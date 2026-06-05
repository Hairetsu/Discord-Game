import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/database.js";

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
});
