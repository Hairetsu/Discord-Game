import { describe, expect, it } from "vitest";
import { SequenceRandomSource } from "../src/game/random.js";
import { createTestServices } from "./helpers.js";

describe("camera service", () => {
  it("records a successful robbery while battery powered", () => {
    const { repo, security, cameras, robbery } = createTestServices(new SequenceRandomSource([0, 0.5]));
    const target = repo.ensurePlayer("guild", "target", 1000);
    target.wallet = 10_000;
    repo.savePlayer(target, 1000);
    repo.ensurePlayer("guild", "robber", 1000);

    expect(security.buy("guild", "target", "camera_keyhole", 2000).ok).toBe(true);
    expect(cameras.recharge("guild", "target", 1, 3000).ok).toBe(true);

    const attack = robbery.rob("guild", "robber", "target", 4000);
    expect(attack.ok && attack.success).toBe(true);

    const footage = cameras.footage("guild", "target", 5000);
    expect(footage.recordings).toHaveLength(1);
    expect(footage.recordings[0]).toMatchObject({
      attackerUserId: "robber",
      attackType: "rob",
      success: true
    });
    expect(cameras.status("guild", "target", 5000).system?.batteryUnits).toBe(4);
  });

  it("does not record when the installed camera has no power", () => {
    const { repo, security, cameras, robbery } = createTestServices(new SequenceRandomSource([0, 0.5]));
    const target = repo.ensurePlayer("guild", "target", 1000);
    target.wallet = 10_000;
    repo.savePlayer(target, 1000);
    repo.ensurePlayer("guild", "robber", 1000);

    expect(security.buy("guild", "target", "camera_keyhole", 2000).ok).toBe(true);
    expect(robbery.rob("guild", "robber", "target", 4000).ok).toBe(true);

    expect(cameras.footage("guild", "target", 5000).recordings).toHaveLength(0);
  });

  it("records bank heists on the vault hall camera while grid powered", () => {
    const { repo, security, cameras, robbery } = createTestServices(new SequenceRandomSource([0, 0.5]));
    const target = repo.ensurePlayer("guild", "target", 1000);
    target.wallet = 10_000;
    target.bank = 10_000;
    repo.savePlayer(target, 1000);
    const robber = repo.ensurePlayer("guild", "robber", 1000);
    robber.wallet = 10_000;
    repo.savePlayer(robber, 1000);

    expect(security.buy("guild", "target", "camera_vault_hall", 2000).ok).toBe(true);
    expect(cameras.payGridBill("guild", "target", 1, 3000).ok).toBe(true);

    const attack = robbery.heist("guild", "robber", "target", 4000);
    expect(attack.ok && attack.success).toBe(true);

    const footage = cameras.footage("guild", "target", 5000);
    expect(footage.recordings).toHaveLength(1);
    expect(footage.recordings[0]).toMatchObject({
      attackerUserId: "robber",
      attackType: "heist",
      success: true,
      powerSource: "grid"
    });
  });

  it("blocks camera installs when cameras are disabled", () => {
    const { repo, security } = createTestServices();
    const player = repo.ensurePlayer("guild", "target", 1000);
    player.wallet = 10_000;
    repo.savePlayer(player, 1000);
    repo.updateGuildSettings("guild", { camerasEnabled: false }, 1000);

    expect(security.buy("guild", "target", "camera_keyhole", 2000)).toMatchObject({
      ok: false,
      reason: "cameras_disabled"
    });
  });
});
