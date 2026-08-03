import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const base = process.env.NIMBUS_E2E_BASE_URL ?? "http://127.0.0.1:4173";
async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
async function seed() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const canvas = await api("/api/canvases", { method: "POST", body: JSON.stringify({ name: `E2E ${suffix}` }) });
  const blocker = await api("/api/tasks", { method: "POST", body: JSON.stringify({ canvasId: canvas.id, title: "E2E blocker", priority: "high", x: 32, y: 32 }) });
  const blocked = await api("/api/tasks", { method: "POST", body: JSON.stringify({ canvasId: canvas.id, title: "E2E blocked", priority: "medium", x: 352, y: 32 }) });
  await api(`/api/tasks/${blocked.id}/blocker`, { method: "PUT", body: JSON.stringify({ blockerId: blocker.id }) });
  return { canvas, blocker, blocked };
}
async function productiveSnapshot(canvasId: string) {
  const exported = await api(`/api/canvases/${canvasId}/export`);
  // The export endpoint intentionally stamps its response time. Exclude that
  // transport-only field so this is a stable before/after data-boundary check.
  delete exported.exportedAt;
  return {
    canvases: await api("/api/canvases"),
    tasks: await api(`/api/tasks?canvasId=${canvasId}&archived=true`),
    exported,
  };
}
async function assertAxe(page: Page, selector?: string) {
  await page.addScriptTag({ content: axe.source });
  const violations = (await page.evaluate(async (selector) => {
    const context = selector ? document.querySelector(selector) : document;
    if (!context) throw new Error(`Axe context not found: ${selector}`);
    return (await (window as any).axe.run(context, { resultTypes: ["violations"] })).violations;
  }, selector))
    .filter((v: any) => ["serious", "critical"].includes(v.impact));
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test("axe: Command Center is available on desktop without a legacy value", async ({ page }) => {
  const { canvas } = await seed();
  await page.goto(`/canvas/${canvas.id}`);
  await expect(page.getByRole("region", { name: "Canvas" })).toHaveCount(1);
  await expect(page.getByRole("toolbar", { name: "Canvas toolbar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ledger" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "First-time tutorial offer" })).toBeVisible();
  await assertAxe(page);

  for (const destination of ["inbox", "today", "review", "operations", "ledger"]) {
    await page.goto(`/canvas/${canvas.id}/${destination}`);
    await expect(page.locator(`[data-workspace="${destination}"]`)).toBeVisible();
    await assertAxe(page);
  }
});

test("a malformed retired legacy value is ignored without being recreated", async ({ page }) => {
  const { canvas } = await seed();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("nimbus:spatial-command-center-shell", "enabled"));
  await page.goto(`/canvas/${canvas.id}`);

  await expect(page.getByRole("navigation", { name: "Command Center" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "First-time tutorial offer" })).not.toBeVisible();
  await page.keyboard.press("?");
  await expect(page.getByRole("button", { name: "Replay safe sample tutorial" })).toBeVisible();
  await expect(page.evaluate(() => localStorage.getItem("nimbus:spatial-command-center-shell"))).resolves.toBe("enabled");
});

test("command header contains the wrapping toolbar before the main region at compact desktop widths", async ({ page }) => {
  const { canvas } = await seed();
  for (const width of [769, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/canvas/${canvas.id}`);
    await expect(page.getByRole("main")).toBeVisible();

    const bounds = await page.evaluate(() => {
      const toolbar = document.querySelector(".absolute.top-4");
      const header = document.querySelector<HTMLElement>(".command-center-shell__commands");
      const main = document.querySelector<HTMLElement>(".command-center-shell__main");
      if (!toolbar || !header || !main) throw new Error("Command-center layout regions are missing");

      return {
        toolbar: toolbar.getBoundingClientRect().toJSON(),
        header: header.getBoundingClientRect().toJSON(),
        main: main.getBoundingClientRect().toJSON(),
      };
    });

    expect(bounds.toolbar.bottom).toBeLessThanOrEqual(bounds.header.bottom);
    expect(bounds.header.bottom).toBeLessThanOrEqual(bounds.main.top);
  }
});

test("Canvas cards retain visible, clickable work area at desktop, compact, and mobile viewports", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    const { canvas, blocker } = await seed();
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem("nimbus:command-center-tutorial-v6", JSON.stringify({ version: 6, status: "skipped", step: 0, sample: { captured: false, triaged: false, assigned: false, today: false, completed: false, workstreamInspected: false, reviewInspected: false } })));
    await page.goto(`/canvas/${canvas.id}`);
    if (viewport.width < 769) await page.getByRole("button", { name: "Canvas", exact: true }).click();

    const card = page.locator(`[aria-label="${blocker.title}"]`);
    await expect(card).toBeVisible();
    const cardBounds = await card.boundingBox();
    expect(cardBounds?.width).toBeGreaterThan(100);
    expect(cardBounds?.height).toBeGreaterThan(60);
    await card.getByRole("button", { name: "Mark done" }).click();
    await expect(card).toHaveCount(0);
  }
});

test("ordinary Canvas card release selects its task Inspector while a drag does not select", async ({ page }) => {
  const { canvas, blocker, blocked } = await seed();
  await page.goto(`/canvas/${canvas.id}`);
  const card = page.locator(`[aria-label="${blocker.title}"]`);
  await expect(card).toBeVisible();

  const box = await card.boundingBox();
  if (!box) throw new Error("Canvas task card has no bounding box");
  await page.mouse.move(box.x + 32, box.y + 24);
  await page.mouse.down();
  await page.mouse.move(box.x + 64, box.y + 24);
  await page.mouse.up();
  await expect(page.locator('[data-selection-context="directory"]')).toBeVisible();

  const untouchedCard = page.locator(`[aria-label="${blocked.title}"]`);
  await untouchedCard.click({ position: { x: 32, y: 24 } });
  await expect(page.locator('[data-selection-context="task"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: blocked.title })).toBeVisible();
});

test("compact desktop defers tutorial and opens utilities only on explicit request", async ({ page }) => {
  const { canvas } = await seed();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`/canvas/${canvas.id}/inbox`);

  await expect(page.getByRole("complementary", { name: "First-time tutorial offer" })).not.toBeVisible();
  await expect(page.getByRole("dialog", { name: "Utilities" })).toHaveCount(0);
  await expect(page.getByPlaceholder("Capture into Inbox")).toBeVisible();
  await page.getByRole("button", { name: "Utilities", exact: true }).click();
  const utilities = page.getByRole("dialog", { name: "Utilities" });
  await expect(utilities).toBeVisible();
  await expect(utilities).toHaveAttribute("aria-modal", "true");
  await expect(utilities.getByRole("button", { name: "Close panel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(utilities).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Utilities", exact: true })).toBeFocused();
  await expect(page.getByPlaceholder("Capture into Inbox")).toBeVisible();
});

test("More menu empty saved-views message meets AA contrast against its documented surface", async ({ page }) => {
  const { canvas } = await seed();
  await page.goto(`/canvas/${canvas.id}`);
  await page.getByRole("button", { name: "More" }).click();
  const emptySavedViews = page.getByText("None saved yet.", { exact: true });
  await expect(emptySavedViews).toBeVisible();
  const ratio = await emptySavedViews.evaluate((element) => {
    const channels = getComputedStyle(element).color.match(/\d+/g)?.map(Number);
    if (!channels || channels.length < 3) throw new Error("Empty saved-views text has no RGB color");
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }).reduce((value, channel, index) => value + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = luminance(channels);
    const background = luminance([26, 29, 36]);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("axe: universal Command Center supports Ledger saved views, keyboard focus, blocker status, and axe", async ({ page }) => {
  const { canvas } = await seed();
  await page.goto(`/canvas/${canvas.id}`);
  const ledger = page.getByRole("button", { name: "Ledger" });
  await expect(ledger).toBeVisible();
  await ledger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ledger" })).toBeFocused();
  await page.getByLabel("Saved view name").fill("E2E view");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("button", { name: "E2E view", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete saved view E2E view" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await assertAxe(page);
});

test("axe: mobile Command Center destinations are universally available and announced", async ({ page }) => {
  const { canvas } = await seed();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/canvas/${canvas.id}`);
  const navigation = page.getByRole("navigation", { name: "Command Center" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("button", { name: "Today" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main", { name: "Today" })).toBeVisible();
  await assertAxe(page);
});

test("mobile canonical routes, history, Capture identity, and Canvas modal stay synchronized", async ({ page }) => {
  const { canvas } = await seed();
  await page.setViewportSize({ width: 390, height: 844 });

  for (const destination of ["inbox", "today", "review", "operations", "ledger", "canvas"] as const) {
    await page.goto(`/canvas/${canvas.id}${destination === "canvas" ? "" : `/${destination}`}`);
    await expect(page.getByRole("main", { name: destination === "canvas" ? "Canvas" : destination[0].toUpperCase() + destination.slice(1) })).toBeVisible();
  }

  await page.goto(`/canvas/${canvas.id}/inbox`);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/canvas/${canvas.id}/today$`));
  await page.goBack();
  await expect(page.getByRole("main", { name: "Inbox" })).toBeVisible();

  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Ledger", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/canvas/${canvas.id}/ledger$`));
  await expect(page.getByRole("main", { name: "Ledger" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("main", { name: "Inbox" })).toBeVisible();

  await page.goto(`/canvas/${canvas.id}/ledger`);
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(page.getByRole("heading", { name: "Capture" })).toBeVisible();
  await expect(page.getByRole("main", { name: "Capture" })).toBeVisible();
  await expect(page.getByLabel("Task to capture")).toBeFocused();
  await page.getByRole("button", { name: "Back Ledger" }).click();
  await expect(page.getByRole("main", { name: "Ledger" })).toBeVisible();

  await page.goto(`/canvas/${canvas.id}`);
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await page.getByRole("region", { name: "Canvas" }).dblclick({ position: { x: 280, y: 280 } });
  await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible();
});

test("compact boundaries retain a closed Utilities rail until an inspector is explicitly selected", async ({ page }) => {
  for (const width of [768, 769, 1100, 1101]) {
    const { canvas, blocker } = await seed();
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/canvas/${canvas.id}`);
    if (width === 768) {
      await expect(page.getByRole("navigation", { name: "Command Center" })).toBeVisible();
      continue;
    }

    await expect(page.getByRole("dialog", { name: "Utilities" })).toHaveCount(0);
    const card = page.locator(`[aria-label="${blocker.title}"]`);
    await card.click({ position: { x: 32, y: 24 } });
    if (width <= 1100) {
      await expect(page.getByRole("dialog", { name: "Inspector" })).toBeVisible();
    } else {
      await expect(page.getByRole("complementary", { name: "Inspector" })).toBeVisible();
    }
  }
});

test("tutorial: safe sample completes, resumes, replays, and stays isolated", async ({ page }) => {
  const { canvas } = await seed();
  const productiveBefore = await productiveSnapshot(canvas.id);
  await page.goto(`/canvas/${canvas.id}`);
  await expect(page.getByRole("complementary", { name: "First-time tutorial offer" })).toBeVisible();
  await page.getByRole("button", { name: "Start tutorial" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Welcome to your safe sample");
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Capture sample task" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Exit tutorial" }).click();

  await page.reload();
  await page.getByRole("button", { name: "Resume tutorial" }).click();
  await expect(dialog).toContainText("Triage the sample Inbox");
  await dialog.getByRole("button", { name: "Triage sample task" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog).toContainText("See the Workstream");
  await dialog.getByRole("button", { name: "Inspect sample Workstream" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog).toContainText("Choose Today deliberately");
  await dialog.getByRole("button", { name: "Place sample task in Today" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Complete sample task" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Inspect sample Review" }).click();
  await dialog.getByRole("button", { name: "Open my workspace" }).click();
  await expect(dialog).toHaveCount(0);

  await page.keyboard.press("?");
  await page.getByRole("button", { name: "Replay safe sample tutorial" }).click();
  await expect(dialog).toContainText("Welcome to your safe sample");
  await dialog.getByRole("button", { name: "Exit tutorial" }).click();
  expect(await productiveSnapshot(canvas.id)).toEqual(productiveBefore);
  await assertAxe(page);
});

test("toolbar: compact desktop keeps six primary controls, global visibility filters, and keyboard menus", async ({ page }) => {
  const { canvas } = await seed();
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto(`/canvas/${canvas.id}`);

  const toolbar = page.getByRole("toolbar", { name: "Canvas toolbar" });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator("[data-toolbar-primary]")).toHaveCount(6);
  await expect(toolbar.getByRole("button", { name: /Visibility: Show completed, Show archived/ })).toBeVisible();

  const visibility = toolbar.getByRole("button", { name: /Visibility: Show completed, Show archived/ });
  await visibility.focus();
  await page.keyboard.press("Enter");
  const visibilityMenu = page.getByRole("menu", { name: "Visibility" });
  await expect(visibilityMenu.getByRole("menuitemcheckbox", { name: "Show completed" })).toBeVisible();
  await expect(visibilityMenu.getByRole("menuitemcheckbox", { name: "Show archived" })).toBeVisible();
  await assertAxe(page, '[role="menu"][aria-label="Visibility"]');
  await page.keyboard.press("Escape");
  await expect(visibility).toBeFocused();

  const view = toolbar.getByRole("button", { name: "View", exact: true });
  await view.click();
  const viewMenu = page.getByRole("menu", { name: "View" });
  await expect(viewMenu.getByRole("menuitem", { name: "Fit" })).toBeVisible();
  await expect(viewMenu.getByRole("menuitem", { name: "Reset" })).toBeVisible();
  await assertAxe(page, '[role="menu"][aria-label="View"]');
  await page.keyboard.press("Escape");
  await expect(view).toBeFocused();

  const primaryBounds = await toolbar.locator("[data-toolbar-primary]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
  expect(primaryBounds.every((bounds: any) => bounds.height >= 44)).toBe(true);
  await assertAxe(page);
});

test("toolbar menus use menu semantics, keyboard navigation, and pass axe while open", async ({ page }) => {
  const { canvas } = await seed();
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto(`/canvas/${canvas.id}`);

  const toolbar = page.getByRole("toolbar", { name: "Canvas toolbar" });
  const lens = toolbar.getByRole("button", { name: /Lens:/ });
  await lens.focus();
  await page.keyboard.press("Space");
  const lensMenu = page.getByRole("menu", { name: "Lens" });
  const lensItems = lensMenu.getByRole("menuitemradio");
  const activeLensIndex = () => lensItems.evaluateAll((items) => items.findIndex((item) => item === document.activeElement));
  await expect(lensItems).toHaveCount(3);
  await expect(lensItems.nth(0)).toBeFocused();
  await expect.poll(activeLensIndex).toBe(0);
  await expect(lensItems.filter({ hasText: "Time" })).toHaveAttribute("aria-checked", "false");
  await assertAxe(page, '[role="menu"][aria-label="Lens"]');
  await page.keyboard.press("End");
  await expect(lensItems.nth(2)).toBeFocused();
  await expect.poll(activeLensIndex).toBe(2);
  await page.keyboard.press("Home");
  await expect(lensItems.nth(0)).toBeFocused();
  await expect.poll(activeLensIndex).toBe(0);
  await page.keyboard.press("ArrowDown");
  await expect(lensItems.nth(1)).toBeFocused();
  await expect.poll(activeLensIndex).toBe(1);
  await page.keyboard.press("Escape");
  await expect(lens).toBeFocused();

  const view = toolbar.getByRole("button", { name: "View", exact: true });
  await view.focus();
  await page.keyboard.press("ArrowDown");
  const viewMenu = page.getByRole("menu", { name: "View" });
  await expect(viewMenu.getByRole("menuitem", { name: "Fit" })).toBeFocused();
  await expect(viewMenu.getByRole("menuitem", { name: "Reset" })).toBeVisible();
  await assertAxe(page, '[role="menu"][aria-label="View"]');
  await page.keyboard.press("Escape");
  await expect(view).toBeFocused();

  const more = toolbar.getByRole("button", { name: "More" });
  await more.focus();
  await page.keyboard.press("Enter");
  const moreMenu = page.getByRole("menu", { name: "More" });
  await expect(moreMenu.getByRole("menuitem", { name: "Markdown (by bubble)" })).toBeFocused();
  await expect(moreMenu.getByRole("menuitemcheckbox", { name: /Mini cards/ })).toHaveAttribute("aria-checked", "false");
  await assertAxe(page, '[role="menu"][aria-label^="More:"]');
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
});

test("toolbar Autopilot is a focus-trapped modal that restores focus to its View menu launcher", async ({ page }) => {
  const { canvas } = await seed();
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto(`/canvas/${canvas.id}`);

  const toolbar = page.getByRole("toolbar", { name: "Canvas toolbar" });
  const view = toolbar.getByRole("button", { name: "View", exact: true });
  await view.click();
  const viewMenu = page.getByRole("menu", { name: "View" });
  const autopilot = viewMenu.getByTitle("Autopilot: housekeeping switches + notifications");
  await autopilot.click();

  const dialog = page.getByRole("dialog", { name: "Autopilot: housekeeping switches + notifications" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("switch", { name: "Complete task when last checklist item checks" })).toBeFocused();
  await expect(dialog.getByLabel("Auto-archive done tasks after")).toBeVisible();
  await expect(dialog.getByLabel("Daily digest at")).toBeVisible();
  await assertAxe(page, '[role="dialog"][aria-label="Autopilot: housekeeping switches + notifications"]');

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByLabel("Daily digest at")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("switch", { name: "Complete task when last checklist item checks" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(autopilot).toBeFocused();
  await expect(viewMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(view).toBeFocused();

  await toolbar.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("toolbar", { name: "Canvas-Werkzeugleiste" }).getByRole("button", { name: "Ansicht", exact: true }).click();
  await page.getByRole("menu", { name: "Ansicht" }).getByTitle("Autopilot: Aufräum-Schalter + Benachrichtigungen").click();
  const germanDialog = page.getByRole("dialog", { name: "Autopilot: Aufräum-Schalter + Benachrichtigungen" });
  await expect(germanDialog.getByLabel("Erledigte Aufgaben automatisch archivieren nach")).toBeVisible();
  await expect(germanDialog.getByLabel("Tägliche Zusammenfassung um")).toBeVisible();
});

test("tutorial: German first-run copy stays localized and skip remains non-blocking", async ({ page }) => {
  const { canvas } = await seed();
  await page.addInitScript(() => {
    localStorage.setItem("locale", "de");
  });
  await page.goto(`/canvas/${canvas.id}`);
  await expect(page.getByText("Nimbus sicher ausprobieren")).toBeVisible();
  await page.getByRole("button", { name: "Tutorial starten" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Willkommen bei deinem sicheren Beispiel");
  await expect(dialog).toContainText("Es werden keine echten Nimbus-Daten gezeigt oder verändert.");
  await dialog.getByRole("button", { name: "Tutorial überspringen" }).click();
  await expect(dialog).toHaveCount(0);
});
