import type { Page } from "../types";
export const navigation: Record<"uz" | "ru" | "en", Record<Page, string>> = {
  uz: {
    dashboard: "Bosh sahifa",
    debts: "Qarz daftari",
    customers: "Mijozlar",
    sales: "Savdo markazi",
    products: "Mahsulotlar",
    reports: "Hisobotlar",
    settings: "Sozlamalar",
  },
  ru: {
    dashboard: "Обзор",
    debts: "Долги",
    customers: "Клиенты",
    sales: "Продажи",
    products: "Товары",
    reports: "Отчёты",
    settings: "Настройки",
  },
  en: {
    dashboard: "Overview",
    debts: "Debt ledger",
    customers: "Customers",
    sales: "Sales",
    products: "Inventory",
    reports: "Reports",
    settings: "Settings",
  },
};
// Feature copy currently ships in Uzbek; dictionaries are organized for full translation.
