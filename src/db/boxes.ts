import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import type { NestBox } from "@/types";

const LOCAL_USER_ID = "local";
const now = (): string => new Date().toISOString();

export async function getBoxesByCollection(
  db: SQLiteDatabase,
  collectionId: string,
): Promise<NestBox[]> {
  return db.getAllAsync<NestBox>(
    "SELECT * FROM nest_boxes WHERE collection_id = ? AND deleted_at IS NULL ORDER BY name",
    collectionId,
  );
}

export async function getBoxById(
  db: SQLiteDatabase,
  id: string,
): Promise<NestBox | null> {
  return db.getFirstAsync<NestBox>(
    "SELECT * FROM nest_boxes WHERE id = ? AND deleted_at IS NULL",
    id,
  );
}

export interface AddBoxInput {
  collection_id: string;
  name: string;
  latitude: number;
  longitude: number;
  properties_json?: string | null;
}

export async function addBox(
  db: SQLiteDatabase,
  input: AddBoxInput,
): Promise<string> {
  const id = randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO nest_boxes (id, collection_id, name, latitude, longitude, properties_json, created_by, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    id,
    input.collection_id,
    input.name,
    input.latitude,
    input.longitude,
    input.properties_json ?? null,
    LOCAL_USER_ID,
    ts,
  );
  return id;
}

export interface UpdateBoxInput {
  name?: string;
  latitude?: number;
  longitude?: number;
  properties_json?: string | null;
}

export async function updateBox(
  db: SQLiteDatabase,
  id: string,
  input: UpdateBoxInput,
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) {
    fields.push("name = ?");
    values.push(input.name);
  }
  if (input.latitude !== undefined) {
    fields.push("latitude = ?");
    values.push(input.latitude);
  }
  if (input.longitude !== undefined) {
    fields.push("longitude = ?");
    values.push(input.longitude);
  }
  if (input.properties_json !== undefined) {
    fields.push("properties_json = ?");
    values.push(input.properties_json);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  values.push(now());
  values.push(id);

  await db.runAsync(
    `UPDATE nest_boxes SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
    ...values,
  );
}

export async function deleteBox(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    "UPDATE nest_boxes SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    now(),
    now(),
    id,
  );
}