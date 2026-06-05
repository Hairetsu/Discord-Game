import type { HeistRepository, PlayerRecord } from "../db/repository.js";
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
  type SecurityItem
} from "../game/constants.js";
import type { RandomSource } from "../game/random.js";
import { clamp } from "../game/time.js";

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

interface SecurityModifiers {
  vaultPenalty: number;
  alarmFineBonus: number;
  guardCounterPercent: number;
  guardCounterMax: number;
  insuranceRestorePercent: number;
  insuranceRestoreMax: number;
}

function modifiers(items: SecurityItem[]): SecurityModifiers {
  return {
    vaultPenalty: items.reduce((total, item) => total + (item.vaultPenalty ?? 0), 0),
    alarmFineBonus: items.reduce((total, item) => total + (item.alarmFineBonus ?? 0), 0),
    guardCounterPercent: items.reduce((total, item) => total + (item.guardCounterPercent ?? 0), 0),
    guardCounterMax: items.reduce((total, item) => total + (item.guardCounterMax ?? 0), 0),
    insuranceRestorePercent: items.reduce((total, item) => total + (item.insuranceRestorePercent ?? 0), 0),
    insuranceRestoreMax: items.reduce((total, item) => total + (item.insuranceRestoreMax ?? 0), 0)
  };
}

export class RobberyService {
  constructor(
    private readonly repo: HeistRepository,
    private readonly random: RandomSource
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
      const robber = this.repo.ensurePlayer(guildId, robberId, now);
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

      const security = modifiers(this.repo.getLoadoutItems(guildId, targetId, target.seasonId));
      const baseChance = kind === "rob" ? ROB_BASE_SUCCESS : HEIST_BASE_SUCCESS;
      const chance = clamp(baseChance - security.vaultPenalty, MIN_SUCCESS_CHANCE, MAX_SUCCESS_CHANCE);
      const success = this.random.chance(chance);

      if (success) {
        return kind === "rob"
          ? this.applyRobSuccess(guildId, robber, target, chance, now)
          : this.applyHeistSuccess(guildId, robber, target, chance, security, now);
      }

      return this.applyFailure(kind, guildId, robber, target, chance, security, now);
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
    robber.robCooldownUntil = now + ROB_COOLDOWN_MS;

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

    return { ok: true, kind: "rob", success: true, robber, target, stolen, chance };
  }

  private applyHeistSuccess(
    guildId: string,
    robber: PlayerRecord,
    target: PlayerRecord,
    chance: number,
    security: SecurityModifiers,
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
    robber.heistCooldownUntil = now + HEIST_COOLDOWN_MS;

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
      insuranceRestore
    };
  }

  private applyFailure(
    kind: AttackKind,
    guildId: string,
    robber: PlayerRecord,
    target: PlayerRecord,
    chance: number,
    security: SecurityModifiers,
    now: number
  ): AttackResult {
    const baseFine =
      kind === "rob"
        ? Math.max(Math.floor(robber.wallet * ROB_FAIL_FINE_RATE), ROB_FAIL_FINE_MIN)
        : Math.floor(robber.wallet * HEIST_FAIL_FINE_RATE);
    const fine = Math.min(robber.wallet, Math.floor(baseFine * (1 + security.alarmFineBonus)));
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
      robber.robCooldownUntil = now + ROB_COOLDOWN_MS;
    } else {
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

    return { ok: true, kind, success: false, robber, target, fine, chance, counterSteal };
  }

  private stealAmount(balance: number, minPercent: number, maxPercent: number, maxSteal: number): number {
    if (balance <= 0) {
      return 0;
    }
    const percent = minPercent + this.random.next() * (maxPercent - minPercent);
    return Math.max(1, Math.min(Math.floor(balance * percent), maxSteal));
  }
}
