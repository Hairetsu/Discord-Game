import { describe, expect, it } from "vitest";
import { HEIST_MAX_STEAL, ROB_MAX_STEAL } from "../src/game/constants.js";
import { NEW_PLAYER_SHIELD_MS, SECURITY_BY_ID } from "../src/game/constants.js";
import { SequenceRandomSource } from "../src/game/random.js";
import { createTestServices, LcgRandomSource } from "./helpers.js";

describe("robbery service", () => {
  it("does not give new players robbery protection", () => {
    const { repo, robbery } = createTestServices(new SequenceRandomSource([0, 0]));
    const robber = repo.ensurePlayer("guild", "robber", 1000);
    const player = repo.ensurePlayer("guild", "target", 1000);
    robber.wallet = 1000;
    player.wallet = 1000;
    player.robberyShieldUntil = 999_999_999;
    repo.savePlayer(robber, 1000);
    repo.savePlayer(player, 1000);

    const result = robbery.rob("guild", "robber", "target", 2000);

    expect(NEW_PLAYER_SHIELD_MS).toBe(0);
    expect(result.ok && result.success && result.stolen).toBe(100);
  });

  it("steals bounded wallet cash on a successful robbery", () => {
    const { repo, robbery } = createTestServices(new SequenceRandomSource([0, 0]));
    const robber = repo.ensurePlayer("guild", "robber", 1000);
    const target = repo.ensurePlayer("guild", "target", 1000);
    robber.wallet = 1000;
    target.wallet = 1000;
    target.robberyShieldUntil = 0;
    repo.savePlayer(robber, 1000);
    repo.savePlayer(target, 1000);

    const result = robbery.rob("guild", "robber", "target", 2000);
    expect(result.ok && result.success && result.stolen).toBe(100);
    expect(result.ok && result.success && result.robber.wallet).toBe(1100);
    expect(result.ok && result.success && result.target.wallet).toBe(900);
  });

  it("applies alarm fines and guard counters on failed attacks", () => {
    const { repo, robbery } = createTestServices(new SequenceRandomSource([0.99]));
    const robber = repo.ensurePlayer("guild", "robber", 1000);
    const target = repo.ensurePlayer("guild", "target", 1000);
    robber.wallet = 1000;
    target.wallet = 1000;
    target.robberyShieldUntil = 0;
    repo.savePlayer(robber, 1000);
    repo.savePlayer(target, 1000);
    repo.addInventoryAndEquip("guild", "target", target.seasonId, SECURITY_BY_ID.get("alarm_i")!);
    repo.addInventoryAndEquip("guild", "target", target.seasonId, SECURITY_BY_ID.get("guard_i")!);

    const result = robbery.rob("guild", "robber", "target", 2000);
    expect(result.ok && !result.success && result.fine).toBe(165);
    expect(result.ok && !result.success && result.counterSteal).toBe(41);
    expect(result.ok && !result.success && result.robber.wallet).toBe(794);
    expect(result.ok && !result.success && result.target.wallet).toBe(1041);
  });

  it("caps bank heists and restores insured losses", () => {
    const { repo, robbery } = createTestServices(new SequenceRandomSource([0, 1]));
    const robber = repo.ensurePlayer("guild", "robber", 1000);
    const target = repo.ensurePlayer("guild", "target", 1000);
    robber.wallet = 1000;
    target.wallet = 1000;
    target.bank = 100_000;
    target.robberyShieldUntil = 0;
    repo.savePlayer(robber, 1000);
    repo.savePlayer(target, 1000);
    repo.addInventoryAndEquip("guild", "target", target.seasonId, SECURITY_BY_ID.get("insurance_ii")!);

    const result = robbery.heist("guild", "robber", "target", 2000);
    expect(result.ok && result.success && result.stolen).toBe(HEIST_MAX_STEAL);
    expect(result.ok && result.success && result.insuranceRestore).toBe(300);
    expect(result.ok && result.success && result.target.bank).toBe(98_800);
  });

  it("does not rob users who have not entered the current season", () => {
    const { repo, robbery } = createTestServices(new SequenceRandomSource([0]));
    repo.ensureGuild("guild", 1000);
    repo.ensurePlayer("guild", "robber", 1000);

    const result = robbery.rob("guild", "robber", "target", 2000);
    expect(result).toMatchObject({ ok: false, reason: "target_not_enrolled" });
  });

  it("refuses self-targets, empty targets, cooldowns, and heist lockouts", () => {
    const { repo, robbery } = createTestServices(new SequenceRandomSource([0]));
    const robber = repo.ensurePlayer("guild", "robber", 1000);
    const target = repo.ensurePlayer("guild", "target", 1000);

    expect(robbery.rob("guild", "robber", "robber", 2000)).toMatchObject({
      ok: false,
      reason: "self_target"
    });

    target.wallet = 0;
    target.bank = 0;
    repo.savePlayer(target, 1000);
    expect(robbery.rob("guild", "robber", "target", 2000)).toMatchObject({
      ok: false,
      reason: "no_wallet_cash"
    });
    expect(robbery.heist("guild", "robber", "target", 2000)).toMatchObject({
      ok: false,
      reason: "no_bank_cash"
    });

    target.wallet = 1000;
    target.bank = 1000;
    robber.robCooldownUntil = 5000;
    repo.savePlayer(robber, 1000);
    repo.savePlayer(target, 1000);
    expect(robbery.rob("guild", "robber", "target", 2000)).toMatchObject({
      ok: false,
      reason: "cooldown"
    });

    robber.robCooldownUntil = 0;
    robber.heistLockoutUntil = 5000;
    repo.savePlayer(robber, 1000);
    expect(robbery.heist("guild", "robber", "target", 2000)).toMatchObject({
      ok: false,
      reason: "lockout"
    });

    robber.heistLockoutUntil = 0;
    robber.heistCooldownUntil = 5000;
    repo.savePlayer(robber, 1000);
    expect(robbery.heist("guild", "robber", "target", 2000)).toMatchObject({
      ok: false,
      reason: "cooldown"
    });
  });

  it("keeps simulated rob and heist rates near configured odds with capped losses", () => {
    const { repo, robbery } = createTestServices(new LcgRandomSource(42));
    const robber = repo.ensurePlayer("guild", "robber", 1000);
    const target = repo.ensurePlayer("guild", "target", 1000);
    target.robberyShieldUntil = 0;
    repo.savePlayer(target, 1000);

    let robSuccesses = 0;
    let heistSuccesses = 0;
    let maxRobSteal = 0;
    let maxHeistSteal = 0;

    for (let index = 0; index < 1000; index += 1) {
      robber.wallet = 1000;
      robber.robCooldownUntil = 0;
      robber.heistCooldownUntil = 0;
      robber.heistLockoutUntil = 0;
      target.wallet = 10_000;
      target.bank = 100_000;
      repo.savePlayer(robber, 2000 + index);
      repo.savePlayer(target, 2000 + index);

      const rob = robbery.rob("guild", "robber", "target", 3000 + index);
      if (rob.ok && rob.success) {
        robSuccesses += 1;
        maxRobSteal = Math.max(maxRobSteal, rob.stolen);
      }

      robber.wallet = 1000;
      robber.robCooldownUntil = 0;
      robber.heistCooldownUntil = 0;
      robber.heistLockoutUntil = 0;
      target.wallet = 10_000;
      target.bank = 100_000;
      repo.savePlayer(robber, 4000 + index);
      repo.savePlayer(target, 4000 + index);

      const heist = robbery.heist("guild", "robber", "target", 5000 + index);
      if (heist.ok && heist.success) {
        heistSuccesses += 1;
        maxHeistSteal = Math.max(maxHeistSteal, heist.stolen);
      }
    }

    expect(robSuccesses).toBeGreaterThan(400);
    expect(robSuccesses).toBeLessThan(500);
    expect(heistSuccesses).toBeGreaterThan(200);
    expect(heistSuccesses).toBeLessThan(300);
    expect(maxRobSteal).toBeLessThanOrEqual(ROB_MAX_STEAL);
    expect(maxHeistSteal).toBeLessThanOrEqual(HEIST_MAX_STEAL);
  });
});
