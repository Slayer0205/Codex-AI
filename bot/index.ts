import "dotenv/config";
import express from "express";
import { connectDatabase, migrate } from "../server/db.js";
import { Business } from "../server/domain.js";
import { seedDemo } from "../server/seed.js";
import { configureHosting } from "../server/hosting.js";
import {
  mountTelegramWebhook,
  registerTelegramWebhook,
} from "../server/telegram-webhook.js";
import { createBotMenu, createTelegramBot } from "./bot.js";

configureHosting();
const db = connectDatabase();
await migrate(db);
if (process.env.DEMO_MODE !== "false") await seedDemo(db);
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token && process.env.DEMO_MODE === "false") {
  await db.destroy();
  throw new Error(
    "Production bot requires TELEGRAM_BOT_TOKEN. Leave the telegram profile disabled until configured.",
  );
}
if (!token) {
  const s = await new Business(db).snapshot({
    userId: "demo-user",
    organizationId: "demo-org",
    role: "admin",
  });
  console.log(
    "Telegram MOCK: no messages sent. Menu:",
    JSON.stringify(createBotMenu().build()),
  );
  console.log(
    `Demo dashboard: ${s.customers.length} customers, ${s.products.length} products, ${s.debts.length} debts. Set TELEGRAM_BOT_TOKEN to connect.`,
  );
  await db.destroy();
} else {
  const bot = createTelegramBot(db);
  if (process.env.TELEGRAM_MODE === "webhook") {
    const app = express();
    app.use(express.json({ limit: "256kb" }));
    mountTelegramWebhook(app, bot);
    const server = app.listen(Number(process.env.BOT_PORT) || 3002);
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
    const stop = () =>
      server.close(() => {
        void db.destroy();
      });
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  } else {
    process.once("SIGTERM", () => bot.stop());
    process.once("SIGINT", () => bot.stop());
    await bot.api.deleteWebhook();
    try {
      await bot.start({
        onStart: () =>
          console.log("Smart Savdo Telegram bot started (polling)"),
      });
    } finally {
      await db.destroy();
    }
  }
}
