import type { HeistRepository, LeaderboardEntry, TransactionRecord } from "../db/repository.js";
import { GAZETTE_INTERVAL_MS, GAZETTE_MIN_EVENTS, heatBand, seasonModifier } from "../game/engagement.js";

export interface GazetteView {
  guildId: string;
  seasonId: number;
  since: number;
  top?: LeaderboardEntry;
  mostWanted?: LeaderboardEntry;
  biggestHeist?: TransactionRecord;
  worstFailure?: TransactionRecord;
  biggestDrop?: TransactionRecord;
  bountyClaim?: TransactionRecord;
  eventCount: number;
  modifierName: string;
  modifierDescription: string;
}

export class GazetteService {
  constructor(private readonly repo: HeistRepository) {}

  build(guildId: string, now: number): GazetteView | null {
    const config = this.repo.ensureGuild(guildId, now);
    const season = this.repo.getCurrentSeason(guildId, now);
    const since = config.lastGazetteAt ?? now - GAZETTE_INTERVAL_MS;
    if (config.lastGazetteAt && now - config.lastGazetteAt < GAZETTE_INTERVAL_MS) {
      return null;
    }

    const transactions = this.repo.listTransactionsSince(guildId, config.currentSeasonId, since, 100);
    const eventCount = transactions.filter((transaction) => transaction.type !== "season_start").length;
    if (eventCount < GAZETTE_MIN_EVENTS) {
      return null;
    }

    const leaders = this.repo.getLeaderboard(guildId, config.currentSeasonId, 10);
    const modifier = seasonModifier(season.modifierId);
    return {
      guildId,
      seasonId: config.currentSeasonId,
      since,
      top: leaders[0],
      mostWanted: leaders
        .filter((entry) => heatBand(entry.heat).id !== "clean")
        .sort((left, right) => right.heat - left.heat)[0],
      biggestHeist: maxTransaction(
        transactions.filter((transaction) => transaction.type === "heist_success" || transaction.type === "crew_heist_success")
      ),
      worstFailure: minTransaction(
        transactions.filter(
          (transaction) =>
            transaction.type === "rob_failure" ||
            transaction.type === "heist_failure" ||
            transaction.type === "crew_heist_failure"
        )
      ),
      biggestDrop: maxTransaction(transactions.filter((transaction) => transaction.type === "drop_claim")),
      bountyClaim: maxTransaction(transactions.filter((transaction) => transaction.type === "bounty_claim")),
      eventCount,
      modifierName: modifier.name,
      modifierDescription: modifier.description
    };
  }

  markPosted(guildId: string, now: number): void {
    this.repo.setLastGazetteAt(guildId, now, now);
  }
}

function maxTransaction(transactions: TransactionRecord[]): TransactionRecord | undefined {
  return [...transactions].sort((left, right) => right.amount - left.amount)[0];
}

function minTransaction(transactions: TransactionRecord[]): TransactionRecord | undefined {
  return [...transactions].sort((left, right) => left.amount - right.amount)[0];
}
