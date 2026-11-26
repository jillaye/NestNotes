import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getBoxesByCollection } from "@/db/boxes";
import { getObservationsByCollection } from "@/db/observations";
import type { Collection, User } from "@/types";
import { toGeoJSON, type ParsedCollection } from "@/lib/geojson";
import { canDelete, LOCAL_USER_ID } from "@/lib/permissions";

const now = (): string => new Date().toISOString();

export interface CollectionWithCounts extends Collection {
  box_count: number;
  observation_count: number;
}

/**
 * Get all active collections with their box and observation counts.
 */
export async function getAllCollections(
  db: SQLiteDatabase,
): Promise<CollectionWithCounts[]> {
  return db.getAllAsync<CollectionWithCounts>(
    `SELECT
       c.*,
       CAST(COALESCE(box_counts.cnt, 0) AS INTEGER) AS box_count,
       CAST(COALESCE(obs_counts.cnt, 0) AS INTEGER) AS observation_count
     FROM collections c
     LEFT JOIN (
       SELECT collection_id, COUNT(*) AS cnt
       FROM nest_boxes
       WHERE deleted_at IS NULL
       GROUP BY collection_id
     ) box_counts ON box_counts.collection_id = c.id
     LEFT JOIN (
       SELECT nb.collection_id, COUNT(*) AS cnt
       FROM observations o
       JOIN nest_boxes nb ON nb.id = o.nest_box_id
       WHERE o.deleted_at IS NULL AND nb.deleted_at IS NULL
       GROUP BY nb.collection_id
     ) obs_counts ON obs_counts.collection_id = c.id
     WHERE c.deleted_at IS NULL
     ORDER BY c.created_at DESC`,
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
    "UPDATE collections SET name = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL",
    name,
    now(),
    id,
  );
}

/**
 * Soft-delete a collection, all its nest boxes, and all their observations.
 * Throws if the user does not have permission.
 *
 * ponytail: soft-deleted rows stay in the DB forever. Upgrade path: a hard
 * purge after v2 sync confirms the delete.
 */
export async function deleteCollection(
  db: SQLiteDatabase,
  user: User,
  id: string,
): Promise<void> {
  const collection = await db.getFirstAsync<Collection>(
    "SELECT * FROM collections WHERE id = ? AND deleted_at IS NULL",
    id,
  );
  if (!collection) return; // already gone, no-op

  if (!canDelete(user, collection)) {
    throw new Error("You don't have permission to delete this collection.");
  }

  const ts = now();

  await db.withTransactionAsync(async () => {
    // Soft-delete all observations on this collection's boxes first,
    // before the boxes themselves are soft-deleted (the subquery needs
    // to find them).
    await db.runAsync(
      `UPDATE observations SET deleted_at = ?, updated_at = ?, sync_status = 'pending'
       WHERE nest_box_id IN (
         SELECT id FROM nest_boxes WHERE collection_id = ? AND deleted_at IS NULL
       )`,
      ts,
      ts,
      id,
    );

    // Soft-delete all its boxes
    await db.runAsync(
      "UPDATE nest_boxes SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE collection_id = ? AND deleted_at IS NULL",
      ts,
      ts,
      id,
    );

    // Soft-delete the collection
    await db.runAsync(
      "UPDATE collections SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
      ts,
      ts,
      id,
    );
  });
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
          `INSERT INTO observations (id, nest_box_id, kind, observed_on, inspector, nests, eggs, chicks, cleaned_out, box_not_found, box_gone_pole_present, pole_cut_down, notes, created_by, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          obsId,
          boxId,
          obs.kind,
          obs.observed_on,
          obs.inspector,
          obs.nests,
          obs.eggs,
          obs.chicks,
          obs.cleaned_out ? 1 : 0,
          obs.box_not_found ? 1 : 0,
          obs.box_gone_pole_present ? 1 : 0,
          obs.pole_cut_down ? 1 : 0,
          obs.notes,
          LOCAL_USER_ID,
          ts,
        );
      }
    }
  });

  return collectionId;
}

/**
 * Export a collection to `<name>-<YYYY-MM-DD>.geojson` in the cache directory
 * and open the system share sheet. Throws a readable error if sharing is
 * unavailable or the file cannot be written.
 *
 * ponytail: the file is left in the cache directory for the OS to reclaim.
 * Add explicit cleanup only if stale exports ever become a problem.
 */
export async function exportCollection(
  db: SQLiteDatabase,
  collection: Collection,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }

  const [boxes, observations] = await Promise.all([
    getBoxesByCollection(db, collection.id),
    getObservationsByCollection(db, collection.id),
  ]);

  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // ponytail: strip path-illegal characters instead of slugifying the name —
  // the field team recognises "South Loop", not "south-loop".
  const safeName = collection.name.replace(/[\\/:*?"<>|]/g, "-");

  const file = new File(Paths.cache, `${safeName}-${stamp}.geojson`);
  file.create({ overwrite: true });
  await file.write(toGeoJSON(collection, boxes, observations));

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/geo+json",
    UTI: "public.json",
    dialogTitle: "Export collection",
  });
}