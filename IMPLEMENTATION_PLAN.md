# Task Planning Dashboard - Implementation Plan

**Project root:** C:/Users/dusti/Source/task-dashboard

---

## 1. Product Summary
- Infinite whiteboard canvas (pan + zoom via mouse wheel and drag).
- Draggable task cards placed freely at any pixel coordinate.
- Cards dragged near each other snap together into glowing bubble clusters.
- Flat clustering only: nearby groups merge, no hierarchical nesting.
- Playful dark-mode-first UI with spring animations everywhere.

---

## 2. Tech Stack
| Layer | Tool |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS 4 (@tailwindcss/vite plugin) |
| Animations | Framer Motion |
| State mgmt | Zustand |
| Validation | Zod |
| Backend | Express.js (tsx runner, no compile step) |
| ORM | Prisma |
| Database | PostgreSQL 16 (Docker container) |

---

## 3. Ports & Environment
- **Frontend dev server**: `http://localhost:5173`
- **Backend API**: `http://localhost:8085`
- **Postgres (compose)**: `port 5432 inside Docker network`
- Frontend proxies `/api/*` to Express via `server.proxy` in vite.config.ts.

---

## 4. Folder Structure
```
task-dashboard/              project root
+-- docker-compose.yml      postgres:16-alpine, port 5432, PGDB=taskdb, PG_PASS=password
+-- .env.sample             PORT=8085, DATABASE_URL=postgresql://postgres:$PASS@db/taskdb
|
+-- server/                 Express + Prisma backend root
    +-- package.json        deps: express tsx cors @types/cors body-parser
    |                 scripts.start = "tsx src/index.ts"
    +-- tsconfig.json       target ESNext, moduleResolution NodeNext, strict:true
    +-- prisma/
    |   +-- schema.prisma   (models in Sec 5)
    |   +-- seed.ts         demo tasks scattered at random positions
    +-- src/
        +-- index.ts        Express app on :8085, CORS for :5173 only
        +-- routes/
            +-- taskRoutes.ts      /api/tasks CRUD
            +-- canvasRoutes.ts    /api/canvases CRUD

frontend/                 React Vite SPA root
    +-- package.json      deps: react zod zustand framer-motion @tailwindcss/vite postcss autoprefixer tailwindcss
    +-- vite.config.ts    dev :5173, server.proxy /api -> localhost:8085
    +-- tailwind.config.cjs   JIT content ./src/**/*.{ts,tsx}
    +-- index.html        <div id="root"> shell
    +-- src/
        +-- main.tsx              React.createRoot mount
        +-- App.tsx               root layout (Toolbar + Canvas)
        +-- global.css            @tailwind directives + custom @keyframes glow
        +-- components/
        |   +-- CanvasRouter.tsx    URL-param canvas selection + multi-canvas nav
        |   +-- CanvasList.tsx      sidebar listing canvases
        |   +-- Canvas.tsx          infinite pan/zoom surface with grid background
        |   +-- TaskCard.tsx        draggable card shell (title/desc/tags/color/pri/date)
        |   +-- BubbleLayer.tsx     SVG overlay: animated cluster glow per group
        |   +-- CreateModal.tsx     inline create/edit dialog form
        |   +-- Toolbar.tsx         Add Task btn, Active/Done toggle, Reset View
        +-- engine/
        |   +-- proximityDetector.ts  rAF ~30fps clustering (adjacency graph + union-find)
        +-- store/
            +-- useStore.ts       Zustand slices: tasks, positions, clusters, viewTransform
        +-- data/
            +-- api.ts           typed fetch wrapper with Zod validation of API responses
        +-- utils/
            +-- colors.ts        deterministic gradient per card seeded by task.id (djb2 hash)
```

---

## 5. Prisma Schema (`server/prisma/schema.prisma`)
```prisma
generator client {
    provider        = "prisma-client-js"
}

datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
}

model Canvas {
    id            String   @id @default(cuid())
    name          String
    createdAt     DateTime @default(now())
    createdTasksId String?  // FK pointing to tasks on this canvas
    tasks         Task[]   @relation("CanvasTasks")  // RELATION: one canvas has many tasks
}

model Task {
    id          String             @id @default(cuid())
    canvasId    String
    x           Float
    y           Float
    z           Int               @default(0)  // stacking order (higher = above lower)
    title       String
    description String            @default("")
    tags        String[]          @default([])
    color       String            @default("")  // hex code auto-generated per card via colors.ts
    dueDate     DateTime?         // optional countdown badge; past-due shows red border
    priority    String            @default("medium")  // "high" | "medium" | "low"
    done        Boolean           @default(false)  // toggles visibility via toolbar filter
    archivedAt  DateTime?         // null = active on canvas
}
```

---

## 6. REST API Endpoints (`server/src/routes/`)
| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/api/canvases` | `-` | List all canvases |
| POST | `/api/canvases` | `{"name": "string"}` | Create new canvas workspace |
| GET | `/api/tasks?canvasId=UUID` | `-` | Active tasks on canvas (non-archived) |
| GET | `/api/tasks/:id` | `-` | Get single task by ID |
| POST | `/api/tasks` | `{"title","description","tags","color","priority","dueDate"}` | Create task card at client x,y |
| PATCH | `/api/tasks/:id` | `Partial<Task>` | Update fields including drag position (x,y,z) |
| DELETE | `/api/tasks/:id` | `-` | Remove permanently from DB |

---

## 7. Clustering Algorithm (`frontend/engine/proximityDetector.ts`)
- THRESHOLD = 240px (center-to-center distance to consider 'close')
~30fps cap via rAF timestamp gating so frames aren't burned.
1. Read all task {x,y} positions from Zustand store subscription.
2. Build adjacency graph: edge if dist(taskA, taskB) <= THRESHOLD.
3. Union-Find (path compression + rank) extracts connected components = clusters.
4. Diff vs prev-frame groupings -> emit enter/exit events per member change.
- Hysteresis: card only un-clusters if dragged > THRESHOLD * 1.15 = 276px from centroid.
   (prevents boundary wobble flicker on threshold edge)

---

## 8. Build Steps Checklist (execute in order)
[ ] Step 1: Scaffold folders: Vite React-TS shell + mkdir server/ + npm init -y
[ ] Step 2: docker-compose.yml for postgres:16-alpine (PGDB=taskdb PG_PASS=password). compose up -d. Verify with psql.
[ ] Step 3: Prisma init in server/ -> write schema.prisma (with relations from Sec 5) -> npx prisma migrate dev --name init
[ ] Step 4: seed.ts: 5-8 sample tasks scattered at random canvas positions. Run npx prisma db seed, verify via npx prisma studio.
[ ] Step 5: Express routes: taskRoutes.ts + canvasRoutes.ts with Prisma client CRUD (create/read/update/delete). Verify all endpoints work via curl.
[ ] Step 6: CORS in index.ts: app.use(cors({origin:['http://localhost:5173']})) — only needed if backend deployed separately on different origin.
[ ] Step 7: Frontend deps: zustand framer-motion zod @tailwindcss/vite postcss autoprefixer tailwindcss. Tailwind config -> JIT mode.
[ ] Step 8: vite.config.ts proxy: /api/* middleware redirecting to localhost:8085
[ ] Step 9: Canvas.tsx pan+zoom via transform matrix in Zustand (tx/ty/scale). Grid background synced to zoom factor for spatial reference.
[ ] Step 10: TaskCard.tsx drag handler (pointerdown/move/up) emits position deltas. CreateModal.tsx form with all fields. Confirm add/edit/delete + persist via API.
[ ] Step 11: proximityDetector.ts: rAF loop, adjacency graph, union-find clusters, hysteresis logic.
[ ] Step 12: BubbleLayer.tsx SVG overlay per-cluster animated glow (Framer Motion layoutId).
[ ] Step 13: Toolbar.tsx: Add Task btn / Active-Done toggle / Reset View. Smoke test end-to-end.
[ ] Step 14: Polish: neon glow CSS (box-shadow via @keyframes 2s pulse), card drop shadows, spring animations everywhere.

---

## 9. Design Tokens (abbreviated)
| Token | Value | Notes |
|---|---|---|
| `bg` | `#0f0f13` | Canvas backdrop |
| `surface-1` | `#1a1d24` | Card shell elevation base |
| `accent` | `gradient auto-gen per card seeded by task.id hash via djb2` | Deterministic unique palette. Override via modal picker later. |
| `glow` | `--glow-color:#00E5FF via CSS @keyframes 2s pulse` | box-shadow inset+outer spread neon edge glow — purely CSS (GPU compositor) for performance |
| `font` | `Nunito -> Quicksand -> Poppins -> system-ui` | No webfonts. Offline capability preserved. |

---

**Next session:** Start at Step 1 in Sec 8 and execute sequentially. All architecture is locked. Do NOT re-decide any section.