import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/database.js";
import { HeistRepository } from "../src/db/repository.js";
import { MICROSHARES_PER_SHARE } from "../src/game/constants.js";
import { MarketService } from "../src/services/market.js";
import { AlphaVantageMarketDataProvider, type MarketDataProvider, type MarketQuote } from "../src/services/market-data.js";

class FakeMarketProvider implements MarketDataProvider {
  calls = 0;
  priceCents = 10_000;

  async quote(symbol: string): Promise<MarketQuote> {
    this.calls += 1;
    return {
      symbol: symbol.toUpperCase(),
      priceCents: this.priceCents,
      changeCents: 125,
      changePercent: 1.25,
      volume: 123456,
      provider: "fake",
      asOf: "2026-01-01",
      raw: {}
    };
  }

  async search() {
    return [{ symbol: "ACME", name: "Acme Markets", region: "United States", currency: "USD" }];
  }
}

function createMarketTestServices(provider = new FakeMarketProvider()) {
  const repo = new HeistRepository(openDatabase(":memory:"));
  return { repo, provider, market: new MarketService(repo, provider, 5 * 60 * 1000) };
}

describe("market service", () => {
  it("caches real quote provider responses", async () => {
    const { provider, market } = createMarketTestServices();

    const first = await market.quote("acme", 1000);
    const second = await market.quote("ACME", 2000);

    expect(first.priceCents).toBe(10_000);
    expect(second.priceCents).toBe(10_000);
    expect(provider.calls).toBe(1);
  });

  it("buys fractional shares with wallet cash and sells shares back to wallet", async () => {
    const { repo, provider, market } = createMarketTestServices();

    const buy = await market.buy("guild", "user", "ACME", 200, 1000);
    expect(buy.ok && buy.player.wallet).toBe(50);
    expect(buy.ok && buy.sharesBoughtMicro).toBe(2 * MICROSHARES_PER_SHARE);

    provider.priceCents = 15_000;
    const sell = await market.sell("guild", "user", "ACME", 1, false, 10 * 60 * 1000);
    expect(sell.ok && sell.receivedDollars).toBe(150);
    expect(sell.ok && sell.realizedGainLossCents).toBe(5_000);
    expect(sell.ok && sell.player.wallet).toBe(200);

    const holding = repo.getStockHolding("guild", "user", 1, "ACME");
    expect(holding?.sharesMicro).toBe(MICROSHARES_PER_SHARE);
    expect(holding?.costBasisCents).toBe(10_000);
  });

  it("builds a portfolio view with open gain or loss", async () => {
    const { provider, market } = createMarketTestServices();

    await market.buy("guild", "user", "ACME", 200, 1000);
    provider.priceCents = 12_500;
    const portfolio = await market.portfolio("guild", "user", 10 * 60 * 1000);

    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.stockValueCents).toBe(25_000);
    expect(portfolio.costBasisCents).toBe(20_000);
    expect(portfolio.gainLossCents).toBe(5_000);
  });
});

describe("alpha vantage market data provider", () => {
  it("parses global quote responses", async () => {
    const provider = new AlphaVantageMarketDataProvider("key", async () => ({
      async json() {
        return {
          "Global Quote": {
            "01. symbol": "IBM",
            "05. price": "123.4500",
            "06. volume": "98765",
            "07. latest trading day": "2026-01-01",
            "09. change": "-1.2300",
            "10. change percent": "-0.9900%"
          }
        };
      }
    }));

    const quote = await provider.quote("ibm");
    expect(quote.symbol).toBe("IBM");
    expect(quote.priceCents).toBe(12_345);
    expect(quote.changeCents).toBe(-123);
    expect(quote.changePercent).toBe(-0.99);
    expect(quote.volume).toBe(98765);
  });
});
