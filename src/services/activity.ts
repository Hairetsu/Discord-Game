import type { HeistRepository, PlayerRecord } from "../db/repository.js";
import {
  CHAT_REWARD_COOLDOWN_MS,
  CHAT_REWARD_MAX,
  CHAT_REWARD_MIN,
  EMOTE_REWARD_COOLDOWN_MS,
  EMOTE_REWARD_MAX,
  EMOTE_REWARD_MIN
} from "../game/constants.js";
import type { RandomSource } from "../game/random.js";

export type ActivityRewardResult =
  | { ok: true; kind: "chat" | "emote"; amount: number; player: PlayerRecord }
  | { ok: false; kind: "chat" | "emote"; reason: "cooldown"; player: PlayerRecord; availableAt: number };

export class ActivityService {
  constructor(
    private readonly repo: HeistRepository,
    private readonly random: RandomSource
  ) {}

  awardChat(guildId: string, userId: string, now: number): ActivityRewardResult {
    return this.repo.transaction(() => {
      const player = this.repo.ensurePlayer(guildId, userId, now);
      if (player.lastChatRewardAt > 0 && player.lastChatRewardAt + CHAT_REWARD_COOLDOWN_MS > now) {
        return {
          ok: false,
          kind: "chat",
          reason: "cooldown",
          player,
          availableAt: player.lastChatRewardAt + CHAT_REWARD_COOLDOWN_MS
        };
      }

      const amount = this.random.int(CHAT_REWARD_MIN, CHAT_REWARD_MAX);
      player.wallet += amount;
      player.lifetimeEarned += amount;
      player.lastChatRewardAt = now;
      this.repo.savePlayer(player, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "chat_reward",
        amount,
        metadata: { kind: "chat" },
        createdAt: now
      });

      return { ok: true, kind: "chat", amount, player };
    });
  }

  awardEmote(guildId: string, userId: string, now: number): ActivityRewardResult {
    return this.repo.transaction(() => {
      const player = this.repo.ensurePlayer(guildId, userId, now);
      if (player.lastEmoteRewardAt > 0 && player.lastEmoteRewardAt + EMOTE_REWARD_COOLDOWN_MS > now) {
        return {
          ok: false,
          kind: "emote",
          reason: "cooldown",
          player,
          availableAt: player.lastEmoteRewardAt + EMOTE_REWARD_COOLDOWN_MS
        };
      }

      const amount = this.random.int(EMOTE_REWARD_MIN, EMOTE_REWARD_MAX);
      player.wallet += amount;
      player.lifetimeEarned += amount;
      player.lastEmoteRewardAt = now;
      this.repo.savePlayer(player, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "emote_reward",
        amount,
        metadata: { kind: "emote" },
        createdAt: now
      });

      return { ok: true, kind: "emote", amount, player };
    });
  }
}

export function containsEmojiOrCustomEmote(content: string): boolean {
  return /<a?:[a-zA-Z0-9_~]+:\d+>|\p{Extended_Pictographic}/u.test(content);
}
