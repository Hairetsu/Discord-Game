import type { HeistRepository, PlayerRecord } from "../db/repository.js";
import { CASE_FILES, adjustHeat, decayHeat, type CaseFile } from "../game/engagement.js";
import type { RandomSource } from "../game/random.js";
import { localDateKey } from "../game/time.js";

export type CaseResult =
  | {
      ok: true;
      caseFile: CaseFile;
      player: PlayerRecord;
      reward: number;
      laundered: number;
      heatDelta: number;
    }
  | { ok: false; reason: "unknown_case" | "cooldown"; availableAt?: number; player?: PlayerRecord };

export class CaseService {
  constructor(
    private readonly repo: HeistRepository,
    private readonly random: RandomSource
  ) {}

  run(guildId: string, userId: string, caseId: string, now: number): CaseResult {
    const caseFile = CASE_FILES.find((candidate) => candidate.id === caseId);
    if (!caseFile) {
      return { ok: false, reason: "unknown_case" };
    }

    return this.repo.transaction(() => {
      const config = this.repo.ensureGuild(guildId, now);
      const player = this.repo.ensurePlayer(guildId, userId, now);
      if (player.lastCaseAt > 0 && localDateKey(player.lastCaseAt, config.timezone) === localDateKey(now, config.timezone)) {
        return { ok: false, reason: "cooldown", availableAt: nextLocalDay(player.lastCaseAt), player };
      }

      const reward = this.random.int(caseFile.minReward, caseFile.maxReward);
      const laundered = caseFile.depositPercent
        ? Math.min(player.wallet, Math.floor(player.wallet * caseFile.depositPercent))
        : 0;

      player.heat = adjustHeat(decayHeat(player.heat, player.updatedAt, now), caseFile.heatDelta);
      player.wallet += reward;
      if (laundered > 0) {
        player.wallet -= laundered;
        player.bank += laundered;
      }
      player.lifetimeEarned += reward;
      player.lastCaseAt = now;
      this.repo.savePlayer(player, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "case_file",
        amount: reward,
        metadata: {
          caseId: caseFile.id,
          heatDelta: caseFile.heatDelta,
          laundered
        },
        createdAt: now
      });

      return { ok: true, caseFile, player, reward, laundered, heatDelta: caseFile.heatDelta };
    });
  }
}

function nextLocalDay(previous: number): number {
  return previous + 24 * 60 * 60 * 1000;
}
