import { describe, expect, it } from "vitest";
import { DAILY_INTEREST_CAP } from "../src/game/constants.js";
import { createTestServices } from "./helpers.js";

describe("economy service", () => {
  it("deposits wallet cash and pays daily interest once per local day", () => {
    const { economy } = createTestServices();
    const guildId = "guild";
    const userId = "user";
    const dayOne = Date.UTC(2026, 0, 1, 15);
    const dayTwo = Date.UTC(2026, 0, 2, 15);

    const deposit = economy.deposit(guildId, userId, 200, dayOne);
    expect(deposit.ok).toBe(true);
    expect(deposit.ok && deposit.player.wallet).toBe(50);
    expect(deposit.ok && deposit.player.bank).toBe(200);

    const firstRun = economy.applyDailyInterest(guildId, dayOne);
    expect(firstRun).toEqual({ applied: true, playersPaid: 1, totalPaid: 2 });

    const secondRun = economy.applyDailyInterest(guildId, dayOne + 60_000);
    expect(secondRun.applied).toBe(false);

    const nextDay = economy.applyDailyInterest(guildId, dayTwo);
    expect(nextDay.applied).toBe(true);
    expect(nextDay.totalPaid).toBe(2);
  });

  it("caps daily interest at the configured maximum", () => {
    const { repo, economy } = createTestServices();
    const player = repo.ensurePlayer("guild", "user", 1000);
    player.bank = 100_000;
    repo.savePlayer(player, 1000);

    const result = economy.applyDailyInterest("guild", 1000);
    expect(result.totalPaid).toBe(DAILY_INTEREST_CAP);
  });
});
