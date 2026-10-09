import type { Knex } from "knex";
import { Business, type Actor, day, defaultSettings } from "./domain.js";
async function seedCore(db: Knex) {
  if (await db("organizations").where({ id: "demo-org" }).first()) return;
  const at = new Date().toISOString();
  await db.transaction(async (trx) => {
    await trx("organizations").insert({
      id: "demo-org",
      name: "Baraka Market",
      createdAt: at,
    });
    await trx("users").insert({
      id: "demo-user",
      name: "Aziz Karimov",
      email: "demo@smart-savdo.local",
      createdAt: at,
    });
    await trx("memberships").insert({
      id: "demo-membership",
      organizationId: "demo-org",
      userId: "demo-user",
      role: "admin",
      createdAt: at,
    });
    await trx("settings").insert({
      organizationId: "demo-org",
      value: JSON.stringify(defaultSettings),
    });
  });
  const a: Actor = {
    userId: "demo-user",
    organizationId: "demo-org",
    role: "admin",
  };
  const b = new Business(db);
  const customers = [];
  for (const [name, phone, address] of [
    ["Javohir Abdullayev", "+998 90 123 45 67", "Chilonzor, 12-kvartal"],
    ["Madina Rasulova", "+998 93 456 78 90", "Yunusobod, 8-kvartal"],
    ["Sardor Tursunov", "+998 99 876 54 32", "Sergeli, 5-kvartal"],
    ["Dilnoza Karimova", "+998 97 234 56 78", "Mirzo Ulug‘bek tumani"],
    ["Alisher Ismoilov", "+998 91 345 67 89", "Yakkasaroy tumani"],
    ["Nigora Sobirova", "+998 94 567 89 01", "Olmazor tumani"],
  ])
    customers.push(
      await b.customer(a, `seed-c-${phone}`, {
        name,
        phone,
        address,
        notes: "Doimiy mijoz",
      }),
    );
  const products = [];
  for (const [i, p] of [
    {
      name: "Oliy navli un",
      category: "Oziq-ovqat",
      cost: 620000,
      price: 850000,
      stock: 180,
      sku: "UN-001",
    },
    {
      name: "Kungaboqar yog‘i",
      category: "Oziq-ovqat",
      cost: 1800000,
      price: 2450000,
      stock: 150,
      sku: "YG-002",
    },
    {
      name: "Lazer guruch",
      category: "Oziq-ovqat",
      cost: 1550000,
      price: 2100000,
      stock: 200,
      sku: "GR-003",
    },
    {
      name: "Qora choy",
      category: "Ichimliklar",
      cost: 1200000,
      price: 1850000,
      stock: 100,
      sku: "CH-004",
    },
    {
      name: "Shakar",
      category: "Oziq-ovqat",
      cost: 950000,
      price: 1250000,
      stock: 180,
      sku: "SH-005",
    },
    {
      name: "Sut 1 litr",
      category: "Sut mahsulotlari",
      cost: 850000,
      price: 1200000,
      stock: 140,
      sku: "ST-006",
    },
    {
      name: "Mineral suv",
      category: "Ichimliklar",
      cost: 200000,
      price: 400000,
      stock: 160,
      sku: "SV-007",
    },
    {
      name: "Kir yuvish kukuni",
      category: "Uy-ro‘zg‘or",
      cost: 2800000,
      price: 3800000,
      stock: 8,
      sku: "KR-008",
    },
  ].entries())
    products.push(await b.product(a, `seed-p-${i}`, p));
  for (let offset = 27; offset >= 0; offset--) {
    const date = day(new Date(Date.now() - offset * 86400000));
    await b.sale(a, `seed-sale-${offset}`, {
      customerId: customers[offset % 6].id,
      items: [
        { productId: products[offset % 7].id, quantity: 2 + (offset % 5) },
        {
          productId: products[(offset + 2) % 7].id,
          quantity: 1 + (offset % 3),
        },
      ],
      method: offset % 6 === 0 ? "debt" : offset % 3 === 0 ? "card" : "cash",
      discount: 0,
      date,
      dueDate: day(new Date(Date.now() + (10 - offset) * 86400000)),
    });
  }
  for (let i = 0; i < 4; i++)
    await b.debt(a, `seed-debt-${i}`, {
      customerId: customers[i].id,
      amount: [125000000, 84000000, 235000000, 62000000][i],
      dueDate: day(new Date(Date.now() + (i * 7 - 4) * 86400000)),
      date: day(new Date(Date.now() - (10 + i) * 86400000)),
      notes: [
        "Mahsulot yetkazib berish",
        "Oylik xarid",
        "Ulgurji savdo",
        "Oilaviy xarid",
      ][i],
    });
  const debts = await db("debts")
    .where({ organizationId: "demo-org" })
    .whereNull("saleId")
    .orderBy("amount", "desc");
  await b.repay(a, "seed-repay", debts[0].id, {
    amount: Math.floor(Number(debts[0].amount) / 300) * 100,
    method: "card",
  });
  await b.expense(a, "seed-exp-1", {
    name: "Do‘kon ijarasi",
    category: "Ijara",
    amount: 65000000,
    date: day(new Date(Date.now() - 12 * 86400000)),
  });
  await b.expense(a, "seed-exp-2", {
    name: "Yetkazib berish",
    category: "Transport",
    amount: 12000000,
    date: day(new Date(Date.now() - 3 * 86400000)),
  });
  await db("notifications").insert({
    id: "welcome",
    organizationId: "demo-org",
    createdAt: at,
    title: "Smart Savdo’ga xush kelibsiz!",
    body: "Bu demo muhit. Barcha operatsiyalar bazada saqlanadi; haqiqiy pul o‘tkazilmaydi.",
    read: false,
    status: "demo",
  });
}

export async function seedDemo(db: Knex) {
  await db.transaction(async (trx) => {
    await seedCore(trx);
  });
}
