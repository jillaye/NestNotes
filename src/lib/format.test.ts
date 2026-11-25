import { describe, it } from "node:test";
import assert from "node:assert";
import { toMDY, parseMDY, summarize } from "./format.ts";
import type { Observation } from "@/types";

// ── toMDY ────────────────────────────────────────────────────────────

describe("toMDY", () => {
  it("converts YYYY-MM-DD to MM/DD/YYYY", () => {
    assert.strictEqual(toMDY("2026-10-21"), "10/21/2026");
  });

  it("strips leading zeros on month and day", () => {
    assert.strictEqual(toMDY("2026-01-05"), "1/5/2026");
  });

  it("works on first day of year", () => {
    assert.strictEqual(toMDY("2026-01-01"), "1/1/2026");
  });
});

// ── parseMDY ─────────────────────────────────────────────────────────

describe("parseMDY", () => {
  it("parses valid MM/DD/YYYY", () => {
    assert.strictEqual(parseMDY("10/21/2026"), "2026-10-21");
  });

  it("handles single-digit month and day", () => {
    assert.strictEqual(parseMDY("1/5/2026"), "2026-01-05");
  });

  it("handles padded month and day", () => {
    assert.strictEqual(parseMDY("01/05/2026"), "2026-01-05");
  });

  it("rejects month > 12", () => {
    assert.strictEqual(parseMDY("13/21/2026"), null);
  });

  it("rejects day > 31", () => {
    assert.strictEqual(parseMDY("12/32/2026"), null);
  });

  it("rejects 13/45/2026 (both month and day out of range)", () => {
    assert.strictEqual(parseMDY("13/45/2026"), null);
  });

  it("rejects February 30", () => {
    assert.strictEqual(parseMDY("2/30/2026"), null);
  });

  it("rejects February 29 in non-leap year 2025", () => {
    assert.strictEqual(parseMDY("2/29/2025"), null);
  });

  it("accepts February 29 in leap year 2024", () => {
    assert.strictEqual(parseMDY("2/29/2024"), "2024-02-29");
  });

  it("rejects April 31", () => {
    assert.strictEqual(parseMDY("4/31/2026"), null);
  });

  it("rejects empty string", () => {
    assert.strictEqual(parseMDY(""), null);
  });

  it("rejects garbage input", () => {
    assert.strictEqual(parseMDY("not-a-date"), null);
  });

  it("rejects day < 1", () => {
    assert.strictEqual(parseMDY("12/0/2026"), null);
  });

  it("rejects month < 1", () => {
    assert.strictEqual(parseMDY("0/15/2026"), null);
  });
});

// ── summarize ────────────────────────────────────────────────────────

function makeNestObs(
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id: "1",
    nest_box_id: "b1",
    kind: "nest",
    observed_on: "2026-10-21",
    inspector: "Jane",
    nests: 1,
    eggs: 4,
    chicks: 0,
    cleaned_out: false,
    notes: "",
    created_by: "local",
    updated_at: "2026-10-21T12:00:00.000Z",
    deleted_at: null,
    sync_status: "pending",
    ...overrides,
  } as Observation;
}

function makeBoxObs(
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id: "2",
    nest_box_id: "b1",
    kind: "box",
    observed_on: "2026-10-21",
    inspector: "Jane",
    nests: null,
    eggs: null,
    chicks: null,
    cleaned_out: false,
    box_not_found: false,
    box_gone_pole_present: false,
    pole_cut_down: false,
    notes: "Box gone, pole still there",
    created_by: "local",
    updated_at: "2026-10-21T12:00:00.000Z",
    deleted_at: null,
    sync_status: "pending",
    ...overrides,
  } as Observation;
}

function makeLegacyObs(
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id: "3",
    nest_box_id: "b1",
    kind: "legacy",
    observed_on: "2024-10-22",
    inspector: "Imported",
    nests: null,
    eggs: null,
    chicks: null,
    cleaned_out: false,
    notes: "Cleaned box and put back on pole. Needs paint. 10/21/26",
    created_by: "local",
    updated_at: "2024-10-22T21:45:15.000Z",
    deleted_at: null,
    sync_status: "pending",
    ...overrides,
  } as Observation;
}

describe("summarize", () => {
  it("nest: formats fields with singular/plural", () => {
    const obs = makeNestObs({ nests: 1, eggs: 4, chicks: 0 });
    assert.strictEqual(summarize(obs), "1 nest, 4 eggs, 0 chicks");
  });

  it("nest: includes cleaned when true", () => {
    const obs = makeNestObs({
      nests: 2,
      eggs: 4,
      chicks: 3,
      cleaned_out: true,
    });
    assert.strictEqual(summarize(obs), "2 nests, 4 eggs, 3 chicks, cleaned");
  });

  it("nest: uses plural 'nests' for 0", () => {
    const obs = makeNestObs({ nests: 0, eggs: null, chicks: null });
    assert.strictEqual(summarize(obs), "0 nests");
  });

  it("nest: omits eggs/chicks when null", () => {
    const obs = makeNestObs({
      nests: 1,
      eggs: null,
      chicks: null,
      cleaned_out: true,
    });
    assert.strictEqual(summarize(obs), "1 nest, cleaned");
  });

  it("box: summarizes a single condition", () => {
    const obs = makeBoxObs({ box_gone_pole_present: true });
    assert.strictEqual(summarize(obs), "Box gone, pole still there");
  });

  it("box: joins multiple conditions in display order", () => {
    const obs = makeBoxObs({ box_not_found: true, pole_cut_down: true });
    assert.strictEqual(
      summarize(obs),
      "Could not find box at all, Pole cut down",
    );
  });

  it("box: returns empty string when no condition is set", () => {
    const obs = makeBoxObs();
    assert.strictEqual(summarize(obs), "");
  });

  it("legacy: returns empty string", () => {
    const obs = makeLegacyObs();
    assert.strictEqual(summarize(obs), "");
  });
});