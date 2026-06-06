ALTER TABLE players ADD COLUMN heat INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN last_case_at INTEGER NOT NULL DEFAULT 0;

ALTER TABLE guild_configs ADD COLUMN last_gazette_at INTEGER;

ALTER TABLE seasons ADD COLUMN modifier_id TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE seasons ADD COLUMN awards_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE drops ADD COLUMN kind TEXT NOT NULL DEFAULT 'cash_bag';
ALTER TABLE drops ADD COLUMN required_claims INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drops ADD COLUMN heat_delta INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS drop_claims (
  drop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (drop_id, user_id)
);

CREATE TABLE IF NOT EXISTS rivalries (
  guild_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  attacker_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  attacks INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  stolen_total INTEGER NOT NULL DEFAULT 0,
  last_attack_at INTEGER NOT NULL,
  last_success_at INTEGER,
  PRIMARY KEY (guild_id, season_id, attacker_user_id, target_user_id)
);

CREATE TABLE IF NOT EXISTS bounties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  issuer_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  claimed_by_user_id TEXT,
  claimed_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crew_heists (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  leader_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS crew_heist_members (
  crew_heist_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (crew_heist_id, user_id),
  UNIQUE (crew_heist_id, role)
);

CREATE INDEX IF NOT EXISTS idx_drop_claims_drop ON drop_claims (drop_id);
CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties (guild_id, season_id, target_user_id, claimed_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_crew_heists_status ON crew_heists (guild_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_rivalries_pair ON rivalries (guild_id, season_id, attacker_user_id, target_user_id);
