import type { HeistRepository, LeaderboardEntry, PlayerRecord } from "../db/repository.js";
import { DAILY_INTEREST_CAP, DAILY_INTEREST_RATE } from "../game/constants.js";
import { localDateKey } from "../game/time.js";

export type MoneyResult =
  | { ok: true; player: PlayerRecord; amount: number }
  | { ok: false; reason: "invalid_amount" | "insufficient_wallet" | "insufficient_bank"; player: PlayerRecord };

export interface InterestRunResult {
  applied: boolean;
  playersPaid: number;
  totalPaid: number;
}

export class EconomyService {
  constructor(private readonly repo: HeistRepository) {}

  getBalance(guildId: string, userId: string, now: number): PlayerRecord {
    return this.repo.ensurePlayer(guildId, userId, now);
  }

  deposit(guildId: string, userId: string, amount: number, now: number): MoneyResult {
    return this.repo.transaction(() => {
      const player = this.repo.ensurePlayer(guildId, userId, now);
      const dollars = Math.floor(amount);
      if (dollars <= 0) {
        return { ok: false, reason: "invalid_amount", player };
      }
      if (player.wallet < dollars) {
        return { ok: false, reason: "insufficient_wallet", player };
      }

      player.wallet -= dollars;
      player.bank += dollars;
      this.repo.savePlayer(player, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "deposit",
        amount: dollars,
        createdAt: now
      });
      return { ok: true, player, amount: dollars };
    });
  }

  withdraw(guildId: string, userId: string, amount: number, now: number): MoneyResult {
    return this.repo.transaction(() => {
      const player = this.repo.ensurePlayer(guildId, userId, now);
      const dollars = Math.floor(amount);
      if (dollars <= 0) {
        return { ok: false, reason: "invalid_amount", player };
      }
      if (player.bank < dollars) {
        return { ok: false, reason: "insufficient_bank", player };
      }

      player.bank -= dollars;
      player.wallet += dollars;
      this.repo.savePlayer(player, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "withdraw",
        amount: dollars,
        createdAt: now
      });
      return { ok: true, player, amount: dollars };
    });
  }

  leaderboard(guildId: string, now: number, limit = 10): LeaderboardEntry[] {
    const config = this.repo.ensureGuild(guildId, now);
    return this.repo.getLeaderboard(guildId, config.currentSeasonId, limit);
  }

  applyDailyInterest(guildId: string, now: number): InterestRunResult {
    return this.repo.transaction(() => {
      const config = this.repo.ensureGuild(guildId, now);
      if (
        config.lastInterestAt &&
        localDateKey(config.lastInterestAt, config.timezone) === localDateKey(now, config.timezone)
      ) {
        return { applied: false, playersPaid: 0, totalPaid: 0 };
      }

      let playersPaid = 0;
      let totalPaid = 0;
      for (const player of this.repo.listCurrentSeasonPlayers(guildId, config.currentSeasonId)) {
        const interest = Math.min(Math.floor(player.bank * DAILY_INTEREST_RATE), DAILY_INTEREST_CAP);
        if (interest <= 0) {
          continue;
        }

        player.bank += interest;
        player.lifetimeEarned += interest;
        this.repo.savePlayer(player, now);
        this.repo.recordTransaction({
          guildId,
          userId: player.userId,
          seasonId: player.seasonId,
          type: "interest",
          amount: interest,
          createdAt: now
        });
        playersPaid += 1;
        totalPaid += interest;
      }

      this.repo.setLastInterestAt(guildId, now, now);
      return { applied: true, playersPaid, totalPaid };
    });
  }
}
