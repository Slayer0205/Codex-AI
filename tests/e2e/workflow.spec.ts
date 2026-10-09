import { test, expect } from "@playwright/test";
const unique = Date.now().toString().slice(-8);
const name = "E2E Mijoz " + unique,
  product = "E2E Guruch " + unique;
async function demo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Demo bilan tanishish" }).click();
  await expect(page.getByRole("heading", { name: /Xayrli kun/ })).toBeVisible();
}
async function nav(page: import("@playwright/test").Page, label: string) {
  await page
    .locator(".sidebar")
    .getByRole("button", { name: label, exact: true })
    .click();
}
test("complete customer → product → credit sale → partial/full repayment → persistence/reports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await nav(page, "Mijozlar");
  await page.getByRole("button", { name: "Yangi mijoz" }).click();
  await page.getByLabel("Ism-familiya").fill(name);
  await page.getByLabel("Telefon raqami").fill("+998901234567");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await nav(page, "Mahsulotlar");
  await page.getByRole("button", { name: "Mahsulot qo‘shish" }).click();
  await page.getByLabel("Mahsulot nomi").fill(product);
  await page.getByLabel("SKU / shtrix-kod").fill("E2E-" + unique);
  await page.getByLabel("Tannarx (so‘m)").fill("6000");
  await page.getByLabel("Sotish narxi (so‘m)").fill("10000");
  await page.getByLabel("Ombor soni").fill("10");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.getByText(product, { exact: true })).toBeVisible();
  await nav(page, "Savdo markazi");
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: product, exact: true }) })
    .click();
  await page.getByRole("button", { name: product + " ko‘paytirish" }).click();
  await page.getByLabel("Mijoz").selectOption({ label: name });
  await page.getByRole("button", { name: "Qarz", exact: true }).click();
  await page.getByRole("button", { name: "Savdoni yakunlash" }).click();
  await expect(
    page.getByRole("heading", { name: "Savdo cheki" }),
  ).toBeVisible();
  await expect(page.locator(".receipt-total")).toContainText("20");
  await page.getByRole("button", { name: "Yopish", exact: true }).click();
  await nav(page, "Mahsulotlar");
  let row = page.getByRole("row").filter({ hasText: product });
  await expect(row).toContainText("8 dona");
  await nav(page, "Qarz daftari");
  row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "To‘lash", exact: true }).click();
  await page.getByLabel("To‘lov summasi (so‘m)").fill("7000");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(row).toContainText("Qisman to‘langan");
  await expect(row).toContainText(/13\s*000/);
  await row.getByRole("button", { name: "To‘lash", exact: true }).click();
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(row).toContainText("Yopilgan");
  await expect(
    row.getByRole("button", { name: "To‘lash", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText(
    "Yopilgan",
  );
  await nav(page, "Hisobotlar");
  await expect(
    page.getByRole("heading", { name: "Hisobotlar va analitika" }),
  ).toBeVisible();
  await expect(page.locator(".stat-card").first()).not.toContainText("NaN");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("savdo-hisoboti.csv");
  expect(errors).toEqual([]);
});
test("dark mode, search, modal keyboard and mobile overflow", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Mavzuni almashtirish" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Tezkor qidiruv" }).click();
  await page.getByLabel("Global qidiruv").fill("Javohir");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Javohir/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Javohir Abdullayev" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yangi mijoz" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation", { name: "Mobil navigatsiya" })
    .getByRole("button", { name: "Bosh sahifa" })
    .click();
  await expect(page.getByRole("heading", { name: /Xayrli kun/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "docs/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Mavzuni almashtirish" }).click();
  await page.screenshot({ path: "docs/dashboard.png", fullPage: true });
});
test("inventory adjustment, atomic CSV import, sale reversal and Excel export", async ({
  page,
}) => {
  await demo(page);
  await nav(page, "Mahsulotlar");
  const row = page.getByRole("row").filter({ hasText: "UN-001" });
  const before = Number(
    (await row.locator(".stock-badge").textContent())!.split(" ")[0],
  );
  await row
    .getByRole("button", { name: "Inventarizatsiya", exact: true })
    .click();
  await page.getByLabel("O‘zgarish (+ kirim / − chiqim)").fill("5");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(row).toContainText(`${before + 5} dona`);
  const sku = "IMPORT-" + Date.now();
  await page.locator("input[type=file]").setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name,category,sku,cost,price,stock,lowStock,image\nImport mahsulot,Test," +
        sku +
        ",5000,8000,12,3,\n",
    ),
  });
  await expect(page.getByRole("row").filter({ hasText: sku })).toContainText(
    "12 dona",
  );
  await nav(page, "Savdo markazi");
  await page.getByRole("button", { name: "Savdo tarixi" }).click();
  const saleRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: "Savdoni qaytarish" }) })
    .first();
  await saleRow.getByRole("button", { name: "Savdoni qaytarish" }).click();
  await page.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect(page.locator("tbody .badge.reversed").first()).toBeVisible();
  await nav(page, "Hisobotlar");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("savdo-hisoboti.xlsx");
  await nav(page, "Sozlamalar");
  await page.getByLabel("Do‘kon nomi").fill("E2E Baraka Market");
  await page.getByRole("button", { name: "O‘zgarishlarni saqlash" }).click();
  await page.reload();
  await expect(page.getByLabel("Do‘kon nomi")).toHaveValue("E2E Baraka Market");
});
test("Telegram SDK adapter: theme, Back/Main buttons and touch layout", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as any).__tgCalls = calls;
    const make = (name: string) => ({
      show: () => calls.push(name + ":show"),
      hide: () => calls.push(name + ":hide"),
      onClick: () => {},
      offClick: () => {},
      setText: (t: string) => calls.push(name + ":" + t),
    });
    (window as any).Telegram = {
      WebApp: {
        initData: "",
        colorScheme: "dark",
        themeParams: {},
        ready: () => calls.push("ready"),
        expand: () => calls.push("expand"),
        onEvent: () => {},
        offEvent: () => {},
        BackButton: make("back"),
        MainButton: make("main"),
        HapticFeedback: { impactOccurred: () => calls.push("haptic") },
      },
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mini");
  await page.getByRole("button", { name: "Demo bilan tanishish" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("navigation", { name: "Mobil navigatsiya" })
    .getByRole("button", { name: "Savdo markazi" })
    .click();
  await page.locator(".pos-product").first().click();
  const calls = await page.evaluate(
    () => (window as any).__tgCalls as string[],
  );
  expect(calls).toContain("ready");
  expect(calls).toContain("expand");
  expect(calls).toContain("back:show");
  expect(calls).toContain("main:show");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const hash of [
      "dashboard",
      "debts",
      "customers",
      "sales",
      "products",
      "reports",
      "settings",
    ]) {
      await page.evaluate((h) => {
        location.hash = h;
      }, hash);
      await page.waitForTimeout(250);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${hash} at ${width}`,
      ).toBe(true);
    }
  }
});
