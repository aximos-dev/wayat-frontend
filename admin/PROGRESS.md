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
- Sidebar matching the Figma nav exactly: Dashboard, Live Operations, Approvals, Students,
  Drivers, Routes & Stops, Settings — plus a bottom user card (shows role + truncated tenant ID,
  not yet the real tenant name) and a working Log out button

**Routes & Stops (`/routes-stops`) — the one fully-built page:**
- Three tabs: **Routes** (name, vehicle reg no, stop count, total known real road distance —
  "—" honestly shown when the backend has no Google Routes data for that route's legs),
  **Vehicles** (reg no, type, seats), **Stops** (name, lat, lng, geofence, delete button — this
  tab isn't in the Figma design, added because the backend needed some way to manage stops
  directly)
- **"Add a route"** (`/routes-stops/routes/new`) — route name, vehicle picker (populated from
  the tenant's real vehicles), an ordered stop list built by picking from the tenant's real
  stops one at a time, with ↑/↓ reorder and remove, submits to the real
  `POST /v1/routes` and redirects back to the list on success
- **"Add a vehicle"** (`/routes-stops/vehicles/new`) — reg no / type / seats, wired to
  `POST /v1/vehicles`; explicitly notes in the UI that the Figma design's driver-assignment and
  document-expiry fields aren't backed yet (see `CLAUDE.md`)
- **"Add a stop"** (modal) — name / lat / lng, wired to `POST /v1/stops`; the backend's real
  validation errors (e.g. `DuplicateStopException`'s exact message) surface verbatim, confirmed
  live by actually triggering a duplicate-name rejection through the UI

**Verified specifically, not just assumed:**
- Full create-a-route round trip through real clicks (not just API calls): typed a route name,
  picked a real vehicle, added two real stops in order, reordered them, saved, watched it appear
  correctly in the Routes tab
- Duplicate-stop-name rejection shows the backend's actual error message in the form
- CORS: found and fixed a real backend gap during this work — Spring Security had no CORS
  config at all, so the browser silently blocked every request even though curl always worked;
  fixed in `wayat-backend` (`app.cors.allowed-origins`), see that repo's `PROGRESS.md`

## Not built yet

Every other nav item is a literal `ComingSoonPage` placeholder:
- **Dashboard** — deliberately skipped first, per explicit instruction
- **Live Operations**
- **Approvals** — unclear yet what backend data this even maps to; needs figuring out before
  building, not just a UI pass
- **Students** — Figma has list + add-one + bulk-upload + bulk-preview + import-done screens
- **Drivers** — Figma has list + add-one screens
- **Settings** — Figma has Profile & Timings / Staff & Roles / Policies sub-tabs

## Known gaps (flagged in the UI itself, not hidden — see `CLAUDE.md` for the full list)

- No map picker for stop coordinates (types lat/lng directly)
- No true drag-and-drop route reordering (↑/↓ buttons)
- Figma's vehicle driver-assignment + document-expiry fields have no backend support
- Sidebar shows tenant ID, not tenant name (no `GET /v1/tenants/{id}` call yet)
- Tokens in `localStorage`, not an httpOnly cookie (needs a backend change too, not frontend-only)

## What's next — not yet decided, ask before picking

Candidates, in no particular priority: Students, Drivers, Settings, Dashboard, Live Operations,
Approvals (needs backend data-mapping figured out first). See the workspace-level
`context/PROGRESS.md` for how this fits against backend feature work too.
