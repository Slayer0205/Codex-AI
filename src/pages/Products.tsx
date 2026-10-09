import { useRef, useState } from "react";
import {
  Plus,
  Search,
  Download,
  Upload,
  Package,
  Pencil,
  History,
  ArrowDownUp,
} from "lucide-react";
import { useStore } from "../store";
import { money, exportCSV, displayDate } from "../lib";
import {
  PageHeading,
  Button,
  Empty,
  Modal,
  Badge,
  ErrorMessage,
} from "../components/ui";
import type { DialogState } from "../types";
export function Products({
  open,
  initialSearch = "",
}: {
  open: (d: DialogState) => void;
  initialSearch?: string;
}) {
  const { data, mutate, notify } = useStore();
  const s = data!;
  const [query, setQuery] = useState(initialSearch),
    [filter, setFilter] = useState("all"),
    [history, setHistory] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const rows = s.products.filter(
    (p) =>
      `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || p.stock <= p.lowStock),
  );
  const exportRows = () =>
    exportCSV(
      s.products.map((p) => ({
        name: p.name,
        category: p.category,
        sku: p.sku,
        cost: p.cost / 100,
        price: p.price / 100,
        stock: p.stock,
        lowStock: p.lowStock,
        image: p.image,
      })),
      "mahsulotlar",
    );
  const importFile = async (f: File) => {
    setBusy(true);
    setError("");
    try {
      if (f.size > 1e6) throw new Error("Fayl 1 MB dan kichik bo‘lsin");
      const text = (await f.text()).replace(/^\uFEFF/, "");
      const parsed: string[][] = [];
      let row: string[] = [],
        cell = "",
        quoted = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
          if (quoted && text[i + 1] === '"') {
            cell += '"';
            i++;
          } else quoted = !quoted;
        } else if (c === "," && !quoted) {
          row.push(cell);
          cell = "";
        } else if ((c === "\n" || c === "\r") && !quoted) {
          if (c === "\r" && text[i + 1] === "\n") i++;
          row.push(cell);
          if (row.some((x) => x.trim())) parsed.push(row);
          row = [];
          cell = "";
        } else cell += c;
      }
      if (quoted) throw new Error("CSV qo‘shtirnoqlari noto‘g‘ri");
      row.push(cell);
      if (row.some((x) => x.trim())) parsed.push(row);
      const [headers, ...values] = parsed;
      if (!headers?.includes("sku"))
        throw new Error(
          "CSV ustunlari: name,category,sku,cost,price,stock,lowStock,image",
        );
      const products = values.map((r) => {
        const p = Object.fromEntries(headers.map((h, i) => [h, r[i] || ""]));
        return {
          ...p,
          cost: Math.round(Number(p.cost) * 100),
          price: Math.round(Number(p.price) * 100),
          stock: Number(p.stock),
          lowStock: Number(p.lowStock || 5),
          image: p.image || "",
        };
      });
      await mutate(
        "/products/import",
        "POST",
        { products },
        `${products.length} ta mahsulot import qilindi`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };
  return (
    <div className="page">
      <PageHeading
        eyebrow="OMBOR — BIZNES TAYANCHI"
        title="Mahsulotlar va ombor"
        description="Kirim, chiqim va qoldiqlar doim nazoratda."
        actions={
          <>
            <Button variant="secondary" onClick={exportRows}>
              <Download size={16} />
              Eksport
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              <Upload size={16} />
              {busy ? "Import…" : "Import"}
            </Button>
            <Button onClick={() => open({ kind: "product" })}>
              <Plus size={18} />
              Mahsulot qo‘shish
            </Button>
          </>
        }
      />
      <input
        hidden
        type="file"
        accept=".csv,text/csv"
        ref={file}
        onChange={(e) => {
          if (e.target.files?.[0]) void importFile(e.target.files[0]);
        }}
      />
      <div className="inventory-summary">
        <div>
          <Package size={22} />
          <span>
            Mahsulot turlari<strong>{s.products.length}</strong>
          </span>
        </div>
        <div>
          <ArrowDownUp size={22} />
          <span>
            Jami qoldiq
            <strong>{s.products.reduce((n, p) => n + p.stock, 0)} dona</strong>
          </span>
        </div>
        <div>
          <span className="low-stock-dot" />
          <span>
            Kam qolgan
            <strong>
              {s.products.filter((p) => p.stock <= p.lowStock).length} mahsulot
            </strong>
          </span>
        </div>
        <div>
          <span>
            Ombor qiymati (tannarx)
            <strong>
              {money(s.products.reduce((n, p) => n + p.cost * p.stock, 0))} so‘m
            </strong>
          </span>
        </div>
      </div>
      <ErrorMessage message={error} />
      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            <button
              className={filter === "all" ? "selected" : ""}
              onClick={() => setFilter("all")}
            >
              Barchasi
            </button>
            <button
              className={filter === "low" ? "selected" : ""}
              onClick={() => setFilter("low")}
            >
              Kam qolgan{" "}
              <span className="count-badge">
                {s.products.filter((p) => p.stock <= p.lowStock).length}
              </span>
            </button>
          </div>
          <div className="search-input">
            <Search size={17} />
            <input
              placeholder="Mahsulot yoki SKU…"
              aria-label="Omborni qidirish"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mahsulot</th>
                  <th>SKU</th>
                  <th>Tannarx</th>
                  <th>Sotish narxi</th>
                  <th>Ombor</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={p.id}>
                    <td>
                      <div className="person">
                        <span className={`product-mini visual-${i % 5}`}>
                          <Package size={20} />
                        </span>
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.category}</small>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{p.sku}</td>
                    <td>{money(p.cost)} so‘m</td>
                    <td className="bold">{money(p.price)} so‘m</td>
                    <td>
                      <span
                        className={
                          p.stock <= p.lowStock
                            ? "stock-badge low"
                            : "stock-badge"
                        }
                      >
                        {p.stock} dona
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label="Mahsulotni tahrirlash"
                          onClick={() =>
                            open({ kind: "editProduct", id: p.id })
                          }
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Inventarizatsiya"
                          onClick={() => open({ kind: "stock", id: p.id })}
                        >
                          <ArrowDownUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Ombor tarixi"
                          onClick={() => setHistory(p.id)}
                        >
                          <History size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
        <div className="table-footer">
          {rows.length} ta mahsulot · Import faqat yangi SKU uchun. Qoldiqni
          inventarizatsiyada o‘zgartiring.
        </div>
      </section>
      {history && (
        <Modal
          title="Ombor harakati"
          description={s.products.find((p) => p.id === history)?.name}
          onClose={() => setHistory(null)}
        >
          <div className="timeline">
            {s.inventory_movements
              .filter((m) => m.productId === history)
              .map((m) => (
                <div className="timeline-row" key={m.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{m.reason}</strong>
                    <small>{displayDate(m.createdAt)}</small>
                  </div>
                  <Badge
                    value={`${m.quantity > 0 ? "+" : ""}${m.quantity} dona`}
                  />
                </div>
              ))}
          </div>
          <div className="modal-footer">
            <Button
              onClick={() => {
                setHistory(null);
                notify("Ombor harakati yopildi");
              }}
            >
              Yopish
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
