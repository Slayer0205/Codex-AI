import type { Knex } from "knex";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type { Snapshot } from "../shared/types.js";

export type Actor = {
  userId: string;
  organizationId: string;
  role: "admin" | "manager" | "cashier" | "viewer";
};
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const day = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Sana noto‘g‘ri",
  );
const money = z.number().int().min(0).max(1_000_000_000_000);
const positiveMoney = money.refine(
  (v) => v > 0,
  "Summa noldan katta bo‘lishi kerak",
);
const text = z.string().trim().min(2).max(120);
export const schemas = {
  customer: z.object({
    name: text,
    phone: z.string().regex(/^\+?[\d\s()-]{7,20}$/, "Telefon raqami noto‘g‘ri"),
    telegramId: z.string().regex(/^\d*$/).max(25).optional(),
    address: z.string().max(250).default(""),
    notes: z.string().max(1000).default(""),
  }),
  product: z.object({
    name: text,
    category: text,
    sku: z.string().trim().min(1).max(60),
    cost: money,
    price: positiveMoney,
    stock: z.number().int().min(0).max(1_000_000),
    lowStock: z.number().int().min(0).max(1_000_000).default(5),
    image: z
      .string()
      .url()
      .refine((v) => v.startsWith("https://"))
      .or(z.literal(""))
      .default(""),
  }),
  debt: z.object({
    customerId: z.string().min(1),
    amount: positiveMoney,
    dueDate: date,
    notes: z.string().max(1000).default(""),
    date: date.optional(),
  }),
  debtEdit: z.object({
    amount: positiveMoney,
    dueDate: date,
    notes: z.string().max(1000).default(""),
  }),
  repayment: z.object({
    amount: positiveMoney,
    method: z.enum(["cash", "card"]).default("cash"),
  }),
  sale: z.object({
    customerId: z.string().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().min(1).max(100000),
        }),
      )
      .min(1)
      .max(100),
    discount: money.default(0),
    method: z.enum(["cash", "card", "debt", "mixed"]),
    paid: money.optional(),
    dueDate: date.optional(),
    date: date.optional(),
  }),
  stock: z.object({
    quantity: z
      .number()
      .int()
      .min(-1000000)
      .max(1000000)
      .refine((v) => v !== 0),
    reason: text,
  }),
  expense: z.object({
    name: text,
    category: text,
    amount: positiveMoney,
    date: date.optional(),
  }),
  settings: z.object({
    storeName: text,
    language: z.enum(["uz", "ru", "en"]),
    theme: z.enum(["light", "dark", "system"]),
    notifications: z.boolean(),
    debtDays: z.number().int().min(1).max(365),
    telegramId: z.string().regex(/^\d*$/).max(25).default(""),
  }),
};
const numeric = new Set([
  "amount",
  "cost",
  "price",
  "total",
  "subtotal",
  "discount",
  "stock",
  "quantity",
  "lowStock",
]);
function normalize(row: any): any {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, numeric.has(k) ? Number(v) : v]),
  );
}
const now = () => new Date().toISOString();
const stamp = (a: Actor, at = now()) => ({
  id: randomUUID(),
  organizationId: a.organizationId,
  createdAt: at,
});
export function debtBalance(debt: any, repayments: any[]) {
  return debt.reversedAt
    ? 0
    : Number(debt.amount) -
        repayments
          .filter((r) => r.debtId === debt.id && r.kind === "payment")
          .reduce((n, r) => n + Number(r.amount), 0);
}
export function debtStatus(debt: any, repayments: any[]) {
  const remaining = debtBalance(debt, repayments);
  if (remaining === 0) return "paid";
  if (debt.dueDate < day()) return "overdue";
  return remaining < Number(debt.amount) ? "partial" : "active";
}

export class Business {
  constructor(public db: Knex) {}
  async scoped(trx: Knex, table: string, id: string, a: Actor) {
    const row = await trx(table)
      .where({ id, organizationId: a.organizationId })
      .first();
    if (!row) throw new DomainError("Yozuv topilmadi", 404);
    return normalize(row);
  }
  async audit(
    trx: Knex,
    a: Actor,
    action: string,
    entityId: string,
    details: unknown,
  ) {
    await trx("audit_logs").insert({
      ...stamp(a),
      userId: a.userId,
      action,
      entityId,
      details: JSON.stringify(details),
    });
  }
  async mutate(
    a: Actor,
    key: string,
    input: unknown,
    action: string,
    fn: (trx: Knex) => Promise<any>,
  ) {
    if (a.role === "viewer")
      throw new DomainError("O‘zgartirish uchun ruxsat yo‘q", 403);
    if (!key || key.length > 120)
      throw new DomainError("Idempotency-Key talab qilinadi");
    const hash = createHash("sha256")
      .update(JSON.stringify({ action, input, user: a.userId }))
      .digest("hex");
    return this.db.transaction(async (trx) => {
      // All mutations of one organization are serialized, including retries and stock changes.
      let q = trx("organizations").where({ id: a.organizationId });
      if (trx.client.config.client === "pg") q = q.forUpdate();
      if (!(await q.first())) throw new DomainError("Tashkilot topilmadi", 404);
      const previous = await trx("idempotency_keys")
        .where({ organizationId: a.organizationId, key })
        .first();
      if (previous) {
        if (previous.hash !== hash)
          throw new DomainError(
            "Bu kalit boshqa operatsiya uchun ishlatilgan",
            409,
          );
        return JSON.parse(previous.response);
      }
      const response = await fn(trx);
      await trx("idempotency_keys").insert({
        organizationId: a.organizationId,
        key,
        hash,
        response: JSON.stringify(response),
      });
      return response;
    });
  }
  async snapshot(a: Actor): Promise<Snapshot> {
    const tables = [
      "customers",
      "products",
      "sales",
      "sale_items",
      "payments",
      "debts",
      "debt_repayments",
      "inventory_movements",
      "expenses",
      "notifications",
      "audit_logs",
      "categories",
    ];
    const result: Record<string, any[]> = {};
    // Consistent read: PostgreSQL uses REPEATABLE READ, SQLite one transaction.
    const read = async (trx: Knex) => {
      for (const table of tables)
        result[table] = (
          await trx(table)
            .where({ organizationId: a.organizationId })
            .orderBy("createdAt", "desc")
        ).map(normalize);
      const s = await trx("settings")
        .where({ organizationId: a.organizationId })
        .first();
      return s ? JSON.parse(s.value) : defaultSettings;
    };
    const settings = await this.db.transaction(
      read,
      this.db.client.config.client === "pg"
        ? { isolationLevel: "repeatable read" }
        : {},
    );
    return {
      ...result,
      settings,
      role: a.role,
      organizationId: a.organizationId,
    } as unknown as Snapshot;
  }
  async customer(a: Actor, key: string, raw: unknown, id?: string) {
    const data = schemas.customer.parse(raw);
    return this.mutate(a, key, data, "customer" + (id || ""), async (trx) => {
      const row = id ? await this.scoped(trx, "customers", id, a) : stamp(a);
      if (id)
        await trx("customers")
          .where({ id, organizationId: a.organizationId })
          .update(data);
      else await trx("customers").insert({ ...row, ...data });
      await this.audit(
        trx,
        a,
        id ? "customer.updated" : "customer.created",
        row.id,
        data,
      );
      return { ...row, ...data };
    });
  }
  async product(a: Actor, key: string, raw: unknown, id?: string) {
    this.manager(a);
    const data = schemas.product.parse(raw);
    return this.mutate(a, key, data, "product" + (id || ""), async (trx) => {
      const row = id ? await this.scoped(trx, "products", id, a) : stamp(a);
      if (id && row.stock !== data.stock)
        throw new DomainError(
          "Ombor sonini inventarizatsiya orqali o‘zgartiring",
        );
      if (id)
        await trx("products")
          .where({ id, organizationId: a.organizationId })
          .update(data);
      else {
        await trx("products").insert({ ...row, ...data });
        await trx("inventory_movements").insert({
          ...stamp(a),
          productId: row.id,
          quantity: data.stock,
          reason: "Boshlang‘ich qoldiq",
        });
      }
      if (
        !(await trx("categories")
          .where({ organizationId: a.organizationId, name: data.category })
          .first())
      )
        await trx("categories").insert({ ...stamp(a), name: data.category });
      await this.audit(
        trx,
        a,
        id ? "product.updated" : "product.created",
        row.id,
        data,
      );
      return { ...row, ...data };
    });
  }
  async importProducts(a: Actor, key: string, raw: unknown) {
    this.manager(a);
    const { products } = z
      .object({ products: z.array(schemas.product).min(1).max(500) })
      .parse(raw);
    if (new Set(products.map((p) => p.sku)).size !== products.length)
      throw new DomainError("Faylda takroriy SKU bor");
    return this.mutate(a, key, products, "products.import", async (trx) => {
      for (const p of products) {
        const row = { ...stamp(a), ...p };
        await trx("products").insert(row);
        await trx("inventory_movements").insert({
          ...stamp(a),
          productId: row.id,
          quantity: p.stock,
          reason: "CSV import",
        });
        if (
          !(await trx("categories")
            .where({ organizationId: a.organizationId, name: p.category })
            .first())
        )
          await trx("categories").insert({ ...stamp(a), name: p.category });
        await this.audit(trx, a, "product.imported", row.id, p);
      }
      return { count: products.length };
    });
  }
  async debt(a: Actor, key: string, raw: unknown) {
    const data = schemas.debt.parse(raw);
    return this.mutate(a, key, data, "debt", async (trx) => {
      await this.scoped(trx, "customers", data.customerId, a);
      const { date: dateValue, ...fields } = data;
      const row = {
        ...stamp(a, dateValue ? `${dateValue}T09:00:00.000Z` : now()),
        ...fields,
      };
      await trx("debts").insert(row);
      await this.audit(trx, a, "debt.created", row.id, data);
      return row;
    });
  }
  async editDebt(a: Actor, key: string, id: string, raw: unknown) {
    const data = schemas.debtEdit.parse(raw);
    return this.mutate(a, key, data, "debt.edit" + id, async (trx) => {
      const debt = await this.scoped(trx, "debts", id, a);
      if (debt.saleId || debt.reversedAt)
        throw new DomainError(
          "Savdoga bog‘langan yoki qaytarilgan qarz tahrirlanmaydi",
        );
      const reps = await trx("debt_repayments").where({
        debtId: id,
        organizationId: a.organizationId,
        kind: "payment",
      });
      if (data.amount < reps.reduce((n, r) => n + Number(r.amount), 0))
        throw new DomainError("Summa mavjud to‘lovlardan kam bo‘la olmaydi");
      await trx("debts")
        .where({ id, organizationId: a.organizationId })
        .update(data);
      await this.audit(trx, a, "debt.updated", id, {
        before: debt,
        after: data,
      });
      return { ...debt, ...data };
    });
  }
  async repay(a: Actor, key: string, id: string, raw: unknown) {
    const data = schemas.repayment.parse(raw);
    return this.mutate(a, key, data, "repay" + id, async (trx) => {
      const debt = await this.scoped(trx, "debts", id, a);
      const reps = await trx("debt_repayments").where({
        debtId: id,
        organizationId: a.organizationId,
      });
      const balance = debtBalance(debt, reps);
      if (data.amount > balance)
        throw new DomainError("To‘lov qarz qoldig‘idan katta");
      const row = { ...stamp(a), debtId: id, ...data, kind: "payment" };
      await trx("debt_repayments").insert(row);
      await this.audit(trx, a, "debt.repaid", id, row);
      return { ...row, remaining: balance - data.amount };
    });
  }
  async sale(a: Actor, key: string, raw: unknown) {
    const data = schemas.sale.parse(raw);
    return this.mutate(a, key, data, "sale", async (trx) => {
      if (data.customerId)
        await this.scoped(trx, "customers", data.customerId, a);
      const grouped = new Map<string, number>();
      for (const item of data.items)
        grouped.set(
          item.productId,
          (grouped.get(item.productId) || 0) + item.quantity,
        );
      const at = data.date ? `${data.date}T09:00:00.000Z` : now();
      const saleId = randomUUID();
      const items = [];
      let subtotal = 0,
        cost = 0;
      for (const [productId, quantity] of grouped) {
        const p = await this.scoped(trx, "products", productId, a);
        if (p.stock < quantity)
          throw new DomainError(`${p.name}: omborda yetarli mahsulot yo‘q`);
        subtotal += p.price * quantity;
        cost += p.cost * quantity;
        items.push({
          ...stamp(a, at),
          saleId,
          productId,
          name: p.name,
          quantity,
          price: p.price,
          cost: p.cost,
        });
      }
      if (
        !Number.isSafeInteger(subtotal) ||
        subtotal > 1e12 ||
        !Number.isSafeInteger(cost) ||
        cost > 1e12
      )
        throw new DomainError("Savdo summasi chegaradan oshdi");
      if (data.discount > subtotal)
        throw new DomainError("Chegirma savdo summasidan katta");
      const total = subtotal - data.discount;
      if (total <= 0)
        throw new DomainError("Savdo summasi noldan katta bo‘lishi kerak");
      const paid =
        data.method === "debt"
          ? 0
          : data.method === "mixed"
            ? data.paid
            : total;
      if (paid === undefined || paid > total)
        throw new DomainError("To‘langan summa noto‘g‘ri");
      const owed = total - paid;
      if (owed > 0 && !data.customerId)
        throw new DomainError("Qarzga savdo uchun mijozni tanlang");
      const row = {
        ...stamp(a, at),
        id: saleId,
        customerId: data.customerId || null,
        subtotal,
        discount: data.discount,
        total,
        cost,
        method: data.method,
        status: "completed",
      };
      await trx("sales").insert(row);
      await trx("sale_items").insert(items);
      for (const item of items) {
        await trx("products")
          .where({ id: item.productId, organizationId: a.organizationId })
          .decrement("stock", item.quantity);
        await trx("inventory_movements").insert({
          ...stamp(a, at),
          productId: item.productId,
          saleId,
          quantity: -item.quantity,
          reason: "Savdo",
        });
      }
      if (paid > 0)
        await trx("payments").insert({
          ...stamp(a, at),
          saleId,
          amount: paid,
          method: data.method === "card" ? "card" : "cash",
          kind: "payment",
        });
      if (owed > 0)
        await trx("debts").insert({
          ...stamp(a, at),
          customerId: data.customerId,
          saleId,
          amount: owed,
          dueDate: data.dueDate || day(new Date(Date.now() + 14 * 86400000)),
          notes: `Savdo #${saleId.slice(0, 6)}`,
        });
      await trx("notifications").insert({
        ...stamp(a, at),
        title: "Yangi savdo",
        body: `Savdo #${saleId.slice(0, 6)}: ${(total / 100).toLocaleString("ru-RU")} so‘m. ${owed > 0 ? "Qarz: " + (owed / 100).toLocaleString("ru-RU") + " so‘m." : ""}`,
        status: process.env.TELEGRAM_BOT_TOKEN ? "queued" : "demo",
        read: false,
      });
      await this.audit(trx, a, "sale.created", saleId, { total, paid, owed });
      return { ...row, items };
    });
  }
  async reverse(a: Actor, key: string, id: string) {
    this.manager(a);
    return this.mutate(a, key, {}, "sale.reverse" + id, async (trx) => {
      const sale = await this.scoped(trx, "sales", id, a);
      if (sale.status === "reversed")
        throw new DomainError("Savdo allaqachon qaytarilgan", 409);
      const at = now();
      const items = await trx("sale_items").where({
        saleId: id,
        organizationId: a.organizationId,
      });
      for (const item of items) {
        await trx("products")
          .where({ id: item.productId, organizationId: a.organizationId })
          .increment("stock", item.quantity);
        await trx("inventory_movements").insert({
          ...stamp(a, at),
          productId: item.productId,
          saleId: id,
          quantity: item.quantity,
          reason: "Savdo qaytarildi",
        });
      }
      for (const payment of await trx("payments").where({
        saleId: id,
        organizationId: a.organizationId,
        kind: "payment",
      }))
        await trx("payments").insert({
          ...stamp(a, at),
          saleId: id,
          amount: payment.amount,
          method: payment.method,
          kind: "refund",
        });
      for (const debt of await trx("debts").where({
        saleId: id,
        organizationId: a.organizationId,
      })) {
        for (const r of await trx("debt_repayments").where({
          debtId: debt.id,
          organizationId: a.organizationId,
          kind: "payment",
        }))
          await trx("debt_repayments").insert({
            ...stamp(a, at),
            debtId: debt.id,
            amount: r.amount,
            method: r.method,
            kind: "refund",
          });
        await trx("debts")
          .where({ id: debt.id, organizationId: a.organizationId })
          .update({ reversedAt: at });
      }
      await trx("sales")
        .where({ id, organizationId: a.organizationId })
        .update({ status: "reversed", reversedAt: at });
      await this.audit(trx, a, "sale.reversed", id, { refund: true });
      return { id, status: "reversed" };
    });
  }
  async stock(a: Actor, key: string, id: string, raw: unknown) {
    this.manager(a);
    const data = schemas.stock.parse(raw);
    return this.mutate(a, key, data, "stock" + id, async (trx) => {
      const p = await this.scoped(trx, "products", id, a);
      if (p.stock + data.quantity < 0)
        throw new DomainError("Ombor qoldig‘i manfiy bo‘la olmaydi");
      await trx("products")
        .where({ id, organizationId: a.organizationId })
        .increment("stock", data.quantity);
      const row = { ...stamp(a), productId: id, ...data };
      await trx("inventory_movements").insert(row);
      await this.audit(trx, a, "stock.adjusted", id, data);
      return row;
    });
  }
  async expense(a: Actor, key: string, raw: unknown) {
    this.manager(a);
    const data = schemas.expense.parse(raw);
    return this.mutate(a, key, data, "expense", async (trx) => {
      const { date: dateValue, ...fields } = data;
      const row = {
        ...stamp(a, dateValue ? `${dateValue}T09:00:00.000Z` : now()),
        ...fields,
      };
      await trx("expenses").insert(row);
      await this.audit(trx, a, "expense.created", row.id, data);
      return row;
    });
  }
  async settings(a: Actor, key: string, raw: unknown) {
    this.manager(a);
    const data = schemas.settings.parse(raw);
    return this.mutate(a, key, data, "settings", async (trx) => {
      await trx("settings")
        .insert({
          organizationId: a.organizationId,
          value: JSON.stringify(data),
        })
        .onConflict("organizationId")
        .merge();
      await trx("organizations")
        .where({ id: a.organizationId })
        .update({ name: data.storeName });
      await this.audit(trx, a, "settings.updated", a.organizationId, data);
      return data;
    });
  }
  async notification(
    a: Actor,
    key: string,
    id: string,
    title: string,
    body: string,
    status: string,
  ) {
    return this.mutate(
      a,
      key,
      { id, title, body, status },
      "notification",
      async (trx) => {
        await this.scoped(trx, "customers", id, a);
        const row = {
          ...stamp(a),
          customerId: id,
          title,
          body,
          status,
          read: false,
        };
        await trx("notifications").insert(row);
        await this.audit(trx, a, "reminder.created", row.id, {
          customerId: id,
          status,
        });
        return row;
      },
    );
  }
  manager(a: Actor) {
    if (!["admin", "manager"].includes(a.role))
      throw new DomainError("Faqat administrator yoki menejer uchun", 403);
  }
}
export const defaultSettings = {
  storeName: "Baraka Market",
  language: "uz",
  theme: "light",
  notifications: true,
  debtDays: 14,
  telegramId: "",
};
