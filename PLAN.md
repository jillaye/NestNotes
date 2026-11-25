# NestNotes — Phased Implementation Plan

Source: [SRS.md](SRS.md) · Rules: [.clinerules/nestnotes.md](.clinerules/nestnotes.md), [AGENTS.md](AGENTS.md), [.clinerules/ponlytail.md](.clinerules/ponlytail.md) · Expo SDK **58** (check https://docs.expo.dev/versions/v58.0.0/ before writing Expo code).

Every milestone ends with **Done when** checks plus `npx expo lint` and `npx tsc --noEmit` passing.

## Ground rules

- Routes in `src/app/` (existing layout). Non-route code in `src/db/`, `src/components/`, `src/types/`, `src/lib/`.
- Offline only: every read/write goes to local `expo-sqlite`. No network calls in v1.
- User-created tables: `id` (UUID, `expo-crypto` `randomUUID()`), `created_by`, `updated_at`, `deleted_at`, `sync_status`. Active queries use `WHERE deleted_at IS NULL`.
- v1 has no accounts (SRS). `created_by = LOCAL_USER_ID = 'local'`, and the current user is `{ id: 'local', role: 'admin' }`.
  `ponytail:` deletes still go through `canDelete(user, record)` in `src/db/`. It allows everything in v1, and v2 RBAC only changes this one function.
- Dates: the UI shows and accepts `MM/DD/YYYY`. The DB stores `observed_on` as `YYYY-MM-DD` so history sorts correctly. Timestamps are ISO strings.
- Pure logic (parsers, formatters, URL builders, permissions) lives in dependency-free `src/lib/*.ts` with one `*.test.ts` each, run by `node --test` (Node 26 strips TS types natively; no test framework).

---

## M0: Project prep

- [x] `expo-crypto`, `expo-document-picker`, `expo-sharing` installed.
- [x] `app.json`: add the `expo-location` plugin with `locationWhenInUsePermission: "Shows your position relative to nest boxes."`
- [x] `npx expo lint` once to generate the ESLint config.
- [x] `package.json` script: `"test": "node --test src/lib"`. Prove it works with a trivial test. If `tsc` rejects `.ts` import extensions in tests, add `"allowImportingTsExtensions": true` to `tsconfig.json` (valid because Expo uses `noEmit`).
- [x] Delete the starter text in `src/app/index.tsx`.

**Done when:** `npx expo-doctor` is clean, the app boots in Expo Go on Android and iPhone, and `npm test`, lint and typecheck pass.

---

## M1: Types & database

Files:

- `src/types/index.ts`: `Collection`, `NestBox`, `Observation` (discriminated union on `kind: 'nest' | 'box' | 'legacy'`), `SyncStatus`, `Role`, `User`.
- `src/db/schema.ts`: `migrateDbIfNeeded(db)` using `PRAGMA user_version`, `journal_mode = WAL`, `foreign_keys = ON`.
- `src/db/collections.ts`, `boxes.ts`, `observations.ts`: small async functions taking `SQLiteDatabase`.
- `src/app/_layout.tsx`: wrap `<Stack>` in `<SQLiteProvider databaseName="nestnotes.db" onInit={migrateDbIfNeeded}>`.

Schema v1 (common sync columns on every table):

| Table          | Columns                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collections`  | `id`, `name`, `created_at`                                                                                                                                                                                                                        |
| `nest_boxes`   | `id`, `collection_id` → collections, `name`, `latitude`, `longitude`, `properties_json` (unknown GeoJSON properties kept, e.g. `time`)                                                                                                            |
| `observations` | `id`, `box_id` → nest_boxes, `kind`, `observed_on` (`YYYY-MM-DD`), `inspector` (null for legacy), `nests`, `eggs`, `chicks`, `cleaned_out` (nest only), `box_not_found`, `box_gone_pole_present`, `pole_cut_down` (box only), `notes` (all kinds) |

Indexes: `nest_boxes(collection_id)`, `observations(box_id)`.

`ponytail:` one `observations` table with nullable columns, so history is one query. Split it if the note types diverge.

**Done when:** a temporary dev button inserts a collection, a box and an observation and reads them back, the data survives an app restart, and the migration runs only once. Remove the button afterwards.

---

## M2: GeoJSON import (legacy + NestNotes format)

`src/lib/geojson.ts`: `parseCollection(text): { name?: string; boxes: ParsedBox[]; skipped: number }`

- Accepts a `FeatureCollection` of `Point` features. Coordinates are `[lon, lat]`. Validate lat −90..90 and lon −180..180. Skip and count invalid features.
- **NestNotes format** (has top-level `"nestnotes": { "version": 1 }`): read `properties.name` and `properties.observations[]`, so the app can import its own exports (M8).
- **Legacy format** (e.g. `Sample.geojson`): name = `properties.name`. Non-empty `properties.desc` → **one `legacy` observation** with `notes = desc.trim()` and `observed_on` = date part of `properties.time` (fallback: import date). Other properties go to `properties_json`.
  `ponytail:` desc is kept word-for-word and not split into dated notes. The sample's dates appear at the start, at the end or not at all, and newlines fall mid-sentence (Box 91B), so splitting would mis-date or break notes. Upgrade path: an admin-side "split legacy note" tool in v2.
- Bad JSON or wrong top-level type → throw a readable error (trust boundary).
- New UUIDs are always created on import. `ponytail:` re-importing creates a new collection rather than merging. Merging belongs with v2 sync.

`src/db/collections.ts`: `importCollection(db, parsed)` runs in a single `withTransactionAsync` (no half imports).

`src/lib/geojson.test.ts`: covers `Sample.geojson` (6 boxes, 6 legacy notes, Box 91B's note is intact), a non-Point feature that gets skipped, bad coordinates, and garbage input.

**Done when:** `npm test` passes.

---

## M3: Collection picker ("Splash screen" in SRS) + delete

- `src/app/index.tsx`: `FlatList` of collections (name and box count). Tapping one goes to `/collection/[id]`.
- **Import collection** button: `DocumentPicker.getDocumentAsync({ type: ['application/geo+json', 'application/json', '*/*'] })`, read with the `expo-file-system` `File` API (part of `expo`), name defaults to the file name. Collections are **not renameable** (by design).
- Empty state text. On parse error: an `Alert` with the message, and nothing is written.
- **Delete collection**: a trash button on each row (`accessibilityLabel="Delete <name>"`, at least 48dp).
  - `Alert`: "Delete _South Loop_? This removes 6 boxes and 14 notes from this phone." with **Cancel** and **Delete** (destructive). M8 adds **Export first**.
  - `src/lib/permissions.ts`: `canDelete(user, record): boolean`. v1 rule: `user.role === 'admin' || record.created_by === user.id`. With the v1 local user this always returns true, and it is already the v2 rule.
  - `src/db/collections.ts`: `deleteCollection(db, user, id)` throws if `!canDelete`, then in one `withTransactionAsync` sets `deleted_at = updated_at = now` and `sync_status = 'pending'` on the collection, its boxes and their observations.
    `ponytail:` soft-deleted rows stay in the DB forever. Upgrade path: a hard purge after v2 sync confirms the delete.
- Test: `permissions.test.ts` covers admin, owner birder and non-owner birder.

**Done when:** importing `Sample.geojson` lists a collection with 6 boxes and it survives a restart. A bad file shows an error without crashing. Delete → confirm removes the row and it stays gone after a restart. Cancel keeps it. Re-importing the same file after deleting works.

---

## M4: Map screen

- `src/app/collection/[id].tsx`: `react-native-maps` `MapView` with `showsUserLocation` and `showsMyLocationButton`, one `Marker` per box, `fitToCoordinates` on load.
- `expo-location` `requestForegroundPermissionsAsync`. If denied, the map still works and shows a small banner.
- Tapping a marker goes to `/box/[id]`.
- An **Add box** button is reserved in the UI (grayed out) for v2 — the backend insert function `addBox` is written in `src/db/boxes.ts` now so it's ready.
- Offline: pins and GPS work without signal. Base-map tiles only show areas already cached, so open each collection on Wi-Fi before fieldwork. Put this note in the README.

**Done when:** the 6 sample pins appear near the right places in Idaho, the blue dot shows, and the screen works in airplane mode.

---

## M5: Nest box bottom sheet & Navigate

- `src/app/box/[id].tsx` registered with `presentation: 'formSheet'`, `sheetAllowedDetents: [0.5, 1]`, `sheetGrabberVisible: true` (native Expo Router, no library). The title is rendered in the content because Android sheets have no header. Wrap the notes list in a `ScrollView` or `FlatList` with `nestedScrollEnabled` so scrolling long histories on Android doesn't accidentally drag or dismiss the sheet.
- Shows the name, coordinates (6 decimals), and **Notes**, one line per observation, newest first:
  - nest: `10/21/2026 · Jane · 1 nest, 4 eggs, 0 chicks, cleaned · <notes>`
  - box: `10/21/2026 · Jane · Box gone, pole still there · <notes>`
  - legacy: `10/22/2024 · Imported · <desc>`
- `src/lib/format.ts`: `toMDY`, `parseMDY` (rejects 13/45/2026), `summarize(observation)`.
- `src/lib/maps.ts`: `directionsUrl(lat, lon, os)`
  - iOS: `https://maps.apple.com/?daddr=LAT,LON&dirflg=d`
  - Android: `https://www.google.com/maps/dir/?api=1&destination=LAT,LON&travelmode=driving`
- Buttons at the bottom: **New Observation** goes to `/box/[id]/observe`. **Navigate to** runs `Linking.openURL(directionsUrl(...))`.
- Tests: `format.test.ts`, `maps.test.ts`.

**Done when:** a pin opens the sheet and swiping down dismisses it, Navigate opens Apple Maps on iPhone and Google Maps on Android with a driving route, and tests pass.

---

## M6: Observation screen & Nest Note

- `src/app/box/[id]/observe.tsx`: two large buttons, **Box present – Take New Note** and **Box missing – Take New Note**, which switch the form on the same screen (`ponytail:` no extra routes).
- Shared fields:
  - **Date**: `TextInput` prefilled with today's date as `MM/DD/YYYY`, editable, validated by `parseMDY` on save.
  - **Inspector**: prefilled with the last name used (`expo-sqlite/kv-store`), saved on submit.
  - **Notes**: multiline `TextInput`.
- Nest fields: `src/components/Stepper.tsx` (− value + with targets of at least 48dp, minimum 0, can also be typed) for nests, eggs and chicks. `Switch` for cleaned out.
- Save → `addObservation` (`sync_status: 'pending'`) → back to the sheet, which shows the new line.
- Accessibility: labels on all controls, high contrast for sunlight, `KeyboardAvoidingView`. A failed save shows an `Alert` and keeps the form data.

**Done when:** a nest note saves in airplane mode and shows in the history, the inspector name is prefilled next time, and an invalid date is blocked.

---

## M7: Box Note (box missing)

- Same screen, "missing" form: the shared fields plus three multi-select checkbox rows (large `Pressable` rows):
  could not find box at all / box gone, pole still there / pole cut down.
- At least one box must be checked. Saves `kind: 'box'`.

**Done when:** a box note with 2 items and notes saves and shows correctly, and saving with nothing checked is blocked.

---

## M8: GeoJSON export

- `src/lib/geojson.ts`: `toGeoJSON(collection, boxes, observations): string`, in the app's own format:
  ```json
  {
    "type": "FeatureCollection",
    "nestnotes": {
      "version": 1,
      "name": "South Loop",
      "exported_at": "2026-11-22T20:00:00.000Z"
    },
    "features": [
      {
        "type": "Feature",
        "id": "<box uuid>",
        "geometry": {
          "type": "Point",
          "coordinates": [-116.503128, 42.620495]
        },
        "properties": {
          "name": "Box 71",
          "desc": "10/21/2026 Jane: 1 nest, 4 eggs, 0 chicks, cleaned\n10/22/2024 Imported: Cleaned box and put back on pole...",
          "observations": [
            {
              "id": "…",
              "kind": "nest",
              "observed_on": "2026-10-21",
              "inspector": "Jane",
              "nests": 1,
              "eggs": 4,
              "chicks": 0,
              "cleaned_out": true,
              "notes": ""
            }
          ]
        }
      }
    ]
  }
  ```
  `desc` is generated with `summarize()` so the old app can still read the file. `observations` is the structured data the app re-imports.
- Write `<name>-<YYYY-MM-DD>.geojson` to `Paths.cache` with the `File` API, then `Sharing.shareAsync(file.uri, { mimeType: 'application/geo+json', UTI: 'public.json', dialogTitle: 'Export collection' })`. Check `Sharing.isAvailableAsync()` first.
- **Export** button in the map screen header, plus an **Export first** option in the M3 delete confirmation.
- Test: round trip, `parseCollection(toGeoJSON(...))` gives back the same boxes and observations.

**Done when:** you can export a collection and email it to yourself, and importing that file on another phone shows the same pins and history. Delete → Export first opens the share sheet and deletes nothing.

## M9: Field-readiness polish

- [ ] Airplane-mode pass through the whole flow on a real Android phone and iPhone.
- [ ] Large OS font sizes and dark mode check.
- [ ] Remove leftover dev code. Update the README (offline map tip, import/export/delete).

---

## M10: Build & distribute

- [ ] Google Maps API key for Android release builds (`android.config.googleMaps.apiKey`). Not needed in Expo Go.
- [ ] `ios.bundleIdentifier` and `android.package` in `app.json`.
- [ ] `npx eas-cli@latest build --profile preview` for testers, then `eas submit`.

---

## Deferred to v2

- Accounts and admin/birder RBAC (swap the v1 local user for a real one; `canDelete` already has the rule). Hide the delete button when `!canDelete`.
- **Master map:** admins import the legacy file, then select boxes to create Collections for birders, using the M8 export format. Birders' exports merge back by box/observation `id`.
- **Add box on map:** place a new box by long-pressing the map (pick from dropped pin, enter name, optionally start an observation). The `addBox` DB function already exists.
- Cloud sync (`sync_status`, `updated_at` and `deleted_at` are already in place) and a hard purge of soft-deleted rows.
- Edit/delete observations, rename boxes (e.g. `Waypoint 10/21/26 13:25` is really Box 88), split legacy notes.

## Not planned

- Renaming collections.
