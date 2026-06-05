export interface MarketQuote {
  symbol: string;
  priceCents: number;
  changeCents: number;
  changePercent: number;
  volume: number;
  provider: string;
  asOf: string;
  raw: Record<string, unknown>;
}

export interface MarketSymbolMatch {
  symbol: string;
  name: string;
  region: string;
  currency: string;
}

export interface MarketDataProvider {
  quote(symbol: string): Promise<MarketQuote>;
  search(keywords: string): Promise<MarketSymbolMatch[]>;
}

export class MarketDataError extends Error {
  constructor(
    public readonly code: "missing_key" | "not_found" | "rate_limited" | "provider_error" | "invalid_symbol",
    message: string
  ) {
    super(message);
  }
}

type FetchLike = (input: string) => Promise<{ json(): Promise<unknown> }>;

export class AlphaVantageMarketDataProvider implements MarketDataProvider {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetcher: FetchLike = fetch
  ) {}

  async quote(symbol: string): Promise<MarketQuote> {
    const normalized = normalizeMarketSymbol(symbol);
    const data = await this.request({
      function: "GLOBAL_QUOTE",
      symbol: normalized
    });

    const quote = readObject(data, "Global Quote");
    const apiSymbol = readString(quote, "01. symbol") || normalized;
    const price = Number(readString(quote, "05. price"));
    if (!Number.isFinite(price) || price <= 0) {
      throw new MarketDataError("not_found", `No market quote was found for ${normalized}.`);
    }

    const change = Number(readString(quote, "09. change") || 0);
    const changePercent = Number((readString(quote, "10. change percent") || "0").replace("%", ""));
    const volume = Number(readString(quote, "06. volume") || 0);
    const latestTradingDay = readString(quote, "07. latest trading day") || new Date().toISOString();

    return {
      symbol: apiSymbol.toUpperCase(),
      priceCents: Math.round(price * 100),
      changeCents: Math.round(change * 100),
      changePercent: Number.isFinite(changePercent) ? changePercent : 0,
      volume: Number.isFinite(volume) ? volume : 0,
      provider: "alpha_vantage",
      asOf: latestTradingDay,
      raw: quote
    };
  }

  async search(keywords: string): Promise<MarketSymbolMatch[]> {
    const trimmed = keywords.trim();
    if (trimmed.length < 2) {
      throw new MarketDataError("invalid_symbol", "Search terms need at least two characters.");
    }

    const data = await this.request({
      function: "SYMBOL_SEARCH",
      keywords: trimmed
    });

    const matches = Array.isArray(readValue(data, "bestMatches")) ? (readValue(data, "bestMatches") as unknown[]) : [];
    return matches.slice(0, 10).flatMap((match) => {
      if (!isRecord(match)) {
        return [];
      }
      const symbol = readString(match, "1. symbol");
      const name = readString(match, "2. name");
      if (!symbol || !name) {
        return [];
      }
      return [
        {
          symbol: symbol.toUpperCase(),
          name,
          region: readString(match, "4. region") || "Unknown",
          currency: readString(match, "8. currency") || "Unknown"
        }
      ];
    });
  }

  private async request(params: Record<string, string>): Promise<Record<string, unknown>> {
    if (!this.apiKey) {
      throw new MarketDataError("missing_key", "ALPHA_VANTAGE_API_KEY is required for real market data.");
    }

    const url = new URL("https://www.alphavantage.co/query");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("apikey", this.apiKey);

    const data = await this.fetcher(url.toString()).then((response) => response.json());
    if (!isRecord(data)) {
      throw new MarketDataError("provider_error", "The market data provider returned an invalid response.");
    }
    if (typeof data["Error Message"] === "string") {
      throw new MarketDataError("not_found", data["Error Message"]);
    }
    if (typeof data.Note === "string" || typeof data.Information === "string") {
      throw new MarketDataError("rate_limited", String(data.Note ?? data.Information));
    }
    return data;
  }
}

export function normalizeMarketSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(normalized)) {
    throw new MarketDataError("invalid_symbol", "Use a valid ticker symbol like AAPL, MSFT, SPY, or BRK.B.");
  }
  return normalized;
}

function readObject(value: unknown, key: string): Record<string, unknown> {
  const child = readValue(value, key);
  return isRecord(child) ? child : {};
}

function readString(value: unknown, key: string): string | undefined {
  const child = readValue(value, key);
  return typeof child === "string" ? child : undefined;
}

function readValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
