import {
  Bot,
  Keyboard,
  InlineKeyboard,
  session,
  type Context,
  type SessionFlavor,
} from "grammy";
import type { Knex } from "knex";
import { Business, type Actor, day, debtBalance } from "../server/domain.js";
import { money } from "./messages.js";
type State = {
  step?:
    | "customer-name"
    | "customer-phone"
    | "debt-customer"
    | "debt-amount"
    | "debt-due"
    | "repay";
  name?: string;
  customerId?: string;
  amount?: number;
  debtId?: string;
};
type BotContext = Context & SessionFlavor<State> & { actor: Actor };
export function createBotMenu(appURL = process.env.WEB_APP_URL) {
  const menu = new Keyboard()
    .text("📊 Dashboard")
    .text("📒 Qarz daftari")
    .row()
    .text("👥 Mijozlar")
    .text("🛒 Savdo")
    .row()
    .text("📦 Ombor")
    .text("📈 Hisobotlar")
    .row()
    .text("🔔 Eslatmalar")
    .text("⚙️ Sozlamalar")
    .resized();
  if (appURL?.startsWith("https://"))
    menu.row().webApp("🚀 Web App ochish", appURL);
  return menu;
}

export function createTelegramBot(db: Knex) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token)
    throw new Error("TELEGRAM_BOT_TOKEN is required to connect the bot");
  const business = new Business(db);
  const appURL = process.env.WEB_APP_URL;
  const menu = createBotMenu(appURL);
  const bot = new Bot<BotContext>(token);
  bot.use(session({ initial: () => ({}) }));
  bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.chat?.type !== "private") return;
    const user = await db("users")
      .where({ telegramId: String(ctx.from.id) })
      .first();
    const m =
      user && (await db("memberships").where({ userId: user.id }).first());
    if (!m) {
      await ctx.reply(
        "Hisobingiz hali bog‘lanmagan. Web ilovaga kiring va Telegram hisobini bog‘lang yoki administratorga murojaat qiling.",
      );
      return;
    }
    ctx.actor = {
      userId: user.id,
      organizationId: m.organizationId,
      role: m.role,
    };
    await next();
  });
  const web = () =>
    appURL?.startsWith("https://")
      ? new InlineKeyboard().webApp("🚀 Mini App ochish", appURL)
      : undefined;
  bot.command("start", (ctx) => {
    ctx.session = {};
    return ctx.reply(
      "Smart Savdo’ga xush kelibsiz!\nSavdo, qarz va omboringiz doim nazoratda.\n\nYangi mijoz: /mijoz\nYangi qarz: /qarz\nJarayonni bekor qilish: /bekor",
      { reply_markup: menu },
    );
  });
  bot.command("bekor", (ctx) => {
    ctx.session = {};
    return ctx.reply("Jarayon bekor qilindi.", { reply_markup: menu });
  });
  bot.command("mijoz", (ctx) => {
    ctx.session = { step: "customer-name" };
    return ctx.reply("Mijozning ism-familiyasini yuboring:");
  });
  bot.command("qarz", async (ctx) => {
    ctx.session = { step: "debt-customer" };
    const s = await business.snapshot(ctx.actor);
    return ctx.reply("Mijozni tanlang:", {
      reply_markup: s.customers.reduce(
        (kb, c) => kb.text(c.name, `customer:${c.id}`).row(),
        new InlineKeyboard(),
      ),
    });
  });
  bot.callbackQuery(/^customer:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.session.step !== "debt-customer") return;
    const id = ctx.callbackQuery.data.slice(9);
    await business.scoped(db, "customers", id, ctx.actor);
    ctx.session = { step: "debt-amount", customerId: id };
    await ctx.reply("Qarz summasini so‘mda yuboring (masalan, 125000):");
  });
  bot.callbackQuery(/^repay:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = ctx.callbackQuery.data.slice(6);
    await business.scoped(db, "debts", id, ctx.actor);
    ctx.session = { step: "repay", debtId: id };
    await ctx.reply("To‘lov summasini so‘mda yuboring:");
  });
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const key = `tg-${ctx.update.update_id}`;
    const state = ctx.session;
    if (state.step === "customer-name") {
      if (text.trim().length < 2)
        return ctx.reply("Ism kamida 2 belgidan iborat bo‘lsin.");
      ctx.session = { step: "customer-phone", name: text.trim() };
      return ctx.reply("Telefon raqamini yuboring (+998…):");
    }
    if (state.step === "customer-phone") {
      const c = await business.customer(ctx.actor, key, {
        name: state.name,
        phone: text,
      });
      ctx.session = {};
      return ctx.reply(`✅ ${c.name} mijozlar ro‘yxatiga qo‘shildi.`, {
        reply_markup: menu,
      });
    }
    if (state.step === "debt-amount") {
      const value = Number(text.replaceAll(" ", ""));
      if (!Number.isFinite(value) || value <= 0)
        return ctx.reply("Musbat summa yuboring.");
      ctx.session = {
        ...state,
        step: "debt-due",
        amount: Math.round(value * 100),
      };
      return ctx.reply("To‘lov muddatini YYYY-MM-DD shaklida yuboring:");
    }
    if (state.step === "debt-due") {
      await business.debt(ctx.actor, key, {
        customerId: state.customerId,
        amount: state.amount,
        dueDate: text,
        notes: "Telegram orqali qo‘shildi",
      });
      ctx.session = {};
      return ctx.reply("✅ Qarz saqlandi. Web ilovada ham ko‘rinadi.", {
        reply_markup: menu,
      });
    }
    if (state.step === "repay") {
      const amount = Math.round(Number(text.replaceAll(" ", "")) * 100);
      const r = await business.repay(ctx.actor, key, state.debtId!, {
        amount,
        method: "cash",
      });
      ctx.session = {};
      return ctx.reply(
        `✅ To‘lov saqlandi. Qoldiq: ${money(r.remaining)} so‘m.`,
        { reply_markup: menu },
      );
    }
    const s = await business.snapshot(ctx.actor);
    const active = s.sales.filter((x) => x.status === "completed");
    const total = active.reduce((n, x) => n + x.total, 0);
    const expense = s.expenses.reduce((n, x) => n + x.amount, 0);
    const debts = s.debts.filter((d) => debtBalance(d, s.debt_repayments) > 0);
    if (text === "📊 Dashboard")
      return ctx.reply(
        `📊 ${s.settings.storeName}\nBugungi savdo: ${money(active.filter((x) => day(new Date(x.createdAt)) === day()).reduce((n, x) => n + x.total, 0))} so‘m\nQarz qoldig‘i: ${money(debts.reduce((n, d) => n + debtBalance(d, s.debt_repayments), 0))} so‘m\nMijozlar: ${s.customers.length}\nMahsulotlar: ${s.products.length}`,
        { reply_markup: web() },
      );
    if (text === "📒 Qarz daftari") {
      if (!debts.length)
        return ctx.reply("Barcha qarzlar yopilgan. Yangi qarz: /qarz");
      for (const d of debts.slice(0, 10)) {
        const c = s.customers.find((c) => c.id === d.customerId);
        await ctx.reply(
          `${c?.name}\nQoldiq: ${money(debtBalance(d, s.debt_repayments))} so‘m\nMuddat: ${d.dueDate}`,
          {
            reply_markup: new InlineKeyboard().text(
              "💳 To‘lov qo‘shish",
              `repay:${d.id}`,
            ),
          },
        );
      }
      return;
    }
    if (text === "👥 Mijozlar")
      return ctx.reply(
        `👥 Mijozlar\n${s.customers
          .slice(0, 20)
          .map((c) => `${c.name} · ${c.phone}`)
          .join("\n")}\n\nQo‘shish: /mijoz`,
        { reply_markup: web() },
      );
    if (text === "📦 Ombor")
      return ctx.reply(
        `📦 Ombor\n${s.products
          .slice(0, 20)
          .map(
            (p) =>
              `${p.name}: ${p.stock} dona${p.stock <= p.lowStock ? " ⚠️" : ""}`,
          )
          .join("\n")}`,
        { reply_markup: web() },
      );
    if (text === "📈 Hisobotlar")
      return ctx.reply(
        `📈 Jami hisobot\nSavdo: ${money(total)} so‘m\nXarajat: ${money(expense)} so‘m\nSof foyda: ${money(total - active.reduce((n, x) => n + x.cost, 0) - expense)} so‘m`,
        { reply_markup: web() },
      );
    if (text === "🔔 Eslatmalar")
      return ctx.reply(
        `Muddati o‘tgan qarzlar: ${debts.filter((d) => d.dueDate < day()).length}.\nEslatmalar Web ilovadagi qarz daftaridan qo‘lda yuboriladi. Avtomatik rejalashtirish yoqilmagan.`,
        { reply_markup: web() },
      );
    if (text === "⚙️ Sozlamalar")
      return ctx.reply(
        `Do‘kon: ${s.settings.storeName}\nValyuta: UZS\nRol: ${ctx.actor.role}\nSozlamalar Web ilovada boshqariladi.`,
        { reply_markup: web() },
      );
    if (text === "🛒 Savdo")
      return ctx.reply(
        "Mahsulot tanlash, aralash to‘lov va chek uchun Mini App savdo markazini oching.",
        { reply_markup: web() },
      );
    return ctx.reply("Menyudan bo‘limni tanlang yoki /start yuboring.", {
      reply_markup: menu,
    });
  });
  bot.catch(async (err) => {
    console.error(
      "Bot operation failed:",
      err.error instanceof Error ? err.error.message : "Unknown",
    );
    await err.ctx
      .reply(
        "Operatsiya bajarilmadi. Ma’lumotlarni tekshiring; bekor qilish uchun /bekor yuboring.",
      )
      .catch(() => {});
  });
  return bot;
}
