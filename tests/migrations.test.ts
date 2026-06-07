import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, runMigrations } from "../src/db/database.js";
import { HeistRepository } from "../src/db/repository.js";

describe("migrations", () => {
  it("creates the core economy tables from an empty database", () => {
    const db = openDatabase(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "guild_configs",
        "players",
        "seasons",
        "inventories",
        "loadouts",
        "drops",
        "transactions",
        "stock_positions",
        "stock_quote_cache",
        "schema_migrations"
      ])
    );
  });

  it("opens filesystem databases and skips already-applied migrations", () => {
    const directory = mkdtempSync(join(tmpdir(), "heist-bank-test-"));
    try {
      const path = join(directory, "nested", "test.sqlite");
      const db = openDatabase(path);
      const firstApplied = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number };
      runMigrations(db);
      const secondApplied = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number };

      expect(firstApplied.count).toBeGreaterThan(0);
      expect(secondApplied.count).toBe(firstApplied.count);
      db.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("caps old attack cooldowns when the cooldown-shortening migration runs", () => {
    const db = openDatabase(":memory:");
    const repo = new HeistRepository(db);
    const player = repo.ensurePlayer("guild", "user", Date.now());
    const farFuture = Date.now() + 10 * 60 * 60 * 1000;
    player.robCooldownUntil = farFuture;
    player.heistCooldownUntil = farFuture;
    player.heistLockoutUntil = farFuture;
    repo.savePlayer(player, Date.now());

    db.prepare("DELETE FROM schema_migrations WHERE version = 5").run();
    runMigrations(db);

    const updated = repo.getPlayer("guild", "user", player.seasonId)!;
    expect(updated.robCooldownUntil).toBeLessThanOrEqual(Date.now() + 16 * 60 * 1000);
    expect(updated.heistCooldownUntil).toBeLessThanOrEqual(Date.now() + 61 * 60 * 1000);
    expect(updated.heistLockoutUntil).toBeLessThanOrEqual(Date.now() + 31 * 60 * 1000);
  });

  it("resets existing player heat when the heat reset migration runs", () => {
    const db = openDatabase(":memory:");
    const repo = new HeistRepository(db);
    const player = repo.ensurePlayer("guild", "user", Date.now());
    player.heat = 72;
    repo.savePlayer(player, Date.now());

    db.prepare("DELETE FROM schema_migrations WHERE version = 6").run();
    runMigrations(db);

    expect(repo.getPlayer("guild", "user", player.seasonId)?.heat).toBe(0);
  });
});
