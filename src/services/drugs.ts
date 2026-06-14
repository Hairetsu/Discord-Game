import type { ContrabandInventoryRecord, ContrabandMarketRecord, HeistRepository, PlayerRecord } from "../db/repository.js";
import {
  CONTRABAND_BY_ID,
  CONTRABAND_MARKET_TTL_MS,
  CONTRABAND_PRODUCTS,
  type ContrabandDemandBand,
  type ContrabandProduct
} from "../game/constants.js";
import { adjustHeat, decayHeat } from "../game/engagement.js";
import type { RandomSource } from "../game/random.js";

export interface DrugMarketEntry {
  product: ContrabandProduct;
  market: ContrabandMarketRecord;
}

export interface DrugStashEntry {
  product: ContrabandProduct;
  inventory: ContrabandInventoryRecord;
  market?: ContrabandMarketRecord;
  estimatedValue: number;
}

export interface DrugPricesView {
  enabled: boolean;
  expiresAt: number;
  entries: DrugMarketEntry[];
}

export interface DrugStashView {
  enabled: boolean;
  player: PlayerRecord;
  entries: DrugStashEntry[];
  totalEstimatedValue: number;
}

export type DrugBuyResult =
  | {
      ok: true;
      product: ContrabandProduct;
      market: ContrabandMarketRecord;
      inventory: ContrabandInventoryRecord;
      player: PlayerRecord;
      quantity: number;
      totalCost: number;
    }
  | { ok: false; reason: "disabled" | "unknown_product" | "invalid_amount" | "insufficient_wallet"; player?: PlayerRecord };

export type DrugSellResult =
  | {
      ok: true;
      busted: false;
      product: ContrabandProduct;
      market: ContrabandMarketRecord;
      inventory: ContrabandInventoryRecord | null;
      player: PlayerRecord;
      quantity: number;
      payout: number;
      heatGain: number;
    }
  | {
      ok: true;
      busted: true;
      product: ContrabandProduct;
      market: ContrabandMarketRecord;
      inventory: ContrabandInventoryRecord | null;
      player: PlayerRecord;
      quantity: number;
      fine: number;
      confiscated: number;
      confiscatedValue: number;
      heatGain: number;
      publicBust: boolean;
    }
  | { ok: false; reason: "disabled" | "unknown_product" | "invalid_amount" | "missing_stash" | "insufficient_stash"; player?: PlayerRecord };

const DEMAND_BANDS: Array<{
  band: ContrabandDemandBand;
  weight: number;
  buyMultiplier: number;
  sellMultiplier: number;
}> = [
  { band: "cold", weight: 18, buyMultiplier: 0.86, sellMultiplier: 0.74 },
  { band: "steady", weight: 48, buyMultiplier: 1, sellMultiplier: 1 },
  { band: "hot", weight: 26, buyMultiplier: 1.08, sellMultiplier: 1.28 },
  { band: "surge", weight: 8, buyMultiplier: 1.18, sellMultiplier: 1.65 }
];

export class DrugService {
  constructor(
    private readonly repo: HeistRepository,
    private readonly random: RandomSource
  ) {}

  prices(guildId: string, now: number): DrugPricesView {
    return this.repo.transaction(() => {
      const config = this.repo.ensureGuild(guildId, now);
      const entries = this.marketEntries(guildId, config.currentSeasonId, config.drugPriceVolatility, now);
      return {
        enabled: config.drugsEnabled,
        expiresAt: Math.min(...entries.map((entry) => entry.market.expiresAt)),
        entries
      };
    });
  }

  stash(guildId: string, userId: string, now: number): DrugStashView {
    return this.repo.transaction(() => {
      const config = this.repo.ensureGuild(guildId, now);
      const player = this.repo.ensurePlayer(guildId, userId, now);
      const market = new Map(
        this.marketEntries(guildId, player.seasonId, config.drugPriceVolatility, now).map((entry) => [
          entry.product.id,
          entry.market
        ])
      );
      const entries: DrugStashEntry[] = [];
      for (const inventory of this.repo.listContrabandInventory(guildId, userId, player.seasonId)) {
        const product = CONTRABAND_BY_ID.get(inventory.productId);
        if (!product) {
          continue;
        }
        const quote = market.get(product.id);
        entries.push({
          product,
          inventory,
          market: quote,
          estimatedValue: inventory.quantity * (quote?.sellPrice ?? inventory.averageCost)
        });
      }
      return {
        enabled: config.drugsEnabled,
        player,
        entries,
        totalEstimatedValue: entries.reduce((total, entry) => total + entry.estimatedValue, 0)
      };
    });
  }

  buy(guildId: string, userId: string, productId: string, quantity: number, now: number): DrugBuyResult {
    const product = CONTRABAND_BY_ID.get(productId);
    if (!product) {
      return { ok: false, reason: "unknown_product" };
    }
    const units = Math.floor(quantity);
    if (units <= 0) {
      return { ok: false, reason: "invalid_amount" };
    }

    return this.repo.transaction(() => {
      const config = this.repo.ensureGuild(guildId, now);
      const player = this.repo.ensurePlayer(guildId, userId, now);
      if (!config.drugsEnabled) {
        return { ok: false, reason: "disabled", player };
      }

      const market = this.marketForProduct(guildId, player.seasonId, config.drugPriceVolatility, product.id, now);
      const totalCost = market.buyPrice * units;
      if (player.wallet < totalCost) {
        return { ok: false, reason: "insufficient_wallet", player };
      }

      const existing = this.repo.getContrabandInventory(guildId, userId, player.seasonId, product.id);
      const currentQuantity = existing?.quantity ?? 0;
      const currentCost = currentQuantity * (existing?.averageCost ?? market.buyPrice);
      const nextQuantity = currentQuantity + units;
      const inventory: ContrabandInventoryRecord = {
        guildId,
        userId,
        seasonId: player.seasonId,
        productId: product.id,
        quantity: nextQuantity,
        averageCost: Math.floor((currentCost + totalCost) / nextQuantity),
        updatedAt: now
      };

      player.wallet -= totalCost;
      this.repo.savePlayer(player, now);
      this.repo.saveContrabandInventory(inventory, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "drug_buy",
        amount: -totalCost,
        metadata: { productId: product.id, quantity: units, unitPrice: market.buyPrice },
        createdAt: now
      });

      return { ok: true, product, market, inventory, player, quantity: units, totalCost };
    });
  }

  sell(guildId: string, userId: string, productId: string, quantity: number, now: number): DrugSellResult {
    const product = CONTRABAND_BY_ID.get(productId);
    if (!product) {
      return { ok: false, reason: "unknown_product" };
    }
    const units = Math.floor(quantity);
    if (units <= 0) {
      return { ok: false, reason: "invalid_amount" };
    }

    return this.repo.transaction(() => {
      const config = this.repo.ensureGuild(guildId, now);
      const player = this.repo.ensurePlayer(guildId, userId, now);
      if (!config.drugsEnabled) {
        return { ok: false, reason: "disabled", player };
      }

      const inventory = this.repo.getContrabandInventory(guildId, userId, player.seasonId, product.id);
      if (!inventory || inventory.quantity <= 0) {
        return { ok: false, reason: "missing_stash", player };
      }
      if (inventory.quantity < units) {
        return { ok: false, reason: "insufficient_stash", player };
      }

      const market = this.marketForProduct(guildId, player.seasonId, config.drugPriceVolatility, product.id, now);
      const heatGain = saleHeat(product, units);
      const saleValue = market.sellPrice * units;
      const bustChance = saleBustChance(product, units);
      const busted = this.random.chance(bustChance);

      player.heat = adjustHeat(decayHeat(player.heat, player.updatedAt, now), heatGain + (busted ? 5 : 0));
      if (busted) {
        const confiscated = Math.min(inventory.quantity, Math.max(1, Math.ceil(units * product.confiscationPercent)));
        const confiscatedValue = confiscated * market.buyPrice;
        const fine = Math.min(player.wallet, Math.max(25, Math.floor(saleValue * 0.25)));
        player.wallet -= fine;
        inventory.quantity -= confiscated;
        this.repo.savePlayer(player, now);
        this.repo.saveContrabandInventory(inventory, now);
        this.repo.recordTransaction({
          guildId,
          userId,
          seasonId: player.seasonId,
          type: "drug_bust",
          amount: -fine,
          metadata: {
            productId: product.id,
            attemptedQuantity: units,
            confiscated,
            confiscatedValue,
            heatGain,
            bustChance
          },
          createdAt: now
        });
        this.repo.recordTransaction({
          guildId,
          userId,
          seasonId: player.seasonId,
          type: "drug_confiscated",
          amount: -confiscatedValue,
          metadata: { productId: product.id, quantity: confiscated },
          createdAt: now
        });
        return {
          ok: true,
          busted: true,
          product,
          market,
          inventory: inventory.quantity > 0 ? inventory : null,
          player,
          quantity: units,
          fine,
          confiscated,
          confiscatedValue,
          heatGain,
          publicBust: confiscatedValue + fine >= config.publicBustThreshold
        };
      }

      inventory.quantity -= units;
      player.wallet += saleValue;
      player.lifetimeEarned += saleValue;
      this.repo.savePlayer(player, now);
      this.repo.saveContrabandInventory(inventory, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "drug_sale",
        amount: saleValue,
        metadata: { productId: product.id, quantity: units, unitPrice: market.sellPrice, heatGain, bustChance },
        createdAt: now
      });

      return {
        ok: true,
        busted: false,
        product,
        market,
        inventory: inventory.quantity > 0 ? inventory : null,
        player,
        quantity: units,
        payout: saleValue,
        heatGain
      };
    });
  }

  private marketForProduct(
    guildId: string,
    seasonId: number,
    volatility: number,
    productId: string,
    now: number
  ): ContrabandMarketRecord {
    const entry = this.marketEntries(guildId, seasonId, volatility, now).find(
      (candidate) => candidate.product.id === productId
    );
    if (!entry) {
      throw new Error(`Missing contraband market for ${productId}`);
    }
    return entry.market;
  }

  private marketEntries(guildId: string, seasonId: number, volatility: number, now: number): DrugMarketEntry[] {
    const existing = new Map(this.repo.listContrabandMarket(guildId, seasonId).map((market) => [market.productId, market]));
    for (const product of CONTRABAND_PRODUCTS) {
      const current = existing.get(product.id);
      if (current && current.expiresAt > now) {
        continue;
      }
      const next = rollMarket(guildId, seasonId, product, Math.max(0, volatility), this.random, now);
      this.repo.saveContrabandMarket(next, now);
      existing.set(product.id, next);
    }

    return CONTRABAND_PRODUCTS.map((product) => {
      const market = existing.get(product.id);
      if (!market) {
        throw new Error(`Missing contraband market for ${product.id}`);
      }
      return { product, market };
    });
  }
}

function saleHeat(product: ContrabandProduct, quantity: number): number {
  return Math.min(product.maxSaleHeat, product.saleHeatBase + Math.floor(quantity * product.saleHeatPerUnit));
}

function saleBustChance(product: ContrabandProduct, quantity: number): number {
  return Math.min(product.maxBustChance, product.bustChance + quantity * product.bustChancePerUnit);
}

function rollMarket(
  guildId: string,
  seasonId: number,
  product: ContrabandProduct,
  volatility: number,
  random: RandomSource,
  now: number
): ContrabandMarketRecord {
  const band = rollDemandBand(random);
  const buyMultiplier = adjustMultiplier(band.buyMultiplier, volatility);
  const sellMultiplier = adjustMultiplier(band.sellMultiplier, volatility);
  const buyPrice = Math.max(1, Math.round(product.baseBuyPrice * buyMultiplier));
  const sellPrice = Math.max(buyPrice + 1, Math.round(product.baseSellPrice * sellMultiplier));
  return {
    guildId,
    seasonId,
    productId: product.id,
    demandBand: band.band,
    buyPrice,
    sellPrice,
    expiresAt: now + CONTRABAND_MARKET_TTL_MS,
    updatedAt: now
  };
}

function rollDemandBand(random: RandomSource): (typeof DEMAND_BANDS)[number] {
  const total = DEMAND_BANDS.reduce((sum, band) => sum + band.weight, 0);
  let roll = random.int(1, total);
  for (const band of DEMAND_BANDS) {
    roll -= band.weight;
    if (roll <= 0) {
      return band;
    }
  }
  return DEMAND_BANDS[1];
}

function adjustMultiplier(multiplier: number, volatility: number): number {
  return 1 + (multiplier - 1) * volatility;
}
