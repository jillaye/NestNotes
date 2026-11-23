import type { SQLiteDatabase } from "expo-sqlite";

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  if (row && row.user_version >= 1) return;

  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS nest_boxes (
      id TEXT PRIMARY KEY NOT NULL,
      collection_id TEXT NOT NULL REFERENCES collections(id),
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      properties_json TEXT,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY NOT NULL,
      nest_box_id TEXT NOT NULL REFERENCES nest_boxes(id),
      kind TEXT NOT NULL CHECK(kind IN ('nest', 'box', 'legacy')),
      observed_on TEXT NOT NULL,
      inspector TEXT NOT NULL,
      nests INTEGER,
      eggs INTEGER,
      chicks INTEGER,
      cleaned_out INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  await db.execAsync("PRAGMA user_version = 1");
}