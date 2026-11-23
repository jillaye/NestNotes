import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import type { Collection } from "@/types";

const LOCAL_USER_ID = "local";
const now = (): string => new Date().toISOString();

export async function getAllCollections(
  db: SQLiteDatabase,
): Promise<Collection[]> {
  return db.getAllAsync<Collection>(
    "SELECT * FROM collections WHERE deleted_at IS NULL ORDER BY created_at DESC",
  );
}

export async function getCollectionById(
  db: SQLiteDatabase,
  id: string,
): Promise<Collection | null> {
  return db.getFirstAsync<Collection>(
    "SELECT * FROM collections WHERE id = ? AND deleted_at IS NULL",
    id,
  );
}

export async function addCollection(
  db: SQLiteDatabase,
  name: string,
): Promise<string> {
  const id = randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO collections (id, name, created_at, created_by, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    id,
    name,
    ts,
    LOCAL_USER_ID,
    ts,
  );
  return id;
}

export async function updateCollection(
  db: SQLiteDatabase,
  id: string,
  name: string,
): Promise<void> {
  await db.runAsync(
    "UPDATE collections SET name = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    name,
    now(),
    id,
  );
}

export async function deleteCollection(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    "UPDATE collections SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    now(),
    now(),
    id,
  );
}