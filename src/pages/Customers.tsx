import { useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  Phone,
  MapPin,
  Pencil,
  Wallet,
} from "lucide-react";
import { useStore } from "../store";
import { customerDebt, money, displayDate } from "../lib";
import {
  PageHeading,
  Button,
  Avatar,
  Empty,
  Modal,
  Badge,
} from "../components/ui";
import type { DialogState } from "../types";
export function Customers({
  open,
  initialSearch = "",
}: {
  open: (d: DialogState) => void;
  initialSearch?: string;
}) {
  const { data } = useStore();
  const s = data!;
  const [query, setQuery] = useState(initialSearch),
    [filter, setFilter] = useState("all"),
    [profile, setProfile] = useState<string | null>(null);
  const c = s.customers.find((c) => c.id === profile);
  const rows = s.customers.filter(
    (c) =>
      `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || customerDebt(c.id, s) > 0),
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow="MUNOSABATLAR — BIZNES ASOSI"
        title="Mijozlar"
        description={`${s.customers.length} mijoz. Har biri uchun alohida e’tibor.`}
        actions={
          <Button onClick={() => open({ kind: "customer" })}>
            <Plus size={18} />
            Yangi mijoz
          </Button>
        }
      />
      <div className="toolbar standalone">
        <div className="tabs">
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            Barcha mijozlar
          </button>
          <button
            className={filter === "debt" ? "selected" : ""}
            onClick={() => setFilter("debt")}
          >
            Qarzdorlar
          </button>
        </div>
        <div className="search-input">
          <Search size={17} />
          <input
            placeholder="Ism yoki telefon…"
            aria-label="Mijozlarni qidirish"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="customer-grid">
        {rows.map((c, i) => {
          const sales = s.sales.filter(
            (x) => x.customerId === c.id && x.status === "completed",
          );
          return (
            <button
              className="customer-card"
              key={c.id}
              onClick={() => setProfile(c.id)}
            >
              <div className="customer-top">
                <Avatar name={c.name} index={i} />
                <ArrowUpRight size={19} />
              </div>
              <h3>{c.name}</h3>
              <span className="customer-phone">
                <Phone size={13} />
                {c.phone}
              </span>
              <div className="customer-card-divider" />
              <div className="customer-numbers">
                <div>
                  <small>Jami xarid</small>
                  <strong>
                    {money(sales.reduce((n, x) => n + x.total, 0))}
                    <span> so‘m</span>
                  </strong>
                </div>
                <div>
                  <small>Qarz qoldig‘i</small>
                  <strong
                    className={customerDebt(c.id, s) > 0 ? "amber-text" : ""}
                  >
                    {money(customerDebt(c.id, s))}
                    <span> so‘m</span>
                  </strong>
                </div>
              </div>
              <div className="customer-card-bottom">
                <span>{sales.length} ta xarid</span>
                <span>Profilni ochish →</span>
              </div>
            </button>
          );
        })}
      </div>
      {!rows.length && (
        <Empty
          title="Mijozlar topilmadi"
          action={
            <Button onClick={() => open({ kind: "customer" })}>
              Mijoz qo‘shish
            </Button>
          }
        />
      )}
      {c && (
        <Modal wide title="Mijoz profili" onClose={() => setProfile(null)}>
          <div className="profile-hero">
            <Avatar name={c.name} />
            <div>
              <h2>{c.name}</h2>
              <p>
                <Phone size={14} />
                {c.phone}
              </p>
              <p>
                <MapPin size={14} />
                {c.address || "Manzil kiritilmagan"}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setProfile(null);
                open({ kind: "editCustomer", id: c.id });
              }}
            >
              <Pencil size={16} />
              Tahrirlash
            </Button>
          </div>
          <div className="profile-stats">
            <div>
              <small>Jami xaridlar</small>
              <strong>
                {money(
                  s.sales
                    .filter(
                      (x) => x.customerId === c.id && x.status === "completed",
                    )
                    .reduce((n, x) => n + x.total, 0),
                )}{" "}
                so‘m
              </strong>
            </div>
            <div>
              <small>Qarz qoldig‘i</small>
              <strong className="amber-text">
                {money(customerDebt(c.id, s))} so‘m
              </strong>
            </div>
            <div>
              <small>Mijoz bo‘lgan sana</small>
              <strong>{displayDate(c.createdAt)}</strong>
            </div>
          </div>
          <p className="detail-note">{c.notes || "Izoh kiritilmagan"}</p>
          <h3 className="section-label">Faoliyat tarixi</h3>
          <div className="timeline">
            {[
              ...s.sales
                .filter((x) => x.customerId === c.id)
                .map((x) => ({
                  id: x.id,
                  createdAt: x.createdAt,
                  title: "Savdo",
                  amount: x.total,
                  status: x.status,
                })),
              ...s.debt_repayments
                .filter(
                  (r) =>
                    s.debts.find((d) => d.id === r.debtId)?.customerId === c.id,
                )
                .map((x) => ({
                  id: x.id,
                  createdAt: x.createdAt,
                  title:
                    x.kind === "refund" ? "To‘lov qaytarildi" : "Qarz to‘lovi",
                  amount: x.amount,
                  status: "paid",
                })),
              ...s.debts
                .filter((d) => d.customerId === c.id && !d.saleId)
                .map((d) => ({
                  id: d.id,
                  createdAt: d.createdAt,
                  title: "Qarz berildi",
                  amount: d.amount,
                  status: "active",
                })),
            ]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((x) => (
                <div className="timeline-row" key={x.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{x.title}</strong>
                    <small>{displayDate(x.createdAt)}</small>
                  </div>
                  <b>{money(x.amount)} so‘m</b>
                  <Badge value={x.status} />
                </div>
              ))}
          </div>
          <div className="modal-footer">
            <Button
              onClick={() => {
                setProfile(null);
                open({ kind: "debt", customerId: c.id });
              }}
            >
              <Wallet size={17} />
              Qarz qo‘shish
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
