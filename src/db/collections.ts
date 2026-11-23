import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import type { Collection } from "@/types";
import type { ParsedCollection } from "@/lib/geojson";

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

/**
 * Import a parsed GeoJSON collection into the database inside a single
 * transaction. Creates the collection, all its boxes, and all observations.
 * Returns the new collection's id.
 */
export async function importCollection(
  db: SQLiteDatabase,
  parsed: ParsedCollection,
): Promise<string> {
  const collectionId = randomUUID();
  const collectionName = parsed.name || "Imported Collection";
  const ts = now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO collections (id, name, created_at, created_by, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      collectionId,
      collectionName,
      ts,
      LOCAL_USER_ID,
      ts,
    );

    for (const box of parsed.boxes) {
      const boxId = randomUUID();
      await db.runAsync(
        `INSERT INTO nest_boxes (id, collection_id, name, latitude, longitude, properties_json, created_by, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        boxId,
        collectionId,
        box.name,
        box.latitude,
        box.longitude,
        box.properties_json,
        LOCAL_USER_ID,
        ts,
      );

      for (const obs of box.observations) {
        const obsId = randomUUID();
        await db.runAsync(
          `INSERT INTO observations (id, nest_box_id, kind, observed_on, inspector, nests, eggs, chicks, cleaned_out, notes, created_by, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          obsId,
          boxId,
          obs.kind,
          obs.observed_on,
          obs.inspector,
          obs.nests,
          obs.eggs,
          obs.chicks,
          obs.cleaned_out ? 1 : 0,
          obs.notes,
          LOCAL_USER_ID,
          ts,
        );
      }
    }
  });

  return collectionId;
}