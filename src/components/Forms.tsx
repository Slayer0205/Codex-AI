import { useState, type FormEvent } from "react";
import { z } from "zod";
import { LoaderCircle, Check, Info } from "lucide-react";
import { useStore } from "../store";
import { day, money, remaining } from "../lib";
import type { DialogState } from "../types";
import { Modal, Button, ErrorMessage } from "./ui";
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  step?: string;
  wide?: boolean;
};
export function RecordForm({
  dialog,
  onClose,
}: {
  dialog: DialogState;
  onClose: () => void;
}) {
  const { data, mutate } = useStore();
  const s = data!;
  const { kind, id } = dialog;
  const debt = s.debts.find((d) => d.id === id),
    customer = s.customers.find((c) => c.id === id),
    product = s.products.find((p) => p.id === id);
  const customerOptions = s.customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const formConfig: {
    title: string;
    description: string;
    path: string;
    method: string;
    fields: Field[];
    initial: Record<string, unknown>;
  } = {
    title: "",
    description: "",
    path: "",
    method: "POST",
    fields: [],
    initial: {},
  };
  if (kind === "customer" || kind === "editCustomer")
    Object.assign(formConfig, {
      title: kind === "customer" ? "Yangi mijoz" : "Mijozni tahrirlash",
      description: "Mijoz ma’lumotlari va barcha operatsiyalar bir joyda.",
      path: "/customers" + (id ? "/" + id : ""),
      method: id ? "PATCH" : "POST",
      initial: customer || {},
      fields: [
        { key: "name", label: "Ism-familiya", required: true, wide: true },
        { key: "phone", label: "Telefon raqami", type: "tel", required: true },
        { key: "telegramId", label: "Telegram ID (ixtiyoriy)" },
        { key: "address", label: "Manzil", wide: true },
        { key: "notes", label: "Izoh", type: "textarea", wide: true },
      ],
    });
  if (kind === "product" || kind === "editProduct")
    Object.assign(formConfig, {
      title: kind === "product" ? "Yangi mahsulot" : "Mahsulotni tahrirlash",
      description:
        "Narxlar so‘mda kiritiladi. Hisob-kitob tiyinlarda bajariladi.",
      path: "/products" + (id ? "/" + id : ""),
      method: id ? "PATCH" : "POST",
      initial: product
        ? { ...product, cost: product.cost / 100, price: product.price / 100 }
        : { category: "Oziq-ovqat", lowStock: 5, stock: 0, cost: 0 },
      fields: [
        { key: "name", label: "Mahsulot nomi", required: true, wide: true },
        { key: "sku", label: "SKU / shtrix-kod", required: true },
        { key: "category", label: "Kategoriya", required: true },
        {
          key: "cost",
          label: "Tannarx (so‘m)",
          type: "number",
          required: true,
          min: 0,
          step: "0.01",
        },
        {
          key: "price",
          label: "Sotish narxi (so‘m)",
          type: "number",
          required: true,
          min: 0.01,
          step: "0.01",
        },
        ...(!id
          ? [
              {
                key: "stock",
                label: "Ombor soni",
                type: "number",
                required: true,
                min: 0,
              },
            ]
          : []),
        {
          key: "lowStock",
          label: "Kam qoldiq chegarasi",
          type: "number",
          min: 0,
        },
        {
          key: "image",
          label: "Rasm URL (HTTPS, ixtiyoriy)",
          type: "url",
          wide: true,
        },
      ],
    });
  if (kind === "debt" || kind === "editDebt")
    Object.assign(formConfig, {
      title: kind === "debt" ? "Yangi qarz" : "Qarzni tahrirlash",
      description: "To‘lovlar tarixi saqlanadi, qoldiq avtomatik hisoblanadi.",
      path: "/debts" + (id ? "/" + id : ""),
      method: id ? "PATCH" : "POST",
      initial: debt
        ? { ...debt, amount: debt.amount / 100 }
        : {
            customerId: dialog.customerId || "",
            dueDate: day(new Date(Date.now() + s.settings.debtDays * 86400000)),
            date: day(),
          },
      fields: [
        ...(!id
          ? [
              {
                key: "customerId",
                label: "Mijoz",
                type: "select",
                options: customerOptions,
                required: true,
                wide: true,
              },
            ]
          : []),
        {
          key: "amount",
          label: "Qarz summasi (so‘m)",
          type: "number",
          required: true,
          min: 0.01,
          step: "0.01",
        },
        ...(!id
          ? [
              {
                key: "date",
                label: "Qarz berilgan sana",
                type: "date",
                required: true,
              },
            ]
          : []),
        {
          key: "dueDate",
          label: "To‘lov muddati",
          type: "date",
          required: true,
        },
        { key: "notes", label: "Izoh", type: "textarea", wide: true },
      ],
    });
  if (kind === "repay")
    Object.assign(formConfig, {
      title: "Qarz to‘lovi",
      description: `${s.customers.find((c) => c.id === debt?.customerId)?.name} · Qoldiq: ${money(remaining(debt!, s))} so‘m`,
      path: `/debts/${id}/repayments`,
      initial: { amount: remaining(debt!, s) / 100, method: "cash" },
      fields: [
        {
          key: "amount",
          label: "To‘lov summasi (so‘m)",
          type: "number",
          required: true,
          min: 0.01,
          step: "0.01",
          wide: true,
        },
        {
          key: "method",
          label: "To‘lov usuli",
          type: "select",
          options: [
            { value: "cash", label: "Naqd" },
            { value: "card", label: "Karta" },
          ],
          required: true,
          wide: true,
        },
      ],
    });
  if (kind === "expense")
    Object.assign(formConfig, {
      title: "Xarajat qo‘shish",
      description: "Xarajat foyda va zarar hisobotida aks etadi.",
      path: "/expenses",
      initial: { date: day(), category: "Boshqa" },
      fields: [
        { key: "name", label: "Xarajat nomi", required: true, wide: true },
        { key: "category", label: "Kategoriya", required: true },
        {
          key: "amount",
          label: "Summa (so‘m)",
          type: "number",
          required: true,
          min: 0.01,
          step: "0.01",
        },
        { key: "date", label: "Sana", type: "date", required: true },
      ],
    });
  if (kind === "stock")
    Object.assign(formConfig, {
      title: "Inventarizatsiya",
      description: `${product?.name} · Hozirgi qoldiq: ${product?.stock} dona`,
      path: `/products/${id}/stock`,
      initial: { reason: "Omborga kirim" },
      fields: [
        {
          key: "quantity",
          label: "O‘zgarish (+ kirim / − chiqim)",
          type: "number",
          required: true,
          wide: true,
        },
        { key: "reason", label: "Sabab", required: true, wide: true },
      ],
    });
  const [values, setValues] = useState<Record<string, unknown>>(
      formConfig.initial,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of formConfig.fields) {
        let value = values[f.key] ?? "";
        if (f.type === "number") {
          value = z.coerce.number().finite().parse(value);
          if (["amount", "price", "cost"].includes(f.key))
            value = Math.round(Number(value) * 100);
          else value = z.number().int().parse(value);
        }
        if (f.required && String(value).trim() === "")
          throw new Error(`${f.label} talab qilinadi`);
        payload[f.key] = value;
      }
      if (kind === "editProduct") payload.stock = product!.stock;
      if ("name" in payload)
        z.string()
          .trim()
          .min(2, "Nom kamida 2 belgidan iborat bo‘lsin")
          .parse(payload.name);
      if ("phone" in payload)
        z.string()
          .regex(/^\+?[\d\s()-]{7,20}$/, "Telefon raqami noto‘g‘ri")
          .parse(payload.phone);
      if ("amount" in payload)
        z.number()
          .int()
          .positive("Summa noldan katta bo‘lsin")
          .parse(payload.amount);
      await mutate(
        formConfig.path,
        formConfig.method,
        payload,
        kind === "repay"
          ? "To‘lov saqlandi. Qarz qoldig‘i yangilandi."
          : "Ma’lumotlar saqlandi",
      );
      onClose();
    } catch (e) {
      setError(
        e instanceof z.ZodError
          ? e.issues.map((i) => i.message).join(", ")
          : (e as Error).message,
      );
      setBusy(false);
    }
  };
  return (
    <Modal
      title={formConfig.title}
      description={formConfig.description}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {formConfig.fields.map((f) => (
            <label key={f.key} className={`field ${f.wide ? "full" : ""}`}>
              <span>
                {f.label}
                {f.required && <em>*</em>}
              </span>
              {f.type === "select" ? (
                <select
                  value={String(values[f.key] ?? "")}
                  required={f.required}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                >
                  <option value="">Tanlang</option>
                  {f.options?.map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  rows={3}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              ) : (
                <input
                  aria-label={f.label}
                  type={f.type || "text"}
                  min={f.min}
                  step={f.step || "1"}
                  required={f.required}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
        </div>
        <ErrorMessage message={error} />
        <div className="form-hint">
          <Info size={15} />
          Ma’lumotlar serverda xavfsiz saqlanadi.
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button disabled={busy} type="submit">
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
