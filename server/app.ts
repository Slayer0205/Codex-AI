import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import type { Knex } from "knex";
import { z, ZodError } from "zod";
import { Business, DomainError, type Actor, debtBalance } from "./domain.js";
import {
  checkPassword,
  decodeToken,
  issueToken,
  verifyTelegram,
} from "./auth.js";
import {
  notificationAdapter,
  type NotificationAdapter,
} from "./adapters/telegram.js";

declare module "express-serve-static-core" {
  interface Request {
    actor: Actor;
  }
}
export function createApp(
  db: Knex,
  options: {
    demo?: boolean;
    secret?: string;
    telegram?: NotificationAdapter;
  } = {},
) {
  const demo = options.demo ?? process.env.DEMO_MODE !== "false";
  if (!demo && !(options.secret || process.env.JWT_SECRET)?.match(/^.{32,}$/))
    throw new Error(
      "Production JWT_SECRET must contain at least 32 characters",
    );
  const secret =
    options.secret || process.env.JWT_SECRET || randomBytes(48).toString("hex");
  const app = express();
  const business = new Business(db);
  const telegram = options.telegram || notificationAdapter();
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      xFrameOptions: false,
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", "https://telegram.org"],
          "img-src": ["'self'", "data:", "https:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "connect-src": ["'self'"],
          "frame-ancestors": [
            "'self'",
            "https://web.telegram.org",
            "https://*.telegram.org",
          ],
        },
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 250,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Juda ko‘p so‘rov. Biroz kuting." },
    }),
  );
  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin;
    const allowed = new Set([
      process.env.APP_URL || "http://localhost:5173",
      process.env.WEB_APP_URL || "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
    if (origin && !allowed.has(origin))
      return res.status(403).json({ error: "Origin ruxsat etilmagan" });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !req.is("application/json")
    )
      return res.status(415).json({ error: "JSON talab qilinadi" });
    if (req.headers["sec-fetch-site"] === "cross-site")
      return res.status(403).json({ error: "Cross-site so‘rov rad etildi" });
    next();
  });
  app.get("/api/health", async (_req, res) => {
    await db.raw("select 1");
    res.json({
      ok: true,
      mode: demo ? "demo" : "production",
      telegram: process.env.TELEGRAM_BOT_TOKEN ? "configured" : "mock",
    });
  });
  const session = (res: Response, userId: string, organizationId: string) => {
    const token = issueToken(userId, organizationId, secret);
    res.cookie("savdo_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.APP_URL?.startsWith("https://") || false,
      maxAge: 8 * 3600000,
      path: "/",
    });
    return token;
  };
  const loginLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    message: { error: "Kirish urinishlari chegaradan oshdi" },
  });
  app.post("/api/auth/demo", loginLimit, async (req, res) => {
    if (!demo) throw new DomainError("Demo rejim o‘chirilgan", 403);
    if (!(await db("users").where({ id: "demo-user" }).first()))
      throw new DomainError("Demo ma’lumotlar tayyor emas", 503);
    const token = session(res, "demo-user", "demo-org");
    res.json({
      name: "Aziz Karimov",
      demo: true,
      accessToken: req.body?.miniApp === true ? token : undefined,
    });
  });
  app.post("/api/auth/login", loginLimit, async (req, res) => {
    const data = z
      .object({
        email: z.email(),
        password: z.string().min(1).max(128),
        organizationId: z.string().optional(),
        miniApp: z.boolean().optional(),
      })
      .parse(req.body);
    const user = await db("users")
      .where({ email: data.email.toLowerCase() })
      .first();
    if (!user?.passwordHash || !checkPassword(data.password, user.passwordHash))
      throw new DomainError("Email yoki parol noto‘g‘ri", 401);
    let q = db("memberships").where({ userId: user.id });
    if (data.organizationId)
      q = q.where({ organizationId: data.organizationId });
    const membership = await q.first();
    if (!membership) throw new DomainError("Tashkilotga ruxsat yo‘q", 403);
    const token = session(res, user.id, membership.organizationId);
    res.json({
      name: user.name,
      demo: false,
      accessToken: data.miniApp ? token : undefined,
    });
  });
  app.post("/api/auth/telegram", loginLimit, async (req, res) => {
    if (!process.env.TELEGRAM_BOT_TOKEN)
      throw new DomainError("Telegram hali ulanmagan", 503);
    const { initData } = z
      .object({ initData: z.string().min(1).max(10000) })
      .parse(req.body);
    const telegramId = verifyTelegram(initData, process.env.TELEGRAM_BOT_TOKEN);
    const user = await db("users").where({ telegramId }).first();
    const membership =
      user && (await db("memberships").where({ userId: user.id }).first());
    if (!membership)
      throw new DomainError("Telegram hisobi tashkilotga biriktirilmagan", 403);
    const token = session(res, user.id, membership.organizationId);
    res.json({ name: user.name, demo: false, accessToken: token });
  });
  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("savdo_session", { path: "/" });
    res.json({ ok: true });
  });
  app.use("/api", async (req, _res, next) => {
    try {
      const token = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : req.cookies.savdo_session;
      if (!token) throw new DomainError("Kirish talab qilinadi", 401);
      const claims = decodeToken(token, secret);
      const membership = await db("memberships")
        .where({ userId: claims.sub, organizationId: claims.organizationId })
        .first();
      if (!membership) throw new DomainError("Ruxsat yo‘q", 403);
      req.actor = {
        userId: membership.userId,
        organizationId: membership.organizationId,
        role: membership.role,
      };
      next();
    } catch (e) {
      next(e);
    }
  });
  const key = (req: Request) => String(req.headers["idempotency-key"] || "");
  app.get("/api/session", async (req, res) => {
    const user = await db("users").where({ id: req.actor.userId }).first();
    res.json({
      name: user.name,
      email: user.email,
      role: req.actor.role,
      demo,
    });
  });
  app.get("/api/snapshot", async (req, res) =>
    res.json(await business.snapshot(req.actor)),
  );
  app.post("/api/customers", async (req, res) =>
    res
      .status(201)
      .json(await business.customer(req.actor, key(req), req.body)),
  );
  app.patch("/api/customers/:id", async (req, res) =>
    res.json(
      await business.customer(
        req.actor,
        key(req),
        req.body,
        String(req.params.id),
      ),
    ),
  );
  app.post("/api/products/import", async (req, res) =>
    res
      .status(201)
      .json(await business.importProducts(req.actor, key(req), req.body)),
  );
  app.post("/api/products", async (req, res) =>
    res.status(201).json(await business.product(req.actor, key(req), req.body)),
  );
  app.patch("/api/products/:id", async (req, res) =>
    res.json(
      await business.product(
        req.actor,
        key(req),
        req.body,
        String(req.params.id),
      ),
    ),
  );
  app.post("/api/products/:id/stock", async (req, res) =>
    res.json(
      await business.stock(
        req.actor,
        key(req),
        String(req.params.id),
        req.body,
      ),
    ),
  );
  app.post("/api/debts", async (req, res) =>
    res.status(201).json(await business.debt(req.actor, key(req), req.body)),
  );
  app.patch("/api/debts/:id", async (req, res) =>
    res.json(
      await business.editDebt(
        req.actor,
        key(req),
        String(req.params.id),
        req.body,
      ),
    ),
  );
  app.post("/api/debts/:id/repayments", async (req, res) =>
    res.json(
      await business.repay(
        req.actor,
        key(req),
        String(req.params.id),
        req.body,
      ),
    ),
  );
  app.post("/api/sales", async (req, res) =>
    res.status(201).json(await business.sale(req.actor, key(req), req.body)),
  );
  app.post("/api/sales/:id/reverse", async (req, res) =>
    res.json(
      await business.reverse(req.actor, key(req), String(req.params.id)),
    ),
  );
  app.post("/api/expenses", async (req, res) =>
    res.status(201).json(await business.expense(req.actor, key(req), req.body)),
  );
  app.put("/api/settings", async (req, res) =>
    res.json(await business.settings(req.actor, key(req), req.body)),
  );
  app.post("/api/debts/:id/remind", async (req, res) => {
    if (req.actor.role === "viewer") throw new DomainError("Ruxsat yo‘q", 403);
    const debt = await business.scoped(
      db,
      "debts",
      String(req.params.id),
      req.actor,
    );
    const customer = await business.scoped(
      db,
      "customers",
      debt.customerId,
      req.actor,
    );
    const repayments = await db("debt_repayments").where({
      organizationId: req.actor.organizationId,
      debtId: debt.id,
    });
    const balance = debtBalance(debt, repayments);
    if (balance <= 0) throw new DomainError("Qarz yopilgan");
    const body = `Assalomu alaykum, ${customer.name}. Qarz qoldig‘i: ${(balance / 100).toLocaleString("uz-UZ")} so‘m. To‘lov muddati: ${debt.dueDate}.`;
    // Record the intent idempotently before side effects. Delivery is explicit and retryable, not hidden.
    const n = await business.notification(
      req.actor,
      key(req),
      customer.id,
      "To‘lov eslatmasi",
      body,
      "queued",
    );
    if (n.status !== "queued") return res.json(n);
    // Claim once; repeated requests never send twice. Failed/uncertain delivery requires a new action/key.
    const claimed = await db("notifications")
      .where({
        id: n.id,
        organizationId: req.actor.organizationId,
        status: "queued",
      })
      .update({ status: "sending" });
    if (!claimed)
      return res.json(
        await db("notifications")
          .where({ id: n.id, organizationId: req.actor.organizationId })
          .first(),
      );
    let status = "demo";
    try {
      if (process.env.TELEGRAM_BOT_TOKEN && !customer.telegramId)
        throw new Error("Mijoz Telegram IDsi yo‘q");
      status = (await telegram.send(customer.telegramId || "demo", body))
        .status;
    } catch {
      status = "failed";
    }
    await db("notifications")
      .where({ id: n.id, organizationId: req.actor.organizationId })
      .update({ status });
    res.json({ ...n, status });
  });
  app.post("/api/notifications/read", async (req, res) => {
    if (req.actor.role === "viewer") throw new DomainError("Ruxsat yo‘q", 403);
    await db("notifications")
      .where({ organizationId: req.actor.organizationId })
      .update({ read: true });
    res.json({ ok: true });
  });
  app.get("/api/memberships", async (req, res) => {
    if (req.actor.role !== "admin") throw new DomainError("Ruxsat yo‘q", 403);
    const members = await db("memberships")
      .join("users", "memberships.userId", "users.id")
      .where("memberships.organizationId", req.actor.organizationId)
      .select(
        "memberships.id",
        "memberships.role",
        "users.name",
        "users.email",
      );
    res.json(members);
  });
  app.patch("/api/memberships/:id", async (req, res) => {
    if (req.actor.role !== "admin") throw new DomainError("Ruxsat yo‘q", 403);
    const { role } = z
      .object({ role: z.enum(["manager", "cashier", "viewer"]) })
      .parse(req.body);
    const m = await business.scoped(
      db,
      "memberships",
      String(req.params.id),
      req.actor,
    );
    if (m.role === "admin")
      throw new DomainError(
        "Administrator rolini bu yerda o‘zgartirib bo‘lmaydi",
      );
    res.json(
      await business.mutate(
        req.actor,
        key(req),
        { role, id: m.id },
        "membership.role",
        async (trx) => {
          await trx("memberships")
            .where({ id: m.id, organizationId: req.actor.organizationId })
            .update({ role });
          await business.audit(trx, req.actor, "membership.role", m.id, {
            role,
          });
          return { id: m.id, role };
        },
      ),
    );
  });
  app.put("/api/profile/telegram", async (req, res) => {
    const { telegramId, initData } = z
      .object({
        telegramId: z.string().regex(/^\d+$/).max(25),
        initData: z.string().optional(),
      })
      .parse(req.body);
    if (!demo) {
      if (
        !process.env.TELEGRAM_BOT_TOKEN ||
        !initData ||
        verifyTelegram(initData, process.env.TELEGRAM_BOT_TOKEN) !== telegramId
      )
        throw new DomainError(
          "Telegram ichida hisobni tasdiqlang yoki administrator CLI orqali bog‘lasin",
          403,
        );
    }
    await business.mutate(
      req.actor,
      key(req),
      { telegramId },
      "profile.telegram",
      async (trx) => {
        await trx("users")
          .where({ id: req.actor.userId })
          .update({ telegramId });
        await business.audit(
          trx,
          req.actor,
          "profile.telegram",
          req.actor.userId,
          { linked: true },
        );
        return { ok: true };
      },
    );
    res.json({ ok: true });
  });
  app.get("/api/backup", async (req, res) => {
    if (req.actor.role !== "admin")
      throw new DomainError("Faqat administrator uchun", 403);
    res.attachment("smart-savdo-backup.json").json({
      version: 1,
      exportedAt: new Date().toISOString(),
      data: await business.snapshot(req.actor),
    });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint topilmadi" }),
  );
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError)
      return res.status(422).json({
        error: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (err instanceof DomainError)
      return res.status(err.status).json({ error: err.message });
    if (
      (err as any)?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      (err as any)?.code === "23505"
    )
      return res
        .status(409)
        .json({ error: "Bu SKU yoki hisob allaqachon mavjud" });
    console.error("API error:", err instanceof Error ? err.message : "Unknown");
    res.status(500).json({ error: "Server xatosi. Qayta urinib ko‘ring." });
  });
  return app;
}
