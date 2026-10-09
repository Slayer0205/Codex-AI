import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ShoppingCart,
  History,
  Printer,
  RotateCcw,
  LoaderCircle,
  Check,
  Wallet,
  CreditCard,
  Banknote,
} from "lucide-react";
import { useStore } from "../store";
import { money, displayDate, day, methodLabel } from "../lib";
import {
  PageHeading,
  Button,
  Empty,
  Badge,
  Modal,
  ConfirmDialog,
  ErrorMessage,
} from "../components/ui";
import type { Sale, SaleItem } from "../types";
export function Sales() {
  const { data, mutate, session } = useStore();
  const s = data!;
  const [tab, setTab] = useState("pos"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [cart, setCart] = useState<Record<string, number>>({}),
    [customerId, setCustomer] = useState(""),
    [method, setMethod] = useState("cash"),
    [discount, setDiscount] = useState("0"),
    [paid, setPaid] = useState("0"),
    [dueDate, setDue] = useState(
      day(new Date(Date.now() + s.settings.debtDays * 86400000)),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState<(Sale & { items?: SaleItem[] }) | null>(
      null,
    ),
    [reverse, setReverse] = useState<string | null>(null);
  const items = Object.entries(cart).map(([id, q]) => ({
    p: s.products.find((p) => p.id === id)!,
    q,
  }));
  const subtotal = items.reduce((n, x) => n + x.p.price * x.q, 0),
    total = subtotal - Math.round(Number(discount) * 100);
  const categories = [...new Set(s.products.map((p) => p.category))];
  const add = (id: string, delta: number) => {
    const stock = s.products.find((p) => p.id === id)!.stock;
    setCart((c) => {
      const next = {
        ...c,
        [id]: Math.min(stock, Math.max(0, (c[id] || 0) + delta)),
      };
      if (!next[id]) delete next[id];
      return next;
    });
  };
  const checkout = async () => {
    setError("");
    setBusy(true);
    try {
      if (!items.length) throw new Error("Savatga mahsulot qo‘shing");
      const result = await mutate<Sale & { items: SaleItem[] }>(
        "/sales",
        "POST",
        {
          customerId: customerId || undefined,
          items: items.map((x) => ({ productId: x.p.id, quantity: x.q })),
          method,
          discount: Math.round(Number(discount) * 100),
          paid: method === "mixed" ? Math.round(Number(paid) * 100) : undefined,
          dueDate,
        },
        "Savdo yakunlandi. Ombor va qarz yangilandi.",
      );
      setReceipt(result);
      setCart({});
      setDiscount("0");
      setPaid("0");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    const click = () => document.getElementById("checkout-button")?.click();
    if (tab === "pos" && items.length) {
      tg.MainButton.setText("Savdoni yakunlash");
      tg.MainButton.onClick(click);
      tg.MainButton.show();
    }
    return () => {
      tg.MainButton.hide();
      tg.MainButton.offClick(click);
    };
  }, [tab, items.length]);
  return (
    <div className="page">
      <PageHeading
        eyebrow="TEZKOR VA ANIQ"
        title="Savdo markazi"
        description="Mahsulotni tanlang. Savdoni yakunlang. Qolganini biz hisoblaymiz."
        actions={
          <div className="tabs">
            <button
              className={tab === "pos" ? "selected" : ""}
              onClick={() => setTab("pos")}
            >
              <ShoppingCart size={16} />
              Yangi savdo
            </button>
            <button
              className={tab === "history" ? "selected" : ""}
              onClick={() => setTab("history")}
            >
              <History size={16} />
              Savdo tarixi
            </button>
          </div>
        }
      />
      {tab === "pos" ? (
        <div className="pos-layout">
          <section>
            <div className="search-input pos-search">
              <Search size={18} />
              <input
                placeholder="Mahsulot yoki SKU qidirish…"
                aria-label="Savdo mahsulotlarini qidirish"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="category-pills">
              <button
                className={category === "all" ? "selected" : ""}
                onClick={() => setCategory("all")}
              >
                Barchasi
              </button>
              {categories.map((c) => (
                <button
                  className={category === c ? "selected" : ""}
                  key={c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="pos-products">
              {s.products
                .filter(
                  (p) =>
                    (category === "all" || p.category === category) &&
                    `${p.name} ${p.sku}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((p, i) => (
                  <button
                    className="pos-product"
                    key={p.id}
                    disabled={p.stock === 0}
                    onClick={() => add(p.id, 1)}
                  >
                    <div className={`product-visual visual-${i % 5}`}>
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <span>
                          {
                            ["🌾", "🌻", "🍚", "🍵", "🧊", "🥛", "💧", "🧺"][
                              s.products.indexOf(p) % 8
                            ]
                          }
                        </span>
                      )}
                      <span className="product-stock">{p.stock} dona</span>
                    </div>
                    <small>{p.category}</small>
                    <h3>{p.name}</h3>
                    <div className="product-price">
                      <strong>
                        {money(p.price)} <span>so‘m</span>
                      </strong>
                      <span className="add-circle">
                        <Plus size={16} />
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </section>
          <aside className="panel cart-panel">
            <div className="panel-heading">
              <div>
                <h2>Savdo savati</h2>
                <p>{items.length} turdagi mahsulot</p>
              </div>
              <ShoppingBag size={21} />
            </div>
            <div className="cart-items">
              {items.map(({ p, q }) => (
                <div className="cart-item" key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <small>{money(p.price)} so‘m / dona</small>
                  </div>
                  <button
                    aria-label={`${p.name} savatdan o‘chirish`}
                    className="icon-button"
                    onClick={() =>
                      setCart((c) => {
                        const n = { ...c };
                        delete n[p.id];
                        return n;
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                  <div className="quantity-control">
                    <button
                      aria-label={`${p.name} kamaytirish`}
                      onClick={() => add(p.id, -1)}
                    >
                      <Minus size={13} />
                    </button>
                    <b>{q}</b>
                    <button
                      aria-label={`${p.name} ko‘paytirish`}
                      onClick={() => add(p.id, 1)}
                      disabled={q >= p.stock}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <strong>{money(p.price * q)} so‘m</strong>
                </div>
              ))}
              {!items.length && (
                <Empty
                  title="Savat bo‘sh"
                  description="Mahsulot ustiga bosib savatga qo‘shing."
                />
              )}
            </div>
            <div className="cart-form">
              <label className="field">
                <span>
                  Mijoz{" "}
                  {method === "debt" || method === "mixed"
                    ? "*"
                    : "(ixtiyoriy)"}
                </span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomer(e.target.value)}
                >
                  <option value="">Mijozni tanlang</option>
                  {s.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="payment-methods">
                {[
                  ["cash", "Naqd", Banknote],
                  ["card", "Karta", CreditCard],
                  ["debt", "Qarz", Wallet],
                  ["mixed", "Aralash", ShoppingBag],
                ].map(([value, label, Icon]) => {
                  const I = Icon as typeof Wallet;
                  return (
                    <button
                      key={String(value)}
                      className={method === value ? "selected" : ""}
                      onClick={() => setMethod(String(value))}
                    >
                      <I size={18} />
                      {String(label)}
                    </button>
                  );
                })}
              </div>
              <label className="field">
                <span>Chegirma (so‘m)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </label>
              {method === "mixed" && (
                <label className="field">
                  <span>Naqd to‘langan qism (so‘m)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paid}
                    onChange={(e) => setPaid(e.target.value)}
                  />
                </label>
              )}
              {(method === "debt" || method === "mixed") && (
                <label className="field">
                  <span>Qarz to‘lov muddati</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
              )}
              <div className="cart-total">
                <span>Jami to‘lov</span>
                <strong>
                  {money(Math.max(0, total))}
                  <small> so‘m</small>
                </strong>
              </div>
              <ErrorMessage message={error} />
              <Button
                id="checkout-button"
                className="full-width"
                disabled={busy || !items.length || session?.role === "viewer"}
                onClick={checkout}
              >
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Check size={18} />
                )}
                Savdoni yakunlash
              </Button>
              <p className="cart-note">
                Savdo, ombor va qarz bir vaqtda yangilanadi.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Chek</th>
                  <th>Mijoz</th>
                  <th>Sana</th>
                  <th>To‘lov</th>
                  <th>Summa</th>
                  <th>Holat</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {s.sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="bold">
                      #{sale.id.slice(0, 6).toUpperCase()}
                    </td>
                    <td>
                      {s.customers.find((c) => c.id === sale.customerId)
                        ?.name || "Naqd savdo"}
                    </td>
                    <td>{displayDate(sale.createdAt)}</td>
                    <td>{methodLabel[sale.method]}</td>
                    <td className="bold">{money(sale.total)} so‘m</td>
                    <td>
                      <Badge value={sale.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label="Chekni ochish"
                          onClick={() => setReceipt(sale)}
                        >
                          <Printer size={17} />
                        </button>
                        {sale.status === "completed" &&
                          ["admin", "manager"].includes(s.role) && (
                            <button
                              className="icon-button"
                              aria-label="Savdoni qaytarish"
                              onClick={() => setReverse(sale.id)}
                            >
                              <RotateCcw size={17} />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!s.sales.length && <Empty />}
        </section>
      )}
      {receipt && (
        <Modal title="Savdo cheki" onClose={() => setReceipt(null)}>
          <div className="receipt print-target">
            <div className="receipt-logo">
              S<span>↗</span>
            </div>
            <h2>{s.settings.storeName}</h2>
            <p>Smart Savdo · #{receipt.id.slice(0, 8).toUpperCase()}</p>
            <p>{new Date(receipt.createdAt).toLocaleString("uz-UZ")}</p>
            <div className="receipt-divider" />
            {(
              receipt.items ||
              s.sale_items.filter((i) => i.saleId === receipt.id)
            ).map((i) => (
              <div className="receipt-line" key={i.id}>
                <span>
                  {i.name}
                  <small>
                    {i.quantity} × {money(i.price)}
                  </small>
                </span>
                <strong>{money(i.quantity * i.price)}</strong>
              </div>
            ))}
            <div className="receipt-divider" />
            <div className="receipt-line">
              <span>Chegirma</span>
              <span>{money(receipt.discount)} so‘m</span>
            </div>
            <div className="receipt-line receipt-total">
              <strong>JAMI</strong>
              <strong>{money(receipt.total)} so‘m</strong>
            </div>
            <p>
              {methodLabel[receipt.method]} ·{" "}
              {receipt.status === "reversed" ? "Qaytarilgan" : "Yakunlangan"}
            </p>
            <p>Xaridingiz uchun rahmat!</p>
          </div>
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setReceipt(null)}>
              Yopish
            </Button>
            <Button onClick={() => window.print()}>
              <Printer size={17} />
              Chop etish / PDF
            </Button>
          </div>
        </Modal>
      )}
      {reverse && (
        <ConfirmDialog
          title="Savdoni qaytarish?"
          description="Mahsulotlar omborga qaytadi, bog‘langan qarz yopiladi va to‘langan summalar uchun qaytarish yozuvlari yaratiladi. Haqiqiy pul o‘tkazmasi bu tizimdan tashqarida bajariladi."
          onConfirm={() =>
            mutate(
              `/sales/${reverse}/reverse`,
              "POST",
              {},
              "Savdo qaytarildi; tarix saqlandi",
            )
          }
          onClose={() => setReverse(null)}
        />
      )}
    </div>
  );
}
