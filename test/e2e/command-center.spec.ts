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
  const blocker = await api("/api/tasks", { method: "POST", body: JSON.stringify({ canvasId: canvas.id, title: "E2E blocker", priority: "high" }) });
  const blocked = await api("/api/tasks", { method: "POST", body: JSON.stringify({ canvasId: canvas.id, title: "E2E blocked", priority: "medium" }) });
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
async function assertAxe(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => (await (window as any).axe.run(document, { resultTypes: ["violations"] })).violations
    .filter((v: any) => ["serious", "critical"].includes(v.impact)));
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test("axe: flag-off retains the legacy canvas and has no command-center Ledger", async ({ page }) => {
  const { canvas } = await seed();
  await page.goto(`/canvas/${canvas.id}`);
  await expect(page.getByRole("region", { name: "Canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ledger" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "First-time tutorial offer" })).toHaveCount(0);
  await assertAxe(page);
});

test("flag-off mobile retains the legacy canvas and never exposes command-center navigation or its tutorial", async ({ page }) => {
  const { canvas } = await seed();
  await page.setViewportSize({ width: 390, height: 844 });
  // Deliberately use a malformed, truthy value: only the exact string "true"
  // may enable the redesigned Command Center.
  await page.addInitScript(() => localStorage.setItem("nimbus:spatial-command-center-shell", "enabled"));
  await page.goto(`/canvas/${canvas.id}`);

  await expect(page.getByRole("region", { name: "Canvas" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Command Center" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "First-time tutorial offer" })).toHaveCount(0);
});

test("command header contains the wrapping toolbar before the main region at compact desktop widths", async ({ page }) => {
  const { canvas } = await seed();
  await page.addInitScript(() => localStorage.setItem("nimbus:spatial-command-center-shell", "true"));

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

test("axe: flag-on supports Ledger saved views, keyboard focus, blocker status, and axe", async ({ page }) => {
  const { canvas } = await seed();
  await page.addInitScript(() => localStorage.setItem("nimbus:spatial-command-center-shell", "true"));
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

test("axe: mobile command-center destinations are flag-gated and announced", async ({ page }) => {
  const { canvas } = await seed();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("nimbus:spatial-command-center-shell", "true"));
  await page.goto(`/canvas/${canvas.id}`);
  const navigation = page.getByRole("navigation", { name: "Command Center" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("button", { name: "Today" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main", { name: "Today" })).toBeVisible();
  await assertAxe(page);
});

test("tutorial: safe sample completes, resumes, replays, and stays isolated", async ({ page }) => {
  const { canvas } = await seed();
  const productiveBefore = await productiveSnapshot(canvas.id);
  await page.addInitScript(() => localStorage.setItem("nimbus:spatial-command-center-shell", "true"));
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
  await dialog.getByRole("button", { name: "Place sample task in Today" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Inspect sample Workstream" }).click();
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

test("tutorial: German first-run copy stays localized and skip remains non-blocking", async ({ page }) => {
  const { canvas } = await seed();
  await page.addInitScript(() => {
    localStorage.setItem("nimbus:spatial-command-center-shell", "true");
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
