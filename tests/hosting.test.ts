import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelegramBot } from "../bot/bot";
import { createApp } from "../server/app";
import { configureHosting } from "../server/hosting";
import { connectDatabase, migrate } from "../server/db";
import {
  mountTelegramWebhook,
  registerTelegramWebhook,
} from "../server/telegram-webhook";

afterEach(() => vi.unstubAllEnvs());

describe("Free hosting configuration", () => {
  it("uses Render HTTPS origin while preserving explicitly configured custom domains", () => {
    const env: NodeJS.ProcessEnv = {
      RENDER: "true",
      DEMO_MODE: "false",
      DATABASE_URL: "postgresql://example.invalid/database?sslmode=require",
      RENDER_EXTERNAL_URL: "https://savdo.onrender.com/",
    };
    configureHosting(env);
    expect(env.APP_URL).toBe("https://savdo.onrender.com");
    expect(env.WEB_APP_URL).toBe(env.APP_URL);
    env.APP_URL = "https://shop.example.com";
    env.WEB_APP_URL = "https://mini.example.com";
    configureHosting(env);
    expect(env.APP_URL).toBe("https://shop.example.com");
    expect(env.WEB_APP_URL).toBe("https://mini.example.com");
  });

  it("rejects public demo access and an ephemeral SQLite database on Render", () => {
    expect(() =>
      configureHosting({ RENDER: "true", DEMO_MODE: "true" }),
    ).toThrow("DEMO_MODE=false");
    expect(() =>
      configureHosting({
        RENDER: "true",
        DEMO_MODE: "false",
        DATABASE_URL: "sqlite:./data/smart-savdo.sqlite",
      }),
    ).toThrow("persistent PostgreSQL");
    expect(() =>
      configureHosting({ RENDER_EXTERNAL_URL: "http://savdo.example.com" }),
    ).toThrow("HTTPS");
  });
});

describe("Telegram webhook on the web application port", () => {
  it("authenticates the webhook before any Telegram calls and uses linked membership on the same server", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:fake-test-token");
    vi.stubEnv("APP_URL", "https://savdo.example.com");
    vi.stubEnv("WEB_APP_URL", "https://savdo.example.com");
    vi.stubEnv(
      "TELEGRAM_WEBHOOK_SECRET",
      "test-secret-with-at-least-32-characters",
    );
    vi.stubEnv("TRUST_PROXY", "1");
    const db = connectDatabase("sqlite::memory:");
    await migrate(db);
    const at = new Date().toISOString();
    await db("organizations").insert({
      id: "org",
      name: "Shop",
      createdAt: at,
    });
    await db("users").insert({
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      telegramId: "12345",
      createdAt: at,
    });
    await db("memberships").insert({
      id: "membership",
      userId: "admin",
      organizationId: "org",
      role: "admin",
      createdAt: at,
    });
    const bot = createTelegramBot(db);
    const calls: { method: string; payload: any }[] = [];
    bot.api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload });
      const p = payload as { chat_id: number; text: string };
      const result: any =
        method === "getMe"
          ? {
              id: 123456,
              is_bot: true,
              first_name: "Test",
              username: "test_bot",
            }
          : method === "setWebhook"
            ? true
            : {
                message_id: 1,
                date: Math.floor(Date.now() / 1000),
                chat: { id: p.chat_id, type: "private" },
                text: p.text,
              };
      return { ok: true, result };
    });
    const app = createApp(db, {
      demo: false,
      secret: "test-jwt-secret-at-least-32-characters",
    });
    expect(app.get("trust proxy")).toBe(1);
    mountTelegramWebhook(app, bot);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const update = (id: number) => ({
      update_id: id,
      message: {
        message_id: id,
        date: Math.floor(Date.now() / 1000),
        from: { id, is_bot: false, first_name: "Admin" },
        chat: { id, type: "private" },
        text: "/start",
        entities: [{ offset: 0, length: 6, type: "bot_command" }],
      },
    });
    try {
      expect((await fetch(base + "/api/health")).status).toBe(200);
      for (const secret of ["", "wrong-secret-with-at-least-32-characters"]) {
        const response = await fetch(base + "/telegram/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Telegram-Bot-Api-Secret-Token": secret,
          },
          body: JSON.stringify(update(12345)),
        });
        expect(response.status).toBe(401);
      }
      expect(calls).toHaveLength(0);
      await registerTelegramWebhook(bot);
      expect(
        calls.find((call) => call.method === "setWebhook")?.payload,
      ).toMatchObject({
        url: "https://savdo.example.com/telegram/webhook",
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
        max_connections: 1,
      });
      for (const id of [12345, 67890]) {
        const response = await fetch(base + "/telegram/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Telegram-Bot-Api-Secret-Token":
              process.env.TELEGRAM_WEBHOOK_SECRET!,
          },
          body: JSON.stringify(update(id)),
        });
        expect(response.status).toBe(200);
      }
      const replies = calls.filter((call) => call.method === "sendMessage");
      expect(replies).toHaveLength(2);
      expect(replies[0].payload.text).toContain("Smart Savdo’ga xush kelibsiz");
      expect(JSON.stringify(replies[0].payload.reply_markup)).toContain(
        "https://savdo.example.com",
      );
      expect(replies[1].payload.text).toContain("Hisobingiz hali bog‘lanmagan");
      const demo = await fetch(base + "/api/auth/demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://savdo.example.com",
        },
        body: "{}",
      });
      expect(demo.status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.destroy();
    }
  });

  it("requires a valid webhook secret before exposing a handler", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:fake-test-token");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "too-short");
    const db = connectDatabase("sqlite::memory:");
    try {
      const bot = createTelegramBot(db);
      const app = createApp(db, { demo: true });
      expect(() => mountTelegramWebhook(app, bot)).toThrow("32-256");
    } finally {
      await db.destroy();
    }
  });
});
