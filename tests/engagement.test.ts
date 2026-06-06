import { describe, expect, it } from "vitest";
import { SequenceRandomSource } from "../src/game/random.js";
import { createTestServices } from "./helpers.js";

describe("engagement systems", () => {
  it("runs one private case per local day and adjusts heat", () => {
    const { cases, repo } = createTestServices(new SequenceRandomSource([0]));
    const player = repo.ensurePlayer("guild", "user", Date.UTC(2026, 0, 1, 12));
    player.heat = 50;
    repo.savePlayer(player, Date.UTC(2026, 0, 1, 12));

    const result = cases.run("guild", "user", "stakeout", Date.UTC(2026, 0, 1, 13));
    expect(result.ok).toBe(true);
    expect(result.ok && result.reward).toBe(25);
    expect(result.ok && result.player.heat).toBe(24);

    const cooldown = cases.run("guild", "user", "quiet_pickup", Date.UTC(2026, 0, 1, 14));
    expect(cooldown).toMatchObject({ ok: false, reason: "cooldown" });
  });

  it("requires two different players to open a locked drop and splits the payout", () => {
    const { drops, repo } = createTestServices(new SequenceRandomSource([0.66, 0]));
    const drop = drops.createDrop("guild", "channel", 1000);
    expect(drop.kind).toBe("locked_case");
    expect(drop.amount).toBe(160);

    const first = drops.claim(drop.id, "one", 2000);
    expect(first).toMatchObject({ ok: true, completed: false, claimsNeeded: 1 });

    const second = drops.claim(drop.id, "two", 3000);
    expect(second).toMatchObject({ ok: true, completed: true, perPlayerAmount: 80 });
    expect(repo.ensurePlayer("guild", "one", 4000).wallet).toBe(330);
    expect(repo.ensurePlayer("guild", "two", 4000).wallet).toBe(330);
  });

  it("pays active bounties when a robbery succeeds", () => {
    const { bounties, repo, robbery } = createTestServices(new SequenceRandomSource([0, 0]));
    const issuer = repo.ensurePlayer("guild", "issuer", 1000);
    const robber = repo.ensurePlayer("guild", "robber", 1000);
    const target = repo.ensurePlayer("guild", "target", 1000);
    target.wallet = 1000;
    repo.savePlayer(issuer, 1000);
    repo.savePlayer(robber, 1000);
    repo.savePlayer(target, 1000);

    const bounty = bounties.place("guild", "issuer", "target", 100, 2000);
    expect(bounty.ok).toBe(true);

    const result = robbery.rob("guild", "robber", "target", 3000);
    expect(result.ok && result.success && result.stolen).toBe(100);
    expect(result.ok && result.success && result.bountyPaid).toBe(100);
    expect(result.ok && result.success && result.robber.wallet).toBe(450);
  });

  it("resolves a two-person crew heist", () => {
    const { crewHeists, repo } = createTestServices(new SequenceRandomSource([0, 0]));
    const target = repo.ensurePlayer("guild", "target", 1000);
    target.bank = 10_000;
    repo.savePlayer(target, 1000);

    const created = crewHeists.create("guild", "channel", "leader", "target", 2000);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const joined = crewHeists.join(created.heist.id, "driver", "driver", 2500);
    expect(joined.ok).toBe(true);

    const result = crewHeists.resolve(created.heist.id, "leader", 3000);
    expect(result.ok && result.success && result.stolen).toBe(300);
    expect(result.ok && result.success && result.payout).toBe(150);
  });

  it("builds a Gazette when enough events have accumulated", () => {
    const { gazette, repo } = createTestServices();
    const player = repo.ensurePlayer("guild", "user", 1000);
    const now = 10 * 24 * 60 * 60 * 1000;
    for (let index = 0; index < 3; index += 1) {
      repo.recordTransaction({
        guildId: "guild",
        userId: "user",
        seasonId: player.seasonId,
        type: "drop_claim",
        amount: 50 + index,
        createdAt: now - 1000 + index
      });
    }

    const view = gazette.build("guild", now);
    expect(view?.eventCount).toBeGreaterThanOrEqual(3);
    expect(view?.biggestDrop?.amount).toBe(52);
  });
});
