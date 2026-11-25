import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Current schema version.
 *
 * ponytail: Bump this whenever CREATE_SCHEMA_SQL changes. Until the first real
 * release there are no shipped installs to migrate, so a bump rebuilds the
 * schema instead of migrating it (dev data is disposable). At the first release:
 * freeze CREATE_SCHEMA_SQL as the shipped v1 and switch to append-only
 * `if (version < N)` steps — real installs exist from then on, so resets are no
 * longer acceptable. Upgrade path is the header comment, not code.
 */
const SCHEMA_VERSION = 5;

/** The full current schema. Edit this in place as the schema evolves. */
const CREATE_SCHEMA_SQL = `
  CREATE TABLE collections (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE nest_boxes (
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

  CREATE TABLE observations (
    id TEXT PRIMARY KEY NOT NULL,
    nest_box_id TEXT NOT NULL REFERENCES nest_boxes(id),
    kind TEXT NOT NULL CHECK(kind IN ('nest', 'box', 'legacy')),
    observed_on TEXT NOT NULL,
    inspector TEXT NOT NULL,
    nests INTEGER,
    eggs INTEGER,
    chicks INTEGER,
    cleaned_out INTEGER NOT NULL DEFAULT 0,
    box_not_found INTEGER NOT NULL DEFAULT 0,
    box_gone_pole_present INTEGER NOT NULL DEFAULT 0,
    pole_cut_down INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE app_state (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE INDEX idx_nest_boxes_collection_id ON nest_boxes(collection_id);
  CREATE INDEX idx_observations_nest_box_id ON observations(nest_box_id);
`;

/** Drop children before parents so foreign keys never block the reset. */
const DROP_SCHEMA_SQL = `
  DROP TABLE IF EXISTS observations;
  DROP TABLE IF EXISTS nest_boxes;
  DROP TABLE IF EXISTS collections;
  DROP TABLE IF EXISTS app_state;
`;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const version = row?.user_version ?? 0;

  // PRAGMAs must run on every connection (not persisted in the DB file)
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");

  // ponytail: dev-only destructive rebuild. Existing dev DBs sit at an older
  // version, so they rebuild on the next launch. Replace with append-only
  // migrations at the first real release (see SCHEMA_VERSION).
  if (version < SCHEMA_VERSION) {
    await db.execAsync(DROP_SCHEMA_SQL);
    await db.execAsync(CREATE_SCHEMA_SQL);
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}