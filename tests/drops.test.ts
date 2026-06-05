import { describe, expect, it } from "vitest";
import { SequenceRandomSource } from "../src/game/random.js";
import { createTestServices } from "./helpers.js";

describe("drop service", () => {
  it("creates a timed drop and lets exactly one player claim it", () => {
    const { drops, repo } = createTestServices(new SequenceRandomSource([0.5, 0]));
    const drop = drops.createDrop("guild", "channel", 1000);
    expect(drop.amount).toBe(25);

    const result = drops.claim(drop.id, "user", 2000);
    expect(result.ok).toBe(true);

    const player = repo.ensurePlayer("guild", "user", 2000);
    expect(player.wallet).toBe(275);
    expect(player.lifetimeEarned).toBe(275);

    const secondClaim = drops.claim(drop.id, "other", 3000);
    expect(secondClaim).toMatchObject({ ok: false, reason: "claimed" });
  });

  it("rejects expired drops", () => {
    const { drops } = createTestServices(new SequenceRandomSource([0.5, 0]));
    const drop = drops.createDrop("guild", "channel", 1000);
    const result = drops.claim(drop.id, "user", drop.expiresAt + 1);

    expect(result).toMatchObject({ ok: false, reason: "expired" });
  });
});
