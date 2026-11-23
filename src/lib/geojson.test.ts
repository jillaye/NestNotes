import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCollection } from "./geojson.ts";

const samplePath = join(
  import.meta.dirname,
  "..",
  "..",
  "Sample.geojson",
);

describe("parseCollection", () => {
  it("parses Sample.geojson: 6 boxes, 6 legacy observations, Box 91B note intact", () => {
    const text = readFileSync(samplePath, "utf-8");
    const result = parseCollection(text);

    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.boxes.length, 6);
    assert.strictEqual(result.name, undefined);

    for (const box of result.boxes) {
      assert.strictEqual(
        box.observations.length,
        1,
        `box "${box.name}" should have 1 observation`,
      );
      assert.strictEqual(box.observations[0].kind, "legacy");
      assert.strictEqual(box.observations[0].inspector, "Imported");
    }

    const box71 = result.boxes.find((b) => b.name === "Box 71");
    assert(box71);
    assert.strictEqual(box71.latitude, 42.620495);
    assert.strictEqual(box71.longitude, -116.503128);
    assert.strictEqual(
      box71.observations[0].notes,
      "Cleaned box and put back on pole.  Needs paint. 10/21/26",
    );

    const box91b = result.boxes.find((b) => b.name === "Box 91B");
    assert(box91b);
    assert(box91b.observations[0].notes.includes("10/22/24"));
    assert(box91b.observations[0].notes.includes("10/21/26 box full"));
    assert(
      box91b.observations[0].notes.includes("Survived Big Grassy Fire"),
    );
  });

  it("skips non-Point features", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "A point" },
          geometry: { type: "Point", coordinates: [-116.5, 42.6] },
        },
        {
          type: "Feature",
          properties: { name: "A polygon" },
          geometry: {
            type: "Polygon",
            coordinates: [[[-116.5, 42.6], [-116.4, 42.6], [-116.4, 42.7], [-116.5, 42.7], [-116.5, 42.6]]],
          },
        },
        {
          type: "Feature",
          properties: { name: "A linestring" },
          geometry: {
            type: "LineString",
            coordinates: [[-116.5, 42.6], [-116.4, 42.7]],
          },
        },
      ],
    });

    const result = parseCollection(text);
    assert.strictEqual(result.boxes.length, 1);
    assert.strictEqual(result.skipped, 2);
  });

  it("skips features with bad coordinates", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Good" },
          geometry: { type: "Point", coordinates: [0, 0] },
        },
        {
          type: "Feature",
          properties: { name: "Bad lat" },
          geometry: { type: "Point", coordinates: [0, 91] },
        },
        {
          type: "Feature",
          properties: { name: "Bad lon" },
          geometry: { type: "Point", coordinates: [181, 0] },
        },
        {
          type: "Feature",
          properties: { name: "Lat too low" },
          geometry: { type: "Point", coordinates: [0, -91] },
        },
      ],
    });

    const result = parseCollection(text);
    assert.strictEqual(result.boxes.length, 1);
    assert.strictEqual(result.skipped, 3);
  });

  it("throws on garbage input", () => {
    assert.throws(() => parseCollection("not json at all"), /Invalid JSON/);
  });

  it("throws on non-object JSON", () => {
    assert.throws(() => parseCollection('"a string"'), /expected a JSON object/);
  });

  it("throws on wrong top-level type", () => {
    const text = JSON.stringify({ type: "Feature", geometry: null });
    assert.throws(() => parseCollection(text), /expected type "FeatureCollection"/);
  });

  it("skips non-Feature items in features array", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Valid" },
          geometry: { type: "Point", coordinates: [-116.5, 42.6] },
        },
        null,
        "a string",
        42,
        { type: "NotFeature" },
      ],
    });

    const result = parseCollection(text);
    assert.strictEqual(result.boxes.length, 1);
    assert.strictEqual(result.skipped, 4);
  });

  it("handles missing coordinates gracefully", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "No coords" },
          geometry: { type: "Point" },
        },
        {
          type: "Feature",
          properties: { name: "Partial" },
          geometry: { type: "Point", coordinates: [-116] },
        },
        {
          type: "Feature",
          properties: { name: "Strings" },
          geometry: { type: "Point", coordinates: ["a", "b"] },
        },
      ],
    });

    const result = parseCollection(text);
    assert.strictEqual(result.boxes.length, 0);
    assert.strictEqual(result.skipped, 3);
  });

  it("parses NestNotes format with structured observations", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      nestnotes: { version: 1, name: "My Export" },
      features: [
        {
          type: "Feature",
          properties: {
            name: "Box 1",
            observations: [
              {
                kind: "nest",
                observed_on: "2026-10-21",
                inspector: "Jane",
                nests: 2,
                eggs: 4,
                chicks: 1,
                cleaned_out: true,
                notes: "Good box",
              },
              {
                kind: "box",
                observed_on: "2026-10-22",
                inspector: "John",
                cleaned_out: false,
                notes: "Box missing",
              },
            ],
          },
          geometry: { type: "Point", coordinates: [-116.5, 42.6] },
        },
        {
          type: "Feature",
          properties: { name: "Box 2", observations: [] },
          geometry: { type: "Point", coordinates: [-116.4, 42.7] },
        },
      ],
    });

    const result = parseCollection(text);
    assert.strictEqual(result.name, "My Export");
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.boxes.length, 2);
    assert.strictEqual(result.boxes[0].observations.length, 2);
    assert.strictEqual(result.boxes[0].observations[0].kind, "nest");
    assert.strictEqual(result.boxes[0].observations[0].nests, 2);
    assert.strictEqual(result.boxes[0].observations[0].cleaned_out, true);
    assert.strictEqual(result.boxes[0].observations[1].kind, "box");
    assert.strictEqual(result.boxes[1].observations.length, 0);
  });

  it("legacy: missing time falls back to today", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "No time", desc: "Note without timestamp" },
          geometry: { type: "Point", coordinates: [-116.5, 42.6] },
        },
      ],
    });

    const result = parseCollection(text);
    const today = new Date().toISOString().slice(0, 10);
    assert.strictEqual(result.boxes[0].observations[0].observed_on, today);
  });

  it("legacy: no desc means no observations", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Empty", desc: "" },
          geometry: { type: "Point", coordinates: [-116.5, 42.6] },
        },
        {
          type: "Feature",
          properties: { name: "Missing" },
          geometry: { type: "Point", coordinates: [-116.4, 42.7] },
        },
      ],
    });

    const result = parseCollection(text);
    assert.strictEqual(result.boxes.length, 2);
    assert.strictEqual(result.boxes[0].observations.length, 0);
    assert.strictEqual(result.boxes[1].observations.length, 0);
  });

  it("missing name generates Box N", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [-116.5, 42.6] },
        },
      ],
    });

    const result = parseCollection(text);
    assert.strictEqual(result.boxes[0].name, "Box 1");
  });
});