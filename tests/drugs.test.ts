import { describe, expect, it } from "vitest";
import { CONTRABAND_BY_ID } from "../src/game/constants.js";
import { SequenceRandomSource } from "../src/game/random.js";
import { createTestServices } from "./helpers.js";

describe("drug service", () => {
  it("buys stash, sells it for wallet cash, and adds heat", () => {
    const { repo, drugs } = createTestServices(new SequenceRandomSource([0.5]));
    const player = repo.ensurePlayer("guild", "dealer", 1000);
    player.wallet = 10_000;
    repo.savePlayer(player, 1000);

    const buy = drugs.buy("guild", "dealer", "blue_static", 3, 2000);
    expect(buy.ok).toBe(true);
    expect(buy.ok && buy.inventory.quantity).toBe(3);
    expect(buy.ok && buy.player.wallet).toBeLessThan(10_000);

    const sell = drugs.sell("guild", "dealer", "blue_static", 2, 3000);
    expect(sell.ok && sell.busted).toBe(false);
    expect(sell.ok && !sell.busted && sell.payout).toBeGreaterThan(0);
    expect(sell.ok && sell.player.heat).toBeGreaterThan(0);

    const stash = drugs.stash("guild", "dealer", 4000);
    expect(stash.entries).toHaveLength(1);
    expect(stash.entries[0]?.inventory.quantity).toBe(1);
  });

  it("blocks buys when drug selling is disabled", () => {
    const { repo, drugs } = createTestServices();
    repo.updateGuildSettings("guild", { drugsEnabled: false }, 1000);

    expect(drugs.buy("guild", "dealer", "corner_candy", 1, 2000)).toMatchObject({
      ok: false,
      reason: "disabled"
    });
  });

  it("can bust a sale, confiscate stash, fine wallet cash, and mark public busts", () => {
    const { repo, drugs } = createTestServices(new SequenceRandomSource([0.5, 0.5, 0.5, 0.5, 0.5, 0]));
    const player = repo.ensurePlayer("guild", "dealer", 1000);
    player.wallet = 10_000;
    repo.savePlayer(player, 1000);
    repo.updateGuildSettings("guild", { publicBustThreshold: 1 }, 1000);

    const product = CONTRABAND_BY_ID.get("velvet_brick")!;
    expect(drugs.buy("guild", "dealer", product.id, 2, 2000).ok).toBe(true);

    const result = drugs.sell("guild", "dealer", product.id, 2, 3000);
    expect(result.ok && result.busted).toBe(true);
    if (result.ok && result.busted) {
      expect(result.fine).toBeGreaterThan(0);
      expect(result.confiscated).toBeGreaterThan(0);
      expect(result.publicBust).toBe(true);
    }
  });
});
