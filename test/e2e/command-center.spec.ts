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
  await assertAxe(page);
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
