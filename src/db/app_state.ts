import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Get a value from the app_state key-value store.
 * Returns null if the key does not exist.
 */
export async function getAppState(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_state WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

/**
 * Set a value in the app_state key-value store (upsert).
 */
export async function setAppState(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)",
    key,
    value,
  );
}