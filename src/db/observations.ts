import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import type { Observation, ObservationKind, User } from "@/types";
import { canDelete, LOCAL_USER_ID } from "@/lib/permissions";

const now = (): string => new Date().toISOString();

export interface AddObservationInput {
  nest_box_id: string;
  kind: ObservationKind;
  observed_on: string;
  inspector: string;
  nests: number | null;
  eggs: number | null;
  chicks: number | null;
  cleaned_out: boolean;
  box_not_found: boolean;
  box_gone_pole_present: boolean;
  pole_cut_down: boolean;
  notes: string;
}

export async function addObservation(
  db: SQLiteDatabase,
  input: AddObservationInput,
): Promise<string> {
  const id = randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO observations (id, nest_box_id, kind, observed_on, inspector, nests, eggs, chicks, cleaned_out, box_not_found, box_gone_pole_present, pole_cut_down, notes, created_by, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    id,
    input.nest_box_id,
    input.kind,
    input.observed_on,
    input.inspector,
    input.nests,
    input.eggs,
    input.chicks,
    input.cleaned_out ? 1 : 0,
    input.box_not_found ? 1 : 0,
    input.box_gone_pole_present ? 1 : 0,
    input.pole_cut_down ? 1 : 0,
    input.notes,
    LOCAL_USER_ID,
    ts,
  );
  return id;
}

function hydrateObservation(row: Record<string, unknown>): Observation {
  return {
    ...row,
    nests: row.nests ?? null,
    eggs: row.eggs ?? null,
    chicks: row.chicks ?? null,
    cleaned_out: Boolean(row.cleaned_out),
    box_not_found: Boolean(row.box_not_found),
    box_gone_pole_present: Boolean(row.box_gone_pole_present),
    pole_cut_down: Boolean(row.pole_cut_down),
  } as unknown as Observation;
}

export async function getObservationsByBox(
  db: SQLiteDatabase,
  nestBoxId: string,
): Promise<Observation[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM observations WHERE nest_box_id = ? AND deleted_at IS NULL ORDER BY observed_on DESC, updated_at DESC",
    nestBoxId,
  );
  return rows.map(hydrateObservation);
}

/** All active observations for a collection, across all its boxes (M8 export). */
export async function getObservationsByCollection(
  db: SQLiteDatabase,
  collectionId: string,
): Promise<Observation[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT o.* FROM observations o
     JOIN nest_boxes nb ON nb.id = o.nest_box_id
     WHERE nb.collection_id = ? AND o.deleted_at IS NULL AND nb.deleted_at IS NULL
     ORDER BY o.observed_on DESC, o.updated_at DESC`,
    collectionId,
  );
  return rows.map(hydrateObservation);
}

export async function getObservationById(
  db: SQLiteDatabase,
  id: string,
): Promise<Observation | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM observations WHERE id = ? AND deleted_at IS NULL",
    id,
  );
  return row ? hydrateObservation(row) : null;
}

/**
 * Soft-delete an observation.
 * Throws if the user does not have permission.
 */
export async function deleteObservation(
  db: SQLiteDatabase,
  user: User,
  id: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ created_by: string }>(
    "SELECT created_by FROM observations WHERE id = ? AND deleted_at IS NULL",
    id,
  );
  if (!row) return;

  if (!canDelete(user, row)) {
    throw new Error("You don't have permission to delete this observation.");
  }

  const ts = now();
  await db.runAsync(
    "UPDATE observations SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL",
    ts,
    ts,
    id,
  );
}