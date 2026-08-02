import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 45_000,
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: { baseURL: process.env.NIMBUS_E2E_BASE_URL ?? "http://127.0.0.1:4173", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
