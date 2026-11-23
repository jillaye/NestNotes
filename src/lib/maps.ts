/**
 * Return a platform-specific driving-directions URL for the given coordinates.
 *
 * iOS: Apple Maps   — https://maps.apple.com/?daddr=LAT,LON&dirflg=d
 * Android: Google Maps — https://www.google.com/maps/dir/?api=1&destination=LAT,LON&travelmode=driving
 *
 * The `os` parameter is required so this module stays dependency-free
 * and testable with plain `node --test`. The caller passes `Platform.OS`
 * from react-native.
 */
export function directionsUrl(
  lat: number,
  lon: number,
  os: "ios" | "android",
): string {
  if (os === "ios") {
    return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}