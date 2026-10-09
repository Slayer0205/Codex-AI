import knex, { type Knex } from "knex";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function connectDatabase(
  url = process.env.DATABASE_URL || "sqlite:./data/smart-savdo.sqlite",
): Knex {
  if (/^postgres(ql)?:/.test(url))
    return knex({ client: "pg", connection: url, pool: { min: 0, max: 10 } });
  const filename = url.replace(/^sqlite:/, "");
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true });
  return knex({
    client: "better-sqlite3",
    connection: { filename },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(connection: any, done: any) {
        connection.pragma("foreign_keys = ON");
        connection.pragma("journal_mode = WAL");
        done(null, connection);
      },
    },
  });
}

// Versioned, transactional migrations. Money is integer tiyin (1 UZS = 100 tiyin).
async function migrateSchema(db: Knex) {
  if (!(await db.schema.hasTable("schema_migrations")))
    await db.schema.createTable("schema_migrations", (t) => {
      t.integer("version").primary();
    });
  if (await db("schema_migrations").where({ version: 1 }).first()) return;
  await db.transaction(async (trx) => {
    const base = (t: Knex.CreateTableBuilder, org = true) => {
      t.string("id").primary();
      if (org)
        t.string("organizationId")
          .notNullable()
          .references("id")
          .inTable("organizations");
      t.string("createdAt").notNullable();
    };
    await trx.schema.createTable("organizations", (t) => {
      base(t, false);
      t.string("name").notNullable();
    });
    await trx.schema.createTable("users", (t) => {
      base(t, false);
      t.string("name").notNullable();
      t.string("email").notNullable().unique();
      t.string("passwordHash");
      t.string("telegramId").unique();
    });
    await trx.schema.createTable("memberships", (t) => {
      base(t);
      t.string("userId").notNullable().references("id").inTable("users");
      t.string("role").notNullable();
      t.unique(["organizationId", "userId"]);
    });
    await trx.schema.createTable("categories", (t) => {
      base(t);
      t.string("name").notNullable();
      t.unique(["organizationId", "name"]);
    });
    await trx.schema.createTable("customers", (t) => {
      base(t);
      t.string("name").notNullable();
      t.string("phone").notNullable();
      t.string("telegramId");
      t.string("address");
      t.text("notes");
    });
    await trx.schema.createTable("products", (t) => {
      base(t);
      t.string("name").notNullable();
      t.string("category").notNullable();
      t.string("sku").notNullable();
      t.bigInteger("cost").notNullable();
      t.bigInteger("price").notNullable();
      t.integer("stock").notNullable();
      t.integer("lowStock").notNullable().defaultTo(5);
      t.string("image");
      t.unique(["organizationId", "sku"]);
    });
    await trx.schema.createTable("sales", (t) => {
      base(t);
      t.string("customerId").references("id").inTable("customers");
      t.bigInteger("subtotal").notNullable();
      t.bigInteger("discount").notNullable();
      t.bigInteger("total").notNullable();
      t.bigInteger("cost").notNullable();
      t.string("method").notNullable();
      t.string("status").notNullable();
      t.string("reversedAt");
    });
    await trx.schema.createTable("sale_items", (t) => {
      base(t);
      t.string("saleId").notNullable().references("id").inTable("sales");
      t.string("productId").notNullable().references("id").inTable("products");
      t.string("name").notNullable();
      t.integer("quantity").notNullable();
      t.bigInteger("price").notNullable();
      t.bigInteger("cost").notNullable();
    });
    await trx.schema.createTable("payments", (t) => {
      base(t);
      t.string("saleId").notNullable().references("id").inTable("sales");
      t.bigInteger("amount").notNullable();
      t.string("method").notNullable();
      t.string("kind").notNullable();
    });
    await trx.schema.createTable("debts", (t) => {
      base(t);
      t.string("customerId")
        .notNullable()
        .references("id")
        .inTable("customers");
      t.string("saleId").references("id").inTable("sales");
      t.bigInteger("amount").notNullable();
      t.string("dueDate").notNullable();
      t.text("notes");
      t.string("reversedAt");
    });
    await trx.schema.createTable("debt_repayments", (t) => {
      base(t);
      t.string("debtId").notNullable().references("id").inTable("debts");
      t.bigInteger("amount").notNullable();
      t.string("method").notNullable();
      t.string("kind").notNullable();
    });
    await trx.schema.createTable("inventory_movements", (t) => {
      base(t);
      t.string("productId").notNullable().references("id").inTable("products");
      t.string("saleId").references("id").inTable("sales");
      t.integer("quantity").notNullable();
      t.string("reason").notNullable();
    });
    await trx.schema.createTable("expenses", (t) => {
      base(t);
      t.string("name").notNullable();
      t.string("category").notNullable();
      t.bigInteger("amount").notNullable();
    });
    await trx.schema.createTable("notifications", (t) => {
      base(t);
      t.string("title").notNullable();
      t.text("body").notNullable();
      t.boolean("read").notNullable().defaultTo(false);
      t.string("status").notNullable();
      t.string("customerId").references("id").inTable("customers");
    });
    await trx.schema.createTable("audit_logs", (t) => {
      base(t);
      t.string("userId").notNullable().references("id").inTable("users");
      t.string("action").notNullable();
      t.string("entityId").notNullable();
      t.text("details").notNullable();
    });
    await trx.schema.createTable("settings", (t) => {
      t.string("organizationId")
        .primary()
        .references("id")
        .inTable("organizations");
      t.text("value").notNullable();
    });
    await trx.schema.createTable("idempotency_keys", (t) => {
      t.string("organizationId")
        .notNullable()
        .references("id")
        .inTable("organizations");
      t.string("key").notNullable();
      t.string("hash").notNullable();
      t.text("response").notNullable();
      t.primary(["organizationId", "key"]);
    });
    for (const table of [
      "customers",
      "products",
      "sales",
      "debts",
      "debt_repayments",
      "inventory_movements",
      "notifications",
      "audit_logs",
    ])
      await trx.schema.alterTable(table, (t) =>
        t.index(["organizationId", "createdAt"]),
      );
    await trx("schema_migrations").insert({ version: 1 });
  });
}

export async function migrate(db: Knex) {
  if (db.client.config.client === "pg") {
    await db.transaction(async (trx) => {
      await trx.raw("SELECT pg_advisory_xact_lock(84274323)");
      await migrateSchema(trx);
    });
  } else await migrateSchema(db);
}
