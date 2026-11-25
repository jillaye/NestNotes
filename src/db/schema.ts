import type { SQLiteDatabase } from "expo-sqlite";

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const version = row?.user_version ?? 0;

  // PRAGMAs must run on every connection (not persisted in the DB file)
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");

  // v1: create core tables
  if (version < 1) {
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

  // v2: app_state key-value store
  if (version < 2) {
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`,
    );
    await db.execAsync("PRAGMA user_version = 2");
  }

  // v3: indexes for box & observation lookups (M1 requirement)
  if (version < 3) {
    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS idx_nest_boxes_collection_id ON nest_boxes(collection_id)",
    );
    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS idx_observations_nest_box_id ON observations(nest_box_id)",
    );
    await db.execAsync("PRAGMA user_version = 3");
  }
}