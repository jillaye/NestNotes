/** Sync status for offline-first sync-ready data */
export type SyncStatus = "pending" | "synced";

export type Role = "admin" | "birder";

export interface User {
  id: string;
  role: Role;
}

/** Common columns on every user-created table */
export interface SyncColumns {
  id: string;
  created_by: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: SyncStatus;
}

export interface Collection extends SyncColumns {
  name: string;
  created_at: string;
}

export interface NestBox extends SyncColumns {
  collection_id: string;
  name: string;
  latitude: number;
  longitude: number;
  properties_json: string | null;
}

export type ObservationKind = "nest" | "box" | "legacy";

interface ObservationBase extends SyncColumns {
  nest_box_id: string;
  observed_on: string;
  inspector: string;
  notes: string;
}

export interface NestObservation extends ObservationBase {
  kind: "nest";
  nests: number;
  eggs: number | null;
  chicks: number | null;
  cleaned_out: boolean;
}

export interface BoxObservation extends ObservationBase {
  kind: "box";
  nests: number | null;
  eggs: number | null;
  chicks: number | null;
  cleaned_out: boolean;
  box_not_found: boolean;
  box_gone_pole_present: boolean;
  pole_cut_down: boolean;
}

export interface LegacyObservation extends ObservationBase {
  kind: "legacy";
  nests: number | null;
  eggs: number | null;
  chicks: number | null;
  cleaned_out: boolean;
}

export type Observation = NestObservation | BoxObservation | LegacyObservation;