ALTER TABLE guild_configs ADD COLUMN drugs_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE guild_configs ADD COLUMN cameras_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE guild_configs ADD COLUMN drug_price_volatility REAL NOT NULL DEFAULT 1.0;
ALTER TABLE guild_configs ADD COLUMN public_bust_threshold INTEGER NOT NULL DEFAULT 500;
ALTER TABLE guild_configs ADD COLUMN camera_footage_window_ms INTEGER NOT NULL DEFAULT 86400000;
ALTER TABLE guild_configs ADD COLUMN camera_battery_cost INTEGER NOT NULL DEFAULT 150;
ALTER TABLE guild_configs ADD COLUMN camera_grid_robbery_cost INTEGER NOT NULL DEFAULT 75;
ALTER TABLE guild_configs ADD COLUMN camera_grid_full_cost INTEGER NOT NULL DEFAULT 125;

CREATE TABLE IF NOT EXISTS contraband_inventory (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  average_cost INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, season_id, product_id)
);

CREATE TABLE IF NOT EXISTS contraband_market (
  guild_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  demand_band TEXT NOT NULL,
  buy_price INTEGER NOT NULL,
  sell_price INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, season_id, product_id)
);

CREATE TABLE IF NOT EXISTS camera_systems (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  tier TEXT NOT NULL,
  power_source TEXT NOT NULL DEFAULT 'battery',
  battery_units INTEGER NOT NULL DEFAULT 0,
  battery_expires_at INTEGER NOT NULL DEFAULT 0,
  grid_paid_until INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, season_id)
);

CREATE TABLE IF NOT EXISTS camera_recordings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  attacker_user_id TEXT NOT NULL,
  attack_type TEXT NOT NULL,
  success INTEGER NOT NULL,
  stolen_amount INTEGER NOT NULL,
  insurance_restore INTEGER NOT NULL DEFAULT 0,
  power_source TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contraband_inventory_player
  ON contraband_inventory (guild_id, user_id, season_id);

CREATE INDEX IF NOT EXISTS idx_contraband_market_guild
  ON contraband_market (guild_id, season_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_camera_recordings_owner
  ON camera_recordings (guild_id, user_id, season_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_camera_recordings_expiration
  ON camera_recordings (expires_at);
