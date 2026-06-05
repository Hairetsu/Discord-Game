import { randomUUID } from "node:crypto";
import type { DropRecord, HeistRepository, PlayerRecord } from "../db/repository.js";
import {
  DROP_INTERVAL_MAX_MS,
  DROP_INTERVAL_MIN_MS,
  DROP_JACKPOT,
  DROP_JACKPOT_CHANCE,
  DROP_LIFETIME_MS,
  DROP_MAX,
  DROP_MIN
} from "../game/constants.js";
import type { RandomSource } from "../game/random.js";

export type ClaimDropResult =
  | { ok: true; drop: DropRecord; player: PlayerRecord }
  | { ok: false; reason: "missing" | "expired" | "claimed"; drop?: DropRecord };

export class DropService {
  constructor(
    private readonly repo: HeistRepository,
    private readonly random: RandomSource
  ) {}

  nextDropAt(now: number): number {
    return now + this.random.int(DROP_INTERVAL_MIN_MS, DROP_INTERVAL_MAX_MS);
  }

  createDrop(guildId: string, channelId: string, now: number): DropRecord {
    const amount = this.random.chance(DROP_JACKPOT_CHANCE)
      ? DROP_JACKPOT
      : this.random.int(DROP_MIN, DROP_MAX);

    const drop: DropRecord = {
      id: randomUUID(),
      guildId,
      channelId,
      messageId: null,
      amount,
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

      if (!this.repo.markDropClaimed(dropId, userId, now)) {
        const latest = this.repo.getDrop(dropId);
        return { ok: false, reason: latest?.claimedByUserId ? "claimed" : "expired", drop: latest };
      }

      const player = this.repo.ensurePlayer(drop.guildId, userId, now);
      player.wallet += drop.amount;
      player.lifetimeEarned += drop.amount;
      this.repo.savePlayer(player, now);
      this.repo.recordTransaction({
        guildId: drop.guildId,
        userId,
        seasonId: player.seasonId,
        type: "drop_claim",
        amount: drop.amount,
        metadata: { dropId },
        createdAt: now
      });

      return {
        ok: true,
        drop: { ...drop, claimedByUserId: userId, claimedAt: now },
        player
      };
    });
  }
}
