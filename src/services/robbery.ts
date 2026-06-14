import type { BountyRecord, HeistRepository, PlayerRecord, RivalryRecord } from "../db/repository.js";
import {
  HEIST_BASE_SUCCESS,
  HEIST_COOLDOWN_MS,
  HEIST_FAIL_FINE_RATE,
  HEIST_LOCKOUT_MS,
  HEIST_MAX_PERCENT,
  HEIST_MAX_STEAL,
  HEIST_MIN_PERCENT,
  MAX_SUCCESS_CHANCE,
  MIN_SUCCESS_CHANCE,
  ROB_BASE_SUCCESS,
  ROB_COOLDOWN_MS,
  ROB_FAIL_FINE_MIN,
  ROB_FAIL_FINE_RATE,
  ROB_MAX_PERCENT,
  ROB_MAX_STEAL,
  ROB_MIN_PERCENT,
} from "../game/constants.js";
import { HEIST_HEAT_GAIN, ROB_HEAT_GAIN, adjustHeat, decayHeat, heatBand, seasonModifier, securityModifiers } from "../game/engagement.js";
import type { RandomSource } from "../game/random.js";
import { clamp } from "../game/time.js";
import type { CameraService } from "./cameras.js";

type AttackKind = "rob" | "heist";

export type AttackResult =
  | {
      ok: true;
      kind: AttackKind;
      success: true;
      robber: PlayerRecord;
      target: PlayerRecord;
      stolen: number;
      chance: number;
      bountyPaid: number;
      rivalry: RivalryRecord;
      insuranceRestore?: number;
    }
  | {
      ok: true;
      kind: AttackKind;
      success: false;
      robber: PlayerRecord;
      target: PlayerRecord;
      fine: number;
      chance: number;
      counterSteal: number;
      rivalry: RivalryRecord;
    }
  | {
      ok: false;
      kind: AttackKind;
      reason:
        | "self_target"
        | "target_not_enrolled"
        | "target_shielded"
        | "cooldown"
        | "lockout"
        | "no_wallet_cash"
        | "no_bank_cash";
      robber?: PlayerRecord;
      target?: PlayerRecord;
      availableAt?: number;
    };

export class RobberyService {
  constructor(
    private readonly repo: HeistRepository,
    private readonly random: RandomSource,
    private readonly cameras?: CameraService
  ) {}

  rob(guildId: string, robberId: string, targetId: string, now: number): AttackResult {
    return this.attack("rob", guildId, robberId, targetId, now);
  }

  heist(guildId: string, robberId: string, targetId: string, now: number): AttackResult {
    return this.attack("heist", guildId, robberId, targetId, now);
  }

  private attack(kind: AttackKind, guildId: string, robberId: string, targetId: string, now: number): AttackResult {
    return this.repo.transaction(() => {
      if (robberId === targetId) {
        return { ok: false, kind, reason: "self_target" };
      }

      const config = this.repo.ensureGuild(guildId, now);
      const season = this.repo.getCurrentSeason(guildId, now);
      const modifier = seasonModifier(season.modifierId);
      const robber = this.repo.ensurePlayer(guildId, robberId, now);
      robber.heat = decayHeat(robber.heat, robber.updatedAt, now);
      const target = this.repo.getPlayer(guildId, targetId, config.currentSeasonId);
      if (!target) {
        return { ok: false, kind, reason: "target_not_enrolled", robber };
      }

      if (kind === "rob") {
        if (robber.robCooldownUntil > now) {
          return { ok: false, kind, reason: "cooldown", robber, target, availableAt: robber.robCooldownUntil };
        }
        if (target.wallet <= 0) {
          return { ok: false, kind, reason: "no_wallet_cash", robber, target };
        }
      } else {
        if (robber.heistLockoutUntil > now) {
          return { ok: false, kind, reason: "lockout", robber, target, availableAt: robber.heistLockoutUntil };
        }
        if (robber.heistCooldownUntil > now) {
          return { ok: false, kind, reason: "cooldown", robber, target, availableAt: robber.heistCooldownUntil };
        }
        if (target.bank <= 0) {
          return { ok: false, kind, reason: "no_bank_cash", robber, target };
        }
      }

      const security = securityModifiers(this.repo.getLoadoutItems(guildId, targetId, target.seasonId));
      const baseChance =
        kind === "rob" ? ROB_BASE_SUCCESS : HEIST_BASE_SUCCESS + (modifier.heistChanceBonus ?? 0);
      const band = heatBand(robber.heat);
      const chance = clamp(baseChance - security.vaultPenalty - band.chancePenalty, MIN_SUCCESS_CHANCE, MAX_SUCCESS_CHANCE);
      const success = this.random.chance(chance);

      const result = success
        ? kind === "rob"
          ? this.applyRobSuccess(guildId, robber, target, chance, now)
          : this.applyHeistSuccess(guildId, robber, target, chance, security, now)
        : this.applyFailure(kind, guildId, robber, target, chance, security, (modifier.fineMultiplier ?? 1) * band.fineMultiplier, now);

      const rivalry = this.repo.recordRivalryAttack(
        guildId,
        robber.seasonId,
        robber.userId,
        target.userId,
        result.ok && result.success,
        result.ok && result.success ? result.stolen : 0,
        now
      );
      if (result.ok) {
        this.cameras?.recordAttack({
          guildId,
          seasonId: target.seasonId,
          targetUserId: target.userId,
          attackerUserId: robber.userId,
          attackType: kind,
          success: result.success,
          stolenAmount: result.success ? result.stolen : 0,
          insuranceRestore: result.success && result.kind === "heist" ? result.insuranceRestore : 0,
          now
        });
      }
      return { ...result, rivalry };
    });
  }

  private applyRobSuccess(
    guildId: string,
    robber: PlayerRecord,
    target: PlayerRecord,
    chance: number,
    now: number
  ): AttackResult {
    const stolen = this.stealAmount(target.wallet, ROB_MIN_PERCENT, ROB_MAX_PERCENT, ROB_MAX_STEAL);
    target.wallet -= stolen;
    robber.wallet += stolen;
    robber.lifetimeEarned += stolen;
    robber.lifetimeStolen += stolen;
    robber.heat = adjustHeat(robber.heat, ROB_HEAT_GAIN);
    robber.robCooldownUntil = now + ROB_COOLDOWN_MS;
    const bountyPaid = this.applyBounties(guildId, robber, target, now);

    this.repo.savePlayer(target, now);
    this.repo.savePlayer(robber, now);
    this.repo.recordTransaction({
      guildId,
      userId: robber.userId,
      seasonId: robber.seasonId,
      type: "rob_success",
      amount: stolen,
      counterpartyUserId: target.userId,
      createdAt: now
    });
    this.repo.recordTransaction({
      guildId,
      userId: target.userId,
      seasonId: target.seasonId,
      type: "robbed_wallet",
      amount: -stolen,
      counterpartyUserId: robber.userId,
      createdAt: now
    });

    return { ok: true, kind: "rob", success: true, robber, target, stolen, chance, bountyPaid, rivalry: nullRivalry(guildId, robber, target, now) };
  }

  private applyHeistSuccess(
    guildId: string,
    robber: PlayerRecord,
    target: PlayerRecord,
    chance: number,
    security: ReturnType<typeof securityModifiers>,
    now: number
  ): AttackResult {
    const stolen = this.stealAmount(target.bank, HEIST_MIN_PERCENT, HEIST_MAX_PERCENT, HEIST_MAX_STEAL);
    const insuranceRestore = Math.min(
      Math.floor(stolen * security.insuranceRestorePercent),
      security.insuranceRestoreMax
    );

    target.bank -= stolen;
    if (insuranceRestore > 0) {
      target.bank += insuranceRestore;
      target.lifetimeEarned += insuranceRestore;
    }
    robber.wallet += stolen;
    robber.lifetimeEarned += stolen;
    robber.lifetimeStolen += stolen;
    robber.heat = adjustHeat(robber.heat, HEIST_HEAT_GAIN);
    robber.heistCooldownUntil = now + HEIST_COOLDOWN_MS;
    const bountyPaid = this.applyBounties(guildId, robber, target, now);

    this.repo.savePlayer(target, now);
    this.repo.savePlayer(robber, now);
    this.repo.recordTransaction({
      guildId,
      userId: robber.userId,
      seasonId: robber.seasonId,
      type: "heist_success",
      amount: stolen,
      counterpartyUserId: target.userId,
      metadata: { insuranceRestore },
      createdAt: now
    });
    this.repo.recordTransaction({
      guildId,
      userId: target.userId,
      seasonId: target.seasonId,
      type: "bank_breached",
      amount: -stolen,
      counterpartyUserId: robber.userId,
      metadata: { insuranceRestore },
      createdAt: now
    });
    if (insuranceRestore > 0) {
      this.repo.recordTransaction({
        guildId,
        userId: target.userId,
        seasonId: target.seasonId,
        type: "insurance_restore",
        amount: insuranceRestore,
        counterpartyUserId: robber.userId,
        createdAt: now
      });
    }

    return {
      ok: true,
      kind: "heist",
      success: true,
      robber,
      target,
      stolen,
      chance,
      bountyPaid,
      rivalry: nullRivalry(guildId, robber, target, now),
      insuranceRestore
    };
  }

  private applyFailure(
    kind: AttackKind,
    guildId: string,
    robber: PlayerRecord,
    target: PlayerRecord,
    chance: number,
    security: ReturnType<typeof securityModifiers>,
    fineMultiplier: number,
    now: number
  ): AttackResult {
    const baseFine =
      kind === "rob"
        ? Math.max(Math.floor(robber.wallet * ROB_FAIL_FINE_RATE), ROB_FAIL_FINE_MIN)
        : Math.floor(robber.wallet * HEIST_FAIL_FINE_RATE);
    const fine = Math.min(robber.wallet, Math.floor(baseFine * (1 + security.alarmFineBonus) * fineMultiplier));
    robber.wallet -= fine;

    const counterSteal = Math.min(
      robber.wallet,
      Math.floor(robber.wallet * security.guardCounterPercent),
      security.guardCounterMax
    );
    if (counterSteal > 0) {
      robber.wallet -= counterSteal;
      target.wallet += counterSteal;
      target.lifetimeEarned += counterSteal;
    }

    if (kind === "rob") {
      robber.heat = adjustHeat(robber.heat, ROB_HEAT_GAIN + 4);
      robber.robCooldownUntil = now + ROB_COOLDOWN_MS;
    } else {
      robber.heat = adjustHeat(robber.heat, HEIST_HEAT_GAIN + 8);
      robber.heistCooldownUntil = now + HEIST_COOLDOWN_MS;
      robber.heistLockoutUntil = now + HEIST_LOCKOUT_MS;
    }

    this.repo.savePlayer(target, now);
    this.repo.savePlayer(robber, now);
    this.repo.recordTransaction({
      guildId,
      userId: robber.userId,
      seasonId: robber.seasonId,
      type: `${kind}_failure`,
      amount: -fine - counterSteal,
      counterpartyUserId: target.userId,
      metadata: { fine, counterSteal },
      createdAt: now
    });
    if (counterSteal > 0) {
      this.repo.recordTransaction({
        guildId,
        userId: target.userId,
        seasonId: target.seasonId,
        type: "guard_counter",
        amount: counterSteal,
        counterpartyUserId: robber.userId,
        createdAt: now
      });
    }

    return { ok: true, kind, success: false, robber, target, fine, chance, counterSteal, rivalry: nullRivalry(guildId, robber, target, now) };
  }

  private applyBounties(guildId: string, robber: PlayerRecord, target: PlayerRecord, now: number): number {
    const bounties: BountyRecord[] = this.repo.claimActiveBountiesForTarget(
      guildId,
      robber.seasonId,
      target.userId,
      robber.userId,
      now
    );
    const bountyPaid = bounties.reduce((total, bounty) => total + bounty.amount, 0);
    if (bountyPaid <= 0) {
      return 0;
    }
    robber.wallet += bountyPaid;
    robber.lifetimeEarned += bountyPaid;
    this.repo.recordTransaction({
      guildId,
      userId: robber.userId,
      seasonId: robber.seasonId,
      type: "bounty_claim",
      amount: bountyPaid,
      counterpartyUserId: target.userId,
      metadata: { bountyIds: bounties.map((bounty) => bounty.id) },
      createdAt: now
    });
    return bountyPaid;
  }

  private stealAmount(balance: number, minPercent: number, maxPercent: number, maxSteal: number): number {
    if (balance <= 0) {
      return 0;
    }
    const percent = minPercent + this.random.next() * (maxPercent - minPercent);
    return Math.max(1, Math.min(Math.floor(balance * percent), maxSteal));
  }
}

function nullRivalry(guildId: string, robber: PlayerRecord, target: PlayerRecord, now: number): RivalryRecord {
  return {
    guildId,
    seasonId: robber.seasonId,
    attackerUserId: robber.userId,
    targetUserId: target.userId,
    attacks: 0,
    successes: 0,
    stolenTotal: 0,
    lastAttackAt: now,
    lastSuccessAt: null
  };
}
