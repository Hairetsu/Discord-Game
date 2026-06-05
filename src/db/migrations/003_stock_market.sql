CREATE TABLE IF NOT EXISTS stock_positions (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  shares_micro INTEGER NOT NULL DEFAULT 0,
  cost_basis_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, season_id, symbol)
);

CREATE TABLE IF NOT EXISTS stock_quote_cache (
  symbol TEXT PRIMARY KEY,
  price_cents INTEGER NOT NULL,
  change_cents INTEGER NOT NULL,
  change_percent REAL NOT NULL,
  volume INTEGER NOT NULL,
  provider TEXT NOT NULL,
  as_of TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  raw TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_stock_positions_player ON stock_positions (guild_id, user_id, season_id);
CREATE INDEX IF NOT EXISTS idx_stock_positions_symbol ON stock_positions (guild_id, season_id, symbol);
