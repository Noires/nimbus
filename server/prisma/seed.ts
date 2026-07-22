import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY = 86_400_000;
const HOUR = 3_600_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);
const hoursFromNow = (n: number) => new Date(Date.now() + n * HOUR);

const DEMO = "clvl0demo0000"; // main demo canvas (id referenced in docs)
const SIDE = "clvl0side0000"; // secondary canvas for portals / cross-canvas cases

const CONN = "seedconn0github";

// Fixed task ids so dependencies, bubbles and events can reference them
// and the seed stays idempotent across re-runs.
const T = {
  plain: "seedtask_plain",
  overdue: "seedtask_overdue",
  dueToday: "seedtask_duetoday",
  dueSoon: "seedtask_duesoon",
  doneBasic: "seedtask_done",
  doneArchived: "seedtask_donearchived",
  archived: "seedtask_archived",
  inbox1: "seedtask_inbox1",
  inbox2: "seedtask_inbox2",
  snoozedFuture: "seedtask_snoozed",
  snoozedExpired: "seedtask_snooze_expired",
  recurDaily: "seedtask_recur_daily",
  recurBiweekly: "seedtask_recur_biweekly",
  recurMonthly: "seedtask_recur_monthly",
  checklist: "seedtask_checklist",
  checklistDone: "seedtask_checklist_done",
  blockerRoot: "seedtask_dep_root",
  blockedMid: "seedtask_dep_mid",
  blockedLeaf: "seedtask_dep_leaf",
  blockedByTwo: "seedtask_dep_double",
  ghOpen: "seedtask_gh_open",
  ghInProgress: "seedtask_gh_wip",
  ghDone: "seedtask_gh_done",
  cluster1: "seedtask_cluster1",
  cluster2: "seedtask_cluster2",
  cluster3: "seedtask_cluster3",
  cluster4: "seedtask_cluster4",
  farNE: "seedtask_far_ne",
  farSW: "seedtask_far_sw",
  farE: "seedtask_far_e",
  unicode: "seedtask_unicode",
  longText: "seedtask_longtext",
  kitchenSink: "seedtask_kitchensink",
  stackedA: "seedtask_stack_a",
  stackedB: "seedtask_stack_b",
  side1: "seedtask_side1",
  side2: "seedtask_side2",
};

const GHOST = "seedtask_ghost"; // deleted task — only its events remain

async function main() {
  // ---- wipe previous seed data (canvas cascade removes tasks/zones/bubbles/portals/connections) ----
  await prisma.canvas.deleteMany({ where: { id: { in: [DEMO, SIDE] } } });
  await prisma.taskEvent.deleteMany({ where: { canvasId: { in: [DEMO, SIDE] } } });
  await prisma.template.deleteMany({ where: { name: { startsWith: "[seed]" } } });

  // ---- canvases ----
  await prisma.canvas.create({
    data: {
      id: DEMO,
      name: "My Tasks",
      shareToken: "seed-share-token-demo",
      icsToken: "seed-ics-token-demo",
      captureToken: "seed-capture-token-demo",
      viewpoints: [
        { slot: 1, zoom: 1, panX: 0, panY: 0 },
        { slot: 2, zoom: 0.5, panX: -400, panY: -200 },
        { slot: 3, zoom: 1.4, panX: 220, panY: 180 },
      ],
      createdAt: daysAgo(30),
    },
  });
  await prisma.canvas.create({
    data: { id: SIDE, name: "Side Project", createdAt: daysAgo(20) },
  });

  // ---- zones ----
  await prisma.zone.createMany({
    data: [
      { canvasId: DEMO, x: 60, y: 60, w: 520, h: 420, label: "Backlog", hue: 200 },
      { canvasId: DEMO, x: 640, y: 60, w: 520, h: 420, label: "In Progress", hue: 40, autoTag: "wip" },
      { canvasId: DEMO, x: 1220, y: 60, w: 420, h: 420, label: "Done", hue: 130, autoTag: "shipped" },
      { canvasId: DEMO, x: 60, y: 560, w: 400, h: 300, label: "Später / Someday", hue: 280 },
      { canvasId: SIDE, x: 100, y: 100, w: 600, h: 400, label: "Ideas", hue: 320 },
    ],
  });

  // ---- external connection (disabled so the sync engine doesn't poll a fake repo) ----
  await prisma.connection.create({
    data: {
      id: CONN,
      provider: "github",
      canvasId: DEMO,
      config: {
        owner: "acme",
        repo: "nimbus-playground",
        projectId: "PVT_kwDOseedProject",
        statusFieldId: "PVTSSF_seedStatusField",
      },
      pollMinutes: 5,
      enabled: false,
      status: "error",
      statusMessage: "GITHUB_TOKEN is not configured in server/.env",
      lastSyncAt: daysAgo(1),
      etag: 'W/"seed-etag-123"',
      columnsCache: ["Todo", "In Progress", "Done"],
      createdAt: daysAgo(10),
    },
  });

  // ---- tasks ----
  const tasks: Parameters<typeof prisma.task.create>[0]["data"][] = [
    // -- basic states --
    {
      id: T.plain, canvasId: DEMO, title: "Plain task — no due date, defaults everywhere",
      description: "Baseline card: medium priority, default color, no metadata.",
      x: 120, y: 140, createdAt: daysAgo(14), lastActivityAt: daysAgo(14),
    },
    {
      id: T.overdue, canvasId: DEMO, title: "Overdue: pay hosting invoice",
      description: "Due three days ago — should render as overdue.",
      x: 160, y: 300, priority: "high", color: "#ef4444", tags: ["finance", "urgent"],
      dueDate: daysAgo(3), createdAt: daysAgo(12), lastActivityAt: daysAgo(4),
    },
    {
      id: T.dueToday, canvasId: DEMO, title: "Due today: send weekly status mail",
      description: "Due in a few hours.",
      x: 320, y: 140, priority: "medium", color: "#f97316", tags: ["comms"],
      dueDate: hoursFromNow(5), estimateMinutes: 15, createdAt: daysAgo(6), lastActivityAt: daysAgo(1),
    },
    {
      id: T.dueSoon, canvasId: DEMO, title: "Due next week: quarterly planning doc",
      description: "Estimate set, low priority.",
      x: 340, y: 320, priority: "low", color: "#22c55e", tags: ["planning"],
      dueDate: daysFromNow(7), estimateMinutes: 120, createdAt: daysAgo(9), lastActivityAt: daysAgo(2),
    },
    // -- done / archived --
    {
      id: T.doneBasic, canvasId: DEMO, title: "Done: set up CI pipeline",
      description: "Completed with tracked focus time.",
      x: 1300, y: 160, priority: "high", color: "#14b8a6", tags: ["devops", "shipped"],
      done: true, actualMinutes: 95, estimateMinutes: 60,
      createdAt: daysAgo(13), lastActivityAt: daysAgo(5),
    },
    {
      id: T.doneArchived, canvasId: DEMO, title: "Done + archived: migrate DNS",
      description: "Finished and archived — hidden from the board.",
      x: 1340, y: 340, priority: "medium", tags: ["devops"],
      done: true, archivedAt: daysAgo(2), actualMinutes: 40,
      createdAt: daysAgo(18), lastActivityAt: daysAgo(2),
    },
    {
      id: T.archived, canvasId: DEMO, title: "Archived while open: old spike",
      description: "Archived without being completed.",
      x: 1400, y: 260, priority: "low", archivedAt: daysAgo(1),
      createdAt: daysAgo(16), lastActivityAt: daysAgo(1),
    },
    // -- inbox / capture --
    {
      id: T.inbox1, canvasId: DEMO, title: "Inbox: idea from quick capture",
      description: "", inbox: true, createdAt: daysAgo(1), lastActivityAt: daysAgo(1),
    },
    {
      id: T.inbox2, canvasId: DEMO, title: "Inbox: read article about CRDTs",
      description: "Captured via share link.", inbox: true, tags: ["reading"],
      createdAt: hoursFromNow(-6), lastActivityAt: hoursFromNow(-6),
    },
    // -- snooze --
    {
      id: T.snoozedFuture, canvasId: DEMO, title: "Snoozed until next week",
      description: "Should be hidden/dimmed until the snooze expires.",
      x: 140, y: 640, priority: "low", color: "#a855f7", snoozedUntil: daysFromNow(6),
      createdAt: daysAgo(8), lastActivityAt: daysAgo(3),
    },
    {
      id: T.snoozedExpired, canvasId: DEMO, title: "Snooze already expired",
      description: "snoozedUntil lies in the past — must behave like a normal task again.",
      x: 300, y: 660, priority: "medium", snoozedUntil: daysAgo(1),
      createdAt: daysAgo(10), lastActivityAt: daysAgo(1),
    },
    // -- recurrence (JSON rule strings) --
    {
      id: T.recurDaily, canvasId: DEMO, title: "Recurring daily: water the plants",
      description: "Completing this spawns the next occurrence (+1 day).",
      x: 700, y: 140, color: "#84cc16", tags: ["habit"],
      dueDate: hoursFromNow(8), recurrence: JSON.stringify({ unit: "day", every: 1 }),
      createdAt: daysAgo(20), lastActivityAt: daysAgo(1),
    },
    {
      id: T.recurBiweekly, canvasId: DEMO, title: "Recurring every 2 weeks: 1:1 with Alex",
      description: "",
      x: 880, y: 140, priority: "high", tags: ["meeting"],
      dueDate: daysFromNow(3), recurrence: JSON.stringify({ unit: "week", every: 2 }),
      estimateMinutes: 30, createdAt: daysAgo(25), lastActivityAt: daysAgo(3),
    },
    {
      id: T.recurMonthly, canvasId: DEMO, title: "Recurring monthly: review subscriptions",
      description: "",
      x: 1060, y: 140, priority: "low", dueDate: daysFromNow(12),
      recurrence: JSON.stringify({ unit: "month", every: 1 }),
      createdAt: daysAgo(28), lastActivityAt: daysAgo(7),
    },
    // -- checklists --
    {
      id: T.checklist, canvasId: DEMO, title: "Checklist: release v1.2",
      description: "Mixed checklist — 2 of 4 items done.",
      x: 720, y: 320, priority: "high", color: "#6366f1", tags: ["wip", "release"],
      estimateMinutes: 240, createdAt: daysAgo(7), lastActivityAt: hoursFromNow(-3),
    },
    {
      id: T.checklistDone, canvasId: DEMO, title: "Checklist fully completed",
      description: "All items checked but the task itself is still open.",
      x: 920, y: 320, priority: "medium", createdAt: daysAgo(5), lastActivityAt: daysAgo(1),
    },
    // -- dependencies: root blocks mid blocks leaf; double is blocked by root AND mid --
    {
      id: T.blockerRoot, canvasId: DEMO, title: "Dep root: design database schema",
      description: "Blocks two tasks directly.",
      x: 160, y: 940, priority: "high", color: "#0ea5e9", tags: ["backend"],
      createdAt: daysAgo(11), lastActivityAt: daysAgo(2),
    },
    {
      id: T.blockedMid, canvasId: DEMO, title: "Dep mid: implement API (blocked)",
      description: "Blocked by the schema task, blocks the frontend task.",
      x: 420, y: 940, priority: "high", color: "#0ea5e9", tags: ["backend"],
      createdAt: daysAgo(11), lastActivityAt: daysAgo(2),
    },
    {
      id: T.blockedLeaf, canvasId: DEMO, title: "Dep leaf: wire up frontend (blocked)",
      description: "End of the dependency chain.",
      x: 680, y: 940, priority: "medium", color: "#0ea5e9", tags: ["frontend"],
      createdAt: daysAgo(11), lastActivityAt: daysAgo(2),
    },
    {
      id: T.blockedByTwo, canvasId: DEMO, title: "Blocked by two tasks: launch announcement",
      description: "Has two blockers — root and mid.",
      x: 420, y: 1120, priority: "low", color: "#0ea5e9",
      createdAt: daysAgo(11), lastActivityAt: daysAgo(2),
    },
    // -- github-synced tasks --
    {
      id: T.ghOpen, canvasId: DEMO, title: "GH #101: fix flaky websocket reconnect",
      description: "Synced from GitHub, open, in Todo column.",
      x: 1700, y: 160, priority: "medium", tags: ["github", "bug"],
      provider: "github", connectionId: CONN,
      externalKey: "github:acme/nimbus-playground#101",
      externalUrl: "https://github.com/acme/nimbus-playground/issues/101",
      status: "Todo",
      externalMeta: { nodeId: "I_kwDOseed101", remoteUpdatedAt: daysAgo(2).toISOString() },
      syncedAt: daysAgo(1), createdAt: daysAgo(9), lastActivityAt: daysAgo(1),
    },
    {
      id: T.ghInProgress, canvasId: DEMO, title: "GH #102: add dark-mode toggle",
      description: "Synced from GitHub, In Progress column.",
      x: 1700, y: 340, priority: "high", tags: ["github", "feature"],
      provider: "github", connectionId: CONN,
      externalKey: "github:acme/nimbus-playground#102",
      externalUrl: "https://github.com/acme/nimbus-playground/issues/102",
      status: "In Progress",
      externalMeta: { nodeId: "I_kwDOseed102", remoteUpdatedAt: daysAgo(1).toISOString() },
      syncedAt: daysAgo(1), createdAt: daysAgo(8), lastActivityAt: daysAgo(1),
    },
    {
      id: T.ghDone, canvasId: DEMO, title: "GH #99: closed issue, synced as done",
      description: "Closed on the provider side.",
      x: 1700, y: 520, priority: "low", tags: ["github"], done: true,
      provider: "github", connectionId: CONN,
      externalKey: "github:acme/nimbus-playground#99",
      externalUrl: "https://github.com/acme/nimbus-playground/issues/99",
      status: "Done",
      externalMeta: { nodeId: "I_kwDOseed099", remoteUpdatedAt: daysAgo(4).toISOString() },
      syncedAt: daysAgo(4), createdAt: daysAgo(15), lastActivityAt: daysAgo(4),
    },
    // -- proximity cluster: four cards within ~240px so they auto-bubble --
    {
      id: T.cluster1, canvasId: DEMO, title: "Cluster: sketch onboarding flow",
      description: "", x: 2200, y: 900, color: "#f43f5e", tags: ["design"],
      createdAt: daysAgo(4), lastActivityAt: daysAgo(1),
    },
    {
      id: T.cluster2, canvasId: DEMO, title: "Cluster: write onboarding copy",
      description: "", x: 2320, y: 940, color: "#f43f5e", tags: ["design"],
      createdAt: daysAgo(4), lastActivityAt: daysAgo(1),
    },
    {
      id: T.cluster3, canvasId: DEMO, title: "Cluster: record demo video",
      description: "", x: 2240, y: 1040, color: "#f43f5e", tags: ["design"],
      createdAt: daysAgo(4), lastActivityAt: daysAgo(1),
    },
    {
      id: T.cluster4, canvasId: DEMO, title: "Cluster: pick launch date",
      description: "", x: 2360, y: 1080, color: "#f43f5e", priority: "high",
      createdAt: daysAgo(4), lastActivityAt: daysAgo(1),
    },
    // -- far-flung tasks: exercise minimap, flyTo, command palette --
    {
      id: T.farNE, canvasId: DEMO, title: "Far away NE: check telescope alignment",
      description: "Way off in world space (+4000, -2500).",
      x: 4000, y: -2500, color: "#06b6d4", createdAt: daysAgo(3), lastActivityAt: daysAgo(3),
    },
    {
      id: T.farSW, canvasId: DEMO, title: "Far away SW: buried treasure",
      description: "Negative coordinates (-3000, 2200).",
      x: -3000, y: 2200, color: "#eab308", createdAt: daysAgo(3), lastActivityAt: daysAgo(3),
    },
    {
      id: T.farE, canvasId: DEMO, title: "Far away E: lonely outpost",
      description: "", x: 6000, y: 400, createdAt: daysAgo(3), lastActivityAt: daysAgo(3),
    },
    // -- text edge cases --
    {
      id: T.unicode, canvasId: DEMO, title: "Ümläute & Emoji prüfen: äöüß 🚀 — 日本語 test",
      description: "Unicode everywhere: Größenänderung, œuvre, «quotes», emoji 🎉🧪, RTL: مرحبا.",
      x: 560, y: 640, tags: ["i18n", "größe", "🚀"], color: "#8b5cf6",
      createdAt: daysAgo(2), lastActivityAt: daysAgo(2),
    },
    {
      id: T.longText, canvasId: DEMO,
      title: "Very long title that keeps going and going to test truncation, wrapping and tooltip behavior on the card and in the table view and the command palette",
      description: ("Long description paragraph. ".repeat(40) + "\n\n").repeat(3) +
        "Also a list:\n- item one\n- item two\n- item three",
      x: 800, y: 640, tags: ["edge", "long", "text", "many", "tags", "to", "overflow", "the", "row"],
      createdAt: daysAgo(2), lastActivityAt: daysAgo(2),
    },
    // -- everything at once --
    {
      id: T.kitchenSink, canvasId: DEMO, title: "Kitchen sink: every field populated",
      description: "Due date, estimate, actuals, recurrence, tags, checklist, custom color, high z.",
      x: 1080, y: 640, z: 5, priority: "high", color: "#ec4899",
      tags: ["everything", "wip"], dueDate: daysFromNow(2),
      estimateMinutes: 90, actualMinutes: 35,
      recurrence: JSON.stringify({ unit: "week", every: 1 }),
      createdAt: daysAgo(6), lastActivityAt: hoursFromNow(-1),
    },
    // -- z-order stack: same spot, different z --
    {
      id: T.stackedA, canvasId: DEMO, title: "Stacked below (z=0)",
      description: "", x: 1500, y: 700, z: 0, color: "#64748b",
      createdAt: daysAgo(2), lastActivityAt: daysAgo(2),
    },
    {
      id: T.stackedB, canvasId: DEMO, title: "Stacked on top (z=3)",
      description: "", x: 1520, y: 720, z: 3, color: "#f59e0b",
      createdAt: daysAgo(2), lastActivityAt: daysAgo(2),
    },
    // -- side canvas --
    {
      id: T.side1, canvasId: SIDE, title: "Side project: research static hosting",
      description: "", x: 200, y: 200, tags: ["research"],
      createdAt: daysAgo(10), lastActivityAt: daysAgo(5),
    },
    {
      id: T.side2, canvasId: SIDE, title: "Side project: register domain",
      description: "", x: 380, y: 260, priority: "low", dueDate: daysFromNow(14),
      createdAt: daysAgo(10), lastActivityAt: daysAgo(5),
    },
  ];
  for (const data of tasks) await prisma.task.create({ data });

  // ---- checklist items ----
  await prisma.checklistItem.createMany({
    data: [
      { taskId: T.checklist, text: "Bump version number", done: true, order: 0 },
      { taskId: T.checklist, text: "Write changelog", done: true, order: 1 },
      { taskId: T.checklist, text: "Tag release & build", done: false, order: 2 },
      { taskId: T.checklist, text: "Announce in Slack", done: false, order: 3 },
      { taskId: T.checklistDone, text: "Draft outline", done: true, order: 0 },
      { taskId: T.checklistDone, text: "Get review", done: true, order: 1 },
      { taskId: T.kitchenSink, text: "One open item", done: false, order: 0 },
      { taskId: T.kitchenSink, text: "One done item", done: true, order: 1 },
    ],
  });

  // ---- dependencies ----
  await prisma.dependency.createMany({
    data: [
      { blockerId: T.blockerRoot, blockedId: T.blockedMid },
      { blockerId: T.blockedMid, blockedId: T.blockedLeaf },
      { blockerId: T.blockerRoot, blockedId: T.blockedByTwo },
      { blockerId: T.blockedMid, blockedId: T.blockedByTwo },
    ],
  });

  // ---- pinned bubble over the cluster ----
  await prisma.bubble.create({
    data: {
      canvasId: DEMO, title: "Launch prep", hue: 340, pinned: true,
      memberIds: [T.cluster1, T.cluster2, T.cluster3, T.cluster4],
      createdAt: daysAgo(4),
    },
  });

  // ---- portals (both directions) ----
  await prisma.portal.createMany({
    data: [
      { canvasId: DEMO, targetCanvasId: SIDE, x: 1900, y: 900 },
      { canvasId: SIDE, targetCanvasId: DEMO, x: 600, y: 200 },
    ],
  });

  // ---- templates (constellations) ----
  await prisma.template.create({
    data: {
      name: "[seed] Sprint kickoff",
      kind: "bubble",
      payload: {
        title: "Sprint kickoff",
        items: [
          { dx: 0, dy: 0, title: "Groom backlog", priority: "high", estimateMinutes: 45, tags: ["sprint"] },
          { dx: 180, dy: 40, title: "Plan capacity", priority: "medium", dueInDays: 1 },
          { dx: 60, dy: 160, title: "Kickoff meeting", color: "#f97316", estimateMinutes: 30, dueInDays: 2 },
        ],
      },
    },
  });
  await prisma.template.create({
    data: {
      name: "[seed] Weekly review",
      kind: "canvas",
      payload: {
        title: "Weekly review",
        items: [
          { dx: 0, dy: 0, title: "Clear inbox", description: "Triage everything captured this week" },
          { dx: 200, dy: 0, title: "Review snoozed tasks" },
          { dx: 100, dy: 150, title: "Pick top 3 for next week", priority: "high" },
        ],
      },
    },
  });

  // ---- task events: full history for pulse/burndown/time-lapse, all actors ----
  const ev = (
    taskId: string, type: "created" | "updated" | "moved" | "completed" | "deleted" | "session",
    payload: object, actor: string, createdAt: Date, canvasId = DEMO,
  ) => ({ taskId, canvasId, type, payload, actor, createdAt });

  await prisma.taskEvent.createMany({
    data: [
      // lifecycle of the completed CI task: created → moved → session → completed
      ev(T.doneBasic, "created", { title: "Done: set up CI pipeline", x: 400, y: 300 }, "local", daysAgo(13)),
      ev(T.doneBasic, "moved", { x: 1300, y: 160, z: 0, prev: { x: 400, y: 300, z: 0 } }, "local", daysAgo(10)),
      ev(T.doneBasic, "session", { fields: { actualMinutes: 50 }, prev: { actualMinutes: 0 } }, "local", daysAgo(8)),
      ev(T.doneBasic, "session", { fields: { actualMinutes: 95 }, prev: { actualMinutes: 50 } }, "local", daysAgo(6)),
      ev(T.doneBasic, "completed", { fields: { done: true }, prev: { done: false } }, "local", daysAgo(5)),
      // edits on the overdue task
      ev(T.overdue, "created", { title: "Overdue: pay hosting invoice", x: 160, y: 300 }, "local", daysAgo(12)),
      ev(T.overdue, "updated", { fields: { priority: "high" }, prev: { priority: "medium" } }, "local", daysAgo(4)),
      // capture actor: quick-captured inbox tasks
      ev(T.inbox1, "created", { title: "Inbox: idea from quick capture", inbox: true }, "capture", daysAgo(1)),
      ev(T.inbox2, "created", { title: "Inbox: read article about CRDTs", inbox: true }, "capture", new Date(Date.now() - 6 * HOUR)),
      // autopilot actor: automatic snooze
      ev(T.snoozedFuture, "updated", { fields: { snoozedUntil: daysFromNow(6).toISOString() }, prev: { snoozedUntil: null } }, "autopilot", daysAgo(3)),
      // github actor: sync writes
      ev(T.ghOpen, "created", { title: "GH #101: fix flaky websocket reconnect", externalKey: "github:acme/nimbus-playground#101" }, "github", daysAgo(9)),
      ev(T.ghInProgress, "created", { title: "GH #102: add dark-mode toggle", externalKey: "github:acme/nimbus-playground#102" }, "github", daysAgo(8)),
      ev(T.ghInProgress, "updated", { fields: { status: "In Progress" }, prev: { status: "Todo" } }, "github", daysAgo(1)),
      ev(T.ghDone, "completed", { fields: { done: true, status: "Done" }, prev: { done: false, status: "In Progress" } }, "github", daysAgo(4)),
      // ghost task: history survives deletion (no matching Task row)
      ev(GHOST, "created", { title: "Ghost task (since deleted)", x: 500, y: 500 }, "local", daysAgo(7)),
      ev(GHOST, "updated", { fields: { title: "Ghost task, renamed" }, prev: { title: "Ghost task (since deleted)" } }, "local", daysAgo(6)),
      ev(GHOST, "deleted", { title: "Ghost task, renamed" }, "local", daysAgo(5)),
      // spread of moves for the time-lapse replay
      ev(T.cluster1, "created", { title: "Cluster: sketch onboarding flow", x: 1800, y: 700 }, "local", daysAgo(4)),
      ev(T.cluster1, "moved", { x: 2200, y: 900, z: 0, prev: { x: 1800, y: 700, z: 0 } }, "local", daysAgo(3)),
      ev(T.cluster2, "moved", { x: 2320, y: 940, z: 0, prev: { x: 1900, y: 760, z: 0 } }, "local", daysAgo(3)),
      ev(T.cluster3, "moved", { x: 2240, y: 1040, z: 0, prev: { x: 1950, y: 800, z: 0 } }, "local", daysAgo(2)),
      // completions across days for the burndown/pulse panel
      ev(T.doneArchived, "completed", { fields: { done: true }, prev: { done: false } }, "local", daysAgo(2)),
      ev(T.kitchenSink, "session", { fields: { actualMinutes: 35 }, prev: { actualMinutes: 0 } }, "local", daysAgo(1)),
      // side canvas activity
      ev(T.side1, "created", { title: "Side project: research static hosting", x: 200, y: 200 }, "local", daysAgo(10), SIDE),
      ev(T.side2, "created", { title: "Side project: register domain", x: 380, y: 260 }, "local", daysAgo(10), SIDE),
    ],
  });

  const counts = {
    canvases: await prisma.canvas.count(),
    tasks: await prisma.task.count(),
    zones: await prisma.zone.count(),
    checklistItems: await prisma.checklistItem.count(),
    dependencies: await prisma.dependency.count(),
    bubbles: await prisma.bubble.count(),
    portals: await prisma.portal.count(),
    templates: await prisma.template.count(),
    connections: await prisma.connection.count(),
    taskEvents: await prisma.taskEvent.count(),
  };
  console.log("✅ Seeded full test data:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
