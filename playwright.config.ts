import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev:test",
    env: {
      PORT: "3003",
      API_PROXY_TARGET: "http://127.0.0.1:3003",
      DATABASE_URL: "sqlite:./data/e2e.sqlite",
      APP_URL: "http://localhost:5174",
      WEB_APP_URL: "http://localhost:5174",
      DEMO_MODE: "true",
    },
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
