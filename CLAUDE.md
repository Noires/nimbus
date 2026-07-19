# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Nimbus** — a spatial task-planning whiteboard. Task cards live at world x/y on an infinite pan/zoom canvas; cards within 240px auto-cluster into glowing "bubbles". Built as an npm-workspaces monorepo: `frontend/` (React 19 + Vite + TypeScript + Tailwind v4 + Zustand + Framer Motion + Zod) and `server/` (Express 5 on the tsx runner + Prisma 6 + PostgreSQL 16).

## Commands

Run workspace scripts from that workspace's directory (or use the root proxies).

```bash
# Database (Postgres in Docker) — start this first
docker compose up -d db          # or: npm run docker:up (starts all services)

# Dev servers (two terminals)
cd server   && npm run dev        # Express on :8085, tsx watch
cd frontend && npm run dev        # Vite on :5173, proxies /api → :8085

# Frontend: typecheck + production build (there is no separate lint step)
cd frontend && npm run build      # runs `tsc -b && vite build`
cd frontend && npx tsc -b         # typecheck only

# Server: typecheck (no build step; tsx runs TS directly)
cd server && npx tsc --noEmit

# Prisma
cd server && npm run seed         # seed demo canvas "clvl0demo0000"
cd server && npm run studio       # Prisma Studio
```

**Ports:** frontend `5173`, server `8085`, Postgres `5432`. The Vite dev proxy (`frontend/vite.config.ts`) forwards `/api/*` to `:8085`, so the browser is same-origin in dev.

### Migrations — important, non-interactive gotcha

`prisma migrate dev` is interactive and **fails in a non-interactive shell** ("environment is non-interactive"). To apply a schema change here, generate the SQL by diffing and apply it with `deploy`:

```bash
cd server
MIG="prisma/migrations/$(date +%Y%m%d%H%M%S)_your_name" && mkdir -p "$MIG"
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script > "$MIG/migration.sql"
npx prisma migrate deploy
npx prisma generate
```

- **`prisma generate` must run from `server/`** (from elsewhere it errors "Could not find Prisma Schema").
- On Windows the running dev server **locks the Prisma query-engine DLL** — stop the server before `prisma generate`, or it fails.
- New nullable/defaulted columns are non-breaking; the codebase relies on this to avoid data migrations.

### Testing / verification

There is **no test framework**. Verify changes by: (1) `tsc`/`npm run build`, (2) driving the running API with `curl` (the dev servers stay up as background tasks), and (3) for external integrations, a throwaway mock server (see the GitHub-sync pattern: run the real server with `GITHUB_API_URL` pointed at a local mock and `GITHUB_TOKEN=dummy`).

## Architecture — the big picture

### The store is the hub
`frontend/src/store.ts` (Zustand) is the single source of truth. **Almost all app logic lives here** — every mutation goes through a store action, which updates local state optimistically then reconciles with the server. Components are mostly render + event wiring. `frontend/src/data/api.ts` is the only place that talks to the backend: a Zod-validated `fetch` wrapper that stamps an `X-Client-Id` header on every request.

### World coordinates & the canvas
Cards store absolute world `x/y`. The visible transform is `screen = world * zoom + pan` (`Canvas.tsx`). `store.flyTo(worldX, worldY, zoom)` is a shared camera tween reused by the command palette, minimap, focus mode, review flight, etc. Proximity clustering (`engine/proximityDetector.ts`) is a union-find over card centers on a ~30fps rAF loop with hysteresis to prevent flicker; it is paused during the time lens and during time-lapse replay.

### Undo/redo — and the invariant that governs everything
`engine/history.ts` is an inverse-operation stack. Store actions record ops **unless called with `{ record: false }`**. This flag is load-bearing: any change that is **not** a direct local user action — remote SSE updates, the sync engine's writes, the focus timer banking minutes — MUST use `{ record: false }`, or undo will try to revert things the user didn't do. Batch ops (`{ kind: "batch" }`) make multi-card actions (arrange, flow-fill, bulk bar) revert as one step.

### Live sync (SSE)
`server/src/bus.ts` is an in-memory `EventEmitter` keyed by `canvasId`. Every mutation route calls `publish(canvasId, { entity, action, data, clientId })` after committing. `GET /api/canvases/:id/stream` is the SSE endpoint. On the client, `frontend/src/data/live.ts` opens an `EventSource` and calls `store.applyRemote()`, which upserts into local state **without touching history** and **ignores events whose `clientId` matches this tab** (echo suppression) and updates to the currently-dragged card. Adding a new synced entity means: widen the `entity` union in `bus.ts` + `store.ts`, publish from its routes, and handle it in `applyRemote`.

### Data model (`server/prisma/schema.prisma`)
`Canvas` owns everything (cascade delete). `Task` is the core entity (position, priority, due/estimate/recurrence/snooze, plus external-sync fields). Supporting models: `Bubble` (server-persisted pinned clusters), `Zone`, `Dependency`, `ChecklistItem`, `Portal`, `Template` (constellations), `Connection` (external integrations), and **`TaskEvent`** — an append-only event log with an `actor` column (`local` / `autopilot` / `capture` / `github`) that powers task history, the time-lapse replay, and the pulse/burndown panel. `TaskEvent` deliberately has **no FK to Task** so history survives deletion.

### External integrations (provider-extensible)
`server/src/integrations/` is a provider abstraction: `types.ts` (the `Provider` interface), `registry.ts`, `github.ts` (REST + GraphQL for Projects v2, plain `fetch`, no SDK), and `syncEngine.ts` (per-connection polling with backoff). Bidirectional sync's **echo prevention** relies on two rules: pushes to the provider originate **only** in the `taskRoutes` PATCH hook (`queuePush`) — the sync engine writes via Prisma directly and never re-pushes — and after each push the remote `updated_at` is stored as `externalMeta.remoteUpdatedAt` so the next poll skips its own echo. Auth is a single `GITHUB_TOKEN` in `server/.env`; the browser never sees it.

### Server bootstrap & env
`server/src/index.ts` calls `process.loadEnvFile()` explicitly at the top — `tsx watch --env-file` does not reliably forward env vars, and Prisma only loads `DATABASE_URL` on its own. `server/.env` holds `PORT`, `DATABASE_URL`, and optional `GITHUB_TOKEN` / `GITHUB_API_URL`. After `app.listen`, `initSync()` schedules polling for enabled connections.

### i18n (English + German)
`frontend/src/i18n/` — a dependency-free `t()` / `useT()` layer. Dictionaries are split into per-area fragment files (`fragments/a.ts`…`d.ts`) merged in `index.ts`; **keys are namespaced by fragment** (`a.*`, `b.*`, `c.*`; `d.*` = store toasts / help / brand). Rules when adding user-facing text: use `useT()` inside components (re-renders on language switch) and the bare `t` in store/module code; **add every key to both `en` and `de`** in the correct fragment; format dates with `dateLocale()`. Missing keys fall back en → key, so partial dictionaries never crash. The product name is the `app.name` key (currently "Nimbus"), not a hardcoded string.

## Conventions

- **Server route files** (`server/src/routes/*.ts`) follow one shape: validate input, mutate via the shared Prisma client (`prisma-client.ts`), `recordEvent`/`recordEvents` for anything user-meaningful, then `publish(...)` for SSE. `PATCH /api/tasks/:id` uses a `PATCHABLE` field whitelist — new editable Task fields must be added there.
- **New popovers/panels** follow the `AutopilotPopover.tsx` pattern: a `relative` wrapper, a trigger button, and (when open) a `fixed inset-0 z-40` click-catcher plus an absolute panel.
- Prefer extending store actions over adding fetch calls in components.
