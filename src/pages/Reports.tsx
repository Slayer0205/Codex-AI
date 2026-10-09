import { useState } from "react";
import {
  Download,
  Printer,
  Plus,
  TrendingUp,
  Wallet,
  ArrowDownLeft,
  ShoppingBag,
} from "lucide-react";
import { useStore } from "../store";
import {
  day,
  metrics,
  money,
  trends,
  exportCSV,
  exportExcel,
  customerDebt,
  remaining,
  status,
  statusLabel,
} from "../lib";
import {
  PageHeading,
  Button,
  StatCard,
  Avatar,
  Empty,
  ErrorMessage,
} from "../components/ui";
import { SalesChart, ProfitChart } from "../components/Charts";
import type { DialogState } from "../types";
export function Reports({ open }: { open: (d: DialogState) => void }) {
  const { data, notify } = useStore();
  const s = data!;
  const [from, setFrom] = useState(day(new Date(Date.now() - 29 * 86400000))),
    [to, setTo] = useState(day()),
    [exporting, setExporting] = useState(false),
    [error, setError] = useState("");
  const [reportType, setReportType] = useState("sales");
  const m = metrics(s, from, to);
  const valid = from <= to;
  const salesSet = new Set(m.sales.map((x) => x.id));
  const top = s.products
    .map((p) => ({
      ...p,
      quantity: s.sale_items
        .filter((i) => i.productId === p.id && salesSet.has(i.saleId))
        .reduce((n, i) => n + i.quantity, 0),
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .filter((p) => p.quantity > 0)
    .slice(0, 5);
  const trend = trends(s, 30).filter((_v, i) => {
    const d = day(new Date(Date.now() - (29 - i) * 86400000));
    return d >= from && d <= to;
  });
  const salesRows = m.sales.map((x) => ({
    Chek: x.id,
    Sana: day(new Date(x.createdAt)),
    Mijoz: s.customers.find((c) => c.id === x.customerId)?.name || "Naqd savdo",
    "Savdo (UZS)": x.total / 100,
    "Tannarx (UZS)": x.cost / 100,
    "Marja (UZS)": (x.total - x.cost) / 100,
  }));
  const debtRows = s.debts
    .filter(
      (d) =>
        day(new Date(d.createdAt)) >= from && day(new Date(d.createdAt)) <= to,
    )
    .map((d) => ({
      Mijoz: s.customers.find((c) => c.id === d.customerId)?.name || "",
      "Berilgan sana": day(new Date(d.createdAt)),
      Muddat: d.dueDate,
      "Qarz (UZS)": d.amount / 100,
      "Joriy qoldiq (UZS)": remaining(d, s) / 100,
      Holat: statusLabel[status(d, s)],
    }));
  const expenseRows = s.expenses
    .filter(
      (x) =>
        day(new Date(x.createdAt)) >= from && day(new Date(x.createdAt)) <= to,
    )
    .map((x) => ({
      Nomi: x.name,
      Kategoriya: x.category,
      Sana: day(new Date(x.createdAt)),
      "Summa (UZS)": x.amount / 100,
    }));
  const inventoryRows = s.products.map((p) => ({
    Mahsulot: p.name,
    SKU: p.sku,
    Kategoriya: p.category,
    "Joriy qoldiq": p.stock,
    "Tannarx (UZS)": p.cost / 100,
    "Narx (UZS)": p.price / 100,
  }));
  const reportRows: Record<string, unknown>[] =
    reportType === "sales"
      ? salesRows
      : reportType === "debts"
        ? debtRows
        : reportType === "expenses"
          ? expenseRows
          : inventoryRows;
  const fileName =
    reportType === "sales" ? "savdo-hisoboti" : reportType + "-hisoboti";
  const excel = async () => {
    setExporting(true);
    setError("");
    try {
      await exportExcel(reportRows, fileName);
      notify("Excel hisoboti yuklandi");
    } catch {
      setError("Excel eksporti bajarilmadi");
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="page print-target report-page">
      <PageHeading
        eyebrow="RAQAMLARDAN TO‘G‘RI QARORLARGA"
        title="Hisobotlar va analitika"
        description="Daromad, xarajat va foyda — aniq ma’lumotlar asosida."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={!valid || !reportRows.length}
              onClick={() => exportCSV(reportRows, fileName)}
            >
              <Download size={16} />
              CSV
            </Button>
            <Button
              variant="secondary"
              disabled={exporting || !valid}
              onClick={excel}
            >
              Excel
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              PDF / Print
            </Button>
            <Button onClick={() => open({ kind: "expense" })}>
              <Plus size={17} />
              Xarajat
            </Button>
          </>
        }
      />
      <div className="report-filters">
        <label className="field">
          <span>Boshlanish</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <span>—</span>
        <label className="field">
          <span>Tugash</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="field export-type">
          <span>Eksport turi</span>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="sales">Savdo</option>
            <option value="debts">Qarzlar (joriy qoldiq)</option>
            <option value="expenses">Xarajatlar</option>
            <option value="inventory">Ombor (joriy holat)</option>
          </select>
        </label>
        <div className="period-buttons">
          {[
            [0, "Bugun"],
            [6, "Hafta"],
            [29, "Oy"],
          ].map(([n, t]) => (
            <button
              key={String(t)}
              onClick={() => {
                setFrom(day(new Date(Date.now() - Number(n) * 86400000)));
                setTo(day());
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <ErrorMessage
        message={
          !valid
            ? "Boshlanish sanasi tugash sanasidan keyin bo‘la olmaydi"
            : error
        }
      />
      <div className="stats-grid">
        <StatCard
          title="Savdo tushumi"
          value={m.revenue}
          subtitle={`${m.sales.length} ta savdo`}
          icon={<ShoppingBag size={19} />}
        />
        <StatCard
          title="Xarajatlar"
          value={m.expenses}
          subtitle="Tannarxdan tashqari xarajatlar"
          icon={<Wallet size={19} />}
          accent="amber"
        />
        <StatCard
          title="Sof foyda / zarar"
          value={m.profit}
          subtitle="Savdo − tannarx − xarajat"
          icon={<TrendingUp size={19} />}
          accent="violet"
        />
        <StatCard
          title="Qarz to‘lovlari"
          value={m.collected}
          subtitle="Tanlangan davr ichida"
          icon={<ArrowDownLeft size={19} />}
          accent="blue"
        />
      </div>
      <div className="report-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Daromad va xarajatlar</h2>
              <p>Grafikda oxirgi 30 kun; statistikada tanlangan davr</p>
            </div>
            <div className="legend-pair">
              <span>
                <i />
                Savdo
              </span>
              <span>
                <i />
                Xarajat
              </span>
            </div>
          </div>
          <SalesChart data={trend} comparison />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Sof foyda dinamikasi</h2>
              <p>Hisoblangan marja va operatsion xarajatlar</p>
            </div>
          </div>
          <ProfitChart data={trend} />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Eng ko‘p sotilgan mahsulotlar</h2>
              <p>Tanlangan davr bo‘yicha</p>
            </div>
          </div>
          <div className="ranking-list">
            {top.map((p, i) => (
              <div className="rank-row" key={p.id}>
                <span className="rank-number">0{i + 1}</span>
                <div>
                  <strong>{p.name}</strong>
                  <div className="rank-track">
                    <span
                      style={{
                        width: `${(p.quantity / top[0].quantity) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <b>
                  {p.quantity} <small>dona</small>
                </b>
              </div>
            ))}
            {!top.length && <Empty />}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Eng faol mijozlar</h2>
              <p>Xarid va qarz qoldig‘i</p>
            </div>
          </div>
          <div className="ranking-list">
            {s.customers
              .map((c) => ({
                ...c,
                total: m.sales
                  .filter((x) => x.customerId === c.id)
                  .reduce((n, x) => n + x.total, 0),
              }))
              .sort((a, b) => b.total - a.total)
              .slice(0, 5)
              .map((c, i) => (
                <div className="rank-row" key={c.id}>
                  <Avatar name={c.name} index={i} />
                  <div>
                    <strong>{c.name}</strong>
                    <small>Qarz: {money(customerDebt(c.id, s))} so‘m</small>
                  </div>
                  <b>
                    {money(c.total)} <small>so‘m</small>
                  </b>
                </div>
              ))}
          </div>
        </section>
      </div>
      <section className="panel expense-panel">
        <div className="panel-heading">
          <div>
            <h2>Xarajatlar tarixi</h2>
            <p>Audit uchun saqlanadigan yozuvlar</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Kategoriya</th>
                <th>Sana</th>
                <th>Summa</th>
              </tr>
            </thead>
            <tbody>
              {s.expenses
                .filter(
                  (x) =>
                    day(new Date(x.createdAt)) >= from &&
                    day(new Date(x.createdAt)) <= to,
                )
                .map((x) => (
                  <tr key={x.id}>
                    <td className="bold">{x.name}</td>
                    <td>{x.category}</td>
                    <td>{day(new Date(x.createdAt))}</td>
                    <td>{money(x.amount)} so‘m</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
