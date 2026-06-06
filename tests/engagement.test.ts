import { describe, expect, it } from "vitest";
import { SequenceRandomSource } from "../src/game/random.js";
import { roleLabel } from "../src/services/crew-heists.js";
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

  it("rejects unknown case files and launders wallet cash", () => {
    const { cases, repo } = createTestServices(new SequenceRandomSource([0]));
    const player = repo.ensurePlayer("guild", "user", 1000);
    player.wallet = 400;
    player.heat = 20;
    repo.savePlayer(player, 1000);

    expect(cases.run("guild", "user", "missing", 2000)).toMatchObject({
      ok: false,
      reason: "unknown_case"
    });

    const result = cases.run("guild", "user", "quick_launder", 2000);
    expect(result.ok && result.reward).toBe(15);
    expect(result.ok && result.laundered).toBe(100);
    expect(result.ok && result.player.wallet).toBe(315);
    expect(result.ok && result.player.bank).toBe(100);
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

  it("rejects missing, expired, duplicate, and already claimed drop attempts", () => {
    const { drops } = createTestServices(new SequenceRandomSource([0, 0]));
    const drop = drops.createDrop("guild", "channel", 1000);

    expect(drops.claim("missing", "user", 2000)).toMatchObject({ ok: false, reason: "missing" });
    expect(drops.claim(drop.id, "user", drop.expiresAt + 1)).toMatchObject({ ok: false, reason: "expired" });

    const live = drops.createDrop("guild", "channel", 5000);
    drops.attachMessage(live.id, "message-id");
    expect(drops.claim(live.id, "user", 6000)).toMatchObject({ ok: true, completed: true });
    expect(drops.claim(live.id, "user", 7000)).toMatchObject({ ok: false, reason: "claimed" });
  });

  it("rejects duplicate locked-case joins", () => {
    const lockedServices = createTestServices(new SequenceRandomSource([0.66, 0]));
    const lockedDrop = lockedServices.drops.createDrop("guild", "channel", 8000);
    expect(lockedDrop.kind).toBe("locked_case");
    expect(lockedServices.drops.claim(lockedDrop.id, "user", 9000)).toMatchObject({ ok: true, completed: false });
    expect(lockedServices.drops.claim(lockedDrop.id, "user", 9500)).toMatchObject({
      ok: false,
      reason: "already_joined"
    });
  });

  it("stores attached drop messages", () => {
    const { drops, repo } = createTestServices(new SequenceRandomSource([0, 0]));
    const live = drops.createDrop("guild", "channel", 5000);
    expect(drops.claim(live.id, "user", 6000).ok).toBe(true);
    drops.attachMessage(live.id, "message-id");
    expect(repo.getDrop(live.id)?.messageId).toBe("message-id");
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

  it("rejects invalid bounty placement and lists active bounties", () => {
    const { bounties, repo } = createTestServices();
    repo.ensurePlayer("guild", "target", 1000);

    expect(bounties.place("guild", "issuer", "issuer", 10, 1000)).toMatchObject({
      ok: false,
      reason: "self_target"
    });
    expect(bounties.place("guild", "issuer", "missing", 10, 1000)).toMatchObject({
      ok: false,
      reason: "target_not_enrolled"
    });
    expect(bounties.place("guild", "issuer", "target", 0, 1000)).toMatchObject({
      ok: false,
      reason: "invalid_amount"
    });
    expect(bounties.place("guild", "issuer", "target", 999, 1000)).toMatchObject({
      ok: false,
      reason: "insufficient_wallet"
    });

    const bounty = bounties.place("guild", "issuer", "target", 25, 1000);
    expect(bounty.ok).toBe(true);
    expect(bounties.list("guild", 2000)).toHaveLength(1);
    expect(bounties.list("guild", 4 * 24 * 60 * 60 * 1000)).toHaveLength(0);
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

  it("covers crew heist rejection and failure paths", () => {
    const { crewHeists, repo } = createTestServices(new SequenceRandomSource([0.99]));
    const target = repo.ensurePlayer("guild", "target", 1000);
    target.bank = 10_000;
    repo.savePlayer(target, 1000);

    expect(crewHeists.create("guild", "channel", "leader", "leader", 1000)).toMatchObject({
      ok: false,
      reason: "self_target"
    });
    expect(crewHeists.create("guild", "channel", "leader", "missing", 1000)).toMatchObject({
      ok: false,
      reason: "target_not_enrolled"
    });

    const emptyTarget = repo.ensurePlayer("guild", "empty", 1000);
    emptyTarget.bank = 0;
    repo.savePlayer(emptyTarget, 1000);
    expect(crewHeists.create("guild", "channel", "leader", "empty", 1000)).toMatchObject({
      ok: false,
      reason: "no_bank_cash"
    });

    const created = crewHeists.create("guild", "channel", "leader", "target", 2000);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    crewHeists.attachMessage(created.heist.id, "message");
    expect(repo.getCrewHeist(created.heist.id)?.messageId).toBe("message");

    expect(crewHeists.join("missing", "user", "driver", 2500)).toMatchObject({ ok: false, reason: "missing" });
    expect(crewHeists.join(created.heist.id, "target", "driver", 2500)).toMatchObject({
      ok: false,
      reason: "target_joined"
    });
    expect(crewHeists.join(created.heist.id, "leader", "driver", 2500)).toMatchObject({
      ok: false,
      reason: "already_joined"
    });
    expect(crewHeists.join(created.heist.id, "driver", "driver", 2500).ok).toBe(true);
    expect(crewHeists.join(created.heist.id, "other", "driver", 2600)).toMatchObject({
      ok: false,
      reason: "role_taken"
    });
    expect(crewHeists.resolve(created.heist.id, "other", 2700)).toMatchObject({
      ok: false,
      reason: "not_leader"
    });

    const shortCrew = crewHeists.create("guild", "channel", "short", "target", 2750);
    expect(shortCrew.ok).toBe(true);
    if (shortCrew.ok) {
      expect(crewHeists.resolve(shortCrew.heist.id, "short", 2760)).toMatchObject({
        ok: false,
        reason: "short_crew"
      });
    }

    const failed = crewHeists.resolve(created.heist.id, "leader", 2800);
    expect(failed.ok && !failed.success && failed.fine).toBeGreaterThan(0);
    expect(crewHeists.join(created.heist.id, "late", "lookout", 2900)).toMatchObject({
      ok: false,
      reason: "closed"
    });
    expect(crewHeists.resolve(created.heist.id, "leader", 3000)).toMatchObject({
      ok: false,
      reason: "closed"
    });

    const expiring = crewHeists.create("guild", "channel", "leader2", "target", 10_000);
    expect(expiring.ok).toBe(true);
    if (expiring.ok) {
      expect(crewHeists.join(expiring.heist.id, "late", "driver", 200_001)).toMatchObject({
        ok: false,
        reason: "expired"
      });
    }

    expect(crewHeists.resolve("missing", "leader", 3000)).toMatchObject({
      ok: false,
      reason: "missing"
    });

    const noBank = crewHeists.create("guild", "channel", "leader3", "target", 20_000);
    expect(noBank.ok).toBe(true);
    if (noBank.ok) {
      expect(crewHeists.join(noBank.heist.id, "driver3", "driver", 20_100).ok).toBe(true);
      const updatedTarget = repo.ensurePlayer("guild", "target", 20_200);
      updatedTarget.bank = 0;
      repo.savePlayer(updatedTarget, 20_200);
      expect(crewHeists.resolve(noBank.heist.id, "leader3", 20_300)).toMatchObject({
        ok: false,
        reason: "no_bank_cash"
      });
    }
  });

  it("pays crew-heist bounties to the leader and labels unknown roles", () => {
    const { bounties, crewHeists, repo } = createTestServices(new SequenceRandomSource([0, 0]));
    const target = repo.ensurePlayer("guild", "target", 1000);
    target.bank = 10_000;
    repo.savePlayer(target, 1000);

    expect(bounties.place("guild", "issuer", "target", 50, 1500).ok).toBe(true);
    const created = crewHeists.create("guild", "channel", "leader", "target", 2000);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(crewHeists.join(created.heist.id, "driver", "driver", 2100).ok).toBe(true);
    const result = crewHeists.resolve(created.heist.id, "leader", 2200);

    expect(result.ok && result.success && result.bountyPaid).toBe(50);
    expect(roleLabel("driver")).toBe("Driver");
    expect(roleLabel("mystery" as never)).toBe("mystery");
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

  it("suppresses and marks Gazette digests by cadence and event count", () => {
    const { gazette, repo } = createTestServices();
    repo.ensurePlayer("guild", "user", 1000);

    expect(gazette.build("guild", 2000)).toBeNull();

    gazette.markPosted("guild", 3000);
    expect(gazette.build("guild", 4000)).toBeNull();
    expect(repo.ensureGuild("guild", 5000).lastGazetteAt).toBe(3000);
  });

  it("summarizes heists, failures, bounties, and heat in Gazette digests", () => {
    const { gazette, repo } = createTestServices();
    const now = 10 * 24 * 60 * 60 * 1000;
    const player = repo.ensurePlayer("guild", "user", 1000);
    player.heat = 80;
    repo.savePlayer(player, 1000);
    const other = repo.ensurePlayer("guild", "other", 1000);
    other.heat = 60;
    repo.savePlayer(other, 1000);

    for (const transaction of [
      { type: "heist_success", amount: 300 },
      { type: "crew_heist_success", amount: 500 },
      { type: "rob_failure", amount: -50 },
      { type: "heist_failure", amount: -150 },
      { type: "bounty_claim", amount: 75 }
    ]) {
      repo.recordTransaction({
        guildId: "guild",
        userId: "user",
        seasonId: player.seasonId,
        type: transaction.type,
        amount: transaction.amount,
        createdAt: now - 1000
      });
    }

    const view = gazette.build("guild", now);
    expect(view?.mostWanted?.userId).toBe("user");
    expect(view?.biggestHeist?.amount).toBe(500);
    expect(view?.worstFailure?.amount).toBe(-150);
    expect(view?.bountyClaim?.amount).toBe(75);
  });
});
