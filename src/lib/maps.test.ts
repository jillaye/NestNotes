import { describe, it } from "node:test";
import assert from "node:assert";
import { directionsUrl } from "./maps.ts";

describe("directionsUrl", () => {
  const lat = 42.620495;
  const lon = -116.503128;

  it("returns Apple Maps URL for iOS", () => {
    const url = directionsUrl(lat, lon, "ios");
    assert.strictEqual(
      url,
      "https://maps.apple.com/?daddr=42.620495,-116.503128&dirflg=d",
    );
  });

  it("returns Google Maps URL for Android", () => {
    const url = directionsUrl(lat, lon, "android");
    assert.strictEqual(
      url,
      "https://www.google.com/maps/dir/?api=1&destination=42.620495,-116.503128&travelmode=driving",
    );
  });
});