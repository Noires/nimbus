import { z } from "zod";

// Per-tab client id: sent with every mutation so the SSE stream can drop
// this tab's own echoes.
export const CLIENT_ID = crypto.randomUUID();

export const ChecklistItemSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  text: z.string(),
  done: z.boolean(),
  order: z.number(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  color: z.string(),
  dueDate: z.string().nullable(),
  priority: z.string(),
  done: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  inbox: z.boolean(),
  snoozedUntil: z.string().nullable(),
  estimateMinutes: z.number().nullable(),
  recurrence: z.string().nullable(),
  lastActivityAt: z.string(),
  actualMinutes: z.number().default(0),
  // external sync (null for plain tasks)
  provider: z.string().nullable().default(null),
  connectionId: z.string().nullable().default(null),
  externalKey: z.string().nullable().default(null),
  externalUrl: z.string().nullable().default(null),
  status: z.string().nullable().default(null),
  externalMeta: z.record(z.unknown()).nullable().default(null),
  syncedAt: z.string().nullable().default(null),
  checklist: z.array(ChecklistItemSchema).default([]),
});
export type Task = z.infer<typeof TaskSchema>;

export const ConnectionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  canvasId: z.string(),
  config: z.record(z.unknown()),
  pollMinutes: z.number(),
  enabled: z.boolean(),
  status: z.string(),
  statusMessage: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  columnsCache: z.array(z.object({ id: z.string().nullable(), name: z.string() })).default([]),
  createdAt: z.string(),
});
export type Connection = z.infer<typeof ConnectionSchema>;

export const CommentSchema = z.object({
  id: z.string(),
  author: z.string(),
  body: z.string(),
  createdAt: z.string(),
  url: z.string(),
});
export type RemoteComment = z.infer<typeof CommentSchema>;

export const SyncSummarySchema = z.object({
  imported: z.number(),
  updated: z.number(),
  pushed: z.number(),
  skipped: z.number(),
});
export type SyncSummary = z.infer<typeof SyncSummarySchema>;

export interface Waypoint {
  slot: number;
  zoom: number;
  panX: number;
  panY: number;
  name?: string;
}

export interface CanvasSettings {
  autoCompleteChecklist?: boolean;
  autoArchiveDays?: number;
  notifyUnblocked?: boolean;
  notifyWake?: boolean;
  digestHour?: number | null;
  cardDensity?: "full" | "mini";
}

export const CanvasSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  shareToken: z.string().nullable().optional(),
  icsToken: z.string().nullable().optional(),
  captureToken: z.string().nullable().optional(),
  viewpoints: z.unknown().optional(),
  settings: z.unknown().optional(),
});
export type Canvas = z.infer<typeof CanvasSchema>;

export const ZoneSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  label: z.string(),
  hue: z.number(),
  autoTag: z.string().nullable(),
  z: z.number(),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const BubbleSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  title: z.string(),
  hue: z.number().nullable(),
  memberIds: z.array(z.string()),
  pinned: z.boolean(),
  createdAt: z.string(),
});
export type Bubble = z.infer<typeof BubbleSchema>;

export const DependencySchema = z.object({
  id: z.string(),
  blockerId: z.string(),
  blockedId: z.string(),
});
export type Dependency = z.infer<typeof DependencySchema>;

export const PortalSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  targetCanvasId: z.string(),
  x: z.number(),
  y: z.number(),
  target: z.object({ name: z.string() }).optional(),
});
export type Portal = z.infer<typeof PortalSchema>;

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  payload: z.unknown(),
  createdAt: z.string(),
});
export type Template = z.infer<typeof TemplateSchema>;

export const TaskEventSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  canvasId: z.string(),
  type: z.string(),
  payload: z.record(z.unknown()),
  actor: z.string(),
  createdAt: z.string(),
});
export type TaskEvent = z.infer<typeof TaskEventSchema>;

export interface TemplateItem {
  dx: number;
  dy: number;
  title: string;
  description?: string;
  tags?: string[];
  color?: string;
  priority?: string;
  estimateMinutes?: number;
  dueInDays?: number;
}

const TaskListSchema = z.object({ tasks: z.array(TaskSchema), total: z.number() });
const EventListSchema = z.object({ events: z.array(TaskEventSchema) });

export interface NewTaskInput {
  id?: string;
  canvasId: string;
  title: string;
  description?: string;
  tags?: string[];
  color?: string;
  dueDate?: string | null;
  priority?: string;
  x?: number;
  y?: number;
  z?: number;
  inbox?: boolean;
  estimateMinutes?: number | null;
  recurrence?: string | null;
}

export type TaskPatch = Partial<
  Omit<
    Task,
    "id" | "createdAt" | "lastActivityAt" | "checklist" |
    "provider" | "connectionId" | "externalKey" | "externalUrl" | "externalMeta" | "syncedAt"
  >
>;

async function request<S extends z.ZodTypeAny>(
  schema: S,
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<z.infer<S>> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: {
      "X-Client-Id": CLIENT_ID,
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${rest.method ?? "GET"} ${url} failed (${res.status}): ${body}`);
  }
  return schema.parse(await res.json());
}

async function requestVoid(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "X-Client-Id": CLIENT_ID, ...init?.headers },
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url} failed (${res.status})`);
}

const PulseSchema = z.object({
  openNow: z.number(),
  days: z.array(
    z.object({
      date: z.string(),
      created: z.number(),
      completed: z.number(),
      moved: z.number(),
      updated: z.number(),
      deleted: z.number(),
    }),
  ),
});
export type Pulse = z.infer<typeof PulseSchema>;

const ShareSnapshotSchema = z.object({
  canvas: z.object({ id: z.string(), name: z.string() }),
  tasks: z.array(TaskSchema),
  bubbles: z.array(BubbleSchema),
  zones: z.array(ZoneSchema),
  dependencies: z.array(DependencySchema),
});
export type ShareSnapshot = z.infer<typeof ShareSnapshotSchema>;

export const api = {
  // --- canvases ---
  listCanvases: () => request(z.array(CanvasSchema), "/api/canvases"),
  createCanvas: (name: string) =>
    request(CanvasSchema, "/api/canvases", { method: "POST", json: { name } }),
  updateCanvas: (id: string, patch: { name?: string; viewpoints?: Waypoint[]; settings?: CanvasSettings }) =>
    request(CanvasSchema, `/api/canvases/${id}`, { method: "PUT", json: patch }),
  deleteCanvas: (id: string) => requestVoid(`/api/canvases/${id}`, { method: "DELETE" }),
  mintToken: (id: string, kind: "share" | "ics" | "capture") =>
    request(CanvasSchema, `/api/canvases/${id}/token/${kind}`, { method: "POST" }),
  revokeToken: (id: string, kind: "share" | "ics" | "capture") =>
    request(CanvasSchema, `/api/canvases/${id}/token/${kind}`, { method: "DELETE" }),
  pulse: (id: string, days = 30) =>
    request(PulseSchema, `/api/canvases/${id}/pulse?days=${days}`),
  shareSnapshot: (token: string) =>
    request(ShareSnapshotSchema, `/api/share/${encodeURIComponent(token)}`),
  canvasEvents: (id: string, since?: string) =>
    request(EventListSchema, `/api/canvases/${id}/events${since ? `?since=${encodeURIComponent(since)}` : ""}`),
  exportCanvas: (id: string) => request(z.record(z.unknown()), `/api/canvases/${id}/export`),
  importCanvas: (payload: unknown) =>
    request(CanvasSchema, "/api/canvases/import", { method: "POST", json: payload }),

  // --- tasks ---
  listTasks: (canvasId: string, opts?: { archived?: boolean }) =>
    request(
      TaskListSchema,
      `/api/tasks?canvasId=${encodeURIComponent(canvasId)}${opts?.archived ? "&archived=true" : ""}`,
    ),
  createTask: (input: NewTaskInput) =>
    request(TaskSchema, "/api/tasks", { method: "POST", json: input }),
  updateTask: (id: string, patch: TaskPatch) =>
    request(TaskSchema, `/api/tasks/${id}`, { method: "PATCH", json: patch }),
  deleteTask: (id: string) => requestVoid(`/api/tasks/${id}`, { method: "DELETE" }),
  taskEvents: (id: string) => request(EventListSchema, `/api/tasks/${id}/events`),
  splitTask: (id: string, positions: Array<{ x: number; y: number }>) =>
    request(
      z.object({ tasks: z.array(TaskSchema), parent: TaskSchema }),
      `/api/tasks/${id}/split`,
      { method: "POST", json: { positions } },
    ),
  mergeTasks: (taskIds: string[], title?: string, x?: number, y?: number) =>
    request(
      z.object({ task: TaskSchema, archived: z.array(TaskSchema) }),
      "/api/tasks/merge",
      { method: "POST", json: { taskIds, title, x, y } },
    ),

  // --- checklist (all return the full updated task) ---
  addChecklistItem: (taskId: string, text: string) =>
    request(TaskSchema, `/api/tasks/${taskId}/checklist`, { method: "POST", json: { text } }),
  updateChecklistItem: (taskId: string, itemId: string, patch: { text?: string; done?: boolean; order?: number }) =>
    request(TaskSchema, `/api/tasks/${taskId}/checklist/${itemId}`, { method: "PATCH", json: patch }),
  deleteChecklistItem: (taskId: string, itemId: string) =>
    request(TaskSchema, `/api/tasks/${taskId}/checklist/${itemId}`, { method: "DELETE" }),

  // --- bubbles ---
  listBubbles: (canvasId: string) =>
    request(z.array(BubbleSchema), `/api/bubbles?canvasId=${encodeURIComponent(canvasId)}`),
  createBubble: (input: { canvasId: string; title?: string; hue?: number | null; memberIds?: string[]; pinned?: boolean }) =>
    request(BubbleSchema, "/api/bubbles", { method: "POST", json: input }),
  updateBubble: (id: string, patch: { title?: string; hue?: number | null; memberIds?: string[]; pinned?: boolean }) =>
    request(BubbleSchema, `/api/bubbles/${id}`, { method: "PATCH", json: patch }),
  deleteBubble: (id: string) => requestVoid(`/api/bubbles/${id}`, { method: "DELETE" }),

  // --- dependencies ---
  listDependencies: (canvasId: string) =>
    request(z.array(DependencySchema), `/api/dependencies?canvasId=${encodeURIComponent(canvasId)}`),
  createDependency: (blockerId: string, blockedId: string) =>
    request(DependencySchema, "/api/dependencies", { method: "POST", json: { blockerId, blockedId } }),
  deleteDependency: (id: string) => requestVoid(`/api/dependencies/${id}`, { method: "DELETE" }),

  // --- portals ---
  listPortals: (canvasId: string) =>
    request(z.array(PortalSchema), `/api/portals?canvasId=${encodeURIComponent(canvasId)}`),
  createPortal: (input: { canvasId: string; targetCanvasId: string; x: number; y: number }) =>
    request(PortalSchema, "/api/portals", { method: "POST", json: input }),
  updatePortal: (id: string, patch: { x?: number; y?: number }) =>
    request(PortalSchema, `/api/portals/${id}`, { method: "PATCH", json: patch }),
  deletePortal: (id: string) => requestVoid(`/api/portals/${id}`, { method: "DELETE" }),

  // --- connections (external sync) ---
  listConnections: (canvasId: string) =>
    request(z.array(ConnectionSchema), `/api/connections?canvasId=${encodeURIComponent(canvasId)}`),
  createConnection: (input: { provider: string; canvasId: string; config: Record<string, unknown>; pollMinutes?: number }) =>
    request(ConnectionSchema, "/api/connections", { method: "POST", json: input }),
  updateConnection: (id: string, patch: { config?: Record<string, unknown>; pollMinutes?: number; enabled?: boolean }) =>
    request(ConnectionSchema, `/api/connections/${id}`, { method: "PATCH", json: patch }),
  deleteConnection: (id: string) => requestVoid(`/api/connections/${id}`, { method: "DELETE" }),
  syncConnection: (id: string) =>
    request(SyncSummarySchema, `/api/connections/${id}/sync`, { method: "POST" }),
  listComments: (taskId: string) =>
    request(z.object({ comments: z.array(CommentSchema) }), `/api/tasks/${taskId}/comments`),
  addComment: (taskId: string, body: string) =>
    request(CommentSchema, `/api/tasks/${taskId}/comments`, { method: "POST", json: { body } }),

  // --- zones ---
  listZones: (canvasId: string) =>
    request(z.array(ZoneSchema), `/api/zones?canvasId=${encodeURIComponent(canvasId)}`),
  createZone: (input: { canvasId: string; x: number; y: number; w: number; h: number; label?: string; hue?: number; autoTag?: string | null }) =>
    request(ZoneSchema, "/api/zones", { method: "POST", json: input }),
  updateZone: (id: string, patch: Partial<Omit<Zone, "id" | "canvasId">>) =>
    request(ZoneSchema, `/api/zones/${id}`, { method: "PATCH", json: patch }),
  deleteZone: (id: string) => requestVoid(`/api/zones/${id}`, { method: "DELETE" }),

  // --- templates ---
  listTemplates: () => request(z.array(TemplateSchema), "/api/templates"),
  createTemplate: (input: { name: string; kind: "bubble" | "canvas"; payload: { title?: string; items: TemplateItem[] } }) =>
    request(TemplateSchema, "/api/templates", { method: "POST", json: input }),
  deleteTemplate: (id: string) => requestVoid(`/api/templates/${id}`, { method: "DELETE" }),
  instantiateTemplate: (id: string, canvasId: string, x: number, y: number) =>
    request(
      z.object({ tasks: z.array(TaskSchema), title: z.string() }),
      `/api/templates/${id}/instantiate`,
      { method: "POST", json: { canvasId, x, y } },
    ),
};
