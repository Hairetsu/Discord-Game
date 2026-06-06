import { describe, expect, it } from "vitest";
import { SECURITY_BY_ID, SECURITY_ITEMS } from "../src/game/constants.js";
import { createTestServices } from "./helpers.js";

describe("security service", () => {
  it("lists shop items, buys security, and equips by slot", () => {
    const { repo, security } = createTestServices();

    expect(security.listShop()).toBe(SECURITY_ITEMS);

    const player = repo.ensurePlayer("guild", "user", 1000);
    player.wallet = 1000;
    repo.savePlayer(player, 1000);

    const result = security.buy("guild", "user", "vault_i", 1000);
    expect(result.ok).toBe(true);
    expect(result.ok && result.player.wallet).toBe(1000 - SECURITY_BY_ID.get("vault_i")!.cost);

    const loadout = security.getLoadout("guild", "user", 2000);
    expect(loadout.equipped.vault?.id).toBe("vault_i");
  });

  it("rejects unknown, duplicate, and unaffordable security purchases", () => {
    const { repo, security } = createTestServices();

    expect(security.buy("guild", "user", "missing", 1000)).toMatchObject({
      ok: false,
      reason: "unknown_item"
    });

    const player = repo.ensurePlayer("guild", "user", 1000);
    player.wallet = 10_000;
    repo.savePlayer(player, 1000);

    expect(security.buy("guild", "user", "guard_i", 2000).ok).toBe(true);
    expect(security.buy("guild", "user", "guard_i", 3000)).toMatchObject({
      ok: false,
      reason: "already_owned"
    });

    expect(security.buy("guild", "poor", "vault_iii", 4000)).toMatchObject({
      ok: false,
      reason: "insufficient_wallet"
    });
  });
});
