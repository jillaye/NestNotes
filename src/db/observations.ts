import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import type { Observation, ObservationKind } from "@/types";

const LOCAL_USER_ID = "local";
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
  notes: string;
}

export async function addObservation(
  db: SQLiteDatabase,
  input: AddObservationInput,
): Promise<string> {
  const id = randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO observations (id, nest_box_id, kind, observed_on, inspector, nests, eggs, chicks, cleaned_out, notes, created_by, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    id,
    input.nest_box_id,
    input.kind,
    input.observed_on,
    input.inspector,
    input.nests,
    input.eggs,
    input.chicks,
    input.cleaned_out ? 1 : 0,
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
  } as unknown as Observation;
}

export async function getObservationsByBox(
  db: SQLiteDatabase,
  nestBoxId: string,
): Promise<Observation[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM observations WHERE nest_box_id = ? AND deleted_at IS NULL ORDER BY observed_on DESC",
    nestBoxId,
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

export async function deleteObservation(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    "UPDATE observations SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    now(),
    now(),
    id,
  );
}