import { describe, expect, it } from "vitest";
import { DROP_INTERVAL_MAX_MS, DROP_INTERVAL_MIN_MS, DROP_LIFETIME_MS } from "../src/game/constants.js";
import { SequenceRandomSource } from "../src/game/random.js";
import { createTestServices } from "./helpers.js";

describe("drop service", () => {
  it("creates a timed drop and lets exactly one player claim it", () => {
    const { drops, repo } = createTestServices(new SequenceRandomSource([0.5, 0]));
    const drop = drops.createDrop("guild", "channel", 1000);
    expect(drop.amount).toBe(25);
    expect(drop.expiresAt - drop.createdAt).toBe(DROP_LIFETIME_MS);
    expect(DROP_LIFETIME_MS).toBe(90_000);

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

  it("schedules random drops every 10 to 20 minutes", () => {
    const now = 1000;
    const minRoll = createTestServices(new SequenceRandomSource([0])).drops.nextDropAt(now);
    const maxRoll = createTestServices(new SequenceRandomSource([0.999999])).drops.nextDropAt(now);

    expect(DROP_INTERVAL_MIN_MS).toBe(10 * 60 * 1000);
    expect(DROP_INTERVAL_MAX_MS).toBe(20 * 60 * 1000);
    expect(minRoll).toBe(now + DROP_INTERVAL_MIN_MS);
    expect(maxRoll).toBe(now + DROP_INTERVAL_MAX_MS);
  });
});
