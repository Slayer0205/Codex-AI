import "dotenv/config";
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { connectDatabase, migrate } from "./db.js";
import { seedDemo } from "./seed.js";
import { createApp } from "./app.js";
import { notificationAdapter } from "./adapters/telegram.js";
import { deliverQueued } from "./services/notification-worker.js";
import { configureHosting } from "./hosting.js";
import { createTelegramBot } from "../bot/bot.js";
import {
  mountTelegramWebhook,
  registerTelegramWebhook,
} from "./telegram-webhook.js";
configureHosting();
if (
  process.env.NODE_ENV === "production" &&
  !["true", "false"].includes(process.env.DEMO_MODE || "")
)
  throw new Error("Set DEMO_MODE explicitly for production runtime");
const db = connectDatabase();
await migrate(db);
if (process.env.DEMO_MODE !== "false") await seedDemo(db);
const app = createApp(db);
const bot =
  process.env.TELEGRAM_MODE === "webhook" ? createTelegramBot(db) : undefined;
if (bot) mountTelegramWebhook(app, bot);
if (existsSync("dist/index.html")) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
const server = app.listen(Number(process.env.PORT) || 3001, "0.0.0.0", () =>
  console.log(
    `Smart Savdo API running on port ${Number(process.env.PORT) || 3001} (${process.env.DEMO_MODE === "false" ? "production" : "DEMO"})`,
  ),
);
if (bot) {
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    await registerTelegramWebhook(bot);
  } catch (error) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.destroy();
    throw error;
  }
}
let running = false;
const timer = setInterval(async () => {
  if (running) return;
  running = true;
  try {
    await deliverQueued(db, notificationAdapter());
  } catch (e) {
    console.error(
      "Notification worker:",
      e instanceof Error ? e.message : "Unknown",
    );
  } finally {
    running = false;
  }
}, 15000);
timer.unref();
async function stop() {
  clearInterval(timer);
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
