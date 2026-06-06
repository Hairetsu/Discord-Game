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

  it("rejects invalid and overdrawn money moves", () => {
    const { economy } = createTestServices();

    expect(economy.deposit("guild", "user", 0, 1000)).toMatchObject({
      ok: false,
      reason: "invalid_amount"
    });
    expect(economy.deposit("guild", "user", 999, 1000)).toMatchObject({
      ok: false,
      reason: "insufficient_wallet"
    });
    expect(economy.withdraw("guild", "user", 0, 1000)).toMatchObject({
      ok: false,
      reason: "invalid_amount"
    });
    expect(economy.withdraw("guild", "user", 1, 1000)).toMatchObject({
      ok: false,
      reason: "insufficient_bank"
    });
  });

  it("applies interest run even when no players qualify", () => {
    const { economy } = createTestServices();
    const result = economy.applyDailyInterest("guild", 1000);
    expect(result).toEqual({ applied: true, playersPaid: 0, totalPaid: 0 });
  });

  it("skips players whose bank balance earns less than one dollar", () => {
    const { economy, repo } = createTestServices();
    const player = repo.ensurePlayer("guild", "user", 1000);
    player.bank = 1;
    repo.savePlayer(player, 1000);

    expect(economy.applyDailyInterest("guild", 2000)).toEqual({
      applied: true,
      playersPaid: 0,
      totalPaid: 0
    });
  });

  it("withdraws bank cash and ranks the leaderboard", () => {
    const { economy, repo } = createTestServices();
    const one = repo.ensurePlayer("guild", "one", 1000);
    one.wallet = 100;
    one.bank = 500;
    repo.savePlayer(one, 1000);
    const two = repo.ensurePlayer("guild", "two", 1000);
    two.wallet = 900;
    repo.savePlayer(two, 1000);

    const withdraw = economy.withdraw("guild", "one", 200, 2000);
    expect(withdraw.ok && withdraw.player.wallet).toBe(300);
    expect(withdraw.ok && withdraw.player.bank).toBe(300);
    expect(economy.getBalance("guild", "one", 3000).wallet).toBe(300);
    expect(economy.leaderboard("guild", 3000, 2).map((entry) => entry.userId)).toEqual(["two", "one"]);
  });

  it("uses the Banker's Moon interest cap bonus", () => {
    const { economy, repo } = createTestServices();
    repo.startNextSeason("guild", 1000, "bankers_moon");
    const player = repo.ensurePlayer("guild", "user", 2000);
    player.bank = 100_000;
    repo.savePlayer(player, 2000);

    const result = economy.applyDailyInterest("guild", Date.UTC(2026, 0, 2));
    expect(result.totalPaid).toBe(DAILY_INTEREST_CAP + 250);
  });
});
