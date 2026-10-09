import type { Debt, Snapshot } from "./types";
export const money = (tiyin: number) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: tiyin % 100 ? 2 : 0,
  }).format(tiyin / 100);
export const compact = (tiyin: number) =>
  tiyin >= 100000000 ? `${(tiyin / 100000000).toFixed(1)} mln` : money(tiyin);
export const day = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
const months = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];
export const displayDate = (s: string) => {
  const d = day(new Date(s));
  return `${Number(d.slice(8))}-${months[Number(d.slice(5, 7)) - 1].slice(0, 3)}`;
};
export const fullDate = (s: string) => {
  const d = day(new Date(s));
  return `${Number(d.slice(8))}-${months[Number(d.slice(5, 7)) - 1]}, ${d.slice(0, 4)}`;
};
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
export const remaining = (d: Debt, s: Snapshot) =>
  d.reversedAt
    ? 0
    : d.amount -
      s.debt_repayments
        .filter((r) => r.debtId === d.id && r.kind === "payment")
        .reduce((n, r) => n + r.amount, 0);
export const status = (d: Debt, s: Snapshot) =>
  remaining(d, s) === 0
    ? "paid"
    : d.dueDate < day()
      ? "overdue"
      : remaining(d, s) < d.amount
        ? "partial"
        : "active";
export const statusLabel: Record<string, string> = {
  paid: "Yopilgan",
  overdue: "Muddati o‘tgan",
  partial: "Qisman to‘langan",
  active: "Faol",
  completed: "Yakunlangan",
  reversed: "Qaytarilgan",
  demo: "Demo",
  sent: "Yuborilgan",
  queued: "Navbatda",
  sending: "Yuborilmoqda",
  failed: "Yuborilmadi",
  unconfigured: "Qabul qiluvchi yo‘q",
  disabled: "O‘chirilgan",
};
export const methodLabel: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  debt: "Qarz",
  mixed: "Aralash",
};
export function metrics(s: Snapshot, from = "", to = "9999-12-31") {
  const sales = s.sales.filter(
    (x) =>
      x.status === "completed" &&
      day(new Date(x.createdAt)) >= from &&
      day(new Date(x.createdAt)) <= to,
  );
  const expenses = s.expenses
    .filter(
      (x) =>
        day(new Date(x.createdAt)) >= from && day(new Date(x.createdAt)) <= to,
    )
    .reduce((n, x) => n + x.amount, 0);
  const revenue = sales.reduce((n, x) => n + x.total, 0);
  const cost = sales.reduce((n, x) => n + x.cost, 0);
  const collected = s.debt_repayments
    .filter(
      (r) =>
        r.kind === "payment" &&
        day(new Date(r.createdAt)) >= from &&
        day(new Date(r.createdAt)) <= to &&
        !s.debts.find((d) => d.id === r.debtId)?.reversedAt,
    )
    .reduce((n, r) => n + r.amount, 0);
  return {
    sales,
    revenue,
    cost,
    expenses,
    profit: revenue - cost - expenses,
    collected,
    debt: s.debts.reduce((n, d) => n + remaining(d, s), 0),
    overdue: s.debts
      .filter((d) => status(d, s) === "overdue")
      .reduce((n, d) => n + remaining(d, s), 0),
  };
}
export function trends(s: Snapshot, days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const date = day(new Date(Date.now() - (days - 1 - i) * 86400000));
    const m = metrics(s, date, date);
    return {
      date: displayDate(date),
      revenue: m.revenue / 100,
      expenses: m.expenses / 100,
      profit: m.profit / 100,
    };
  });
}
export const customerDebt = (id: string, s: Snapshot) =>
  s.debts
    .filter((d) => d.customerId === id)
    .reduce((n, d) => n + remaining(d, s), 0);
export function downloadBlob(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCSV(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let value = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
    return `"${value.replaceAll('"', '""')}"`;
  };
  downloadBlob(
    new Blob(
      [
        "\ufeff" +
          [
            cols.map(cell).join(","),
            ...rows.map((r) => cols.map((c) => cell(r[c])).join(",")),
          ].join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8;" },
    ),
    name + ".csv",
  );
}
export async function exportExcel(
  rows: Record<string, unknown>[],
  name: string,
) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const sheet = wb.addWorksheet("Hisobot");
  if (rows.length) {
    sheet.columns = Object.keys(rows[0]).map((k) => ({
      header: k,
      key: k,
      width: 24,
    }));
    for (const row of rows) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF132C31" },
    };
  }
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer as unknown as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    name + ".xlsx",
  );
}
