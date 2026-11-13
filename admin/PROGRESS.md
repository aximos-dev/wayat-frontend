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

**Student Management (new) — `src/pages/StudentManagementPage.tsx`:**
- Built backend-first (per explicit instruction) against the new `Child`/`Parent`/`SchoolClass`/
  `Section` API surface — see `wayat-backend`'s `PROGRESS.md` for the full data-model writeup.
  Two tabs: **Students** and **Parents**, same tab-bar pattern as Drivers & Vehicles.
- **`StudentModal.tsx`** (Add/Edit student) — name, admission no., a class→section cascading
  pair of selects (picking a class resets and re-filters the section options), an optional
  assigned-stop select. Create mode has an inline 1-2-guardian form (name/phone/relation each,
  "+ Add second guardian"); edit mode instead shows the student's real guardians live — each
  with its own invite status and a **Remove** button, plus "+ Add guardian" capped at 2 — wired
  straight to the backend's dedicated guardian endpoints rather than going through the student
  update endpoint, matching how the backend models guardians as a separate resource. The page
  passes the modal a **student id**, not the student object itself, specifically so that
  removing/adding a guardian (which refetches the student list) is reflected live in the open
  modal instead of showing a stale snapshot from when it was opened.
- **`BulkImportStudentsModal.tsx`** — CSV columns studentName/admissionNo/className/sectionName/
  parent1Name/parent1Phone/parent1Relation/parent2Name/parent2Phone/parent2Relation (last three
  optional), downloadable template, same paste-or-upload + row-preview-with-status-badges
  pattern as the Driver/Vehicle importers. Client-side validation catches a bad relation string
  or a half-filled second guardian before it's even submitted; admission-number duplicates
  within the pasted batch are also caught client-side, same as Driver's phone-dup check.
- **`ClassSectionModal.tsx`** — "Classes & sections" button on the Students tab, a two-column
  layout (classes list on the left, the selected class's sections on the right), reusing the
  same inline add/rename/delete-with-usage-count pattern as `VehicleTypeModal`.
- **Parents tab** — name/phone/children/invite-status table. Per-row "Send invite" (or "Resend"
  once already invited) plus a header "Send invite to N pending" button that only appears when
  there's at least one never-invited parent — both call the backend's `WhatsAppInviteService`
  stand-in (it logs the message server-side; see backend `CLAUDE.md`), verified live by checking
  the backend log for the exact rendered message after clicking.
- **Settings → General** gained a new **Organization** card (`TenantSection.tsx`, new component,
  placed above the existing Destination school card) — the tenant's name (editable, finally
  replacing the sidebar's truncated tenant ID — see "Known gaps" below) and the tenant-wide
  fallback invite code, with copy and regenerate. The copy button's `navigator.clipboard` call is
  wrapped in try/catch with a "select and copy manually" fallback message, since clipboard
  permission isn't guaranteed in every environment.
- **A real bug found and fixed during testing, not just in the new code**: all three existing
  bulk-import modals (Drivers/Vehicles/Stops, plus the new Students one) left their "Import"
  button enabled after a partial-success import — clicking it again (or an accidental
  double-click) silently resubmitted the same rows, including ones that had just succeeded,
  which then failed as duplicates. Fixed in all four by also disabling the button once
  `submitOutcome.size > 0`; editing the pasted text already resets that state, so re-enabling on
  a genuine edit still works. Caught live while testing the new Students importer — a second
  click on "Import 3 students" re-sent 2 already-created siblings, which came back `FAILED` as
  duplicates, before the fix.
- Verified live, in the browser, against the real backend: created a student with 2 guardians,
  edited it to remove one guardian down to 1 (succeeded), attempted to remove the last one (409
  `LAST_GUARDIAN`, backend's own message surfaced, guardian stayed), added a guardian back, sent
  one parent an individual invite then bulk-sent the rest, confirmed both the invite-status badge
  and the backend's logged WhatsApp message; bulk-imported a CSV with a sibling pair (correctly
  shared one parent), a row with a duplicate admission number (correctly `Failed`, not blocking
  the 2 good rows), and a bad relation string (correctly caught client-side as `Invalid` before
  submission); renamed the tenant and watched the sidebar update live; copied and regenerated the
  tenant invite code. All test data cleaned up afterward via direct `psql` deletes, same
  convention as every other feature here.

**Revised after Srinivas used the first pass — four real defects fixed, backend contract
changed to match (see `wayat-backend`'s `PROGRESS.md`, `V16` migration):**
- **`PhoneInput.tsx`** (new, shared) — every phone field in the app (`Driver`, `Parent`) now has
  a fixed, non-removable "+91" prefix segment next to a digits-only input (filters non-digits,
  caps at 10) instead of a free-text field expecting the admin to type the full
  `+91XXXXXXXXXX` string themselves. `value`/`onChange` still carry the full phone string, so
  callers didn't need to change shape, just swap the input element.
- **Parents are a real standalone directory now, not a side effect of adding a student.** The
  "Add Student" form used to let you type a brand-new guardian's name/phone/relation inline,
  silently creating a `Parent` row — Srinivas's call was that this hides the fact that Parents
  are their own managed resource. The **Parents tab** is now a genuine directory: `+ Add parent`
  opens `ParentModal.tsx` (new) with first/last name + `PhoneInput`, wired to the backend's new
  `POST /v1/parents`. The old combined "Parents" tab (directory + invite sending) is now two
  separate tabs — **Parents** (directory: name, phone, linked children, Edit) and **Invites**
  (today's invite-status-and-send table, unchanged in behavior) — so managing who a parent *is*
  is a different screen from nudging them to accept.
- **`StudentModal.tsx`'s guardian fields are a search-and-pick UI now, not inline create
  fields.** Create mode's old "type a name/phone/relation" boxes are gone; typing in the new
  "Search parent by name or phone…" box filters the tenant's already-loaded parent list
  client-side (same in-memory-filter pattern as the class/section pickers), picking a result
  shows it as a pending chip with a relation dropdown and an Add/Cancel pair before it's
  committed to the student (create) or immediately linked (edit, via the existing
  `useAddGuardian`). A student literally cannot reference a parent that doesn't exist yet — the
  backend enforces this too (`GuardianLink(parentId, relation)` replaced
  `GuardianInput(name, phone, relation)` on `CreateChildRequest` and
  `POST /v1/children/{id}/guardians`).
- **First name / last name, not one free-text name field, for both Student and Parent** — Driver
  and every other entity in the app kept a single `name` field; Srinivas's ask was specifically
  scoped to Student and Parent. `StudentModal`/`ParentModal` now have separate First/Last name
  inputs (last name optional); list/table views still show one combined name, reading the
  backend's computed `name` field (= `firstName` + `lastName`, not independently editable) so
  no display code needed to change. `BulkImportStudentsModal`'s CSV columns changed to match:
  `firstName`/`lastName` for the student and for each of the (still phone-resolved-or-created,
  see backend `PROGRESS.md`) parent1/parent2 — 13 columns now instead of 10, template and
  client-side validation updated accordingly.
- Verified live, in the browser: the +91 prefix correctly strips/caps pasted garbage input to
  10 digits on both Driver and Parent forms; added a parent through the new directory flow;
  searched for and linked that parent to a new student by name, picked a relation, saved;
  confirmed the Invites tab is now separate from the Parents directory and still sends/shows
  invite status correctly; confirmed the pre-existing student/parent data (added by Srinivas
  between sessions) round-tripped through the `V16` first/last-name-split migration correctly
  and was untouched by this session's own test data, which was cleaned up via `psql` afterward.
- **Noted for later, not built**: tracking whether a parent actually *accepted* their invite
  (opened the app, entered the code), not just that it was sent — see backend `PROGRESS.md`
  roadmap item #6. Blocked on the same thing as parent login generally: the mobile app doesn't
  exist yet to call a "redeem code" endpoint.
- **Real bug fixed**: `ParentModal.tsx`'s edit mode showed phone as a read-only `<p>`, justified
  by a comment claiming parity with `Driver` — except `Driver`'s edit form *does* let you change
  phone. Found when Srinivas tried to edit a parent's number and couldn't. Root cause was
  actually one level deeper: the backend's `UpdateParentRequest` never had a `phone` field at
  all (an oversight — `Driver`'s equivalent request always did). Fixed both sides: backend gained
  `phone` on `UpdateParentRequest` plus the same duplicate-check-excluding-self `Driver` already
  does, and `ParentModal` now always renders the editable `PhoneInput`. Verified live: edited a
  parent's phone, saved, confirmed it persisted, reverted the test value back afterward.

**Approvals (new) — `src/pages/ApprovalsPage.tsx`:**
- Replaces the `ComingSoonPage` placeholder. Backend: new `StopRequest` entity/endpoints — see
  `wayat-backend`'s `PROGRESS.md` for the full data-model writeup (including a real,
  previously-systemic 401-vs-400 bug this feature surfaced and fixed, affecting every endpoint
  in the app, not just this one).
- Three tabs — **Pending** (default, live count badge), **Approved**, **Rejected** — same
  `usePagedSearch`/`SearchBar`/`PaginationBar` pattern as every other list page now.
- **`StopRequestModal.tsx`** (new) — opened via "Review": student + parent info, the request
  itself (existing stop name, or a proposed new name/lat/lng), and a seat-availability card per
  nearby route (green/amber/red by seats left, with distance shown for a `NEW_STOP` proposal) —
  this is the "assess before deciding" view the backend's live-computed `nearbyRoutes` exists
  for. Clicking a route card selects it as the one the map preview above compares against — also
  the route a `NEW_STOP` approval would attach to, see below. A `PENDING` request gets Approve
  (optional note) / Reject (two-step, reason required) right there; a resolved one shows the
  outcome read-only.
- **`StopRequestMapPreview.tsx`** (rewritten) — sits in the review modal, between the
  parent/request-details cards and the `nearbyRoutes` capacity list. Originally drew every *other*
  tenant stop as small muted gray dots for context; reported hard to actually see, and not
  ordered in any meaningful way. Now draws the **selected candidate route's own stops**, as the
  same numbered yellow markers used everywhere else a route's order is shown (`RouteMapModal`,
  `RouteStopsPreviewMap`), in their real run order, connected by the route's actual stored road
  path — "is this near anything, and where would it fit in today's run" instead of an unordered
  scatter. The proposed/requested stop stays the distinct yellow pin. Still reuses the existing
  Google Maps wiring, no new dependency.
- **Attach-to-route-at-approval (new, `NEW_STOP` + `PENDING` only)** — a checkbox under the
  selected route's capacity card, "Add this stop to `<route>`'s run now", disabled with an
  explanation if that route already has ride history (new `NearbyRouteOption.hasRideHistory` field
  — mirrors the backend's `update()`/`ROUTE_IN_USE` rule: a route with real rides can't have its
  stop order changed). Checking it seeds a reorder list — the route's current stops plus the
  proposed one, appended at the end by default — with ▲▼ buttons (same pattern as `RouteModal`'s
  own stop reordering) to place it; the map preview above updates live, renumbering every marker
  after the insertion point. Approving sends the backend's new `routeId` /
  `existingStopIdsInOrder` / `insertPosition` fields, which insert the stop into that route's run
  order and re-fetch real road legs for the changed adjacency, in the same request as the
  approval — previously this always required a separate trip to the Routes tab afterward.
- No parent-facing UI exists anywhere to generate real requests from (no mobile app yet) — the
  mock data behind this was produced by actually calling `POST /v1/stop-requests` with real
  invite codes for real students already in the tenant, the same way a parent's app will one day
  call it, not inserted directly into the database. Verified live: approved a request down to a
  tenant's single 8-seat route's last free seat, confirmed a second parent's competing request
  for the same route correctly flipped to "0/8 seats free" in red before resolving it; a
  `NEW_STOP` proposal's map preview correctly showed Route 1's 3 stops as separated numbered
  markers (previously invisible-looking gray dots); checked "Add to Route 1's run now", moved the
  proposed stop from the default last slot to position 2 via ▲▼ (map renumbered live to match),
  approved, and confirmed on the Routes & Stops map that Route 1 now runs 4 stops in exactly that
  order with real road legs recalculated. Also caught a numbering bug live during this pass — an
  `EXISTING_STOP` review showed a route's 4th stop as "3" because markers were numbered *after*
  filtering the already-on-this-route target out, not before — fixed by indexing pre-filter.
- **Attach-preview road path fix** — the "attach to route" map preview originally drew every leg
  as a straight dashed line the moment the checkbox was checked, even ones the insert didn't
  actually touch. `AttachRoadPath` (rewritten) now only approximates the (at most) two edges
  touching wherever the admin places the new stop — every other leg, including the final one to
  school, keeps the route's real stored road path. Caught and fixed a real crash along the way:
  switching which route is being previewed while already attaching could hand a stale/negative
  insert index to the path-drawing logic for one render before the reorder list caught up —
  `StopRequestModal` now nulls out `insertAt` instead of leaving it at `-1`, and
  `StopRequestMapPreview` bounds-checks it against the newly-selected route's actual stop count.
- **Grace (standing) seats (new)** — see `wayat-backend`'s `PROGRESS.md` for the full backend
  writeup (`VehicleType.graceSeats`, `RouteCapacitySnapshot.graceAvailable`,
  `ApproveStopRequestRequest.viaGraceSeat`). On the frontend:
  - **`VehicleTypeModal.tsx`** — the existing rename form gained a "Grace" number input alongside
    the name (both add and edit), and the list row shows a `+N grace` badge when set.
  - **`NearbyRouteRow`** (in `StopRequestModal.tsx`) — a full route's badge now reads "No seats
    free" instead of a confusing `-1/8 seats free` (negative availability was always possible
    once occupancy ran past capacity, see the bug-fix note below), and gets a second amber "+N
    grace (standing)" badge when the route's vehicle type has room to spare there.
  - **Grace-seat opt-in panel** — appears once the selected/previewed route is both full and has
    `graceAvailable > 0`, for either request type (not just the attach-to-route flow, which is
    `NEW_STOP`-only — grace applies to an `EXISTING_STOP` approval too, since that stop's already
    on a route). Checking it prefills the note field with the same default message the backend
    would fill in anyway if left blank (editable, never overwrites a note the admin already
    typed), and sends `viaGraceSeat: true` on approve. A resolved request that went through this
    way shows a "Grace seat (standing)" badge next to its assigned stop.
  - **Deliberately not built**: a parent opting into a grace seat themselves — there's no
    parent-facing app in this codebase to put that UI in (see backend `PROGRESS.md`'s note on the
    same gap). The backend is already shaped for it (nothing ever blocked a parent from
    requesting a full stop, grace or not) — only the UI surface is missing.
  - **A real capacity bug found while testing this, not caused by it**: Route 1 was showing
    `-1/8 seats free` — not a calculation bug, `RouteCapacityService` was correctly counting 9
    children genuinely assigned to its stops (4 crammed onto ISB Main Gate alone) against an
    8-seat Mini Van. Fixed by moving one child to a different route with room, via the real
    `PUT /v1/children` endpoint — this is exactly the scenario grace seats exist for, and is now
    used as the live Route 1 test case for the feature above instead of being "fixed away."
- **A real caching bug found right after, and fixed**: Route 1's stop list kept silently
  reverting to an older, shorter version (dropping a stop) with no corresponding action taken in
  this app. Traced to `useApproveStopRequest`'s `onSuccess` never invalidating the `["routes",
  tenantId]` query — an attach-to-route approval genuinely changes a route server-side, but the
  cached `routes` list didn't know to refetch. Anyone who approved a request and then opened
  "Edit route" on a stale-cached route could silently save it back to the pre-attach stop list.
  Fixed by adding that invalidation; restored Route 1's data via the real route-update API
  afterward (not a raw DB edit).
- **Counter-proposals (new)** — see `wayat-backend`'s `PROGRESS.md` for the full backend writeup
  (`StopRequestStatus.COUNTER_PROPOSED`, `counterProposed*` fields, the four new endpoints). On
  the frontend:
  - **`StopRequestModal.tsx`** — a `NEW_STOP` + `PENDING` review now has a "Suggest a different
    location instead" link next to the usual Approve/Reject actions, opening an inline form that
    reuses **`StopLocationPicker`** exactly as-is (search a place, click the map, or drag the pin
    — the same component already used when adding a stop by hand) to pick the alternate spot,
    plus a name field and an optional note to the parent. Submitting moves the request into a new
    `COUNTER_PROPOSED` state without approving or rejecting anything.
  - **`ApprovalsPage.tsx`** gained a fourth tab, "Awaiting parent", alongside Pending/
    Approved/Rejected.
  - A `COUNTER_PROPOSED` review shows a dedicated amber panel with the suggested location, the
    admin's note, and an honest line that no parent app exists yet to deliver or answer it — with
    a "Withdraw suggestion" action (admin-only) to put it back to Pending, since otherwise a
    misclick would leave a request permanently stuck with no way to move it from this UI alone.
  - **`StopRequestMapPreview.tsx`** draws the admin's suggestion as a second, distinctly-colored
    (blue, not yellow or the school's green) pin alongside the original proposed location, so
    both are visible on the same map at once.
  - Verified live end-to-end: suggested "ISB Main Entrance Road" (dragged onto an actual road) in
    place of Ananya Pillai's original off-road pin, confirmed the request moved from Pending to
    the new Awaiting Parent tab with both pins and the note showing, then withdrew it and
    confirmed it landed back in Pending exactly as it started.
- **Review-modal decision redesign** — grace seats, attach-to-route, and counter-proposals each
  added their own panel to `StopRequestModal.tsx`'s `PENDING` view independently, and by the time
  all three existed stacked on the page at once (nearby-routes list, a grace checkbox, an
  attach-to-route checkbox with its own drag-reorder sub-list, then separate Reject and Suggest
  forms toggled by their own booleans) it read as a pile of maybe-related panels rather than one
  clear decision — flagged as confusing. Replaced the three independent `rejecting`/
  `suggestingAlternate`/implicit-approve boolean states with one `decisionTab: "approve" |
  "suggest" | "reject"`, rendered as a segmented tab bar (same visual pattern as the Approvals
  page's own Pending/Awaiting parent/Approved/Rejected tabs) directly under the nearby-routes
  list. Grace-seat and attach-to-route are **not** separate tabs — they're sub-options nested
  inside the Approve tab's content, since they're modifiers on approving (and can combine with
  each other) rather than alternative top-level actions the way Suggest-alternate and Reject are.
  Each tab's form only renders its own fields; switching tabs no longer leaves a previous tab's
  inputs visible underneath. Verified live: all three tabs on Ananya Pillai's request (grace +
  attach-eligible NEW_STOP) render cleanly with no bleed-through, and switching tabs doesn't lose
  or submit anything.
- **Further split into two explicit steps, and added a confirm-before-send preview** — still
  flagged confusing after the tab redesign above: comparing routes and deciding what to do about
  the request were both live on screen at once, and the Suggest-alternate tab's location picker
  was a blank map with no sense of where the candidate route even runs. Two follow-up changes:
  - **`step: "route" | "decide"`** (new) now gates the map + nearby-routes comparison into its
    own first screen, with a "Continue to decide →" button handing off to the Approve/Suggest/
    Reject tabs from the redesign above. A "← Change route" link at the top of the Decide step
    goes back without losing anything — `previewRouteId` persists across both steps.
  - **`StopLocationPicker.tsx`** gained optional `contextMarkers`/`contextLabel` props — the same
    numbered-yellow-circle treatment used everywhere else a route's stop order is shown. The
    Suggest-alternate tab now passes the selected route's own stops in, so the admin drags the
    new pin relative to where the bus actually goes instead of guessing on an empty map. Framing
    is captured once on mount (via a ref, not live state) so it doesn't keep re-fitting and
    undoing the admin's own zoom every time they drag the pin.
  - **A preview stage before either commit** — both the Approve and Suggest-alternate tabs now
    end their form with "Continue to preview →" rather than the actual commit button. The preview
    screen (new `previewing` boolean per tab) shows `StopRequestMapPreview` again reflecting the
    final state, a plain-English recap (grace/attach/note, or the suggested name+coordinates+
    note), and only *there* do "Confirm & approve" / "Confirm & send suggestion" actually exist —
    with a "← Back" to return to the editable form. The suggest-preview map is fed an ephemeral
    copy of `stopRequest` with the in-progress `counterProposed*` fields overlaid locally (nothing
    sent yet), reusing `StopRequestMapPreview`'s existing dual-pin rendering rather than building
    a second map component.
  - Verified live on Ananya Pillai's request: Route step → Continue to decide → Suggest alternate
    (confirmed Route 1's 3 stops render as numbered pins alongside the draggable pick pin,
    clicked to place it) → Continue to preview (both pins + route context + recap shown) → Back
    (form state preserved) → Change route (returned cleanly to the Route step, nothing submitted).
  - **A real bug found by actually running the flow (not just reading the code) and fixed**:
    picking a location while comparing against one route, then using "← Change route" to compare
    against a different one, silently carried the old pin's coordinates forward — the suggestion
    preview would show "Comparing against Route 1" while the pin was still sitting wherever it
    was dropped under Route 3's context, nowhere near Route 1's actual stops. Root cause:
    `counterLat`/`counterLng`/`counterName`/`counterNote` had no reset tied to `previewRouteId`,
    unlike `useGraceSeat` which already did. Found the exact same gap on `attachToRoute` while
    auditing for more of the same class — checking "attach to Route 3's run", then switching to
    Route 1, left the checkbox checked (and, since it's `disabled` whenever the newly-selected
    route `hasRideHistory`, could render checked-but-disabled, a contradictory state). Fixed both
    by resetting alongside `useGraceSeat` in the same effect, keyed on `previewRouteId`. Also
    caught and fixed a related perf bug while in there: `suggestContextMarkers` was a brand new
    array on every render, which defeated `StopLocationPicker`'s one-time-fit memoization and
    would have re-fit (re-zoomed) the picker's map on every keystroke elsewhere in the form —
    wrapped it in `useMemo`. Reproduced the original bug live (pick under Route 3 → switch to
    Route 1 → stale coordinates), then reproduced the fix (same steps → pin correctly resets to
    the original proposed location each time the compared route changes).
- **A second, more fundamental bug found the same way (run it, don't just read it) — the
  Suggest-alternate map rendered completely blank**, no base tiles, no pin, nothing. Root cause:
  `StopLocationPicker` was the only one of this app's four map components requesting the
  `"places"` library (for its address search box) — `StopRequestMapPreview`, `RouteMapModal`, and
  `RouteStopsPreviewMap` all request `"geometry"` instead (for decoding stored route polylines).
  The Google Maps JS SDK loads once per page as a global singleton: whichever `<APIProvider>`
  mounts first locks in its library list, and a later one mounted with a *different* list doesn't
  get a second load — its request is silently dropped (console: "already been loaded with
  different parameters"), and in this case the second map failed to render at all rather than
  just missing the extra library. Since this modal's own review flow mounts a `"geometry"` map
  first (the Route step) and only reaches the `"places"` one after advancing to Suggest
  alternate, it hit this on every single use. Fixed by giving every `<APIProvider>` in the app
  the same superset, `MAP_LIBRARIES = ["geometry", "places"]` (new, in `routeMapShared.tsx`, with
  a kdoc explaining why it has to stay a single shared constant rather than four components each
  requesting only what they individually need) — whichever one loads the SDK first now satisfies
  every other map's needs too, regardless of mount order. Verified live: full page reload, opened
  the Suggest-alternate tab directly, map rendered correctly on the first try with Route 1's
  numbered stops visible, no console warning.

## Approval UX refinements (2026-10-09) — five issues reported after using the rebuilt flow live

1. **Seat counts showed "8/10 seats free" — switched to just "10 seats free"** per explicit
   request. `NearbyRouteRow` in `StopRequestModal.tsx` now reads
   `${option.availableSeats} seat${…} free` instead of including `totalSeats`.
2. **Grace-seat opt-in looked like a routine checkbox, easy to miss it's an above-capacity
   decision — restyled as a warning banner** (`border-warning/40 bg-warning-bg/30`, ⚠ prefix),
   same visual language as the counter-proposal's "awaiting parent" banner, instead of a plain
   `bg-bg-surface` card.
3. **The real bug: approving a NEW_STOP without checking "attach to route" silently created an
   orphaned Stop no bus run ever visits** — `approve()` only inserts into a route's run order
   when `routeId`/`existingStopIdsInOrder`/`insertPosition` are explicitly sent; leaving
   `attachToRoute` unchecked (its old default) meant the *default*, no-extra-clicks path left the
   child's assigned stop off every route. Fixed by defaulting `attachToRoute` to `true` whenever
   a route is selected and can still be reordered (no ride history yet) — both on mount and on
   every `previewRouteId` change — plus an explicit warning note when that's not possible ("no
   bus run will visit it until…"). Verified live: reproduced the original gap (Route stayed at 4
   stops after a plain approve), then confirmed the new default actually attaches (Route went
   4 → 5 stops in the right position).
4. **Suggest-alternate's map showed the comparison route as floating numbered dots, no road
   line** (`StopLocationPicker` never drew anything connecting its `contextMarkers`), **and there
   was no way to say where in the run the suggested stop would go.** Fixed in two parts:
   - Extracted the road-path-drawing logic (decode each stop's stored `roadPolylineToNext`,
     straight-line fallback when missing) out of `StopRequestMapPreview`'s local `RoadPath` into
     a new shared `RoadPathSegments`/`RoadPathNode` in `routeMapShared.tsx`, so both
     `StopRequestMapPreview` and `StopLocationPicker` draw the exact same yellow-line vocabulary.
     `StopLocationPicker` gained `contextMarkers[].roadPolylineToNext` and a `contextFinalPoint`
     prop (wired to the destination school) to drive it.
   - Gave the Suggest tab its own attach-to-route + reorder UI, mirroring the Approve tab's.
     Pulled the drag/▲▼ reorder list out into a standalone `OrderEntryList` component (was
     duplicated inline in the Approve tab) so both tabs share one implementation over different
     `entries`/`onChange` pairs. Suggest's choice can't apply immediately — nothing's approved
     yet, the parent hasn't answered — so it's persisted on the backend
     (`counterProposedRouteId`/`counterProposedInsertPosition`, new in V20) and applied
     automatically by `acceptCounterProposal` once the parent accepts, re-reading the route's
     *then-current* stop order rather than trusting what the admin saw (see backend `PROGRESS.md`
     for the two real transaction bugs this needed catching and fixing along the way).
5. **"Shown clearly" at the final preview** — both the Approve and Suggest preview screens now
   state the attach decision explicitly ("Attaching to X's run, as ordered above" /
   "Will join X's run, as ordered above, the moment the parent accepts"), and the
   Suggest-tab map preview now actually shows the *suggested* location spliced into the route
   (previously it only ever showed the parent's *original* proposed spot with the suggestion as
   a disconnected second pin) — done by feeding `StopRequestMapPreview` a synthetic request with
   the suggested coordinates substituted into `proposedLat`/`proposedLng`, reusing the exact same
   target/insertAt machinery the Approve tab's preview already had.

All five verified live via the browser tools against the real dev server + backend, not just
code review — including the full counter-proposal → simulated-parent-accept round trip via curl,
which is what surfaced the two backend transaction bugs documented in the backend `PROGRESS.md`.

## Vehicle depot ("stop 0") — new feature, requested directly (2026-10-09)

A vehicle can now have an optional start/end point — where its driver starts the morning run and
returns to after the evening run — configured in `VehicleModal.tsx` behind a checkbox (name +
reused `StopLocationPicker` for the map/search pin-drop, no new picker component needed). Shows as
a "Depot" column in the vehicles table (`DriversVehiclesPage.tsx`). Full backend design/writeup is
in `wayat-backend/PROGRESS.md`'s matching entry — this one covers only the frontend side.

Treated as "stop 0" of every route that vehicle runs, and rendered everywhere a route's shape
already is, each reusing the backend's new `Route.vehicleDepotName`/`Lat`/`Lng` and
`depotDistanceToFirstStopM`/`depotDurationToFirstStopS`/`depotPolylineToFirstStop` fields:
- `RouteMapModal.tsx` (saved route) — depot leg drawn via a new shared `RoadPathNode`/
  `RoadPathSegments` done this same day for the Approvals rework (see below), depot listed first
  in the stop legend, counted into the total distance/duration.
- `RouteStopsPreviewMap.tsx` (live preview before saving) — same leg, fetched client-side the
  same way every other preview leg already was (`legTargets`/`legCache`), keyed `depot:<firstStopId>`.
  `RouteModal.tsx` just had to pass its already-resolved `vehicle` object one level down.
- `RoutesStopsPage.tsx`'s routes list — total distance/duration columns now include the depot leg
  when the route's vehicle has one, same "partial" asterisk convention as every other leg.
- `StopRequestMapPreview.tsx` (the approvals review map) — depot shown in the plain route-
  comparison case; deliberately NOT added to the attach-splice preview (`AttachRoadPath`), since
  inserting a stop elsewhere in the route never changes the depot leg (the one exception —
  inserting as the new first stop — is left as a minor, rare visual inaccuracy rather than
  complicating that splice logic further).

New `DEPOT_MARKER_ICON` in `routeMapShared.tsx` (muted blue-gray circle with a house glyph) keeps
the depot visually distinct from numbered stops (yellow) and the destination school (green) on
every one of these maps.

Verified live end-to-end: set a depot on Route 1's vehicle via the vehicles table, confirmed the
real road leg computed on re-save, and confirmed the identical total distance/duration (90.0 km ·
2h16min) shows consistently across the routes list, the saved-route map, the live pre-save
preview, and the Approvals review map's route comparison.

## Approvals: auto-approval UI (2026-10-25)

Backend now approves most stop requests by itself (see `wayat-backend/PROGRESS.md`). Admin side:
- `ApprovalsPage.tsx` — tabs are now Needs review / Awaiting parent / **Auto-approved** /
  Approved (by an admin) / Rejected; Auto-approved and Approved are both status APPROVED, split on
  `autoApproved`. Needs review rows carry a "Why" badge (`reviewReason`), auto-approved rows an
  Outcome badge (Auto / Nearest stop · N m / Grace seat). "Re-check pending" header button calls
  the backend's auto-resolve over the backlog.
- `StopRequestModal.tsx` — a "Why this needs you" banner on pending requests; for a new location,
  the precomputed suggestion ("add to Route X as stop #N — adds about M min") with Route X
  preselected and the new stop starting in that slot of the reorder list (`buildInitialOrder` now
  takes an insert position). Auto-approved requests show "Approved automatically" plus an
  "Undo & review manually" button.
- Labels live in `src/lib/stopRequestLabels.ts` (shared by page and modal).

Verified live in the browser: Needs review shows only the 2 genuinely-manual requests with
reasons; Auto-approved shows Vihaan and Pari (grace badge); Ishita's modal shows the Route 2 /
stop #1 / ~15 min suggestion with the order list starting at #1; the undo button appears on
auto-approved requests.

## Approvals: "New stops to check" (2026-10-26)

The backend can now create a stop on a bus's existing road for a home pin (see
`wayat-backend/PROGRESS.md`). Admin side:
- `ApprovalsPage.tsx` — new **New stops to check (N)** tab: auto-created stops not yet confirmed
  (`Stop.autoCreated && !confirmedAt`), with their route and position, the child it was added for
  and how far from their home pin.
- `ConfirmStopModal.tsx` (new) — rename and drag the pin (with the route's other stops and real
  road drawn for context), then **Confirm stop**; or **Can't stop here — remove & review**, which
  undoes the approval (stop comes off the route, request goes to Needs review).
- Outcome badges/labels now distinguish "New stop on route · N m" from "Nearest stop · N m".

Verified live: a home pin near Route 3's road was auto-approved with a new stop inserted as #3; it
appeared in the tab; confirming with a new name cleared it and saved the name.

## Approvals outcome details + "Re-plan routes" (2026-10-30)

- Approvals badges now show which option the system took and its cost — e.g. "Shared detour stop ·
  119 m walk · +10 min for the bus · 3 families", "New stop on bus road · 196 m walk"; Needs review
  shows "Too far from every bus · cheapest detour +10 min". Labels/helpers in
  `src/lib/stopRequestLabels.ts` (`RESOLUTION_LABEL`, `resolutionSummary`).
- `RoutePlanModal.tsx` (new), opened from **Re-plan routes** on the Routes page: loads the backend's
  preview, groups routes linked by moved stops (they must be applied together), shows ride
  before → after, the proposed order with moved-in stops in blue ("from Route X"), and applies the
  ticked groups. Over-cap routes shown as a warning.

Verified live: badges render on Auto-approved; the re-plan modal shows the −42 min plan for the 3
test routes as one linked group with the Route 1 over-cap warning. Not applied (left for review).

## Not built yet

- **Dashboard** — deliberately skipped first, per explicit instruction — `ComingSoonPage`
- **Live Operations** — `ComingSoonPage`
- **Settings → Profile tab** — Figma has Profile & Timings / Staff & Roles / Policies sub-tabs;
  only a bare "Not built yet" placeholder exists today, no backend data to build against yet
  (General tab is built — see above)

## Known gaps (flagged in the UI itself, not hidden — see `CLAUDE.md` for the full list)

- Figma's vehicle document-expiry field (insurance/fitness certificate) has no backend support —
  driver-assignment, the other half of this old gap, is now built (see Drivers & Vehicles above)
- Tokens in `localStorage`, not an httpOnly cookie (needs a backend change too, not frontend-only)
- No admin UI exists yet to delete/view individual rides — a route with stale/leftover test ride
  history has no way to be freed up for deletion short of direct DB access (see backend
  `CLAUDE.md` — `ride_event` is deliberately append-only, so even that requires temporarily
  disabling a DB trigger, not something to reach for casually)

## What's next — not yet decided, ask before picking

Candidates, in no particular priority: Settings → Profile, Dashboard, Live Operations,
Approvals (needs backend data-mapping figured out first), linking a Student to a route/stop as
part of the route-building flow (today a stop is assigned from the Student edit modal, one at a
time — fine for now, worth revisiting once route-building is the more common workflow). See the
workspace-level `context/PROGRESS.md` for how this fits against backend feature work too.


## Demand board (2026-11-11)

New **Demand** page (`src/pages/DemandPage.tsx`, nav item shown only when the signed-in tenant is
our own fleet — `tenant.type === "OPERATOR"`). Families waiting for a school our vans don't serve
yet, grouped by school (`GET /v1/demand/schools`): one card per school with children, monthly
revenue, vans needed, cluster share, a progress bar to the launch threshold, and "Ready to launch" /
"Collecting"; the selected school shows a dark map (school flag + home dots, stale families dimmed)
and the family list. Read-only for now — launching a school is phase 2. Types in `src/lib/types.ts`
(`DemandBoard`, `DemandSchool`, `DemandFamily`), hooks `useDemandBoard` / `useDemandSchool`;
`Tenant` gained `type` / `billingModel`, `School` gained `googlePlaceId`, `Route` gained `schoolId`.

## Super admin / ops pages (2026-11-12)

Our ops team signs in on the same login (dev: `+919999900001`, code `123456`) and gets:
- **Fleet overview** (`/platform`, `FleetOverviewPage.tsx`): every school, route and van across
  our fleets — stat tiles, fleet/school/search filters, one map of every route (colour per
  route), and tabs Routes / Schools / Vans. A route's van is changed right in the table (spares,
  "runs X", "too small" shown in the dropdown; a van already in use asks to swap first).
- **Schools & fleets** (`/platform/tenants`, `TenantsPage.tsx`): every tenant with its numbers,
  "Onboard a school or fleet" (tenant + first admin, then shows the new code), admins per tenant.
- **Work inside** a tenant: a switcher in the sidebar (and Open/Edit buttons) steps into any
  school or fleet; every existing page then works as that tenant's admin, under a banner saying
  changes are logged as wayAt ops. How: `AuthContext` keeps `account` (who signed in) and
  `principal` (the tenant being worked in); `api.ts` sends `X-Wayat-Tenant` from
  `localStorage` (`wayat_acting_tenant`, cleared on logout); switching clears the query cache.
  Route guards: `TenantRoute` / `SuperAdminRoute` in `layout/ProtectedRoute.tsx`.
- Types and hooks for the platform API: `src/lib/platform.ts`.
- Gotcha hit: the Vite dev server didn't generate Tailwind classes used only in newly added
  files until it was restarted.

## Demand board: stale families (2026-11-12)

Cards and totals count fresh families only; stale ones show as "+N stale … not counted". The
launch preview marks stale families given a spare seat and lists those not offered.
