import { randomUUID } from "node:crypto";
import type { CrewHeistMemberRecord, CrewHeistRecord, HeistRepository, PlayerRecord } from "../db/repository.js";
import {
  HEIST_FAIL_FINE_RATE,
  HEIST_LOCKOUT_MS,
  HEIST_MAX_PERCENT,
  HEIST_MIN_PERCENT,
  MIN_SUCCESS_CHANCE,
  MAX_SUCCESS_CHANCE
} from "../game/constants.js";
import {
  CREW_HEIST_HEAT_GAIN,
  CREW_HEIST_RECRUIT_MS,
  CREW_ROLES,
  adjustHeat,
  decayHeat,
  seasonModifier,
  securityModifiers,
  type CrewRole
} from "../game/engagement.js";
import type { RandomSource } from "../game/random.js";
import { clamp } from "../game/time.js";

export type CreateCrewHeistResult =
  | { ok: true; heist: CrewHeistRecord; members: CrewHeistMemberRecord[] }
  | { ok: false; reason: "self_target" | "target_not_enrolled" | "no_bank_cash" };

export type JoinCrewHeistResult =
  | { ok: true; heist: CrewHeistRecord; members: CrewHeistMemberRecord[] }
  | { ok: false; reason: "missing" | "closed" | "expired" | "target_joined" | "already_joined" | "role_taken" };

export type ResolveCrewHeistResult =
  | {
      ok: true;
      success: true;
      heist: CrewHeistRecord;
      members: CrewHeistMemberRecord[];
      players: PlayerRecord[];
      target: PlayerRecord;
      stolen: number;
      payout: number;
      bountyPaid: number;
      chance: number;
    }
  | {
      ok: true;
      success: false;
      heist: CrewHeistRecord;
      members: CrewHeistMemberRecord[];
      players: PlayerRecord[];
      target: PlayerRecord;
      fine: number;
      chance: number;
    }
  | { ok: false; reason: "missing" | "not_leader" | "closed" | "expired" | "short_crew" | "target_not_enrolled" | "no_bank_cash" };

export class CrewHeistService {
  constructor(
    private readonly repo: HeistRepository,
    private readonly random: RandomSource
  ) {}

  create(guildId: string, channelId: string, leaderUserId: string, targetUserId: string, now: number): CreateCrewHeistResult {
    return this.repo.transaction(() => {
      if (leaderUserId === targetUserId) {
        return { ok: false, reason: "self_target" };
      }
      const config = this.repo.ensureGuild(guildId, now);
      const leader = this.repo.ensurePlayer(guildId, leaderUserId, now);
      const target = this.repo.getPlayer(guildId, targetUserId, config.currentSeasonId);
      if (!target) {
        return { ok: false, reason: "target_not_enrolled" };
      }
      if (target.bank <= 0) {
        return { ok: false, reason: "no_bank_cash" };
      }

      const heist: CrewHeistRecord = {
        id: randomUUID(),
        guildId,
        seasonId: leader.seasonId,
        leaderUserId,
        targetUserId,
        channelId,
        messageId: null,
        status: "recruiting",
        createdAt: now,
        expiresAt: now + CREW_HEIST_RECRUIT_MS,
        resolvedAt: null
      };
      this.repo.insertCrewHeist(heist);
      this.repo.addCrewHeistMember(heist.id, leaderUserId, "inside_person", now);
      return { ok: true, heist, members: this.repo.listCrewHeistMembers(heist.id) };
    });
  }

  attachMessage(heistId: string, messageId: string): void {
    this.repo.setCrewHeistMessage(heistId, messageId);
  }

  join(heistId: string, userId: string, role: CrewRole, now: number): JoinCrewHeistResult {
    return this.repo.transaction(() => {
      const heist = this.repo.getCrewHeist(heistId);
      if (!heist) {
        return { ok: false, reason: "missing" };
      }
      if (heist.status !== "recruiting") {
        return { ok: false, reason: "closed" };
      }
      if (heist.expiresAt < now) {
        this.repo.updateCrewHeistStatus(heistId, "expired", now);
        return { ok: false, reason: "expired" };
      }
      if (heist.targetUserId === userId) {
        return { ok: false, reason: "target_joined" };
      }

      const members = this.repo.listCrewHeistMembers(heistId);
      if (members.some((member) => member.userId === userId)) {
        return { ok: false, reason: "already_joined" };
      }
      if (members.some((member) => member.role === role)) {
        return { ok: false, reason: "role_taken" };
      }

      this.repo.ensurePlayer(heist.guildId, userId, now);
      this.repo.addCrewHeistMember(heistId, userId, role, now);
      return { ok: true, heist, members: this.repo.listCrewHeistMembers(heistId) };
    });
  }

  resolve(heistId: string, launcherUserId: string, now: number): ResolveCrewHeistResult {
    return this.repo.transaction(() => {
      const heist = this.repo.getCrewHeist(heistId);
      if (!heist) {
        return { ok: false, reason: "missing" };
      }
      if (heist.leaderUserId !== launcherUserId) {
        return { ok: false, reason: "not_leader" };
      }
      if (heist.status !== "recruiting") {
        return { ok: false, reason: "closed" };
      }
      if (heist.expiresAt < now) {
        this.repo.updateCrewHeistStatus(heistId, "expired", now);
        return { ok: false, reason: "expired" };
      }

      const members = this.repo.listCrewHeistMembers(heistId);
      if (members.length < 2) {
        return { ok: false, reason: "short_crew" };
      }

      const target = this.repo.getPlayer(heist.guildId, heist.targetUserId, heist.seasonId);
      if (!target) {
        return { ok: false, reason: "target_not_enrolled" };
      }
      if (target.bank <= 0) {
        return { ok: false, reason: "no_bank_cash" };
      }

      const roles = new Set(members.map((member) => member.role));
      const modifier = seasonModifier(this.repo.getSeason(heist.guildId, heist.seasonId)?.modifierId);
      const security = securityModifiers(this.repo.getLoadoutItems(heist.guildId, target.userId, heist.seasonId));
      const softenedVault = roles.has("inside_person") ? security.vaultPenalty * 0.5 : security.vaultPenalty;
      const roleBonus = (roles.has("lookout") ? 0.08 : 0) + Math.max(0, members.length - 2) * 0.04;
      const chance = clamp(0.28 + roleBonus + (modifier.heistChanceBonus ?? 0) - softenedVault, MIN_SUCCESS_CHANCE, MAX_SUCCESS_CHANCE);
      const success = this.random.chance(chance);

      this.repo.updateCrewHeistStatus(heistId, "resolved", now);
      const resolvedHeist = { ...heist, status: "resolved" as const, resolvedAt: now };
      return success
        ? this.applySuccess(resolvedHeist, members, target, chance, roles, now)
        : this.applyFailure(resolvedHeist, members, target, chance, roles, modifier.fineMultiplier ?? 1, now);
    });
  }

  private applySuccess(
    heist: CrewHeistRecord,
    members: CrewHeistMemberRecord[],
    target: PlayerRecord,
    chance: number,
    roles: Set<CrewRole>,
    now: number
  ): Extract<ResolveCrewHeistResult, { ok: true; success: true }> {
    const maxSteal = roles.has("lockpick") ? 3500 : 2500;
    const percent = HEIST_MIN_PERCENT + this.random.next() * (HEIST_MAX_PERCENT - HEIST_MIN_PERCENT);
    const stolen = Math.max(1, Math.min(Math.floor(target.bank * percent), maxSteal));
    const payout = Math.max(1, Math.floor(stolen / members.length));
    target.bank -= stolen;

    const players = members.map((member) => {
      const player = this.repo.ensurePlayer(heist.guildId, member.userId, now);
      player.heat = adjustHeat(decayHeat(player.heat, player.updatedAt, now), CREW_HEIST_HEAT_GAIN);
      player.wallet += payout;
      player.lifetimeEarned += payout;
      player.lifetimeStolen += payout;
      player.heistLockoutUntil = now + HEIST_LOCKOUT_MS;
      this.repo.savePlayer(player, now);
      this.repo.recordTransaction({
        guildId: heist.guildId,
        userId: player.userId,
        seasonId: player.seasonId,
        type: "crew_heist_success",
        amount: payout,
        counterpartyUserId: target.userId,
        metadata: { heistId: heist.id, stolen, role: member.role },
        createdAt: now
      });
      return player;
    });

    const leader = players.find((player) => player.userId === heist.leaderUserId) ?? players[0];
    const bountyPaid = this.applyBounties(heist, leader, target, now);
    this.repo.savePlayer(leader, now);
    this.repo.savePlayer(target, now);
    return { ok: true, success: true, heist, members, players, target, stolen, payout, bountyPaid, chance };
  }

  private applyFailure(
    heist: CrewHeistRecord,
    members: CrewHeistMemberRecord[],
    target: PlayerRecord,
    chance: number,
    roles: Set<CrewRole>,
    seasonFineMultiplier: number,
    now: number
  ): Extract<ResolveCrewHeistResult, { ok: true; success: false }> {
    const fineMultiplier = (roles.has("driver") ? 0.75 : 1) * seasonFineMultiplier;
    let totalFine = 0;
    const players = members.map((member) => {
      const player = this.repo.ensurePlayer(heist.guildId, member.userId, now);
      const fine = Math.min(player.wallet, Math.max(25, Math.floor(player.wallet * HEIST_FAIL_FINE_RATE * fineMultiplier)));
      totalFine += fine;
      player.wallet -= fine;
      player.heat = adjustHeat(decayHeat(player.heat, player.updatedAt, now), CREW_HEIST_HEAT_GAIN + 10);
      player.heistLockoutUntil = now + HEIST_LOCKOUT_MS;
      this.repo.savePlayer(player, now);
      this.repo.recordTransaction({
        guildId: heist.guildId,
        userId: player.userId,
        seasonId: player.seasonId,
        type: "crew_heist_failure",
        amount: -fine,
        counterpartyUserId: target.userId,
        metadata: { heistId: heist.id, role: member.role },
        createdAt: now
      });
      return player;
    });

    return { ok: true, success: false, heist, members, players, target, fine: totalFine, chance };
  }

  private applyBounties(heist: CrewHeistRecord, leader: PlayerRecord, target: PlayerRecord, now: number): number {
    const bounties = this.repo.claimActiveBountiesForTarget(
      heist.guildId,
      heist.seasonId,
      target.userId,
      leader.userId,
      now
    );
    const bountyPaid = bounties.reduce((total, bounty) => total + bounty.amount, 0);
    if (bountyPaid <= 0) {
      return 0;
    }
    leader.wallet += bountyPaid;
    leader.lifetimeEarned += bountyPaid;
    this.repo.recordTransaction({
      guildId: heist.guildId,
      userId: leader.userId,
      seasonId: leader.seasonId,
      type: "bounty_claim",
      amount: bountyPaid,
      counterpartyUserId: target.userId,
      metadata: { bountyIds: bounties.map((bounty) => bounty.id), crewHeistId: heist.id },
      createdAt: now
    });
    return bountyPaid;
  }
}

export function roleLabel(role: CrewRole): string {
  return CREW_ROLES.find((definition) => definition.id === role)?.label ?? role;
}
