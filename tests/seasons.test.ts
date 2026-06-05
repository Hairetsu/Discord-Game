import { describe, expect, it } from "vitest";
import { SECURITY_BY_ID } from "../src/game/constants.js";
import { createTestServices } from "./helpers.js";

describe("seasons", () => {
  it("soft-resets seasonal money and loadouts while preserving lifetime stats", () => {
    const { repo } = createTestServices();
    const player = repo.ensurePlayer("guild", "user", 1000);
    player.wallet = 9000;
    player.bank = 4000;
    player.lifetimeEarned = 12_000;
    player.lifetimeStolen = 3000;
    player.robberyShieldUntil = 0;
    repo.savePlayer(player, 1000);
    repo.addInventoryAndEquip("guild", "user", player.seasonId, SECURITY_BY_ID.get("vault_i")!);

    const next = repo.startNextSeason("guild", 2000);
    expect(next.seasonId).toBe(2);
    expect(next.winnerUserId).toBe("user");

    const newSeasonPlayer = repo.ensurePlayer("guild", "user", 3000);
    expect(newSeasonPlayer.seasonId).toBe(2);
    expect(newSeasonPlayer.wallet).toBe(250);
    expect(newSeasonPlayer.bank).toBe(0);
    expect(newSeasonPlayer.lifetimeEarned).toBe(12_000);
    expect(newSeasonPlayer.lifetimeStolen).toBe(3000);
    expect(repo.getLoadoutItems("guild", "user", newSeasonPlayer.seasonId)).toEqual([]);
  });
});
