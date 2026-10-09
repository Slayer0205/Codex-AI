import { useState } from "react";
import {
  ArrowUpRight,
  Plus,
  Wallet,
  TrendingUp,
  Users,
  ArrowDownLeft,
  ArrowRight,
  ShoppingBag,
  Package,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { useStore } from "../store";
import {
  metrics,
  money,
  day,
  fullDate,
  trends,
  remaining,
  status,
  displayDate,
  methodLabel,
  customerDebt,
} from "../lib";
import {
  StatCard,
  PageHeading,
  Button,
  Avatar,
  Badge,
  TextLink,
  Empty,
} from "../components/ui";
import { SalesChart } from "../components/Charts";
import type { DialogState, Page } from "../types";
export function Dashboard({
  navigate,
  open,
}: {
  navigate: (p: Page) => void;
  open: (d: DialogState) => void;
}) {
  const { data, session } = useStore();
  const s = data!;
  const [range, setRange] = useState(14);
  const all = metrics(s),
    today = metrics(s, day(), day());
  const week = metrics(s, day(new Date(Date.now() - 6 * 86400000)), day());
  const month = metrics(s, day().slice(0, 7) + "-01", day());
  const chart = trends(s, range);
  const urgent = s.debts
    .filter((d) => remaining(d, s) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const totalPrincipal = s.debts
      .filter((d) => !d.reversedAt)
      .reduce((n, d) => n + d.amount, 0),
    paid = totalPrincipal - all.debt;
  const percent = totalPrincipal
    ? Math.round((paid / totalPrincipal) * 100)
    : 0;
  return (
    <div className="page">
      <PageHeading
        eyebrow="BIZNESINGIZ BIR QARASHDA"
        title={`Xayrli kun, ${session?.name.split(" ")[0]} 👋`}
        description="Bugungi natijalar va yangi imkoniyatlar — hammasi shu yerda."
        actions={
          <>
            <div className="date-pill">
              <CalendarDays size={16} />
              {fullDate(new Date().toISOString())}
            </div>
            <Button onClick={() => navigate("sales")}>
              <Plus size={18} />
              Yangi savdo
            </Button>
          </>
        }
      />
      <div className="overview-banner">
        <div className="banner-mark">
          <TrendingUp size={23} />
        </div>
        <div>
          <strong>Har bir savdo — o‘sish sari qadam.</strong>
          <p>Hisob-kitoblar aniq. Biznesingiz nazoratda.</p>
        </div>
        <button onClick={() => navigate("reports")}>
          Hisobotni ko‘rish <ArrowUpRight size={18} />
        </button>
        <span className="banner-orbit" />
      </div>
      <div className="stats-grid">
        <StatCard
          title="Bugungi savdo"
          value={today.revenue}
          subtitle={`${today.sales.length} ta yakunlangan savdo`}
          icon={<ShoppingBag size={19} />}
        />
        <StatCard
          title="Umumiy qarzdorlik"
          value={all.debt}
          subtitle={`${s.debts.filter((d) => remaining(d, s) > 0).length} ta faol qarz`}
          icon={<Wallet size={19} />}
          accent="amber"
        />
        <StatCard
          title="Sof foyda"
          value={month.profit}
          subtitle="Joriy oy · tannarx va xarajatdan so‘ng"
          icon={<TrendingUp size={19} />}
          accent="violet"
        />
        <StatCard
          title="Jami mijozlar"
          value={String(s.customers.length)}
          subtitle="Biznesingizning eng katta boyligi"
          icon={<Users size={19} />}
          accent="blue"
        />
      </div>
      <div className="dashboard-main">
        <section className="panel sales-panel">
          <div className="panel-heading">
            <div>
              <h2>Savdo dinamikasi</h2>
              <p>Biznesingiz qanday o‘sayotganini kuzating</p>
            </div>
            <div className="select-inline">
              <select
                aria-label="Grafik davri"
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
              >
                <option value={7}>Oxirgi 7 kun</option>
                <option value={14}>Oxirgi 14 kun</option>
                <option value={30}>Oxirgi 30 kun</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>
          <div className="chart-summary">
            <strong>
              {money(chart.reduce((n, v) => n + v.revenue * 100, 0))}
              <span>so‘m</span>
            </strong>
            <span className="chart-legend">
              <i />
              Savdo tushumi
            </span>
          </div>
          <SalesChart data={chart} />
          <div className="chart-footer">
            <span>
              <i className="small-dot" />
              Tranzaksiyalar asosida yangilanadi
            </span>
            <TextLink onClick={() => navigate("reports")}>
              Batafsil hisobot
            </TextLink>
          </div>
        </section>
        <section className="collection-card">
          <div className="collection-top">
            <span className="collection-icon">
              <ArrowDownLeft size={22} />
            </span>
            <span>QARZ NAZORATI</span>
            <ArrowUpRight size={20} />
          </div>
          <h2>
            Qaytgan mablag‘lar.
            <br />
            Yangi imkoniyatlar.
          </h2>
          <div className="collection-value">
            {money(paid)}
            <span>so‘m qaytarildi</span>
          </div>
          <div className="collection-progress">
            <div style={{ width: `${percent}%` }} />
          </div>
          <div className="collection-caption">
            <span>Qarzlarning qaytarilishi</span>
            <strong>{percent}%</strong>
          </div>
          <div className="collection-divider" />
          <div className="collection-row">
            <span>Muddati o‘tgan</span>
            <strong>{money(all.overdue)} so‘m</strong>
          </div>
          <Button onClick={() => navigate("debts")}>
            Qarz daftarini ochish
            <ArrowRight size={17} />
          </Button>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Oxirgi savdolar</h2>
              <p>Har bir operatsiya o‘z o‘rnida</p>
            </div>
            <TextLink onClick={() => navigate("sales")}>Barchasi</TextLink>
          </div>
          {s.sales.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mijoz / operatsiya</th>
                    <th>To‘lov</th>
                    <th>Summa</th>
                    <th>Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {s.sales.slice(0, 5).map((sale, i) => (
                    <tr key={sale.id}>
                      <td>
                        <div className="person">
                          <Avatar
                            name={
                              s.customers.find((c) => c.id === sale.customerId)
                                ?.name || "Naqd savdo"
                            }
                            index={i}
                          />
                          <div>
                            <strong>
                              {s.customers.find((c) => c.id === sale.customerId)
                                ?.name || "Naqd savdo"}
                            </strong>
                            <small>
                              #{sale.id.slice(0, 6).toUpperCase()} ·{" "}
                              {displayDate(sale.createdAt)}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="muted">
                          {methodLabel[sale.method]}
                        </span>
                      </td>
                      <td className="amount-cell">
                        {money(sale.total)}
                        <small>so‘m</small>
                      </td>
                      <td>
                        <Badge value={sale.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
        </section>
        <section className="panel payments-panel">
          <div className="panel-heading">
            <div>
              <h2>Yaqin to‘lovlar</h2>
              <p>E’tibordan chetda qolmasin</p>
            </div>
            <span className="count-badge">{urgent.length}</span>
          </div>
          {urgent.map((d, i) => {
            const c = s.customers.find((c) => c.id === d.customerId)!;
            return (
              <button
                className="upcoming-row"
                key={d.id}
                onClick={() => open({ kind: "repay", id: d.id })}
              >
                <Avatar name={c.name} index={i + 2} />
                <div>
                  <strong>{c.name}</strong>
                  <small>
                    {displayDate(d.dueDate)}{" "}
                    <span
                      className={
                        status(d, s) === "overdue" ? "danger-text" : ""
                      }
                    >
                      {status(d, s) === "overdue" ? "· Muddati o‘tgan" : ""}
                    </span>
                  </small>
                </div>
                <b>
                  {money(remaining(d, s))}
                  <small>so‘m</small>
                </b>
              </button>
            );
          })}
          {!urgent.length && (
            <Empty
              title="Barcha qarzlar yopilgan"
              description="To‘lovlar o‘z vaqtida bajarilgan."
            />
          )}
          <div className="panel-bottom">
            <TextLink onClick={() => navigate("debts")}>
              Barcha qarzlarni ko‘rish
            </TextLink>
          </div>
        </section>
      </div>
      <div className="quick-insights">
        <div>
          <TrendingUp size={19} />
          <span>
            Haftalik savdo<strong>{money(week.revenue)} so‘m</strong>
          </span>
        </div>
        <div>
          <Wallet size={19} />
          <span>
            Oylik savdo<strong>{money(month.revenue)} so‘m</strong>
          </span>
        </div>
        <div>
          <Package size={19} />
          <span>
            Ombordagi mahsulotlar
            <strong>{s.products.reduce((n, p) => n + p.stock, 0)} dona</strong>
          </span>
        </div>
        <div>
          <Users size={19} />
          <span>
            Qarzdor mijozlar
            <strong>
              {s.customers.filter((c) => customerDebt(c.id, s) > 0).length}{" "}
              mijoz
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
