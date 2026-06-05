import { describe, expect, it } from "vitest";
import { CHAT_REWARD_COOLDOWN_MS, EMOTE_REWARD_COOLDOWN_MS } from "../src/game/constants.js";
import { SequenceRandomSource } from "../src/game/random.js";
import { containsEmojiOrCustomEmote } from "../src/services/activity.js";
import { createTestServices } from "./helpers.js";

describe("activity service", () => {
  it("awards small chat rewards with a cooldown", () => {
    const { activity, repo } = createTestServices(new SequenceRandomSource([0]));
    const first = activity.awardChat("guild", "user", 1000);

    expect(first.ok && first.amount).toBe(1);
    expect(first.ok && first.player.wallet).toBe(251);
    expect(first.ok && first.player.lifetimeEarned).toBe(251);

    const blocked = activity.awardChat("guild", "user", 1000 + CHAT_REWARD_COOLDOWN_MS - 1);
    expect(blocked.ok).toBe(false);

    const second = activity.awardChat("guild", "user", 1000 + CHAT_REWARD_COOLDOWN_MS);
    expect(second.ok && second.amount).toBe(1);

    const player = repo.ensurePlayer("guild", "user", 1000 + CHAT_REWARD_COOLDOWN_MS);
    expect(player.wallet).toBe(252);
  });

  it("awards emote rewards independently from chat rewards", () => {
    const { activity } = createTestServices(new SequenceRandomSource([0.999, 0]));

    const chat = activity.awardChat("guild", "user", 1000);
    const emote = activity.awardEmote("guild", "user", 1000);
    expect(chat.ok && chat.amount).toBe(4);
    expect(emote.ok && emote.amount).toBe(2);
    expect(emote.ok && emote.player.wallet).toBe(256);

    const blocked = activity.awardEmote("guild", "user", 1000 + EMOTE_REWARD_COOLDOWN_MS - 1);
    expect(blocked.ok).toBe(false);
  });

  it("detects unicode emoji and Discord custom emotes in message text", () => {
    expect(containsEmojiOrCustomEmote("nice score 🔥")).toBe(true);
    expect(containsEmojiOrCustomEmote("cash <a:spincoin:1234567890>")).toBe(true);
    expect(containsEmojiOrCustomEmote("plain ledger text")).toBe(false);
  });
});
