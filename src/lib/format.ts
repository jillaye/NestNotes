import type { Observation } from "@/types";

/**
 * Ordered box-missing conditions (M7). The labels double as the summary text
 * shown in the note list, e.g. "Box gone, pole still there".
 */
export const BOX_CONDITIONS = [
  { key: "box_not_found", label: "Could not find box at all" },
  { key: "box_gone_pole_present", label: "Box gone, pole still there" },
  { key: "pole_cut_down", label: "Pole cut down" },
] as const;

export type BoxConditionKey = (typeof BOX_CONDITIONS)[number]["key"];

/**
 * Convert an ISO date string (YYYY-MM-DD) to MM/DD/YYYY display format.
 */
export function toMDY(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}/${year}`;
}

/**
 * Parse a MM/DD/YYYY string into an ISO date (YYYY-MM-DD).
 * Returns null for invalid dates including impossible month/day combos.
 */
export function parseMDY(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Validate day per month (JS Date: month is 0-indexed, day=0 goes back one)
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Generate a human-readable summary string for an observation.
 *
 * - nest: "1 nest, 4 eggs, 0 chicks, cleaned"
 * - box:  "" (the notes field carries the condition detail)
 * - legacy: "" (the notes/desc field carries the detail)
 */
export function summarize(obs: Observation): string {
  switch (obs.kind) {
    case "nest": {
      const parts: string[] = [];
      parts.push(`${obs.nests} nest${obs.nests !== 1 ? "s" : ""}`);
      if (obs.eggs !== null) {
        parts.push(`${obs.eggs} egg${obs.eggs !== 1 ? "s" : ""}`);
      }
      if (obs.chicks !== null) {
        parts.push(`${obs.chicks} chick${obs.chicks !== 1 ? "s" : ""}`);
      }
      if (obs.cleaned_out) {
        parts.push("cleaned");
      }
      return parts.join(", ");
    }
    case "box":
      return BOX_CONDITIONS.filter((c) => obs[c.key])
        .map((c) => c.label)
        .join(", ");
    case "legacy":
      return "";
  }
}