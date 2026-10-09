import { useState } from "react";
import {
  Plus,
  Search,
  Wallet,
  Clock,
  CheckCircle2,
  ArrowDownLeft,
  Bell,
  History,
  Pencil,
  LoaderCircle,
} from "lucide-react";
import { useStore } from "../store";
import {
  remaining,
  status,
  money,
  displayDate,
  metrics,
  methodLabel,
} from "../lib";
import {
  PageHeading,
  Button,
  StatCard,
  Badge,
  Avatar,
  Empty,
  Modal,
  ErrorMessage,
} from "../components/ui";
import type { DialogState } from "../types";
export function Debts({
  open,
  initialSearch = "",
}: {
  open: (d: DialogState) => void;
  initialSearch?: string;
}) {
  const { data, mutate } = useStore();
  const s = data!;
  const [query, setQuery] = useState(initialSearch),
    [filter, setFilter] = useState("all"),
    [detail, setDetail] = useState<string | null>(null),
    [sending, setSending] = useState(""),
    [error, setError] = useState("");
  const m = metrics(s);
  const rows = s.debts.filter(
    (d) =>
      (filter === "all" || status(d, s) === filter) &&
      `${s.customers.find((c) => c.id === d.customerId)?.name} ${d.notes}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const debt = s.debts.find((d) => d.id === detail);
  async function remind(id: string) {
    setSending(id);
    setError("");
    try {
      const n = await mutate<{ status: string }>(
        `/debts/${id}/remind`,
        "POST",
        {},
        "Eslatma qayd etildi",
      );
      if (n.status === "failed")
        setError(
          "Telegram xabari yuborilmadi. Mijoz IDsi va bot sozlamalarini tekshiring.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending("");
    }
  }
  return (
    <div className="page">
      <PageHeading
        eyebrow="MOLIYAVIY XOTIRJAMLIK"
        title="Qarz daftari"
        description="Har bir qarz, har bir to‘lov — aniq va shaffof."
        actions={
          <Button onClick={() => open({ kind: "debt" })}>
            <Plus size={18} />
            Yangi qarz
          </Button>
        }
      />
      <div className="stats-grid">
        <StatCard
          title="Jami qoldiq"
          value={m.debt}
          subtitle="Barcha faol qarzlar"
          icon={<Wallet size={19} />}
          accent="amber"
        />
        <StatCard
          title="Qaytarilgan"
          value={m.collected}
          subtitle="Saqlangan to‘lovlar asosida"
          icon={<ArrowDownLeft size={19} />}
        />
        <StatCard
          title="Muddati o‘tgan"
          value={m.overdue}
          subtitle="Eslatma yuborish tavsiya etiladi"
          icon={<Clock size={19} />}
          accent="rose"
        />
        <StatCard
          title="Yopilgan qarzlar"
          value={String(s.debts.filter((d) => status(d, s) === "paid").length)}
          subtitle="To‘liq hisob-kitob qilingan"
          icon={<CheckCircle2 size={19} />}
          accent="violet"
        />
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            {[
              ["all", "Barchasi"],
              ["active", "Faol"],
              ["partial", "Qisman"],
              ["overdue", "Muddati o‘tgan"],
              ["paid", "Yopilgan"],
            ].map(([k, v]) => (
              <button
                key={k}
                className={filter === k ? "selected" : ""}
                onClick={() => setFilter(k)}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Qarzlarni qidirish"
              placeholder="Mijoz yoki izohni qidirish…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <ErrorMessage message={error} />
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mijoz</th>
                  <th>Qarz summasi</th>
                  <th>Qoldiq</th>
                  <th>To‘lov muddati</th>
                  <th>Holat</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d, i) => {
                  const c = s.customers.find((c) => c.id === d.customerId)!;
                  return (
                    <tr key={d.id}>
                      <td>
                        <button
                          className="person plain-button"
                          onClick={() => setDetail(d.id)}
                        >
                          <Avatar name={c.name} index={i} />
                          <div>
                            <strong>{c.name}</strong>
                            <small>{d.notes || c.phone}</small>
                          </div>
                        </button>
                      </td>
                      <td>
                        {money(d.amount)} <span className="unit">so‘m</span>
                      </td>
                      <td className="bold">
                        {money(remaining(d, s))}{" "}
                        <span className="unit">so‘m</span>
                      </td>
                      <td
                        className={
                          status(d, s) === "overdue" ? "danger-text" : ""
                        }
                      >
                        {displayDate(d.dueDate)}
                      </td>
                      <td>
                        <Badge value={status(d, s)} />
                      </td>
                      <td>
                        <div className="row-actions">
                          {remaining(d, s) > 0 && (
                            <>
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  open({ kind: "repay", id: d.id })
                                }
                              >
                                To‘lash
                              </Button>
                              <button
                                className="icon-button"
                                title="Eslatma yuborish"
                                aria-label={`${c.name} uchun eslatma`}
                                disabled={sending === d.id}
                                onClick={() => remind(d.id)}
                              >
                                {sending === d.id ? (
                                  <LoaderCircle size={17} className="spin" />
                                ) : (
                                  <Bell size={17} />
                                )}
                              </button>
                            </>
                          )}
                          <button
                            className="icon-button"
                            aria-label="Qarz tarixi"
                            onClick={() => setDetail(d.id)}
                          >
                            <History size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Qarzlar topilmadi"
            description="Filtrni o‘zgartiring yoki yangi qarz kiriting."
          />
        )}
        <div className="table-footer">
          {rows.length} ta yozuv · To‘lovlar o‘chirilmaydi, tarixda saqlanadi.
        </div>
      </section>
      {debt && (
        <Modal
          title="Qarz tafsilotlari"
          description={s.customers.find((c) => c.id === debt.customerId)?.name}
          onClose={() => setDetail(null)}
        >
          <div className="detail-summary">
            <div>
              <small>Dastlabki qarz</small>
              <strong>{money(debt.amount)} so‘m</strong>
            </div>
            <div>
              <small>Qoldiq</small>
              <strong>{money(remaining(debt, s))} so‘m</strong>
            </div>
            <Badge value={status(debt, s)} />
          </div>
          <p className="detail-note">
            {debt.notes} · Muddat: {debt.dueDate}
          </p>
          <h3 className="section-label">To‘lovlar tarixi</h3>
          <div className="timeline">
            {s.debt_repayments
              .filter((r) => r.debtId === debt.id)
              .map((r) => (
                <div className="timeline-row" key={r.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>
                      {r.kind === "refund"
                        ? "Qaytarildi"
                        : "To‘lov qabul qilindi"}
                    </strong>
                    <small>
                      {displayDate(r.createdAt)} · {methodLabel[r.method]}
                    </small>
                  </div>
                  <b>{money(r.amount)} so‘m</b>
                </div>
              ))}
            {!s.debt_repayments.some((r) => r.debtId === debt.id) && (
              <Empty
                title="To‘lov hali yo‘q"
                description="Birinchi to‘lov shu yerda aks etadi."
              />
            )}
          </div>
          <div className="modal-footer">
            {!debt.saleId && !debt.reversedAt && (
              <Button
                variant="secondary"
                onClick={() => {
                  setDetail(null);
                  open({ kind: "editDebt", id: debt.id });
                }}
              >
                <Pencil size={16} />
                Tahrirlash
              </Button>
            )}
            {remaining(debt, s) > 0 && (
              <Button
                onClick={() => {
                  setDetail(null);
                  open({ kind: "repay", id: debt.id });
                }}
              >
                To‘lov qo‘shish
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
