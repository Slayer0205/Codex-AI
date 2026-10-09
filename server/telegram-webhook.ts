import { timingSafeEqual } from "node:crypto";
import { webhookCallback } from "grammy";
import type { Express } from "express";
import type { createTelegramBot } from "../bot/bot.js";

type TelegramBot = ReturnType<typeof createTelegramBot>;

function settings() {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret))
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET must be 32-256 letters, digits, underscores or hyphens",
    );
  const origin = new URL(process.env.APP_URL || "http://localhost");
  if (
    origin.protocol !== "https:" ||
    !process.env.WEB_APP_URL?.startsWith("https://")
  )
    throw new Error("Webhook requires HTTPS APP_URL and WEB_APP_URL");
  return { secret, url: `${origin.origin}/telegram/webhook` };
}

export function mountTelegramWebhook(app: Express, bot: TelegramBot) {
  const { secret } = settings();
  const callback = webhookCallback(bot, "express", {
    secretToken: secret,
    timeoutMilliseconds: 25000,
  });
  app.post("/telegram/webhook", (req, res) => {
    const provided = Buffer.from(
      req.get("X-Telegram-Bot-Api-Secret-Token") || "",
    );
    const expected = Buffer.from(secret);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      res.sendStatus(401);
      return;
    }
    Promise.resolve(callback(req, res)).catch((error: unknown) => {
      console.error(
        "Telegram webhook failed:",
        error instanceof Error ? error.message : "Unknown",
      );
      if (!res.headersSent) res.sendStatus(500);
    });
  });
}

export async function registerTelegramWebhook(bot: TelegramBot) {
  const { secret, url } = settings();
  await bot.init();
  await bot.api.setWebhook(url, {
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    max_connections: 1,
  });
  console.log("Smart Savdo Telegram bot started (webhook)");
}
