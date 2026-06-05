CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  guild_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  winner_user_id TEXT,
  PRIMARY KEY (guild_id, season_id)
);

CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id TEXT PRIMARY KEY,
  current_season_id INTEGER NOT NULL DEFAULT 1,
  drop_channel_ids TEXT NOT NULL DEFAULT '[]',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  next_drop_at INTEGER,
  last_interest_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  wallet INTEGER NOT NULL DEFAULT 250,
  bank INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 250,
  lifetime_stolen INTEGER NOT NULL DEFAULT 0,
  robbery_shield_until INTEGER NOT NULL,
  rob_cooldown_until INTEGER NOT NULL DEFAULT 0,
  heist_cooldown_until INTEGER NOT NULL DEFAULT 0,
  heist_lockout_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, season_id)
);

CREATE TABLE IF NOT EXISTS inventories (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id, season_id, item_id)
);

CREATE TABLE IF NOT EXISTS loadouts (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  slot TEXT NOT NULL,
  item_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id, season_id, slot)
);

CREATE TABLE IF NOT EXISTS drops (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  amount INTEGER NOT NULL,
  claimed_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  claimed_at INTEGER
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  counterparty_user_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_guild_season_wallet ON players (guild_id, season_id, wallet DESC);
CREATE INDEX IF NOT EXISTS idx_players_guild_season_bank ON players (guild_id, season_id, bank DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions (guild_id, user_id, season_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drops_expiration ON drops (expires_at, claimed_by_user_id);
