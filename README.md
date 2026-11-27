# NestNotes

Offline-first mobile app for bluebird nest-box trail volunteers. Load a trail
(a **Collection** of GPS-tagged nest boxes), walk it, and record what you find at
each box — nests, eggs, chicks, cleaned-out, or "box missing" conditions.

Everything is stored on the phone in `expo-sqlite`. There are no accounts and no
network calls in v1, so it works with or without cell service.

## Requirements

- A phone with [Expo Go](https://expo.dev/go) (Android or iOS)
- Node.js 26+ on the development machine

## Get started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). The app runs
entirely on-device.

## Using the app

### 1. Import a collection

Tap **Import collection** on the first screen and pick a `.geojson` file. The app
reads both:

- **Legacy format** — the original app's export (`properties.desc` becomes one
  "Imported" note per box).
- **NestNotes format** — this app's own export, with full structured history.

Importing always creates a **new** collection; it never merges. Re-importing the
same file after deleting the old one works fine.

### 2. Open a trail on the map

Tap a collection to see its boxes as pins. Tapping a pin opens the box sheet:
name, coordinates, and the note history (newest first). Allow location access to
see your live position and use the **Navigate to** button (Google Maps on
Android, Apple Maps on iOS, driving directions).

### 3. Take a note

**New Observation** → choose **Box present** (nest note: nests / eggs / chicks /
cleaned out) or **Box missing** (box note: tick one or more conditions). The date
defaults to today (`MM/DD/YYYY`) and the inspector name is remembered from last
time. Saving with an invalid date or no box condition is blocked.

### 4. Export

**Export** in the map header writes `<collection>-<YYYY-MM-DD>.geojson` and opens
the share sheet (email, AirDrop, Files, …). The file carries a legacy-readable
`desc` so the original app can still open it, plus the structured data this app
re-imports.

### 5. Delete

The trash button next to a collection offers **Export first** (the share sheet
opens and nothing is deleted) or **Delete**. Deleting removes the collection and
all its boxes and notes from this phone.

## Offline map tip

Pins, notes and GPS work with no signal — that data lives on the phone. The
**base map tiles are the only thing that needs the network.** Before heading out,
open each collection once while on Wi-Fi and pan/zoom over the area so the tiles
get cached. In airplane mode you'll still see the pins and your blue dot, but map
areas you never viewed render blank.

## Field checklist

- **Airplane mode:** import → map → note → export all work with the radio off.
- **Large fonts:** raise the OS text size; controls grow instead of clipping.
- **Dark mode:** the app is intentionally light-only (high contrast for
  sunlight), so it looks the same in the system's dark mode.

## Data & file format

- One SQLite database (`nestnotes.db`) holds collections, boxes, observations and
  a small key/value store for the last inspector name.
- Rows use string UUIDs and carry `created_by`, `updated_at`, `deleted_at` and
  `sync_status`, so v2 cloud sync can slot in without a rewrite.
- Deletes are soft (`deleted_at`); active queries filter them out.
- Export is a GeoJSON `FeatureCollection` with a top-level
  `nestnotes: { version: 1 }` marker (see `src/lib/geojson.ts`).

## Development

```bash
npm start          # Expo dev server
npm test           # node --test over src/lib (pure logic, no framework)
npx expo lint      # ESLint
npx tsc --noEmit   # typecheck (there is no tsc script — Expo strips types)
```

Layout: routes live in `src/app/` (Expo Router, file-based). Reusable code lives
in `src/components/`, `src/db/` (all SQLite reads/writes), `src/lib/` (dependency-
free pure logic with a `*.test.ts` each) and `src/types/`. The `@/` alias maps to
`src/`.

See [SRS.md](SRS.md) for requirements and [PLAN.md](PLAN.md) for the milestone
history.

## Not in v1

Accounts / RBAC (admin vs birder), cloud sync, adding boxes on the map, editing
notes, renaming boxes, and renaming collections. See the "Deferred to v2"
section of [PLAN.md](PLAN.md).
