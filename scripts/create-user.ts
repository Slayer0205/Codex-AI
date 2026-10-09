import "dotenv/config";
import { randomUUID } from "node:crypto";
import { connectDatabase, migrate } from "../server/db.js";
import { hashPassword } from "../server/auth.js";
import { defaultSettings } from "../server/domain.js";
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const i = a.indexOf("=");
      return [a.slice(2, i), a.slice(i + 1)];
    }),
);
if (
  !args.email ||
  !args.name ||
  !process.env.ADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD.length < 12
)
  throw new Error(
    "Provide --email=... --name=... [--org=existing-id --role=cashier --telegram=ID]. Set ADMIN_PASSWORD securely (12+ characters).",
  );
const db = connectDatabase();
try {
  await migrate(db);
  const at = new Date().toISOString();
  const organizationId = args.org || randomUUID();
  const id = randomUUID();
  await db.transaction(async (trx) => {
    if (!args.org) {
      await trx("organizations").insert({
        id: organizationId,
        name: args.store || "Mening do‘konim",
        createdAt: at,
      });
      await trx("settings").insert({
        organizationId,
        value: JSON.stringify({
          ...defaultSettings,
          storeName: args.store || "Mening do‘konim",
        }),
      });
    } else if (!(await trx("organizations").where({ id: args.org }).first()))
      throw new Error("Organization not found");
    const role = args.role || "admin";
    if (!["admin", "manager", "cashier", "viewer"].includes(role))
      throw new Error("Invalid role");
    await trx("users").insert({
      id,
      name: args.name,
      email: args.email.toLowerCase(),
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD!),
      telegramId: args.telegram || null,
      createdAt: at,
    });
    await trx("memberships").insert({
      id: randomUUID(),
      organizationId,
      userId: id,
      role,
      createdAt: at,
    });
  });
  console.log("Created user. Organization:", organizationId);
} finally {
  await db.destroy();
}
