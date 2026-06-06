import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, runMigrations } from "../src/db/database.js";

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
});
