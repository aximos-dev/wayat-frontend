# Progress

Read this first to know where this app actually stands. See `CLAUDE.md` for *how* we work;
this file is *what's actually built*. See also
`/Users/srinivas/IdeaProjects/wayAt/context/PROGRESS.md` for the cross-repo picture (backend +
this app + the not-yet-started mobile app together).

## Built and tested end-to-end (live, in a real browser, against the real running backend)

**Project setup:**
- React 19 + TypeScript + Vite + Tailwind CSS v4, scaffolded fresh
- Color theme pixel-matched from the Figma design (`CLAUDE.md` has the exact token table)
- Lives at `wayat-frontend` repo's `admin/` subfolder (monorepo-style — see the workspace
  `context/README.md` for why)

**Auth:**
- Full phone + OTP login flow (`/login`) against the real backend's `ADMIN_LOGIN` purpose —
  shows the dev-mode OTP inline when the backend has `app.auth.otp-dev-mode: true`, same as
  curl/Hoppscotch would see it
- JWT decoded client-side to know who's logged in; stored in `localStorage` (known
  simplification, see `CLAUDE.md`)
- Automatic refresh-on-401, race-safe against the backend's single-use refresh token (two
  concurrent 401s share one in-flight refresh call rather than both trying to refresh)
- Protected routing — everything except `/login` redirects there if there's no valid token

**Shell:**
- Sidebar: Dashboard, Live Operations, Approvals, Students, **Drivers & Vehicles** (renamed from
  the Figma's plain "Drivers" — Vehicles management now lives here instead of under Routes &
  Stops), Routes & Stops, Settings — plus a bottom user card (shows role + truncated tenant ID,
  not yet the real tenant name) and a working Log out button

**Drivers & Vehicles (`/drivers-vehicles`) — now fully built, both tabs, following Routes &
Stops' modal-not-page convention throughout:**
- **Both tabs are real now.** Drivers was a bare "Not built yet" placeholder and Vehicles was a
  3-column read-only table with no edit/delete at all; both now have full add/edit (Vehicles)
  and add/edit/delete (Drivers), all via modals opened from the page — no `/new` route, matching
  how Stops/Routes already work. **"Add a vehicle" was previously its own standalone page**
  (`AddVehiclePage.tsx`, reached via `/drivers-vehicles/vehicles/new`) — the one place in the app
  that didn't follow the modal convention; deleted outright and replaced with
  `VehicleModal.tsx`, same `<Modal>` chrome/entrance-animation as everything else.
- **`VehicleModal.tsx`** (Add/Edit vehicle) — reg no, seats, a real **type** dropdown (see
  `VehicleTypeModal.tsx` below — this replaces the old hardcoded `<option>Van/Bus/Minibus</option>`
  free-text select), and **driver/co-driver assignment, per leg** (morning/evening — see the
  dedicated bullet below for why), four optional selects total sourced from `useDrivers`. **A
  driver already assigned elsewhere *in that same leg* simply doesn't appear in the list at
  all** — the first version showed them with a "currently driving X" hint and let you pick them
  anyway (the backend would auto-unassign them from their old vehicle on save), but Srinivas
  flagged that as backwards: "if the driver and co-driver are selected for a vehicle, it should
  not be showing in other vehicles' selectors." Reassigning someone now takes two explicit
  edits — clear them from the old vehicle, then pick them on the new one — rather than one
  implicit move; the backend's auto-unassign (`VehicleService.resolveLegAssignment`, see that
  repo's `PROGRESS.md`) still exists underneath as a safety net for direct API calls, it's just
  no longer reachable through this form since you can't select an already-assigned driver to
  trigger it. Within each leg, its two selects still filter each other out (can't pick the same
  driver as both driver and co-driver) as a client-side guard ahead of the backend's own
  `400 DRIVER_DOUBLE_ASSIGNED`. A "Manage types" link inside the modal opens `VehicleTypeModal`
  as a sibling overlay (not nested inside this one — nesting two `<Modal>`s would briefly
  mis-position the inner one during the outer's own entrance transform) while this modal stays
  open underneath; its `useVehicleTypes` query shares the same cache key, so a type added there
  shows up in this modal's dropdown immediately once closed.
- **`VehicleTypeModal.tsx`** — "Manage types" button on the Vehicles tab opens a list/add/
  rename/delete modal for the tenant's vehicle types (Van, Mini Van, Bus, ...), mirroring
  `StopModal.tsx`'s create/update shape but for a short reusable list instead of a single
  record: existing types render as rows with inline-rename (click Edit → text input + Save/
  Cancel) and Delete, a dashed "+ add new type" row at the bottom matches `RouteModal.tsx`'s
  stop-adding affordance. **Delete is disabled with a tooltip** ("Used by N vehicles — change
  their type first") for any type actually in use, computed from the already-loaded `Vehicle[]`
  — same "don't let the admin discover `_IN_USE` the hard way" pattern as Stops' route-usage
  guard.
- **`DriverModal.tsx`** (Add/Edit driver) — name, phone (with a note that phone is also this
  driver's login identity and must be unique — surfaces the backend's real
  `DRIVER_PHONE_ALREADY_EXISTS` message verbatim on collision). When editing, shows a read-only
  "Vehicle assignment" line, one per leg that's actually set (driving/co-driving which vehicle,
  or "Not currently assigned" if neither leg has one) — **deliberately not editable from here**;
  assignment is a Vehicle-side concern (the backend's leg fields live on `Vehicle`, not `Driver`),
  so there's exactly one place to change it, not two UIs that could drift out of sync.
- **Drivers tab table** — name, phone, a computed "Vehicle" column showing up to two lines
  (`"Morning: <regNo> (driver)"` / `"Evening: <regNo> (co-driver)"`, whichever legs are actually
  assigned) or `"—"` if neither is, Edit always available, **Delete disabled with a tooltip**
  ("Currently assigned to a vehicle — unassign them from the Vehicles tab first") whenever any of
  the four morning/evening driver/co-driver fields is set — same guard pattern as vehicle types
  and Stops.
- **Vehicles tab table** gained Type/Morning/Evening columns (previously just reg no/type/seats,
  no edit at all) and Edit/Delete actions — Morning and Evening each render as a compact
  `"<driver>, <co-driver> (co)"` summary (`legCellText` helper) or `"—"`. `src/lib/types.ts`'s
  `Vehicle`/`CreateVehicleRequest` were updated to match the backend's shape change (`type:
  string` → `vehicleTypeId`/`vehicleTypeName`); two other call sites that read the now-gone
  `vehicle.type` directly (`RouteModal.tsx`'s vehicle picker option label and its confirm-screen
  summary line) were fixed in the same change rather than left to break silently.
- **Driver/co-driver assignment is now per LEG (morning/evening), not one global slot** — direct
  response to Srinivas noticing the original single-slot version showed every driver who had
  *any* assignment anywhere as "already assigned" when editing a *different* vehicle, which was
  confusing because real schedules often have the same driver running a different vehicle's
  morning route than their evening one. `VehicleModal.tsx` was restructured into two
  `LegSection`s ("Morning leg" / "Evening leg"), each with its own Driver/Co-driver pair — **the
  admin assigns both legs in one form, one submit**, matching the request directly rather than
  needing two separate edits. Each leg's own picker logic (`isAssignedElsewhereInLeg`) only
  looks at that leg's fields — being assigned in the *other* leg never affects a driver's
  availability here, since it isn't a real conflict (see backend `PROGRESS.md` for the matching
  `VehicleService.resolveLegAssignment` split). `Driver`/`Vehicle` in `types.ts` and every call
  site that read the old flat `driverId`/`coDriverId` fields were updated to the 8-field
  morning/evening shape. (The in-picker "currently driving X" hint from the first version of
  this was replaced shortly after with outright filtering — see the `VehicleModal.tsx` bullet
  above for why.)
- **Fixed a real bug in the token-refresh interceptor** (`src/lib/api.ts`), found while
  investigating a confusing "Not authenticated" toast that flashed during normal use: when a
  refresh token is truly invalid, the interceptor set `window.location.href = "/login"` but still
  fell through to `return Promise.reject(error)` — the original caller's `.catch` ran with the
  stale 401 in the instant before the browser actually navigated away, showing a misleading error
  toast right as the redirect was happening. Fixed by returning a promise that never settles once
  the redirect is triggered, so no caller reacts to a request that's moot anyway.
- **Delete vehicle** — the backend had no `DELETE /v1/vehicles/{id}` at all until this was added
  specifically for the frontend button (see that repo's `PROGRESS.md`). Same "disable + explain"
  guard as everywhere else: `DriversVehiclesPage` now also fetches `useRoutes(tenantId)` and
  disables Delete (with a tooltip) for any vehicle referenced by a route — the one case this
  can't catch client-side is a vehicle with *only* ride history and no route, since there's no
  ride-list query anywhere in this app yet; that case still gets a correct, non-silent failure
  because the click goes through and the backend's real `409 VEHICLE_IN_USE` message shows in a
  toast either way, same fallback-to-the-server's-own-message pattern used for every other delete
  in this app.
- Verified live end to end in the browser: added a vehicle with both a driver and co-driver
  assigned (each dropdown correctly excluded whichever the other had picked); confirmed the
  Drivers tab immediately showed both as assigned with Delete disabled; edited the vehicle to
  clear the co-driver and confirmed only that slot cleared; added/renamed/deleted a vehicle type
  through "Manage types" and confirmed the in-use one's Delete stayed disabled throughout; created
  a throwaway vehicle through the UI and deleted it clean; confirmed the vehicle actually used by
  a real route shows Delete disabled with the correct explanation the whole time. Re-verified
  after the morning/evening redesign, logged in through the real UI flow (not a manually-injected
  token, to avoid repeating the token-contamination issue below): assigned a driver as morning
  driver + morning co-driver of one vehicle, then assigned that same morning driver as the
  *evening* driver of their own vehicle through the same single form submit — both legs saved
  together, the Drivers tab showed both assignments on separate lines, and the Vehicles tab's
  Morning/Evening columns showed the correct split; reverted cleanly afterward.
- **Bulk import from CSV, for both tabs** — "Import CSV" button next to "+ Add driver"/
  "+ Add vehicle", same partial-success shape as Stops' existing bulk import (see below):
  `BulkImportVehiclesModal.tsx`/`BulkImportDriversModal.tsx`, paste-or-upload a CSV, a live
  preview table shows each row's parsed fields with an Invalid/Ready/Added/Failed badge before
  and after submit. Each modal also has a **"Download template"** button (a plain client-side
  `Blob` download via a new shared `src/lib/csv.ts`, no backend endpoint needed) — vehicles:
  `regNo,type,seats`; drivers: `name,phone`. Vehicle's `type` column is free text, matched
  case-insensitively against existing vehicle types server-side (auto-creating a new one if
  nothing matches), so the admin doesn't have to go set up types first just to import a fleet.
  Driver's header-row detection couldn't reuse Stops'/Vehicles' "is the 3rd column numeric"
  trick (name and phone are both text), so it instead checks whether the 2nd column *looks like
  a phone number* (`looksLikePhone` — a loose `+?\d{7,15}` check, not full E.164 validation).
  The CSV-parsing internals (`splitCsvLine`, line-splitting, the download-trigger helper) were
  pulled out of `BulkImportStopsModal.tsx` into `src/lib/csv.ts` for the two new modals to share
  — `BulkImportStopsModal.tsx` itself was left untouched rather than refactored to use it too,
  since that's an unrelated change to already-working code; worth doing later as a small
  follow-up cleanup. Verified live end to end: pasted a 4-row driver CSV (2 valid, 1 in-batch
  duplicate phone, 1 obviously-invalid phone) and confirmed the preview flagged exactly those
  two and imported the other two; pasted a 4-row vehicle CSV mixing an existing type ("Van"), a
  brand-new type name ("Tempo Traveller" — confirmed it now appears in "Manage types" afterward),
  an in-batch duplicate regNo, and a regNo that collides with a real existing vehicle — 2
  created, 2 correctly reported failed/invalid without blocking the batch; all test data (the 2
  vehicles, the 2 drivers, and the auto-created "Tempo Traveller" type) cleaned up afterward via
  direct DB access, same as other throwaway test rows all session.

**Routes & Stops (`/routes-stops`) — the one fully-built page:**
- Two tabs: **Routes** (name, vehicle reg no, stop count, total known real road distance — "—"
  honestly shown when the backend has no Google Routes data for that route's legs, now including
  the final stop→school leg in the total — plus Map/Edit/Delete per row), **Stops** (name, lat,
  lng, geofence, **Used in** — see below — Edit/Delete per row; this tab isn't in the Figma
  design, added because the backend needed some way to manage stops directly)
- **Stop reuse is now visible instead of a guessing game.** The Stops tab's "Used in" column
  shows "N routes" (hover for the actual route names, via a new shared `Tooltip.tsx`) or "—" when
  unused — computed client-side from the already-loaded routes + stops, no backend change needed.
  **Delete is disabled (with a tooltip explaining why) for any stop referenced by a route**,
  instead of letting the admin click Delete and only finding out from a `409 STOP_IN_USE` toast
  that it was shared. Direct response to Srinivas flagging that "deleting and hitting
  `STOP_IN_USE` was the only way to discover it's shared."
- **Route map preview** (`src/components/RouteMapModal.tsx`, opened via a new "Map" action per
  route row) — an actual map instead of a bare stop-name list, so "does this route make sense"
  is visible at a glance instead of requiring mental geocoding. Numbered accent-yellow circle
  markers for each stop in order and a distinct green flag marker for the destination school
  (fetched via `useSchool`, resolved stop coordinates via the already-loaded `Stop[]`), auto-fit
  to bounds via `map.fitBounds`. A read-only numbered list below the map mirrors the pins for
  when markers overlap at low zoom. **The connecting line follows actual roads, not a straight
  line between stops** — Srinivas flagged the first version as "some straight line path, not
  from roads... this is not at all correct," which was a fair catch (it really was just a
  geodesic line through the stop coordinates). Fixed at the source rather than papering over it
  client-side: the backend now stores each leg's real road *shape* (`roadPolylineToNext`, Google's
  encoded polyline format — see that repo's `PROGRESS.md`/`CLAUDE.md`) from the same Google
  Routes API call that already computes distance/duration, so this costs nothing extra and keeps
  the project's "fetch once at route-creation time, never per view" principle intact — no live
  Directions API call on every preview open. Decoded client-side per leg via
  `google.maps.geometry.encoding.decodePath` (the "geometry" library, loaded alongside the map) and
  rendered as one `Polyline` per leg; a leg with no stored polyline (API failed/was skipped, or
  the route predates this column) falls back to a plain straight segment, deliberately styled
  differently from a real path rather than silently pretending it's one — a small legend under
  the map explains both colors. **The fallback color needed a second pass**: the first version
  used the UI's `text-muted` gray (`#8A8F99`) at 60% opacity, which turned out to be correct in
  the data/logic but essentially invisible against this map theme's dark, varied terrain colors
  — Srinivas tested an old route with no stored polyline and (reasonably) read "no visible
  difference from before" as the fix not working. Root-caused by logging the computed segments
  (confirmed `isApprox: true` for every leg, correctly) and then swapping the fallback color for
  a hot-pink test value to confirm the `Polyline` itself really was positioned correctly and just
  invisible — it was. Settled on a brighter `#D7DAE0` at 90% opacity, which reads clearly as "a
  different, duller line" without disappearing into the map. Verified live: a real 2-stop route
  with stored polylines visibly bends through actual street geometry (confirmed via screenshot),
  and a route predating the polyline column shows a clearly visible light-gray straight-line
  fallback instead of either an invisible line or a misleadingly gold "real path" one.
- **Bulk stop import from CSV** (`src/components/BulkImportStopsModal.tsx`, a new "Import CSV"
  button next to "+ Add stop") — paste CSV text or upload a `.csv` file into one textarea (a
  hand-rolled parser, no library — handles basic quoted fields, auto-detects and skips a header
  row). A live preview table shows every row's parsed fields and a status badge (*Ready* /
  *Invalid*, with the reason in a tooltip) as you type, including a client-side duplicate-name
  check *within the pasted batch itself*. "Import N stops" only ever submits the valid rows to
  the new `POST /v1/stops/bulk`; the response's per-row failures (e.g. a name that collides with
  a stop already in the database — something only the backend can know) are merged back into the
  same table as *Failed* badges with the backend's exact message, and the modal stays open on any
  failure so those rows are visible to fix, instead of silently losing them. Verified live: 6
  pasted rows (2 valid, 1 colliding with an existing stop, 1 in-batch duplicate, 1 out-of-range
  lat, 1 blank name) → exactly the 2 new stops created, every other row correctly rejected with
  its specific reason, confirmed in the Stops tab refreshing live behind the modal.
- **"Add a route" and "Edit route"** (`src/components/RouteModal.tsx`, one shared modal for
  both, opened from Routes & Stops rather than navigating to a separate page — see below) — route
  name, vehicle picker, an ordered stop list built by picking from the tenant's real stops.
  Create posts to `POST /v1/routes`; edit puts to `PUT /v1/routes/{id}`, pre-filled from the
  already-loaded `Route` object (no extra `GET /v1/routes/{id}` fetch needed — Routes & Stops
  already has the full list in memory). Deleting a route (`DELETE /v1/routes/{id}`) and editing
  one both surface the backend's `409 ROUTE_IN_USE` message verbatim (e.g. `Route "X" already has
  ride history and cannot be deleted`) instead of failing silently — this was a real bug, fixed
  mid-session (the delete button previously had zero error handling at all). **Picking a stop
  from the dropdown adds it to the route immediately** — no separate "Add" click needed, same
  combobox-to-add pattern you'd expect from a modern picker. **Real drag-and-drop reordering
  replaced the old ↑/↓ buttons** (which had a layout-shift glitch moving the row text) — each
  stop is a card with a grip handle, dragged and dropped via native HTML5 drag events
  (`draggable`, `onDragStart`/`onDragOver`/`onDrop`), with a live accent-colored drop-line
  indicator and a dimmed drag source. No new dependency — native browser DnD is enough for a
  short, desktop-only list; verified live by dragging a card to swap two stops and confirming the
  saved route's `route_stop.position` rows matched the dragged order, not the original add order.
  **Saving is now a two-step edit → confirm flow**, with the map preview living only in the
  confirm step — not visible at all while stops are being added/reordered. This is the result of
  three iterations in one sitting, each a direct response to Srinivas's own feedback, worth
  recording because the end state only makes sense with that history:
  1. First version: a live map next to the stop list, updating in real time as you edited —
     direct response to "I need preview for the route on map there so I can see what is causing
     what." Straight lines only, no road data, by design (to avoid API cost).
  2. He then asked for the straight lines to become real roads, "live... in real time," like the
     saved-route preview. Built via a debounced (600ms), cached, client-side call to the Google
     Routes API on every stop-list change (`src/lib/googleRoutes.ts`, same endpoint/shape as the
     backend's `GoogleRoutesClient.kt`, reusing `VITE_GOOGLE_MAPS_API_KEY`) — it worked, but Hit
     one real bug along the way: `Map` imported from `@vis.gl/react-google-maps` (the map
     component) shadowed the global `Map` constructor used for the leg cache, crashing with
     `TypeError: Map is not a constructor` — fixed by aliasing the import (`Map as GoogleMap`).
  3. Once it worked, he asked directly: "is this routes api costly coz we are making multiple
     api calls here right." Honest answer: current pricing wasn't confidently known, and this
     really did add real, ongoing cost on top of the backend's existing "once per leg, at Save"
     design with no way to turn it off. He then redesigned the flow rather than just dialing back
     the fetch rate: **"don't show preview while adding stops... while click on Save Route it
     should show preview, then ask for confirm, else he can go back and edit if needed."**
  The current design: the edit screen (`max-w-2xl`, single column, no map at all) has a
  "Save route"/"Save changes" button that — instead of saving — validates and advances to a
  "Confirm route" screen (`max-w-3xl`). That screen mounts `RouteStopsPreviewMap` for the first
  time in the whole flow, which immediately (and only once) fetches the real road path for every
  leg via the same `googleRoutes.ts` call, with a blurred-map + spinner overlay
  ("Calculating road path…") while it runs — a real loading state, not a silent straight-line
  placeholder. "Back to edit" returns to the form with everything intact (name, vehicle, stop
  order) and no data lost; "Confirm & save route" is what actually calls
  `POST`/`PUT /v1/routes`. The leg cache lives in `RouteModal` itself, not inside
  `RouteStopsPreviewMap`, specifically so going Back then Save again doesn't refetch legs already
  resolved — confirmed live: a second visit to the confirm screen showed the real road path
  instantly, no blur, no new network call. Verified the complete loop end to end: edit → Save →
  confirm screen auto-loads the real path → Back to edit (state preserved) → Save again (instant,
  cached) → Confirm & save → route appears in the list with real road distance.
  **The leg cache now also seeds itself from the route's own already-saved data when editing**
  — previously, editing *any* existing route (even just fixing a typo in the name, stops
  untouched) always re-fetched every leg fresh on reaching the confirm screen, even though the
  real road path for those unchanged legs was already sitting in the database from the last
  save. `RouteModal` now reads `route.stops[].roadPolylineToNext`/`roadDistanceToNextM`/
  `roadDurationToNextS` straight into the leg cache's initial state for the stop-to-stop legs
  (synchronous, no `school` dependency), plus a small `useEffect` for the one leg that does need
  `school`'s id (the last stop → school leg, since `useSchool` resolves asynchronously) once
  that query settles. Deliberately does **not** treat a leg as cached unless it has a real stored
  polyline — a route saved before the `roadPolylineToNext` column existed (distance only, no
  polyline) is treated as not-yet-known rather than permanently stuck showing a straight line, so
  it gets a real fetch and picks up a polyline on next save. Verified live: editing a route whose
  stops were unchanged showed the confirm screen's real road path with zero loading state and
  zero Routes API calls (checked network log); adding one new stop to that same route correctly
  showed the two already-known legs resolved instantly while only the two new/changed legs were
  actually fetched.
  **Two further refinements, both built on data the app already had (no new API cost):**
  (1) **A total distance/duration summary** now shows wherever a route's legs are known —
  `src/lib/format.ts` (`formatDistance`/`formatDuration`, new) sums whichever legs are known and
  renders e.g. "4.6 km · 11 min" on the Routes list (a new "Est. duration" column next to the
  existing "Road distance" one), in `RouteMapModal` under the route name, and on the confirm
  screen itself (`RouteStopsPreviewMap`, computed from the same `legCache`/`legTargets` it already
  tracks). A route with any leg still unknown (API failure, or saved before polyline storage
  existed) shows a muted `*` with a tooltip ("N of M legs known") next to the partial total,
  rather than silently presenting an undercount as if it were complete. Verified live: the Routes
  list, the Map modal, and the confirm screen all show the identical "4.6 km · 11 min" for the
  same real 3-stop route.
  (2) **Accessible ▲/▼ reorder buttons are back, alongside the drag handle, not instead of it.**
  These existed once before and were deliberately removed for a "layout-shift glitch moving the
  row text" (see the three-iteration history above) — this is not that regression: the buttons
  are always rendered (never conditionally removed from the layout), each one `disabled` at the
  end of the list rather than hidden, so the row's width/position never jumps. They exist because
  native HTML5 drag-and-drop fires on neither a keyboard nor a touch screen — the grip handle
  alone made reordering unreachable for both. Verified live: clicking "Move ISB Main Gate up"
  swapped it with its neighbor correctly, with no layout jump, and the first/last stop's
  corresponding button is correctly disabled. — Srinivas
  flagged that the old "navigate to a new page just to add one route" flow was inconsistent with
  Stop's modal, and that modals in general looked too abrupt. `AddRoutePage.tsx`/`EditRoutePage.tsx`
  and the old shared `RouteForm.tsx` are gone; `RoutesStopsPage.tsx` now opens `RouteModal`
  via local state (`addRouteOpen`/`editingRoute`), same pattern it already used for
  `StopModal`. The now-dead `useRoute(routeId)` query hook (only ever used by the deleted
  `EditRoutePage`) was removed too.
- **Every modal now has a real entrance animation** instead of appearing instantly — a new shared
  `src/components/Modal.tsx` (backdrop + bordered panel) used by both `StopModal` and
  `RouteModal`, with keyframes in `index.css` (`modal-backdrop-in` fades the backdrop,
  `modal-panel-in` fades/scales/slides the panel up over ~200ms with an ease-out-quint curve).
  Direct response to "that modal should have some popup animation, not some basic" — confirmed
  live that both animation classes apply with the expected duration/timing-function via
  `getComputedStyle`.
- **"Add a stop" and "Edit stop"** (`src/components/StopModal.tsx`, one shared modal for both)
  — name + a Google Maps place-search box and draggable/clickable map pin (search, click-to-place,
  or drag all update the lat/lng), replacing the old manual lat/lng number inputs. Uses the current
  `google.maps.places.PlaceAutocompleteElement` web component, not the deprecated `Autocomplete`
  class (closed to new Google Cloud projects since March 2025). Needs
  `VITE_GOOGLE_MAPS_API_KEY` in `.env.development.local` (gitignored — the committed
  `.env.development` only has an empty placeholder) with Maps JavaScript API, Places API, and
  Places API (New) all enabled and allowlisted on that key (shares the same
  `GOOGLE_MAPS_API_KEY` value the backend uses for Routes API). Create posts to `POST /v1/stops`;
  edit puts to the new `PUT /v1/stops/{id}` (added to the backend specifically for this). The
  backend's real validation errors (e.g. `DuplicateStopException`'s exact message) surface
  verbatim, confirmed live by actually triggering a duplicate-name rejection through the UI on
  both create and edit. **Geofence radius is collapsed behind a "Customize geofence radius
  (default 75m)" toggle** — most stops just want the default, so the field stays out of the way
  until asked for; editing a stop whose geofence was already customized starts with it expanded
  so that value isn't hidden. Edit mode shows the same "won't recalculate existing route legs"
  caveat as School's edit form. **The map pin itself is a custom teardrop in the app's accent
  yellow** (`StopLocationPicker.tsx`'s `MARKER_ICON`, an inline SVG data URI — not Google's
  default red, and not an `AdvancedMarker`/`Pin` since those need a Google Maps "Map ID"
  configured, which isn't set up), and whenever a geofence value is known, a translucent yellow
  `Circle` of that exact radius is drawn around the pin so the admin sees the real geofence, not
  just a point — updates live as the geofence input changes.
- **A floating toast notification system** (`src/lib/ToastContext.tsx`) — top-right,
  auto-dismisses after 5s, success (green) and error (red) variants, manual ✕ dismiss. Replaced
  every scattered inline `<p className="text-danger">` error pattern across Add Stop, Add/Edit
  Route, Add Vehicle, and both delete actions on Routes & Stops, and added success toasts
  ("Stop added", "Route created/updated", "Vehicle added", "Stop/Route deleted") that didn't
  exist before. Direct response to a real UX complaint mid-session — errors were showing raw
  backend UUIDs (fixed at the backend source, see that repo's `PROGRESS.md`) and there was no
  success feedback anywhere.

**Settings (`/settings`) — General tab, the other newly-built page:**
- Two tabs: **General** (destination School — below) and **Profile** (still `"Not built yet."`,
  no Figma-mapped backend data to build against yet)
- **Destination school section** — the admin UI for the School entity, which didn't exist in any
  form before this (previously `POST /v1/schools` was curl/Hoppscotch-only). Reuses
  `StopLocationPicker` (the same Google Places search + draggable map pin component from Add
  Stop) for picking the school's location. Empty state shows "+ Set up destination school" when
  the tenant has none yet (`GET /v1/schools` returning `[]`); once one exists, shows a read-only
  name/lat-lng card with an **Edit** button that reopens the same form pre-filled, wired to the
  new `PUT /v1/schools/{id}` (added to the backend specifically for this — see that repo's
  `PROGRESS.md`). Create and update both surface the backend's real error messages via toast, and
  the edit form shows an honest caveat: moving the school doesn't recalculate the final leg on
  routes that already exist, only on new or re-saved ones. **This closes what was the single
  biggest gap in the app** — a brand-new tenant with no School was completely stuck (every route
  creation 409'd with `NO_SCHOOL_FOR_TENANT`) with no admin-facing way to fix it.
- Verified live, in the browser, as two separate admins/tenants: the edit flow on a tenant that
  already had a School (map pre-filled at the stored location, drag/click/save round-tripped
  correctly), and the create flow from scratch on a different tenant that had none (empty state →
  form → save → confirmed in Postgres and in that tenant's own audit log, correctly attributed to
  the admin who did it).

**Verified specifically, not just assumed:**
- Full create-a-route round trip through real clicks (not just API calls): typed a route name,
  picked a real vehicle, added two real stops in order, reordered them, saved, watched it appear
  correctly in the Routes tab
- Duplicate-stop-name rejection shows the backend's actual error message in the form
- CORS: found and fixed a real backend gap during this work — Spring Security had no CORS
  config at all, so the browser silently blocked every request even though curl always worked;
  fixed in `wayat-backend` (`app.cors.allowed-origins`), see that repo's `PROGRESS.md`

## Not built yet

- **Dashboard** — deliberately skipped first, per explicit instruction — `ComingSoonPage`
- **Live Operations** — `ComingSoonPage`
- **Approvals** — unclear yet what backend data this even maps to; needs figuring out before
  building, not just a UI pass — `ComingSoonPage`
- **Students** — Figma has list + add-one + bulk-upload + bulk-preview + import-done screens —
  `ComingSoonPage`
- **Settings → Profile tab** — Figma has Profile & Timings / Staff & Roles / Policies sub-tabs;
  only a bare "Not built yet" placeholder exists today, no backend data to build against yet
  (General tab is built — see above)

## Known gaps (flagged in the UI itself, not hidden — see `CLAUDE.md` for the full list)

- Figma's vehicle document-expiry field (insurance/fitness certificate) has no backend support —
  driver-assignment, the other half of this old gap, is now built (see Drivers & Vehicles above)
- Sidebar shows tenant ID, not tenant name (no `GET /v1/tenants/{id}` call yet)
- Tokens in `localStorage`, not an httpOnly cookie (needs a backend change too, not frontend-only)
- No admin UI exists yet to delete/view individual rides — a route with stale/leftover test ride
  history has no way to be freed up for deletion short of direct DB access (see backend
  `CLAUDE.md` — `ride_event` is deliberately append-only, so even that requires temporarily
  disabling a DB trigger, not something to reach for casually)

## What's next — not yet decided, ask before picking

Candidates, in no particular priority: Students, Settings → Profile, Dashboard, Live Operations,
Approvals (needs backend data-mapping figured out first). See the workspace-level
`context/PROGRESS.md` for how this fits against backend feature work too.
