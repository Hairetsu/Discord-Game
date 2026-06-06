import type { BountyRecord, HeistRepository } from "../db/repository.js";
import { BOUNTY_DURATION_MS } from "../game/engagement.js";

export type PlaceBountyResult =
  | { ok: true; bounty: BountyRecord }
  | {
      ok: false;
      reason: "self_target" | "target_not_enrolled" | "invalid_amount" | "insufficient_wallet";
    };

export class BountyService {
  constructor(private readonly repo: HeistRepository) {}

  place(guildId: string, issuerUserId: string, targetUserId: string, amount: number, now: number): PlaceBountyResult {
    return this.repo.transaction(() => {
      if (issuerUserId === targetUserId) {
        return { ok: false, reason: "self_target" };
      }

      const config = this.repo.ensureGuild(guildId, now);
      const issuer = this.repo.ensurePlayer(guildId, issuerUserId, now);
      const target = this.repo.getPlayer(guildId, targetUserId, config.currentSeasonId);
      const dollars = Math.floor(amount);
      if (!target) {
        return { ok: false, reason: "target_not_enrolled" };
      }
      if (dollars <= 0) {
        return { ok: false, reason: "invalid_amount" };
      }
      if (issuer.wallet < dollars) {
        return { ok: false, reason: "insufficient_wallet" };
      }

      issuer.wallet -= dollars;
      this.repo.savePlayer(issuer, now);
      this.repo.recordTransaction({
        guildId,
        userId: issuerUserId,
        seasonId: issuer.seasonId,
        type: "bounty_place",
        amount: -dollars,
        counterpartyUserId: targetUserId,
        metadata: { expiresAt: now + BOUNTY_DURATION_MS },
        createdAt: now
      });

      return {
        ok: true,
        bounty: this.repo.createBounty(
          guildId,
          issuer.seasonId,
          issuerUserId,
          targetUserId,
          dollars,
          now + BOUNTY_DURATION_MS,
          now
        )
      };
    });
  }

  list(guildId: string, now: number): BountyRecord[] {
    const config = this.repo.ensureGuild(guildId, now);
    return this.repo.listActiveBounties(guildId, config.currentSeasonId, now);
  }
}
