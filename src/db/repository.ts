import type { SqliteDatabase } from "./database.js";
import { STARTING_WALLET, NEW_PLAYER_SHIELD_MS, SECURITY_BY_ID, type SecurityItem } from "../game/constants.js";

export interface GuildConfig {
  guildId: string;
  currentSeasonId: number;
  dropChannelIds: string[];
  timezone: string;
  nextDropAt: number | null;
  lastInterestAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PlayerRecord {
  guildId: string;
  userId: string;
  seasonId: number;
  wallet: number;
  bank: number;
  lifetimeEarned: number;
  lifetimeStolen: number;
  robberyShieldUntil: number;
  robCooldownUntil: number;
  heistCooldownUntil: number;
  heistLockoutUntil: number;
  lastChatRewardAt: number;
  lastEmoteRewardAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface DropRecord {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  amount: number;
  claimedByUserId: string | null;
  createdAt: number;
  expiresAt: number;
  claimedAt: number | null;
}

interface GuildConfigRow {
  guild_id: string;
  current_season_id: number;
  drop_channel_ids: string;
  timezone: string;
  next_drop_at: number | null;
  last_interest_at: number | null;
  created_at: number;
  updated_at: number;
}

interface PlayerRow {
  guild_id: string;
  user_id: string;
  season_id: number;
  wallet: number;
  bank: number;
  lifetime_earned: number;
  lifetime_stolen: number;
  robbery_shield_until: number;
  rob_cooldown_until: number;
  heist_cooldown_until: number;
  heist_lockout_until: number;
  last_chat_reward_at: number;
  last_emote_reward_at: number;
  created_at: number;
  updated_at: number;
}

interface DropRow {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  amount: number;
  claimed_by_user_id: string | null;
  created_at: number;
  expires_at: number;
  claimed_at: number | null;
}

export interface TransactionInput {
  guildId: string;
  userId: string;
  seasonId: number;
  type: string;
  amount: number;
  counterpartyUserId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface LeaderboardEntry {
  userId: string;
  wallet: number;
  bank: number;
  netWorth: number;
  lifetimeStolen: number;
}

function mapGuild(row: GuildConfigRow): GuildConfig {
  return {
    guildId: row.guild_id,
    currentSeasonId: row.current_season_id,
    dropChannelIds: JSON.parse(row.drop_channel_ids) as string[],
    timezone: row.timezone,
    nextDropAt: row.next_drop_at,
    lastInterestAt: row.last_interest_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlayer(row: PlayerRow): PlayerRecord {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    seasonId: row.season_id,
    wallet: row.wallet,
    bank: row.bank,
    lifetimeEarned: row.lifetime_earned,
    lifetimeStolen: row.lifetime_stolen,
    robberyShieldUntil: row.robbery_shield_until,
    robCooldownUntil: row.rob_cooldown_until,
    heistCooldownUntil: row.heist_cooldown_until,
    heistLockoutUntil: row.heist_lockout_until,
    lastChatRewardAt: row.last_chat_reward_at,
    lastEmoteRewardAt: row.last_emote_reward_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDrop(row: DropRow): DropRecord {
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    amount: row.amount,
    claimedByUserId: row.claimed_by_user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at
  };
}

export class HeistRepository {
  constructor(public readonly db: SqliteDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(work)();
  }

  ensureGuild(guildId: string, now: number): GuildConfig {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO guild_configs
          (guild_id, current_season_id, drop_channel_ids, timezone, created_at, updated_at)
         VALUES (?, 1, '[]', 'America/New_York', ?, ?)`
      )
      .run(guildId, now, now);

    this.db
      .prepare(
        `INSERT OR IGNORE INTO seasons (guild_id, season_id, started_at)
         VALUES (?, 1, ?)`
      )
      .run(guildId, now);

    const config = this.getGuildConfig(guildId);
    if (!config) {
      throw new Error(`Failed to initialize guild ${guildId}`);
    }
    return config;
  }

  getGuildConfig(guildId: string): GuildConfig | undefined {
    const row = this.db
      .prepare("SELECT * FROM guild_configs WHERE guild_id = ?")
      .get(guildId) as GuildConfigRow | undefined;
    return row ? mapGuild(row) : undefined;
  }

  listGuildConfigs(): GuildConfig[] {
    return (this.db.prepare("SELECT * FROM guild_configs").all() as GuildConfigRow[]).map(mapGuild);
  }

  setDropChannels(guildId: string, channelIds: string[], now: number): GuildConfig {
    this.db
      .prepare(
        `UPDATE guild_configs
         SET drop_channel_ids = ?, updated_at = ?
         WHERE guild_id = ?`
      )
      .run(JSON.stringify([...new Set(channelIds)]), now, guildId);
    return this.ensureGuild(guildId, now);
  }

  setNextDropAt(guildId: string, nextDropAt: number | null, now: number): void {
    this.db
      .prepare("UPDATE guild_configs SET next_drop_at = ?, updated_at = ? WHERE guild_id = ?")
      .run(nextDropAt, now, guildId);
  }

  setLastInterestAt(guildId: string, lastInterestAt: number, now: number): void {
    this.db
      .prepare("UPDATE guild_configs SET last_interest_at = ?, updated_at = ? WHERE guild_id = ?")
      .run(lastInterestAt, now, guildId);
  }

  startNextSeason(guildId: string, now: number): { seasonId: number; winnerUserId: string | null } {
    return this.transaction(() => {
      const config = this.ensureGuild(guildId, now);
      const winner = this.db
        .prepare(
          `SELECT user_id
           FROM players
           WHERE guild_id = ? AND season_id = ?
           ORDER BY (wallet + bank) DESC, lifetime_stolen DESC
           LIMIT 1`
        )
        .get(guildId, config.currentSeasonId) as { user_id: string } | undefined;

      this.db
        .prepare(
          `UPDATE seasons
           SET ended_at = ?, winner_user_id = ?
           WHERE guild_id = ? AND season_id = ?`
        )
        .run(now, winner?.user_id ?? null, guildId, config.currentSeasonId);

      const nextSeasonId = config.currentSeasonId + 1;
      this.db
        .prepare(
          `INSERT INTO seasons (guild_id, season_id, started_at)
           VALUES (?, ?, ?)`
        )
        .run(guildId, nextSeasonId, now);

      this.db
        .prepare(
          `UPDATE guild_configs
           SET current_season_id = ?, next_drop_at = NULL, last_interest_at = NULL, updated_at = ?
           WHERE guild_id = ?`
        )
        .run(nextSeasonId, now, guildId);

      return { seasonId: nextSeasonId, winnerUserId: winner?.user_id ?? null };
    });
  }

  ensurePlayer(guildId: string, userId: string, now: number): PlayerRecord {
    const config = this.ensureGuild(guildId, now);
    const existing = this.getPlayer(guildId, userId, config.currentSeasonId);
    if (existing) {
      return existing;
    }

    const previous = this.db
      .prepare(
        `SELECT lifetime_earned, lifetime_stolen
         FROM players
         WHERE guild_id = ? AND user_id = ?
         ORDER BY season_id DESC
         LIMIT 1`
      )
      .get(guildId, userId) as
      | { lifetime_earned: number; lifetime_stolen: number }
      | undefined;

    this.db
      .prepare(
        `INSERT INTO players
          (guild_id, user_id, season_id, wallet, bank, lifetime_earned, lifetime_stolen,
           robbery_shield_until, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
      )
      .run(
        guildId,
        userId,
        config.currentSeasonId,
        STARTING_WALLET,
        previous?.lifetime_earned ?? STARTING_WALLET,
        previous?.lifetime_stolen ?? 0,
        now + NEW_PLAYER_SHIELD_MS,
        now,
        now
      );

    this.recordTransaction({
      guildId,
      userId,
      seasonId: config.currentSeasonId,
      type: "season_start",
      amount: STARTING_WALLET,
      metadata: { seasonId: config.currentSeasonId },
      createdAt: now
    });

    const player = this.getPlayer(guildId, userId, config.currentSeasonId);
    if (!player) {
      throw new Error(`Failed to initialize player ${userId}`);
    }
    return player;
  }

  getPlayer(guildId: string, userId: string, seasonId: number): PlayerRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM players WHERE guild_id = ? AND user_id = ? AND season_id = ?")
      .get(guildId, userId, seasonId) as PlayerRow | undefined;
    return row ? mapPlayer(row) : undefined;
  }

  savePlayer(player: PlayerRecord, now: number): void {
    this.db
      .prepare(
        `UPDATE players
         SET wallet = ?, bank = ?, lifetime_earned = ?, lifetime_stolen = ?,
             robbery_shield_until = ?, rob_cooldown_until = ?, heist_cooldown_until = ?,
             heist_lockout_until = ?, last_chat_reward_at = ?, last_emote_reward_at = ?, updated_at = ?
         WHERE guild_id = ? AND user_id = ? AND season_id = ?`
      )
      .run(
        player.wallet,
        player.bank,
        player.lifetimeEarned,
        player.lifetimeStolen,
        player.robberyShieldUntil,
        player.robCooldownUntil,
        player.heistCooldownUntil,
        player.heistLockoutUntil,
        player.lastChatRewardAt,
        player.lastEmoteRewardAt,
        now,
        player.guildId,
        player.userId,
        player.seasonId
      );
  }

  listCurrentSeasonPlayers(guildId: string, seasonId: number): PlayerRecord[] {
    return (
      this.db
        .prepare("SELECT * FROM players WHERE guild_id = ? AND season_id = ?")
        .all(guildId, seasonId) as PlayerRow[]
    ).map(mapPlayer);
  }

  getLeaderboard(guildId: string, seasonId: number, limit: number): LeaderboardEntry[] {
    return (
      this.db
        .prepare(
          `SELECT user_id, wallet, bank, (wallet + bank) AS net_worth, lifetime_stolen
           FROM players
           WHERE guild_id = ? AND season_id = ?
           ORDER BY net_worth DESC, lifetime_stolen DESC
           LIMIT ?`
        )
        .all(guildId, seasonId, limit) as Array<{
        user_id: string;
        wallet: number;
        bank: number;
        net_worth: number;
        lifetime_stolen: number;
      }>
    ).map((row) => ({
      userId: row.user_id,
      wallet: row.wallet,
      bank: row.bank,
      netWorth: row.net_worth,
      lifetimeStolen: row.lifetime_stolen
    }));
  }

  insertDrop(drop: DropRecord): void {
    this.db
      .prepare(
        `INSERT INTO drops
          (id, guild_id, channel_id, message_id, amount, claimed_by_user_id, created_at, expires_at, claimed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        drop.id,
        drop.guildId,
        drop.channelId,
        drop.messageId,
        drop.amount,
        drop.claimedByUserId,
        drop.createdAt,
        drop.expiresAt,
        drop.claimedAt
      );
  }

  setDropMessage(dropId: string, messageId: string): void {
    this.db.prepare("UPDATE drops SET message_id = ? WHERE id = ?").run(messageId, dropId);
  }

  getDrop(dropId: string): DropRecord | undefined {
    const row = this.db.prepare("SELECT * FROM drops WHERE id = ?").get(dropId) as DropRow | undefined;
    return row ? mapDrop(row) : undefined;
  }

  markDropClaimed(dropId: string, userId: string, now: number): boolean {
    const result = this.db
      .prepare(
        `UPDATE drops
         SET claimed_by_user_id = ?, claimed_at = ?
         WHERE id = ? AND claimed_by_user_id IS NULL AND expires_at >= ?`
      )
      .run(userId, now, dropId, now);
    return result.changes === 1;
  }

  recordTransaction(input: TransactionInput): void {
    this.db
      .prepare(
        `INSERT INTO transactions
          (guild_id, user_id, season_id, type, amount, counterparty_user_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.guildId,
        input.userId,
        input.seasonId,
        input.type,
        input.amount,
        input.counterpartyUserId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdAt
      );
  }

  getInventoryQuantity(guildId: string, userId: string, seasonId: number, itemId: string): number {
    const row = this.db
      .prepare(
        `SELECT quantity
         FROM inventories
         WHERE guild_id = ? AND user_id = ? AND season_id = ? AND item_id = ?`
      )
      .get(guildId, userId, seasonId, itemId) as { quantity: number } | undefined;
    return row?.quantity ?? 0;
  }

  addInventoryAndEquip(guildId: string, userId: string, seasonId: number, item: SecurityItem): void {
    this.db
      .prepare(
        `INSERT INTO inventories (guild_id, user_id, season_id, item_id, quantity)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(guild_id, user_id, season_id, item_id)
         DO UPDATE SET quantity = inventories.quantity + 1`
      )
      .run(guildId, userId, seasonId, item.id);

    this.db
      .prepare(
        `INSERT INTO loadouts (guild_id, user_id, season_id, slot, item_id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id, season_id, slot)
         DO UPDATE SET item_id = excluded.item_id`
      )
      .run(guildId, userId, seasonId, item.slot, item.id);
  }

  getLoadoutItems(guildId: string, userId: string, seasonId: number): SecurityItem[] {
    const rows = this.db
      .prepare(
        `SELECT item_id
         FROM loadouts
         WHERE guild_id = ? AND user_id = ? AND season_id = ?`
      )
      .all(guildId, userId, seasonId) as Array<{ item_id: string }>;

    return rows
      .map((row) => SECURITY_BY_ID.get(row.item_id))
      .filter((item): item is SecurityItem => Boolean(item));
  }
}
