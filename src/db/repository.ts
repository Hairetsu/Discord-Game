import type { SqliteDatabase } from "./database.js";
import {
  STARTING_WALLET,
  NEW_PLAYER_SHIELD_MS,
  SECURITY_BY_ID,
  type CameraAttackType,
  type CameraPowerSource,
  type CameraTier,
  type ContrabandDemandBand,
  type SecurityItem
} from "../game/constants.js";
import type { CrewRole, DropKind, SeasonModifierId } from "../game/engagement.js";

export interface GuildConfig {
  guildId: string;
  currentSeasonId: number;
  dropChannelIds: string[];
  timezone: string;
  nextDropAt: number | null;
  lastInterestAt: number | null;
  lastGazetteAt: number | null;
  drugsEnabled: boolean;
  camerasEnabled: boolean;
  drugPriceVolatility: number;
  publicBustThreshold: number;
  cameraFootageWindowMs: number;
  cameraBatteryCost: number;
  cameraGridRobberyCost: number;
  cameraGridFullCost: number;
  createdAt: number;
  updatedAt: number;
}

export interface SeasonAwards {
  richestUserId?: string;
  bestThiefUserId?: string;
  biggestHeistUserId?: string;
  biggestHeistAmount?: number;
  worstLuckUserId?: string;
  mostWantedUserId?: string;
}

export interface SeasonRecord {
  guildId: string;
  seasonId: number;
  startedAt: number;
  endedAt: number | null;
  winnerUserId: string | null;
  modifierId: SeasonModifierId;
  awards: SeasonAwards;
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
  heat: number;
  lastCaseAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface DropRecord {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  amount: number;
  kind: DropKind;
  requiredClaims: number;
  heatDelta: number;
  claimedByUserId: string | null;
  createdAt: number;
  expiresAt: number;
  claimedAt: number | null;
}

export interface DropClaimRecord {
  dropId: string;
  userId: string;
  claimedAt: number;
}

export interface RivalryRecord {
  guildId: string;
  seasonId: number;
  attackerUserId: string;
  targetUserId: string;
  attacks: number;
  successes: number;
  stolenTotal: number;
  lastAttackAt: number;
  lastSuccessAt: number | null;
}

export interface BountyRecord {
  id: number;
  guildId: string;
  seasonId: number;
  issuerUserId: string;
  targetUserId: string;
  amount: number;
  claimedByUserId: string | null;
  claimedAt: number | null;
  expiresAt: number;
  createdAt: number;
}

export interface CrewHeistRecord {
  id: string;
  guildId: string;
  seasonId: number;
  leaderUserId: string;
  targetUserId: string;
  channelId: string;
  messageId: string | null;
  status: "recruiting" | "resolved" | "expired";
  createdAt: number;
  expiresAt: number;
  resolvedAt: number | null;
}

export interface CrewHeistMemberRecord {
  crewHeistId: string;
  userId: string;
  role: CrewRole;
  joinedAt: number;
}

export interface TransactionRecord {
  id: number;
  guildId: string;
  userId: string;
  seasonId: number;
  type: string;
  amount: number;
  counterpartyUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface ContrabandInventoryRecord {
  guildId: string;
  userId: string;
  seasonId: number;
  productId: string;
  quantity: number;
  averageCost: number;
  updatedAt: number;
}

export interface ContrabandMarketRecord {
  guildId: string;
  seasonId: number;
  productId: string;
  demandBand: ContrabandDemandBand;
  buyPrice: number;
  sellPrice: number;
  expiresAt: number;
  updatedAt: number;
}

export interface CameraSystemRecord {
  guildId: string;
  userId: string;
  seasonId: number;
  tier: CameraTier;
  powerSource: CameraPowerSource;
  batteryUnits: number;
  batteryExpiresAt: number;
  gridPaidUntil: number;
  enabled: boolean;
  updatedAt: number;
}

export interface CameraRecordingRecord {
  id: number;
  guildId: string;
  userId: string;
  seasonId: number;
  attackerUserId: string;
  attackType: CameraAttackType;
  success: boolean;
  stolenAmount: number;
  insuranceRestore: number;
  powerSource: CameraPowerSource;
  recordedAt: number;
  expiresAt: number;
}

interface GuildConfigRow {
  guild_id: string;
  current_season_id: number;
  drop_channel_ids: string;
  timezone: string;
  next_drop_at: number | null;
  last_interest_at: number | null;
  last_gazette_at: number | null;
  drugs_enabled: number;
  cameras_enabled: number;
  drug_price_volatility: number;
  public_bust_threshold: number;
  camera_footage_window_ms: number;
  camera_battery_cost: number;
  camera_grid_robbery_cost: number;
  camera_grid_full_cost: number;
  created_at: number;
  updated_at: number;
}

interface SeasonRow {
  guild_id: string;
  season_id: number;
  started_at: number;
  ended_at: number | null;
  winner_user_id: string | null;
  modifier_id: SeasonModifierId;
  awards_json: string;
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
  heat: number;
  last_case_at: number;
  created_at: number;
  updated_at: number;
}

interface DropRow {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  amount: number;
  kind: DropKind;
  required_claims: number;
  heat_delta: number;
  claimed_by_user_id: string | null;
  created_at: number;
  expires_at: number;
  claimed_at: number | null;
}

interface DropClaimRow {
  drop_id: string;
  user_id: string;
  claimed_at: number;
}

interface RivalryRow {
  guild_id: string;
  season_id: number;
  attacker_user_id: string;
  target_user_id: string;
  attacks: number;
  successes: number;
  stolen_total: number;
  last_attack_at: number;
  last_success_at: number | null;
}

interface BountyRow {
  id: number;
  guild_id: string;
  season_id: number;
  issuer_user_id: string;
  target_user_id: string;
  amount: number;
  claimed_by_user_id: string | null;
  claimed_at: number | null;
  expires_at: number;
  created_at: number;
}

interface CrewHeistRow {
  id: string;
  guild_id: string;
  season_id: number;
  leader_user_id: string;
  target_user_id: string;
  channel_id: string;
  message_id: string | null;
  status: "recruiting" | "resolved" | "expired";
  created_at: number;
  expires_at: number;
  resolved_at: number | null;
}

interface CrewHeistMemberRow {
  crew_heist_id: string;
  user_id: string;
  role: CrewRole;
  joined_at: number;
}

interface TransactionRow {
  id: number;
  guild_id: string;
  user_id: string;
  season_id: number;
  type: string;
  amount: number;
  counterparty_user_id: string | null;
  metadata: string;
  created_at: number;
}

interface ContrabandInventoryRow {
  guild_id: string;
  user_id: string;
  season_id: number;
  product_id: string;
  quantity: number;
  average_cost: number;
  updated_at: number;
}

interface ContrabandMarketRow {
  guild_id: string;
  season_id: number;
  product_id: string;
  demand_band: ContrabandDemandBand;
  buy_price: number;
  sell_price: number;
  expires_at: number;
  updated_at: number;
}

interface CameraSystemRow {
  guild_id: string;
  user_id: string;
  season_id: number;
  tier: CameraTier;
  power_source: CameraPowerSource;
  battery_units: number;
  battery_expires_at: number;
  grid_paid_until: number;
  enabled: number;
  updated_at: number;
}

interface CameraRecordingRow {
  id: number;
  guild_id: string;
  user_id: string;
  season_id: number;
  attacker_user_id: string;
  attack_type: CameraAttackType;
  success: number;
  stolen_amount: number;
  insurance_restore: number;
  power_source: CameraPowerSource;
  recorded_at: number;
  expires_at: number;
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
  heat: number;
}

export interface StockHoldingRecord {
  guildId: string;
  userId: string;
  seasonId: number;
  symbol: string;
  sharesMicro: number;
  costBasisCents: number;
  createdAt: number;
  updatedAt: number;
}

export interface CachedStockQuoteRecord {
  symbol: string;
  priceCents: number;
  changeCents: number;
  changePercent: number;
  volume: number;
  provider: string;
  asOf: string;
  fetchedAt: number;
  raw: Record<string, unknown>;
}

interface StockHoldingRow {
  guild_id: string;
  user_id: string;
  season_id: number;
  symbol: string;
  shares_micro: number;
  cost_basis_cents: number;
  created_at: number;
  updated_at: number;
}

interface CachedStockQuoteRow {
  symbol: string;
  price_cents: number;
  change_cents: number;
  change_percent: number;
  volume: number;
  provider: string;
  as_of: string;
  fetched_at: number;
  raw: string;
}

function mapGuild(row: GuildConfigRow): GuildConfig {
  return {
    guildId: row.guild_id,
    currentSeasonId: row.current_season_id,
    dropChannelIds: JSON.parse(row.drop_channel_ids) as string[],
    timezone: row.timezone,
    nextDropAt: row.next_drop_at,
    lastInterestAt: row.last_interest_at,
    lastGazetteAt: row.last_gazette_at,
    drugsEnabled: row.drugs_enabled === 1,
    camerasEnabled: row.cameras_enabled === 1,
    drugPriceVolatility: row.drug_price_volatility,
    publicBustThreshold: row.public_bust_threshold,
    cameraFootageWindowMs: row.camera_footage_window_ms,
    cameraBatteryCost: row.camera_battery_cost,
    cameraGridRobberyCost: row.camera_grid_robbery_cost,
    cameraGridFullCost: row.camera_grid_full_cost,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSeason(row: SeasonRow): SeasonRecord {
  return {
    guildId: row.guild_id,
    seasonId: row.season_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    winnerUserId: row.winner_user_id,
    modifierId: row.modifier_id,
    awards: JSON.parse(row.awards_json) as SeasonAwards
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
    heat: row.heat,
    lastCaseAt: row.last_case_at,
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
    kind: row.kind,
    requiredClaims: row.required_claims,
    heatDelta: row.heat_delta,
    claimedByUserId: row.claimed_by_user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at
  };
}

function mapDropClaim(row: DropClaimRow): DropClaimRecord {
  return {
    dropId: row.drop_id,
    userId: row.user_id,
    claimedAt: row.claimed_at
  };
}

function mapRivalry(row: RivalryRow): RivalryRecord {
  return {
    guildId: row.guild_id,
    seasonId: row.season_id,
    attackerUserId: row.attacker_user_id,
    targetUserId: row.target_user_id,
    attacks: row.attacks,
    successes: row.successes,
    stolenTotal: row.stolen_total,
    lastAttackAt: row.last_attack_at,
    lastSuccessAt: row.last_success_at
  };
}

function mapBounty(row: BountyRow): BountyRecord {
  return {
    id: row.id,
    guildId: row.guild_id,
    seasonId: row.season_id,
    issuerUserId: row.issuer_user_id,
    targetUserId: row.target_user_id,
    amount: row.amount,
    claimedByUserId: row.claimed_by_user_id,
    claimedAt: row.claimed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

function mapCrewHeist(row: CrewHeistRow): CrewHeistRecord {
  return {
    id: row.id,
    guildId: row.guild_id,
    seasonId: row.season_id,
    leaderUserId: row.leader_user_id,
    targetUserId: row.target_user_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    resolvedAt: row.resolved_at
  };
}

function mapCrewHeistMember(row: CrewHeistMemberRow): CrewHeistMemberRecord {
  return {
    crewHeistId: row.crew_heist_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at
  };
}

function mapTransaction(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    seasonId: row.season_id,
    type: row.type,
    amount: row.amount,
    counterpartyUserId: row.counterparty_user_id,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at
  };
}

function mapContrabandInventory(row: ContrabandInventoryRow): ContrabandInventoryRecord {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    seasonId: row.season_id,
    productId: row.product_id,
    quantity: row.quantity,
    averageCost: row.average_cost,
    updatedAt: row.updated_at
  };
}

function mapContrabandMarket(row: ContrabandMarketRow): ContrabandMarketRecord {
  return {
    guildId: row.guild_id,
    seasonId: row.season_id,
    productId: row.product_id,
    demandBand: row.demand_band,
    buyPrice: row.buy_price,
    sellPrice: row.sell_price,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at
  };
}

function mapCameraSystem(row: CameraSystemRow): CameraSystemRecord {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    seasonId: row.season_id,
    tier: row.tier,
    powerSource: row.power_source,
    batteryUnits: row.battery_units,
    batteryExpiresAt: row.battery_expires_at,
    gridPaidUntil: row.grid_paid_until,
    enabled: row.enabled === 1,
    updatedAt: row.updated_at
  };
}

function mapCameraRecording(row: CameraRecordingRow): CameraRecordingRecord {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    seasonId: row.season_id,
    attackerUserId: row.attacker_user_id,
    attackType: row.attack_type,
    success: row.success === 1,
    stolenAmount: row.stolen_amount,
    insuranceRestore: row.insurance_restore,
    powerSource: row.power_source,
    recordedAt: row.recorded_at,
    expiresAt: row.expires_at
  };
}

function mapStockHolding(row: StockHoldingRow): StockHoldingRecord {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    seasonId: row.season_id,
    symbol: row.symbol,
    sharesMicro: row.shares_micro,
    costBasisCents: row.cost_basis_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCachedStockQuote(row: CachedStockQuoteRow): CachedStockQuoteRecord {
  return {
    symbol: row.symbol,
    priceCents: row.price_cents,
    changeCents: row.change_cents,
    changePercent: row.change_percent,
    volume: row.volume,
    provider: row.provider,
    asOf: row.as_of,
    fetchedAt: row.fetched_at,
    raw: JSON.parse(row.raw) as Record<string, unknown>
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

  getSeason(guildId: string, seasonId: number): SeasonRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM seasons WHERE guild_id = ? AND season_id = ?")
      .get(guildId, seasonId) as SeasonRow | undefined;
    return row ? mapSeason(row) : undefined;
  }

  getCurrentSeason(guildId: string, now: number): SeasonRecord {
    const config = this.ensureGuild(guildId, now);
    const season = this.getSeason(guildId, config.currentSeasonId);
    if (!season) {
      throw new Error(`Missing current season ${config.currentSeasonId} for guild ${guildId}`);
    }
    return season;
  }

  listSeasons(guildId: string, limit = 5): SeasonRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM seasons
           WHERE guild_id = ?
           ORDER BY season_id DESC
           LIMIT ?`
        )
        .all(guildId, limit) as SeasonRow[]
    ).map(mapSeason);
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

  setLastGazetteAt(guildId: string, lastGazetteAt: number, now: number): void {
    this.db
      .prepare("UPDATE guild_configs SET last_gazette_at = ?, updated_at = ? WHERE guild_id = ?")
      .run(lastGazetteAt, now, guildId);
  }

  updateGuildSettings(
    guildId: string,
    settings: Partial<
      Pick<
        GuildConfig,
        | "drugsEnabled"
        | "camerasEnabled"
        | "drugPriceVolatility"
        | "publicBustThreshold"
        | "cameraFootageWindowMs"
        | "cameraBatteryCost"
        | "cameraGridRobberyCost"
        | "cameraGridFullCost"
      >
    >,
    now: number
  ): GuildConfig {
    this.ensureGuild(guildId, now);
    const updates: string[] = [];
    const values: Array<number> = [];
    const setNumber = (column: string, value: number | undefined) => {
      if (value === undefined) {
        return;
      }
      updates.push(`${column} = ?`);
      values.push(value);
    };

    setNumber("drugs_enabled", settings.drugsEnabled === undefined ? undefined : settings.drugsEnabled ? 1 : 0);
    setNumber("cameras_enabled", settings.camerasEnabled === undefined ? undefined : settings.camerasEnabled ? 1 : 0);
    setNumber("drug_price_volatility", settings.drugPriceVolatility);
    setNumber("public_bust_threshold", settings.publicBustThreshold);
    setNumber("camera_footage_window_ms", settings.cameraFootageWindowMs);
    setNumber("camera_battery_cost", settings.cameraBatteryCost);
    setNumber("camera_grid_robbery_cost", settings.cameraGridRobberyCost);
    setNumber("camera_grid_full_cost", settings.cameraGridFullCost);

    if (updates.length > 0) {
      this.db
        .prepare(`UPDATE guild_configs SET ${updates.join(", ")}, updated_at = ? WHERE guild_id = ?`)
        .run(...values, now, guildId);
    }

    return this.ensureGuild(guildId, now);
  }

  startNextSeason(
    guildId: string,
    now: number,
    modifierId: SeasonModifierId = "standard"
  ): { seasonId: number; winnerUserId: string | null; awards: SeasonAwards; modifierId: SeasonModifierId } {
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
      const awards = this.buildSeasonAwards(guildId, config.currentSeasonId);

      this.db
        .prepare(
          `UPDATE seasons
           SET ended_at = ?, winner_user_id = ?, awards_json = ?
           WHERE guild_id = ? AND season_id = ?`
        )
        .run(now, winner?.user_id ?? null, JSON.stringify(awards), guildId, config.currentSeasonId);

      const nextSeasonId = config.currentSeasonId + 1;
      this.db
        .prepare(
          `INSERT INTO seasons (guild_id, season_id, started_at, modifier_id)
           VALUES (?, ?, ?, ?)`
        )
        .run(guildId, nextSeasonId, now, modifierId);

      this.db
        .prepare(
          `UPDATE guild_configs
           SET current_season_id = ?, next_drop_at = NULL, last_interest_at = NULL, updated_at = ?
           WHERE guild_id = ?`
        )
        .run(nextSeasonId, now, guildId);

      return { seasonId: nextSeasonId, winnerUserId: winner?.user_id ?? null, awards, modifierId };
    });
  }

  private buildSeasonAwards(guildId: string, seasonId: number): SeasonAwards {
    const richest = this.getLeaderboard(guildId, seasonId, 1)[0];
    const bestThief = this.db
      .prepare(
        `SELECT user_id, SUM(amount) AS total
         FROM transactions
         WHERE guild_id = ? AND season_id = ? AND type IN ('rob_success', 'heist_success')
         GROUP BY user_id
         ORDER BY total DESC
         LIMIT 1`
      )
      .get(guildId, seasonId) as { user_id: string; total: number } | undefined;
    const biggestHeist = this.db
      .prepare(
        `SELECT user_id, amount
         FROM transactions
         WHERE guild_id = ? AND season_id = ? AND type = 'heist_success'
         ORDER BY amount DESC
         LIMIT 1`
      )
      .get(guildId, seasonId) as { user_id: string; amount: number } | undefined;
    const worstLuck = this.db
      .prepare(
        `SELECT user_id, COUNT(*) AS failures
         FROM transactions
         WHERE guild_id = ? AND season_id = ? AND type IN ('rob_failure', 'heist_failure', 'crew_heist_failure')
         GROUP BY user_id
         ORDER BY failures DESC
         LIMIT 1`
      )
      .get(guildId, seasonId) as { user_id: string; failures: number } | undefined;
    const mostWanted = this.db
      .prepare(
        `SELECT user_id, heat
         FROM players
         WHERE guild_id = ? AND season_id = ?
         ORDER BY heat DESC
         LIMIT 1`
      )
      .get(guildId, seasonId) as { user_id: string; heat: number } | undefined;

    return {
      richestUserId: richest?.userId,
      bestThiefUserId: bestThief?.user_id,
      biggestHeistUserId: biggestHeist?.user_id,
      biggestHeistAmount: biggestHeist?.amount,
      worstLuckUserId: worstLuck?.user_id,
      mostWantedUserId: mostWanted && mostWanted.heat > 0 ? mostWanted.user_id : undefined
    };
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
             heist_lockout_until = ?, last_chat_reward_at = ?, last_emote_reward_at = ?,
             heat = ?, last_case_at = ?, updated_at = ?
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
        player.heat,
        player.lastCaseAt,
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
          `SELECT user_id, wallet, bank, (wallet + bank) AS net_worth, lifetime_stolen, heat
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
        heat: number;
      }>
    ).map((row) => ({
      userId: row.user_id,
      wallet: row.wallet,
      bank: row.bank,
      netWorth: row.net_worth,
      lifetimeStolen: row.lifetime_stolen,
      heat: row.heat
    }));
  }

  insertDrop(drop: DropRecord): void {
    this.db
      .prepare(
        `INSERT INTO drops
          (id, guild_id, channel_id, message_id, amount, kind, required_claims, heat_delta,
           claimed_by_user_id, created_at, expires_at, claimed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        drop.id,
        drop.guildId,
        drop.channelId,
        drop.messageId,
        drop.amount,
        drop.kind,
        drop.requiredClaims,
        drop.heatDelta,
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

  addDropClaim(dropId: string, userId: string, now: number): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO drop_claims (drop_id, user_id, claimed_at)
         VALUES (?, ?, ?)`
      )
      .run(dropId, userId, now);
    return result.changes === 1;
  }

  listDropClaims(dropId: string): DropClaimRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM drop_claims
           WHERE drop_id = ?
           ORDER BY claimed_at ASC`
        )
        .all(dropId) as DropClaimRow[]
    ).map(mapDropClaim);
  }

  recordRivalryAttack(
    guildId: string,
    seasonId: number,
    attackerUserId: string,
    targetUserId: string,
    success: boolean,
    stolen: number,
    now: number
  ): RivalryRecord {
    this.db
      .prepare(
        `INSERT INTO rivalries
          (guild_id, season_id, attacker_user_id, target_user_id, attacks, successes,
           stolen_total, last_attack_at, last_success_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
         ON CONFLICT(guild_id, season_id, attacker_user_id, target_user_id)
         DO UPDATE SET
           attacks = rivalries.attacks + 1,
           successes = rivalries.successes + excluded.successes,
           stolen_total = rivalries.stolen_total + excluded.stolen_total,
           last_attack_at = excluded.last_attack_at,
           last_success_at = COALESCE(excluded.last_success_at, rivalries.last_success_at)`
      )
      .run(guildId, seasonId, attackerUserId, targetUserId, success ? 1 : 0, stolen, now, success ? now : null);

    const record = this.getRivalry(guildId, seasonId, attackerUserId, targetUserId);
    if (!record) {
      throw new Error("Failed to record rivalry");
    }
    return record;
  }

  getRivalry(
    guildId: string,
    seasonId: number,
    attackerUserId: string,
    targetUserId: string
  ): RivalryRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT *
         FROM rivalries
         WHERE guild_id = ? AND season_id = ? AND attacker_user_id = ? AND target_user_id = ?`
      )
      .get(guildId, seasonId, attackerUserId, targetUserId) as RivalryRow | undefined;
    return row ? mapRivalry(row) : undefined;
  }

  createBounty(
    guildId: string,
    seasonId: number,
    issuerUserId: string,
    targetUserId: string,
    amount: number,
    expiresAt: number,
    now: number
  ): BountyRecord {
    const result = this.db
      .prepare(
        `INSERT INTO bounties
          (guild_id, season_id, issuer_user_id, target_user_id, amount, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(guildId, seasonId, issuerUserId, targetUserId, amount, expiresAt, now);
    const bounty = this.getBounty(Number(result.lastInsertRowid));
    if (!bounty) {
      throw new Error("Failed to create bounty");
    }
    return bounty;
  }

  getBounty(id: number): BountyRecord | undefined {
    const row = this.db.prepare("SELECT * FROM bounties WHERE id = ?").get(id) as BountyRow | undefined;
    return row ? mapBounty(row) : undefined;
  }

  listActiveBounties(guildId: string, seasonId: number, now: number, limit = 10): BountyRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM bounties
           WHERE guild_id = ? AND season_id = ? AND claimed_at IS NULL AND expires_at >= ?
           ORDER BY amount DESC, created_at ASC
           LIMIT ?`
        )
        .all(guildId, seasonId, now, limit) as BountyRow[]
    ).map(mapBounty);
  }

  claimActiveBountiesForTarget(
    guildId: string,
    seasonId: number,
    targetUserId: string,
    claimantUserId: string,
    now: number
  ): BountyRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM bounties
         WHERE guild_id = ? AND season_id = ? AND target_user_id = ?
           AND claimed_at IS NULL AND expires_at >= ? AND issuer_user_id != ?
         ORDER BY amount DESC, created_at ASC`
      )
      .all(guildId, seasonId, targetUserId, now, claimantUserId) as BountyRow[];

    const claimed: BountyRecord[] = [];
    for (const row of rows) {
      const result = this.db
        .prepare(
          `UPDATE bounties
           SET claimed_by_user_id = ?, claimed_at = ?
           WHERE id = ? AND claimed_at IS NULL`
        )
        .run(claimantUserId, now, row.id);
      if (result.changes === 1) {
        claimed.push(mapBounty({ ...row, claimed_by_user_id: claimantUserId, claimed_at: now }));
      }
    }
    return claimed;
  }

  insertCrewHeist(heist: CrewHeistRecord): void {
    this.db
      .prepare(
        `INSERT INTO crew_heists
          (id, guild_id, season_id, leader_user_id, target_user_id, channel_id, message_id,
           status, created_at, expires_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        heist.id,
        heist.guildId,
        heist.seasonId,
        heist.leaderUserId,
        heist.targetUserId,
        heist.channelId,
        heist.messageId,
        heist.status,
        heist.createdAt,
        heist.expiresAt,
        heist.resolvedAt
      );
  }

  setCrewHeistMessage(heistId: string, messageId: string): void {
    this.db.prepare("UPDATE crew_heists SET message_id = ? WHERE id = ?").run(messageId, heistId);
  }

  getCrewHeist(heistId: string): CrewHeistRecord | undefined {
    const row = this.db.prepare("SELECT * FROM crew_heists WHERE id = ?").get(heistId) as CrewHeistRow | undefined;
    return row ? mapCrewHeist(row) : undefined;
  }

  updateCrewHeistStatus(heistId: string, status: CrewHeistRecord["status"], resolvedAt: number | null): void {
    this.db
      .prepare("UPDATE crew_heists SET status = ?, resolved_at = ? WHERE id = ?")
      .run(status, resolvedAt, heistId);
  }

  addCrewHeistMember(heistId: string, userId: string, role: CrewRole, now: number): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO crew_heist_members (crew_heist_id, user_id, role, joined_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(heistId, userId, role, now);
    return result.changes === 1;
  }

  listCrewHeistMembers(heistId: string): CrewHeistMemberRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM crew_heist_members
           WHERE crew_heist_id = ?
           ORDER BY joined_at ASC`
        )
        .all(heistId) as CrewHeistMemberRow[]
    ).map(mapCrewHeistMember);
  }

  listTransactionsSince(guildId: string, seasonId: number, since: number, limit = 50): TransactionRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM transactions
           WHERE guild_id = ? AND season_id = ? AND created_at >= ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(guildId, seasonId, since, limit) as TransactionRow[]
    ).map(mapTransaction);
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

  getContrabandInventory(
    guildId: string,
    userId: string,
    seasonId: number,
    productId: string
  ): ContrabandInventoryRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT *
         FROM contraband_inventory
         WHERE guild_id = ? AND user_id = ? AND season_id = ? AND product_id = ?`
      )
      .get(guildId, userId, seasonId, productId) as ContrabandInventoryRow | undefined;
    return row ? mapContrabandInventory(row) : undefined;
  }

  listContrabandInventory(guildId: string, userId: string, seasonId: number): ContrabandInventoryRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM contraband_inventory
           WHERE guild_id = ? AND user_id = ? AND season_id = ? AND quantity > 0
           ORDER BY product_id ASC`
        )
        .all(guildId, userId, seasonId) as ContrabandInventoryRow[]
    ).map(mapContrabandInventory);
  }

  saveContrabandInventory(record: ContrabandInventoryRecord, now: number): void {
    if (record.quantity <= 0) {
      this.db
        .prepare(
          `DELETE FROM contraband_inventory
           WHERE guild_id = ? AND user_id = ? AND season_id = ? AND product_id = ?`
        )
        .run(record.guildId, record.userId, record.seasonId, record.productId);
      return;
    }

    this.db
      .prepare(
        `INSERT INTO contraband_inventory
          (guild_id, user_id, season_id, product_id, quantity, average_cost, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id, season_id, product_id)
         DO UPDATE SET
           quantity = excluded.quantity,
           average_cost = excluded.average_cost,
           updated_at = excluded.updated_at`
      )
      .run(
        record.guildId,
        record.userId,
        record.seasonId,
        record.productId,
        record.quantity,
        record.averageCost,
        now
      );
  }

  getContrabandMarket(guildId: string, seasonId: number, productId: string): ContrabandMarketRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT *
         FROM contraband_market
         WHERE guild_id = ? AND season_id = ? AND product_id = ?`
      )
      .get(guildId, seasonId, productId) as ContrabandMarketRow | undefined;
    return row ? mapContrabandMarket(row) : undefined;
  }

  listContrabandMarket(guildId: string, seasonId: number): ContrabandMarketRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM contraband_market
           WHERE guild_id = ? AND season_id = ?
           ORDER BY product_id ASC`
        )
        .all(guildId, seasonId) as ContrabandMarketRow[]
    ).map(mapContrabandMarket);
  }

  saveContrabandMarket(record: ContrabandMarketRecord, now: number): void {
    this.db
      .prepare(
        `INSERT INTO contraband_market
          (guild_id, season_id, product_id, demand_band, buy_price, sell_price, expires_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, season_id, product_id)
         DO UPDATE SET
           demand_band = excluded.demand_band,
           buy_price = excluded.buy_price,
           sell_price = excluded.sell_price,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`
      )
      .run(
        record.guildId,
        record.seasonId,
        record.productId,
        record.demandBand,
        record.buyPrice,
        record.sellPrice,
        record.expiresAt,
        now
      );
  }

  getCameraSystem(guildId: string, userId: string, seasonId: number): CameraSystemRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT *
         FROM camera_systems
         WHERE guild_id = ? AND user_id = ? AND season_id = ?`
      )
      .get(guildId, userId, seasonId) as CameraSystemRow | undefined;
    return row ? mapCameraSystem(row) : undefined;
  }

  upsertCameraSystem(guildId: string, userId: string, seasonId: number, tier: CameraTier, now: number): CameraSystemRecord {
    this.db
      .prepare(
        `INSERT INTO camera_systems
          (guild_id, user_id, season_id, tier, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id, season_id)
         DO UPDATE SET tier = excluded.tier, enabled = 1, updated_at = excluded.updated_at`
      )
      .run(guildId, userId, seasonId, tier, now);

    const system = this.getCameraSystem(guildId, userId, seasonId);
    if (!system) {
      throw new Error("Failed to save camera system");
    }
    return system;
  }

  saveCameraSystem(system: CameraSystemRecord, now: number): void {
    this.db
      .prepare(
        `INSERT INTO camera_systems
          (guild_id, user_id, season_id, tier, power_source, battery_units, battery_expires_at,
           grid_paid_until, enabled, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id, season_id)
         DO UPDATE SET
           tier = excluded.tier,
           power_source = excluded.power_source,
           battery_units = excluded.battery_units,
           battery_expires_at = excluded.battery_expires_at,
           grid_paid_until = excluded.grid_paid_until,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`
      )
      .run(
        system.guildId,
        system.userId,
        system.seasonId,
        system.tier,
        system.powerSource,
        system.batteryUnits,
        system.batteryExpiresAt,
        system.gridPaidUntil,
        system.enabled ? 1 : 0,
        now
      );
  }

  insertCameraRecording(input: Omit<CameraRecordingRecord, "id">): CameraRecordingRecord {
    const result = this.db
      .prepare(
        `INSERT INTO camera_recordings
          (guild_id, user_id, season_id, attacker_user_id, attack_type, success, stolen_amount,
           insurance_restore, power_source, recorded_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.guildId,
        input.userId,
        input.seasonId,
        input.attackerUserId,
        input.attackType,
        input.success ? 1 : 0,
        input.stolenAmount,
        input.insuranceRestore,
        input.powerSource,
        input.recordedAt,
        input.expiresAt
      );
    const row = this.db
      .prepare("SELECT * FROM camera_recordings WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as CameraRecordingRow | undefined;
    if (!row) {
      throw new Error("Failed to insert camera recording");
    }
    return mapCameraRecording(row);
  }

  listCameraRecordings(guildId: string, userId: string, seasonId: number, now: number, limit = 25): CameraRecordingRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM camera_recordings
           WHERE guild_id = ? AND user_id = ? AND season_id = ? AND expires_at > ?
           ORDER BY recorded_at DESC
           LIMIT ?`
        )
        .all(guildId, userId, seasonId, now, limit) as CameraRecordingRow[]
    ).map(mapCameraRecording);
  }

  getStockHolding(guildId: string, userId: string, seasonId: number, symbol: string): StockHoldingRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT *
         FROM stock_positions
         WHERE guild_id = ? AND user_id = ? AND season_id = ? AND symbol = ?`
      )
      .get(guildId, userId, seasonId, symbol.toUpperCase()) as StockHoldingRow | undefined;
    return row ? mapStockHolding(row) : undefined;
  }

  listStockHoldings(guildId: string, userId: string, seasonId: number): StockHoldingRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM stock_positions
           WHERE guild_id = ? AND user_id = ? AND season_id = ? AND shares_micro > 0
           ORDER BY symbol ASC`
        )
        .all(guildId, userId, seasonId) as StockHoldingRow[]
    ).map(mapStockHolding);
  }

  listSeasonStockHolders(guildId: string, seasonId: number): Array<{ userId: string; symbols: string[] }> {
    const rows = this.db
      .prepare(
        `SELECT user_id, symbol
         FROM stock_positions
         WHERE guild_id = ? AND season_id = ? AND shares_micro > 0
         ORDER BY user_id ASC, symbol ASC`
      )
      .all(guildId, seasonId) as Array<{ user_id: string; symbol: string }>;

    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      grouped.set(row.user_id, [...(grouped.get(row.user_id) ?? []), row.symbol]);
    }
    return [...grouped.entries()].map(([userId, symbols]) => ({ userId, symbols }));
  }

  saveStockHolding(holding: StockHoldingRecord, now: number): void {
    if (holding.sharesMicro <= 0) {
      this.db
        .prepare(
          `DELETE FROM stock_positions
           WHERE guild_id = ? AND user_id = ? AND season_id = ? AND symbol = ?`
        )
        .run(holding.guildId, holding.userId, holding.seasonId, holding.symbol);
      return;
    }

    this.db
      .prepare(
        `INSERT INTO stock_positions
          (guild_id, user_id, season_id, symbol, shares_micro, cost_basis_cents, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id, season_id, symbol)
         DO UPDATE SET
           shares_micro = excluded.shares_micro,
           cost_basis_cents = excluded.cost_basis_cents,
           updated_at = excluded.updated_at`
      )
      .run(
        holding.guildId,
        holding.userId,
        holding.seasonId,
        holding.symbol.toUpperCase(),
        holding.sharesMicro,
        holding.costBasisCents,
        holding.createdAt,
        now
      );
  }

  getCachedStockQuote(symbol: string): CachedStockQuoteRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM stock_quote_cache WHERE symbol = ?")
      .get(symbol.toUpperCase()) as CachedStockQuoteRow | undefined;
    return row ? mapCachedStockQuote(row) : undefined;
  }

  saveCachedStockQuote(quote: CachedStockQuoteRecord): void {
    this.db
      .prepare(
        `INSERT INTO stock_quote_cache
          (symbol, price_cents, change_cents, change_percent, volume, provider, as_of, fetched_at, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(symbol)
         DO UPDATE SET
           price_cents = excluded.price_cents,
           change_cents = excluded.change_cents,
           change_percent = excluded.change_percent,
           volume = excluded.volume,
           provider = excluded.provider,
           as_of = excluded.as_of,
           fetched_at = excluded.fetched_at,
           raw = excluded.raw`
      )
      .run(
        quote.symbol.toUpperCase(),
        quote.priceCents,
        quote.changeCents,
        quote.changePercent,
        quote.volume,
        quote.provider,
        quote.asOf,
        quote.fetchedAt,
        JSON.stringify(quote.raw)
      );
  }
}
