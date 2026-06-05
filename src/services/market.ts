import type { CachedStockQuoteRecord, HeistRepository, PlayerRecord, StockHoldingRecord } from "../db/repository.js";
import { MARKET_QUOTE_CACHE_MS, MICROSHARES_PER_SHARE } from "../game/constants.js";
import type { MarketDataProvider, MarketQuote, MarketSymbolMatch } from "./market-data.js";
import { normalizeMarketSymbol } from "./market-data.js";

export interface MarketPositionView {
  holding: StockHoldingRecord;
  quote: MarketQuote;
  shares: number;
  marketValueCents: number;
  costBasisCents: number;
  gainLossCents: number;
}

export interface PortfolioView {
  player: PlayerRecord;
  positions: MarketPositionView[];
  stockValueCents: number;
  costBasisCents: number;
  gainLossCents: number;
}

export type MarketBuyResult =
  | { ok: true; player: PlayerRecord; holding: StockHoldingRecord; quote: MarketQuote; sharesBoughtMicro: number; spentDollars: number }
  | { ok: false; reason: "invalid_amount" | "insufficient_wallet" | "order_too_small"; player?: PlayerRecord; quote?: MarketQuote };

export type MarketSellResult =
  | {
      ok: true;
      player: PlayerRecord;
      holding?: StockHoldingRecord;
      quote: MarketQuote;
      sharesSoldMicro: number;
      receivedDollars: number;
      realizedGainLossCents: number;
    }
  | {
      ok: false;
      reason: "missing_position" | "invalid_shares" | "insufficient_shares" | "order_too_small";
      player: PlayerRecord;
      quote?: MarketQuote;
    };

export interface MarketLeaderboardEntry {
  userId: string;
  stockValueCents: number;
}

export class MarketService {
  constructor(
    private readonly repo: HeistRepository,
    private readonly provider: MarketDataProvider,
    private readonly quoteCacheMs = MARKET_QUOTE_CACHE_MS
  ) {}

  async quote(symbol: string, now: number): Promise<MarketQuote> {
    const normalized = normalizeMarketSymbol(symbol);
    const cached = this.repo.getCachedStockQuote(normalized);
    if (cached && now - cached.fetchedAt <= this.quoteCacheMs) {
      return cachedToQuote(cached);
    }

    const quote = await this.provider.quote(normalized);
    this.repo.saveCachedStockQuote({ ...quote, fetchedAt: now });
    return quote;
  }

  async search(keywords: string): Promise<MarketSymbolMatch[]> {
    return this.provider.search(keywords);
  }

  async buy(guildId: string, userId: string, symbol: string, amountDollars: number, now: number): Promise<MarketBuyResult> {
    const quote = await this.quote(symbol, now);
    return this.repo.transaction(() => {
      const player = this.repo.ensurePlayer(guildId, userId, now);
      const dollars = Math.floor(amountDollars);
      if (dollars <= 0) {
        return { ok: false, reason: "invalid_amount", player, quote };
      }
      if (player.wallet < dollars) {
        return { ok: false, reason: "insufficient_wallet", player, quote };
      }

      const costCents = dollars * 100;
      const sharesBoughtMicro = Math.floor((costCents * MICROSHARES_PER_SHARE) / quote.priceCents);
      if (sharesBoughtMicro <= 0) {
        return { ok: false, reason: "order_too_small", player, quote };
      }

      const existing = this.repo.getStockHolding(guildId, userId, player.seasonId, quote.symbol);
      const holding: StockHoldingRecord = existing ?? {
        guildId,
        userId,
        seasonId: player.seasonId,
        symbol: quote.symbol,
        sharesMicro: 0,
        costBasisCents: 0,
        createdAt: now,
        updatedAt: now
      };

      holding.sharesMicro += sharesBoughtMicro;
      holding.costBasisCents += costCents;
      player.wallet -= dollars;

      this.repo.savePlayer(player, now);
      this.repo.saveStockHolding(holding, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "stock_buy",
        amount: -dollars,
        metadata: {
          symbol: quote.symbol,
          sharesMicro: sharesBoughtMicro,
          priceCents: quote.priceCents,
          provider: quote.provider
        },
        createdAt: now
      });

      return { ok: true, player, holding, quote, sharesBoughtMicro, spentDollars: dollars };
    });
  }

  async sell(
    guildId: string,
    userId: string,
    symbol: string,
    shares: number | undefined,
    sellAll: boolean,
    now: number
  ): Promise<MarketSellResult> {
    const quote = await this.quote(symbol, now);
    return this.repo.transaction(() => {
      const player = this.repo.ensurePlayer(guildId, userId, now);
      const holding = this.repo.getStockHolding(guildId, userId, player.seasonId, quote.symbol);
      if (!holding || holding.sharesMicro <= 0) {
        return { ok: false, reason: "missing_position", player, quote };
      }

      const sharesSoldMicro = sellAll ? holding.sharesMicro : Math.floor((shares ?? 0) * MICROSHARES_PER_SHARE);
      if (sharesSoldMicro <= 0) {
        return { ok: false, reason: "invalid_shares", player, quote };
      }
      if (sharesSoldMicro > holding.sharesMicro) {
        return { ok: false, reason: "insufficient_shares", player, quote };
      }

      const proceedsCents = Math.floor((sharesSoldMicro * quote.priceCents) / MICROSHARES_PER_SHARE);
      const receivedDollars = Math.floor(proceedsCents / 100);
      if (receivedDollars <= 0) {
        return { ok: false, reason: "order_too_small", player, quote };
      }

      const soldCostBasisCents = Math.floor((holding.costBasisCents * sharesSoldMicro) / holding.sharesMicro);
      const realizedGainLossCents = proceedsCents - soldCostBasisCents;
      holding.sharesMicro -= sharesSoldMicro;
      holding.costBasisCents = Math.max(0, holding.costBasisCents - soldCostBasisCents);
      player.wallet += receivedDollars;

      this.repo.savePlayer(player, now);
      this.repo.saveStockHolding(holding, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "stock_sell",
        amount: receivedDollars,
        metadata: {
          symbol: quote.symbol,
          sharesMicro: sharesSoldMicro,
          priceCents: quote.priceCents,
          proceedsCents,
          realizedGainLossCents,
          provider: quote.provider
        },
        createdAt: now
      });

      return {
        ok: true,
        player,
        holding: holding.sharesMicro > 0 ? holding : undefined,
        quote,
        sharesSoldMicro,
        receivedDollars,
        realizedGainLossCents
      };
    });
  }

  async portfolio(guildId: string, userId: string, now: number): Promise<PortfolioView> {
    const player = this.repo.ensurePlayer(guildId, userId, now);
    const holdings = this.repo.listStockHoldings(guildId, userId, player.seasonId);
    const positions = await Promise.all(holdings.map((holding) => this.positionView(holding, now)));
    const stockValueCents = positions.reduce((total, position) => total + position.marketValueCents, 0);
    const costBasisCents = positions.reduce((total, position) => total + position.costBasisCents, 0);
    return {
      player,
      positions,
      stockValueCents,
      costBasisCents,
      gainLossCents: stockValueCents - costBasisCents
    };
  }

  async leaderboard(guildId: string, now: number, limit = 10): Promise<MarketLeaderboardEntry[]> {
    const config = this.repo.ensureGuild(guildId, now);
    const holders = this.repo.listSeasonStockHolders(guildId, config.currentSeasonId);
    const entries = await Promise.all(
      holders.map(async (holder) => {
        const portfolio = await this.portfolio(guildId, holder.userId, now);
        return { userId: holder.userId, stockValueCents: portfolio.stockValueCents };
      })
    );

    return entries
      .filter((entry) => entry.stockValueCents > 0)
      .sort((a, b) => b.stockValueCents - a.stockValueCents)
      .slice(0, limit);
  }

  private async positionView(holding: StockHoldingRecord, now: number): Promise<MarketPositionView> {
    const quote = await this.quote(holding.symbol, now);
    const marketValueCents = Math.floor((holding.sharesMicro * quote.priceCents) / MICROSHARES_PER_SHARE);
    return {
      holding,
      quote,
      shares: holding.sharesMicro / MICROSHARES_PER_SHARE,
      marketValueCents,
      costBasisCents: holding.costBasisCents,
      gainLossCents: marketValueCents - holding.costBasisCents
    };
  }
}

function cachedToQuote(cached: CachedStockQuoteRecord): MarketQuote {
  return {
    symbol: cached.symbol,
    priceCents: cached.priceCents,
    changeCents: cached.changeCents,
    changePercent: cached.changePercent,
    volume: cached.volume,
    provider: cached.provider,
    asOf: cached.asOf,
    raw: cached.raw
  };
}
