import { randomUUID } from "node:crypto";
import type { DropRecord, HeistRepository, PlayerRecord } from "../db/repository.js";
import {
  DROP_INTERVAL_MAX_MS,
  DROP_INTERVAL_MIN_MS,
  DROP_LIFETIME_MS,
} from "../game/constants.js";
import { adjustHeat, decayHeat, randomDropVariant, seasonModifier } from "../game/engagement.js";
import type { RandomSource } from "../game/random.js";

export type ClaimDropResult =
  | {
      ok: true;
      completed: true;
      drop: DropRecord;
      players: PlayerRecord[];
      claimants: string[];
      perPlayerAmount: number;
    }
  | {
      ok: true;
      completed: false;
      drop: DropRecord;
      claimants: string[];
      claimsNeeded: number;
    }
  | { ok: false; reason: "missing" | "expired" | "claimed" | "already_joined"; drop?: DropRecord };

export class DropService {
  constructor(
    private readonly repo: HeistRepository,
    private readonly random: RandomSource
  ) {}

  nextDropAt(now: number): number {
    return now + this.random.int(DROP_INTERVAL_MIN_MS, DROP_INTERVAL_MAX_MS);
  }

  createDrop(guildId: string, channelId: string, now: number): DropRecord {
    const variant = randomDropVariant(this.random);
    const modifier = seasonModifier(this.repo.getCurrentSeason(guildId, now).modifierId);
    const baseAmount = this.random.int(variant.minAmount, variant.maxAmount);
    const amount = Math.max(1, Math.floor(baseAmount * (modifier.dropMultiplier ?? 1)));

    const drop: DropRecord = {
      id: randomUUID(),
      guildId,
      channelId,
      messageId: null,
      amount,
      kind: variant.kind,
      requiredClaims: variant.requiredClaims,
      heatDelta: variant.heatDelta,
      claimedByUserId: null,
      createdAt: now,
      expiresAt: now + DROP_LIFETIME_MS,
      claimedAt: null
    };
    this.repo.insertDrop(drop);
    return drop;
  }

  attachMessage(dropId: string, messageId: string): void {
    this.repo.setDropMessage(dropId, messageId);
  }

  claim(dropId: string, userId: string, now: number): ClaimDropResult {
    return this.repo.transaction(() => {
      const drop = this.repo.getDrop(dropId);
      if (!drop) {
        return { ok: false, reason: "missing" };
      }
      if (drop.claimedByUserId) {
        return { ok: false, reason: "claimed", drop };
      }
      if (drop.expiresAt < now) {
        return { ok: false, reason: "expired", drop };
      }

      if (!this.repo.addDropClaim(dropId, userId, now)) {
        return { ok: false, reason: "already_joined", drop };
      }

      const claims = this.repo.listDropClaims(dropId);
      if (claims.length < drop.requiredClaims) {
        return {
          ok: true,
          completed: false,
          drop,
          claimants: claims.map((claim) => claim.userId),
          claimsNeeded: drop.requiredClaims - claims.length
        };
      }

      if (!this.repo.markDropClaimed(dropId, userId, now)) {
        const latest = this.repo.getDrop(dropId);
        return { ok: false, reason: latest?.claimedByUserId ? "claimed" : "expired", drop: latest };
      }

      const claimants = claims.slice(0, drop.requiredClaims).map((claim) => claim.userId);
      const perPlayerAmount = Math.max(1, Math.floor(drop.amount / claimants.length));
      const players = claimants.map((claimantId) => {
        const player = this.repo.ensurePlayer(drop.guildId, claimantId, now);
        player.heat = adjustHeat(decayHeat(player.heat, player.updatedAt, now), drop.heatDelta);
        player.wallet += perPlayerAmount;
        player.lifetimeEarned += perPlayerAmount;
        this.repo.savePlayer(player, now);
        this.repo.recordTransaction({
          guildId: drop.guildId,
          userId: claimantId,
          seasonId: player.seasonId,
          type: "drop_claim",
          amount: perPlayerAmount,
          metadata: { dropId, kind: drop.kind, heatDelta: drop.heatDelta, totalAmount: drop.amount },
          createdAt: now
        });
        return player;
      });

      return {
        ok: true,
        completed: true,
        drop: { ...drop, claimedByUserId: userId, claimedAt: now },
        players,
        claimants,
        perPlayerAmount
      };
    });
  }
}
