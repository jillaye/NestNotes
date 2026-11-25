/** An observation parsed from a GeoJSON import, ready to be inserted. */
export interface ParsedObservation {
  kind: "nest" | "box" | "legacy";
  observed_on: string;
  inspector: string;
  nests: number | null;
  eggs: number | null;
  chicks: number | null;
  cleaned_out: boolean;
  notes: string;
}

/** A nest box parsed from a GeoJSON import. */
export interface ParsedBox {
  name: string;
  latitude: number;
  longitude: number;
  properties_json: string | null;
  observations: ParsedObservation[];
}

function safeNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** The result of parsing a GeoJSON file for import. */
export interface ParsedCollection {
  name?: string;
  boxes: ParsedBox[];
  skipped: number;
}

/**
 * Parse a GeoJSON text string into a collection of nest boxes.
 *
 * Accepts both:
 * - **NestNotes format**: top-level `"nestnotes": { "version": 1 }` with
 *   `properties.observations[]` on each feature.
 * - **Legacy format** (e.g. Sample.geojson): name from `properties.name`,
 *   non-empty `properties.desc` becomes one `legacy` observation.
 *
 * @throws if the text is not valid JSON, not a FeatureCollection, or has
 *         structural issues at the trust boundary.
 */
export function parseCollection(text: string): ParsedCollection {
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON: could not parse the file.");
  }

  if (!root || typeof root !== "object") {
    throw new Error("Invalid GeoJSON: expected a JSON object.");
  }

  // Detect NestNotes format
  const nestnotes = root.nestnotes as Record<string, unknown> | undefined;
  const isNestNotes =
    nestnotes &&
    typeof nestnotes === "object" &&
    (nestnotes as Record<string, unknown>).version === 1;

  if (root.type !== "FeatureCollection") {
    throw new Error('Invalid GeoJSON: expected type "FeatureCollection".');
  }

  const features = root.features;
  if (!Array.isArray(features)) {
    throw new Error('Invalid GeoJSON: "features" must be an array.');
  }

  const boxes: ParsedBox[] = [];
  let skipped = 0;

  for (const feature of features) {
    const f = feature as Record<string, unknown>;

    // Skip non-Feature entries
    if (!f || typeof f !== "object" || f.type !== "Feature") {
      skipped++;
      continue;
    }

    const geometry = f.geometry as Record<string, unknown> | undefined;
    if (
      !geometry ||
      typeof geometry !== "object" ||
      geometry.type !== "Point"
    ) {
      skipped++;
      continue;
    }

    const coords = geometry.coordinates;
    if (
      !Array.isArray(coords) ||
      coords.length < 2 ||
      typeof coords[0] !== "number" ||
      typeof coords[1] !== "number"
    ) {
      skipped++;
      continue;
    }

    // GeoJSON coordinates are [longitude, latitude]
    const longitude = coords[0];
    const latitude = coords[1];

    if (latitude < -90 || latitude > 90) {
      skipped++;
      continue;
    }
    if (longitude < -180 || longitude > 180) {
      skipped++;
      continue;
    }

    const props = (f.properties ?? {}) as Record<string, unknown>;
    const name =
      typeof props.name === "string" && props.name.trim()
        ? props.name.trim()
        : `Box ${boxes.length + 1}`;

    let observations: ParsedObservation[] = [];
    let properties_json: string | null = null;

    if (isNestNotes) {
      observations = parseNestNotesObservations(props);
      properties_json = stringifyExtraProps(
        props,
        new Set(["name", "desc", "observations"]),
      );
    } else {
      observations = parseLegacyObservations(props);
      properties_json = stringifyExtraProps(
        props,
        new Set(["name", "desc", "time"]),
      );
    }

    boxes.push({
      name,
      latitude,
      longitude,
      properties_json,
      observations,
    });
  }

  const name =
    isNestNotes && nestnotes && typeof nestnotes.name === "string"
      ? nestnotes.name
      : typeof root.name === "string"
        ? root.name
        : undefined;

  return { name, boxes, skipped };
}

function parseNestNotesObservations(
  props: Record<string, unknown>,
): ParsedObservation[] {
  const rawObs = props.observations;
  if (!Array.isArray(rawObs)) return [];

  return rawObs
    .filter(
      (o): o is Record<string, unknown> => o != null && typeof o === "object",
    )
    .map((o) => ({
      kind: (["nest", "box", "legacy"].includes(String(o.kind))
        ? String(o.kind)
        : "legacy") as "nest" | "box" | "legacy",
      observed_on: String(o.observed_on ?? ""),
      inspector: String(o.inspector ?? "Imported"),
      nests: safeNumber(o.nests),
      eggs: safeNumber(o.eggs),
      chicks: safeNumber(o.chicks),
      cleaned_out: Boolean(o.cleaned_out),
      notes: String(o.notes ?? ""),
    }));
}

function parseLegacyObservations(
  props: Record<string, unknown>,
): ParsedObservation[] {
  const desc =
    typeof props.desc === "string" && props.desc.trim()
      ? props.desc.trim()
      : "";

  if (!desc) return [];

  const todayLocal = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  let observed_on: string;
  if (typeof props.time === "string") {
    const match = (props.time as string).match(/^(\d{4}-\d{2}-\d{2})/);
    observed_on = match ? match[1] : todayLocal();
  } else {
    observed_on = todayLocal();
  }

  return [
    {
      kind: "legacy",
      observed_on,
      inspector: "Imported",
      nests: null,
      eggs: null,
      chicks: null,
      cleaned_out: false,
      notes: desc,
    },
  ];
}

function stringifyExtraProps(
  props: Record<string, unknown>,
  known: Set<string>,
): string | null {
  const extra: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(props)) {
    if (!known.has(key) && val !== undefined) {
      extra[key] = val;
    }
  }
  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;
}
