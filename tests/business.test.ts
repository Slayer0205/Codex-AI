import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { connectDatabase, migrate } from "../server/db";
import {
  Business,
  day,
  debtBalance,
  debtStatus,
  type Actor,
} from "../server/domain";
import { createApp } from "../server/app";
import { createHmac, randomUUID } from "node:crypto";
import { verifyTelegram, hashPassword, checkPassword } from "../server/auth";
import type { Knex } from "knex";
import type { Server } from "node:http";
let db: Knex, b: Business;
const a: Actor = { userId: "u1", organizationId: "o1", role: "admin" };
const other: Actor = { userId: "u2", organizationId: "o2", role: "admin" };
beforeEach(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (url && !url.endsWith("/savdo_test"))
    throw new Error(
      "TEST_DATABASE_URL must point to disposable savdo_test database",
    );
  db = connectDatabase(url || "sqlite::memory:");
  if (url) {
    await db.raw("DROP SCHEMA public CASCADE");
    await db.raw("CREATE SCHEMA public");
  }
  await migrate(db);
  const at = new Date().toISOString();
  await db("organizations").insert([
    { id: "o1", name: "Shop 1", createdAt: at },
    { id: "o2", name: "Shop 2", createdAt: at },
  ]);
  await db("users").insert([
    {
      id: "u1",
      email: "one@example.com",
      name: "One",
      passwordHash: hashPassword("securePassword12"),
      createdAt: at,
    },
    {
      id: "u2",
      email: "two@example.com",
      name: "Two",
      passwordHash: hashPassword("securePassword12"),
      createdAt: at,
    },
  ]);
  await db("memberships").insert([
    {
      id: "m1",
      organizationId: "o1",
      userId: "u1",
      role: "admin",
      createdAt: at,
    },
    {
      id: "m2",
      organizationId: "o2",
      userId: "u2",
      role: "admin",
      createdAt: at,
    },
  ]);
  b = new Business(db);
});
afterEach(async () => {
  await db.destroy();
});
const customer = () =>
  b.customer(a, randomUUID(), { name: "Test Mijoz", phone: "+998901234567" });
const product = (stock = 10) =>
  b.product(a, randomUUID(), {
    name: "Test mahsulot",
    sku: randomUUID(),
    category: "Test",
    cost: 60000,
    price: 100000,
    stock,
  });
describe("Business transactions and ledger", () => {
  it("customer/product creation persists; duplicate SKU fails without partial writes", async () => {
    const c = await customer(),
      p = await product();
    const s = await b.snapshot(a);
    expect(s.customers[0].id).toBe(c.id);
    expect(s.products[0].id).toBe(p.id);
    expect(s.inventory_movements[0].quantity).toBe(10);
    await expect(
      b.product(a, "dup", { ...p, id: undefined }),
    ).rejects.toThrow();
    expect((await b.snapshot(a)).products).toHaveLength(1);
  });
  it("credit sale updates stock, history and debt atomically; partial/full payments derive paid status", async () => {
    const c = await customer(),
      p = await product();
    const sale = await b.sale(a, "sale", {
      customerId: c.id,
      items: [{ productId: p.id, quantity: 3 }],
      method: "debt",
      discount: 10000,
      dueDate: day(),
    });
    let s = await b.snapshot(a);
    expect(s.products[0].stock).toBe(7);
    expect(s.sales[0].total).toBe(290000);
    expect(s.sale_items[0].saleId).toBe(sale.id);
    const d = s.debts[0];
    await b.repay(a, "payment-1", d.id, { amount: 90000, method: "cash" });
    s = await b.snapshot(a);
    expect(debtBalance(d, s.debt_repayments)).toBe(200000);
    expect(debtStatus(d, s.debt_repayments)).toBe("partial");
    await b.repay(a, "payment-2", d.id, { amount: 200000, method: "card" });
    s = await b.snapshot(a);
    expect(debtBalance(d, s.debt_repayments)).toBe(0);
    expect(debtStatus(d, s.debt_repayments)).toBe("paid");
    expect(s.debt_repayments).toHaveLength(2);
    expect(s.audit_logs.filter((x) => x.action === "debt.repaid")).toHaveLength(
      2,
    );
  });
  it("idempotent and concurrent retries never double count; changed payload conflicts", async () => {
    const c = await customer();
    const d = await b.debt(a, "debt", {
      customerId: c.id,
      amount: 500000,
      dueDate: day(),
    });
    const [r1, r2] = await Promise.all([
      b.repay(a, "same", d.id, { amount: 100000 }),
      b.repay(a, "same", d.id, { amount: 100000 }),
    ]);
    expect(r1.id).toBe(r2.id);
    expect((await b.snapshot(a)).debt_repayments).toHaveLength(1);
    await expect(b.repay(a, "same", d.id, { amount: 200000 })).rejects.toThrow(
      "kalit",
    );
  });
  it("concurrent payments cannot make debt negative", async () => {
    const c = await customer();
    const d = await b.debt(a, "debt", {
      customerId: c.id,
      amount: 100000,
      dueDate: day(),
    });
    const results = await Promise.allSettled([
      b.repay(a, "one", d.id, { amount: 80000 }),
      b.repay(a, "two", d.id, { amount: 80000 }),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(debtBalance(d, (await b.snapshot(a)).debt_repayments)).toBe(20000);
  });
  it("overpayment/oversell fails; earlier product changes are rolled back", async () => {
    const c = await customer(),
      p = await product(5),
      p2 = await product(0);
    await expect(
      b.sale(a, "bad", {
        customerId: c.id,
        items: [
          { productId: p.id, quantity: 2 },
          { productId: p2.id, quantity: 1 },
        ],
        method: "cash",
      }),
    ).rejects.toThrow("yetarli");
    const s = await b.snapshot(a);
    expect(s.products.find((x) => x.id === p.id)!.stock).toBe(5);
    expect(s.sales).toHaveLength(0);
    expect(s.debts).toHaveLength(0);
  });
  it("mixed tender creates only outstanding debt; credit requires customer", async () => {
    const p = await product();
    await expect(
      b.sale(a, "bad", {
        items: [{ productId: p.id, quantity: 1 }],
        method: "debt",
      }),
    ).rejects.toThrow("mijoz");
    const c = await customer();
    await b.sale(a, "mixed", {
      customerId: c.id,
      items: [{ productId: p.id, quantity: 2 }],
      method: "mixed",
      paid: 70000,
      discount: 10000,
    });
    const s = await b.snapshot(a);
    expect(s.debts[0].amount).toBe(120000);
    expect(s.payments[0].amount).toBe(70000);
  });
  it("reversal restores stock, closes debt and appends refunds without deleting history", async () => {
    const c = await customer(),
      p = await product();
    const sale = await b.sale(a, "sale", {
      customerId: c.id,
      items: [{ productId: p.id, quantity: 2 }],
      method: "mixed",
      paid: 50000,
    });
    const d = (await b.snapshot(a)).debts[0];
    await b.repay(a, "repay", d.id, { amount: 50000 });
    await b.reverse(a, "reverse", sale.id);
    await b.reverse(a, "reverse", sale.id);
    const s = await b.snapshot(a);
    expect(s.products[0].stock).toBe(10);
    expect(s.sales[0].status).toBe("reversed");
    expect(s.payments.map((p) => p.kind).sort()).toEqual(["payment", "refund"]);
    expect(s.debt_repayments.map((r) => r.kind).sort()).toEqual([
      "payment",
      "refund",
    ]);
    expect(debtBalance(s.debts[0], s.debt_repayments)).toBe(0);
    await expect(b.repay(a, "late", d.id, { amount: 1 })).rejects.toThrow();
  });
  it("organizations stay isolated for snapshots and all cross-org entity mutations", async () => {
    const c = await customer(),
      p = await product();
    expect((await b.snapshot(other)).customers).toHaveLength(0);
    await expect(
      b.sale(other, "x", {
        customerId: c.id,
        items: [{ productId: p.id, quantity: 1 }],
        method: "debt",
      }),
    ).rejects.toThrow("topilmadi");
    await expect(
      b.stock(other, "y", p.id, { quantity: 1, reason: "Kirim" }),
    ).rejects.toThrow("topilmadi");
  });
  it("RBAC protects mutations and manager operations", async () => {
    await expect(
      b.customer({ ...a, role: "viewer" }, "x", {
        name: "Test user",
        phone: "+998901234567",
      }),
    ).rejects.toThrow("ruxsat");
    await expect(
      b.product({ ...a, role: "cashier" }, "x", {
        name: "Test",
        sku: "SKU",
        category: "Test",
        price: 100,
        cost: 0,
        stock: 1,
      }),
    ).rejects.toThrow("menejer");
  });
  it("manual debt edits preserve payment history and cannot lower below repayments", async () => {
    const c = await customer(),
      d = await b.debt(a, "d", {
        customerId: c.id,
        amount: 100000,
        dueDate: day(),
      });
    await b.repay(a, "r", d.id, { amount: 70000 });
    await expect(
      b.editDebt(a, "e", d.id, { amount: 60000, dueDate: day() }),
    ).rejects.toThrow("to‘lovlardan");
    await b.editDebt(a, "e2", d.id, {
      amount: 150000,
      dueDate: day(),
      notes: "Tahrir",
    });
    const s = await b.snapshot(a);
    expect(debtBalance(s.debts[0], s.debt_repayments)).toBe(80000);
    expect(s.debt_repayments).toHaveLength(1);
  });
  it("stock movement rejects negatives; import batch rolls back on conflicting SKU", async () => {
    const p = await product(3);
    await expect(
      b.stock(a, "negative", p.id, { quantity: -4, reason: "Chiqim" }),
    ).rejects.toThrow("manfiy");
    await expect(
      b.importProducts(a, "batch", {
        products: [
          {
            name: "New",
            category: "Test",
            sku: "NEW",
            cost: 0,
            price: 100,
            stock: 1,
          },
          {
            name: "Conflict",
            category: "Test",
            sku: p.sku,
            cost: 0,
            price: 100,
            stock: 1,
          },
        ],
      }),
    ).rejects.toThrow();
    expect((await b.snapshot(a)).products).toHaveLength(1);
  });
  it("money input rejects floats, NaN, overflow and invalid calendar dates", async () => {
    const c = await customer();
    for (const amount of [1.2, NaN, Number.MAX_SAFE_INTEGER, -1])
      await expect(
        b.debt(a, randomUUID(), { customerId: c.id, amount, dueDate: day() }),
      ).rejects.toThrow();
    await expect(
      b.debt(a, "bad-date", {
        customerId: c.id,
        amount: 100,
        dueDate: "2026-02-30",
      }),
    ).rejects.toThrow();
  });
  it("migration is repeatable and does not erase data", async () => {
    await customer();
    await migrate(db);
    expect((await b.snapshot(a)).customers).toHaveLength(1);
  });
});
describe("Security", () => {
  it("passwords use salted hashes and constant-time verification", () => {
    const hash = hashPassword("a good password");
    expect(hash).not.toContain("a good password");
    expect(checkPassword("a good password", hash)).toBe(true);
    expect(checkPassword("wrong", hash)).toBe(false);
    expect(hashPassword("a good password")).not.toBe(hash);
  });
  it("Telegram validates signature, age, duplicate fields and user id", () => {
    const now = Math.floor(Date.now() / 1000);
    const signed = (timestamp: number) => {
      const fields = new URLSearchParams({
        auth_date: String(timestamp),
        user: JSON.stringify({ id: 12345 }),
      });
      const check = [...fields]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      const secret = createHmac("sha256", "WebAppData")
        .update("test-token")
        .digest();
      fields.set(
        "hash",
        createHmac("sha256", secret).update(check).digest("hex"),
      );
      return fields.toString();
    };
    expect(verifyTelegram(signed(now), "test-token", now)).toBe("12345");
    expect(() => verifyTelegram(signed(now), "wrong", now)).toThrow();
    expect(() => verifyTelegram(signed(now - 301), "test-token", now)).toThrow(
      "eskirgan",
    );
    expect(() =>
      verifyTelegram(signed(now) + "&auth_date=" + now, "test-token", now),
    ).toThrow("Takroriy");
  });
  it("real API requires auth, checks origin/RBAC, serves consistent snapshots and cookie session", async () => {
    const app = createApp(db, {
      demo: false,
      secret: "test-secret-longer-than-32-characters",
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      expect((await fetch(url + "/api/snapshot")).status).toBe(401);
      expect(
        (
          await fetch(url + "/api/auth/demo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(url + "/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "https://evil.example",
            },
            body: "{}",
          })
        ).status,
      ).toBe(403);
      const login = await fetch(url + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "one@example.com",
          password: "securePassword12",
        }),
      });
      expect(login.status).toBe(200);
      expect(login.headers.get("set-cookie")).toContain("HttpOnly");
      const cookie = login.headers.get("set-cookie")!.split(";")[0];
      const c = await fetch(url + "/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "Idempotency-Key": "api-c",
        },
        body: JSON.stringify({ name: "API Mijoz", phone: "+998901234567" }),
      });
      expect(c.status).toBe(201);
      const snapshot = await fetch(url + "/api/snapshot", {
        headers: { Cookie: cookie },
      });
      expect((await snapshot.json()).customers).toHaveLength(1);
      await db("memberships").where({ id: "m1" }).update({ role: "viewer" });
      expect(
        (
          await fetch(url + "/api/customers", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: cookie,
              "Idempotency-Key": "api-c2",
            },
            body: JSON.stringify({ name: "Blocked", phone: "+998901234567" }),
          })
        ).status,
      ).toBe(403);
    } finally {
      await new Promise<void>((resolve) =>
        (server as Server).close(() => resolve()),
      );
    }
  });
});
describe("Adapter delivery and integer boundaries", () => {
  it("at-most-once worker persists delivery status, respects preferences and does not re-send", async () => {
    const { deliverQueued } =
      await import("../server/services/notification-worker");
    const settings = {
      storeName: "Test",
      notifications: true,
      telegramId: "12345",
    };
    await db("settings").insert({
      organizationId: a.organizationId,
      value: JSON.stringify(settings),
    });
    await db("notifications").insert({
      id: "queued",
      organizationId: a.organizationId,
      createdAt: new Date().toISOString(),
      title: "Savdo",
      body: "Test",
      status: "queued",
      read: false,
    });
    let calls = 0;
    const adapter = {
      send: async () => {
        calls++;
        return { status: "sent" };
      },
    };
    await Promise.all([deliverQueued(db, adapter), deliverQueued(db, adapter)]);
    expect(calls).toBe(1);
    expect((await b.snapshot(a)).notifications[0].status).toBe("sent");
    await deliverQueued(db, adapter);
    expect(calls).toBe(1);
    await db("settings")
      .where({ organizationId: a.organizationId })
      .update({ value: JSON.stringify({ ...settings, notifications: false }) });
    await db("notifications").insert({
      id: "disabled",
      organizationId: a.organizationId,
      createdAt: new Date().toISOString(),
      title: "Savdo",
      body: "Test",
      status: "queued",
      read: false,
    });
    await deliverQueued(db, adapter);
    expect(
      (await db("notifications").where({ id: "disabled" }).first()).status,
    ).toBe("disabled");
    expect(calls).toBe(1);
  });
  it("overflowing cost is rejected before any sale or stock writes", async () => {
    const p = await b.product(a, "p-high", {
      name: "Cost high",
      category: "Test",
      sku: "HIGH",
      stock: 100000,
      cost: 1e12,
      price: 1,
    });
    await expect(
      b.sale(a, "s-high", {
        items: [{ productId: p.id, quantity: 100000 }],
        method: "cash",
      }),
    ).rejects.toThrow("chegaradan");
    const s = await b.snapshot(a);
    expect(s.sales).toHaveLength(0);
    expect(s.products[0].stock).toBe(100000);
  });
});
describe("Mini App session transport", () => {
  it("issues in-memory bearer auth only for requested Mini App transport; normal web uses cookie", async () => {
    const server = createApp(db, {
      demo: false,
      secret: "test-secret-longer-than-32-characters",
    }).listen(0, "127.0.0.1");
    await new Promise<void>((r) => server.once("listening", r));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      const body = { email: "one@example.com", password: "securePassword12" };
      const web = await fetch(url + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect((await web.json()).accessToken).toBeUndefined();
      const mini = await fetch(url + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, miniApp: true }),
      });
      const token = (await mini.json()).accessToken;
      expect(typeof token).toBe("string");
      const snapshot = await fetch(url + "/api/snapshot", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(snapshot.status).toBe(200);
      expect((await snapshot.json()).organizationId).toBe(a.organizationId);
      expect(mini.headers.get("x-frame-options")).toBeNull();
      expect(mini.headers.get("content-security-policy")).toContain(
        "https://web.telegram.org",
      );
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
