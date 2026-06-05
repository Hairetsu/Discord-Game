import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SqliteDatabase = Database.Database;

const migrationDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export function openDatabase(databasePath: string): SqliteDatabase {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function runMigrations(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>).map(
      (row) => row.version
    )
  );

  const files = readdirSync(migrationDir)
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const version = Number(file.split("_")[0]);
    if (applied.has(version)) {
      continue;
    }

    const sql = readFileSync(join(migrationDir, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        version,
        Date.now()
      );
    })();
  }
}
