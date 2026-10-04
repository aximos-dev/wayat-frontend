# wayAt Admin — working procedure

This file is read automatically at the start of every session in this project. It captures
*how we work on this repo specifically* — see `/Users/srinivas/IdeaProjects/wayAt/context/CLAUDE.md`
(the workspace-level one, one level up from this repo's parent folder) for cross-repo setup:
git/GitHub accounts, the Figma file reference, how this app relates to the backend and the
not-yet-started mobile app. Read that one too, especially before touching git remotes.

See `PROGRESS.md` in this same folder for current status and what's next.

## Who this is for

Same as the backend: Srinivas is a PM, not an engineer, learning as we build. Every new concept
(a React pattern, a TanStack Query idea, a Tailwind v4 quirk) gets a short plain-English
explanation inline, not skipped. Ask before big design decisions, don't ask about mechanical
setup — same rules as the backend, see the workspace `CLAUDE.md`.

## Tech stack (decided, don't re-litigate without reason)

- **React 19 + TypeScript + Vite** — chosen over Flutter Web specifically because this is a
  dense, desktop-only, data-table-and-modal-heavy internal admin tool, exactly what React's
  ecosystem is built for (TanStack Table, React Hook Form, browser-native text selection and
  keyboard nav). Flutter stays the pick for the driver/parent *mobile* apps — different tool for
  a different job, not a contradiction.
- **Tailwind CSS v4** (CSS-first `@theme` config, not the old JS config file) for styling,
  themed to match the Figma design exactly (see "Design tokens" below).
- **React Router** for navigation, **TanStack Query** for all server state (no separate global
  state library — server state *is* almost all the state this app has), **React Hook Form +
  Zod** for forms (installed, not yet used on every form — some early forms are still plain
  `useState`, see `PROGRESS.md`), **axios** for HTTP.
- Plain HTML `<table>` elements for the current list pages, not TanStack Table — a deliberate v1
  simplification given how small the current lists are. Revisit if/when a list page needs
  sorting, pagination, or column resizing.

## Local environment

- Dev server: `npm run dev` → `http://localhost:5173`
- Talks to the backend at `VITE_API_BASE_URL` (`.env.development`, currently
  `http://localhost:8080`) — the backend must be running and its CORS config
  (`app.cors.allowed-origins`) must include this app's origin, or every request fails silently
  client-side with no server-side trace. Hit this for real once already.
- No test suite exists yet.

## Architecture conventions

- **`src/lib/types.ts` mirrors the backend's DTOs field-for-field, by hand.** No shared schema
  or codegen exists yet — if a backend DTO changes shape, this file (and the query hooks that
  use it in `src/lib/queries.ts`) must be updated in the same change, or the two silently drift.
- **`src/lib/queries.ts`** — one `useX`/`useCreateX` pair per resource, each a thin TanStack
  Query wrapper around `src/lib/api.ts`'s axios instance. Mutations invalidate the relevant
  list query key on success so the UI refetches rather than needing manual cache patching.
- **Auth**: `src/lib/tokenStore.ts` (localStorage — a known simplification, see "Known
  simplifications" below), `src/lib/auth.ts` (the three API calls: request/verify OTP, logout),
  `src/lib/AuthContext.tsx` (React context exposing the decoded JWT principal to the whole app).
  `src/lib/api.ts`'s response interceptor handles 401 → refresh → retry automatically, with a
  single shared in-flight refresh promise so two concurrent 401s don't race the backend's
  single-use refresh token (one would get `INVALID_REFRESH_TOKEN` otherwise).
- **Routing**: `src/layout/ProtectedRoute.tsx` gates everything except `/login` behind
  "is there a valid, unexpired JWT right now" (checked client-side by decoding the token — the
  backend is still the real authority; this is just UX, not security). `src/layout/AppShell.tsx`
  is the sidebar + top-level layout, matching the Figma nav exactly.
- **One page per route under `src/pages/`**, matching the Figma screen names where a design
  exists. `ComingSoonPage` is the deliberate placeholder for every nav item not built yet — see
  `PROGRESS.md` for which ones.
- **Error surfacing**: forms catch axios errors and show `err.response.data.message` directly —
  the backend's `ApiError.message` is written to be human-readable (see backend `CLAUDE.md`'s
  one-exception-per-reason convention), so the frontend doesn't need its own error-message
  mapping layer. Don't build one; keep surfacing the backend's own message.

## Design tokens (pixel-sampled from Figma, not exact published variables)

The Figma Dev Mode variable API wasn't reachable in the environment these were built in (no live
desktop Figma session) — these are sampled directly off rendered screenshots, close
approximations rather than exact hex values from a design-tokens export. They live in
`src/index.css` as Tailwind v4 `@theme` vars. **Reuse these exact values for anything new — don't
re-sample from scratch**, and if real design-system variables ever become reachable, reconcile
against these rather than guessing which is more "correct."

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#15171C` | page / sidebar background |
| `bg-surface` | `#1E2027` | cards, inputs, search bar |
| `border` | `#0C0D10` | hairlines |
| `text-primary` | `#FFFFFF` | headings, main text |
| `text-muted` | `#8A8F99` | secondary text, inactive nav |
| `accent` | `#FFC531` | primary buttons, logo dot |
| `accent-muted` | `#AF8726` | active nav item text |
| `accent-bg` | `#2B2413` | active nav item background |
| `success` / `success-bg` | `#39C689` / `#122419` | "ACTIVE", long-expiry badges |
| `warning` / `warning-bg` | `#E9B42E` / `#362D15` | soon-to-expire badges, dev-mode OTP banner |
| `danger` / `danger-bg` | `#E76161` / `#3A2224` | expiring-soon / error badges, form errors |
| `neutral` / `neutral-bg` | `#8A8F99` / `#2A2D35` | neutral status badges |

Tailwind v4 generates utility classes from the `@theme` var name after `--color-`, so
`--color-bg-base` → `bg-bg-base`/`text-bg-base`/etc. (reads a little oddly but is correct).

## Known, deliberate simplifications (don't "fix" these without discussing first)

- **Tokens live in `localStorage`.** Simplest thing that works, but an XSS bug anywhere in this
  app could read them. Hardening would move the refresh token to an httpOnly cookie the backend
  sets — the backend doesn't do that yet (it returns both tokens in the JSON body today); this
  is a two-sided change, not just a frontend one.
- **No true drag-and-drop stop reordering** on the "Add a route" page — ↑/↓ buttons instead.
  Functionally equivalent, much less code/risk for a v1. The Figma design shows a drag handle.
- **No map picker for stop coordinates** — admin types lat/lng directly (e.g. copied from Google
  Maps). A real map-pin picker is a known, unbuilt gap.
- **The Figma "Add a vehicle" screen's "Assign Driver" and "Documents" (insurance/fitness
  certificate expiry) fields have zero backend support.** Today a driver is only attached to a
  *ride*, never permanently to a *vehicle*, and no document-expiry field exists anywhere in the
  backend's `Vehicle` entity. The admin app's Add Vehicle form only renders the three fields the
  backend actually has (`regNo`, `type`, `seats`) and says so explicitly in the UI rather than
  rendering fake/disabled fields.
- **No sidebar tenant name** — the bottom-left user card shows a truncated tenant *ID*, not the
  tenant's actual name, because fetching it would need a `GET /v1/tenants/{id}` call this app
  doesn't make yet. Trivial to add once the Settings page (which will need the same data) is
  built.
- **The "Stops" tab doesn't exist in the Figma design** — added anyway, because the backend has
  full Stop CRUD (including delete, with real duplicate-name/location checks) and there was no
  other way to see or remove a stop without it.
