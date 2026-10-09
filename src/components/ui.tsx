import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  X,
  ArrowUpRight,
  Inbox,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { money, statusLabel, initials } from "../lib";
import { useStore } from "../store";
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export const Badge = ({ value }: { value: string }) => (
  <span className={`badge ${value}`}>{statusLabel[value] || value}</span>
);
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return <span className={`avatar color-${index % 5}`}>{initials(name)}</span>;
}
export function Empty({
  title = "Hozircha ma’lumot yo‘q",
  description = "Birinchi yozuvni qo‘shib, ishni boshlang.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="page skeleton-page">
      <div className="skeleton heading-skeleton" />
      <div className="stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton stat-skeleton" key={i} />
        ))}
      </div>
      <div className="skeleton chart-skeleton" />
    </div>
  );
}
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent = "mint",
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${accent}`}>{icon}</span>
      </div>
      <div className="stat-value">
        {typeof value === "number" ? money(value) : value}
        {typeof value === "number" && <span>so‘m</span>}
      </div>
      <div className="stat-bottom">
        <span className={`stat-dot ${accent}`} />
        {subtitle}
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>(
      "input,select,button",
    );
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const items = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',
          ),
        ];
        const a = items[0],
          b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b?.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal ${wide ? "wide" : ""}`}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Oynani yopish"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-text">{description}</p>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-footer">
        <Button variant="secondary" onClick={onClose}>
          Bekor qilish
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? <LoaderCircle size={16} className="spin" /> : null}Tasdiqlash
        </Button>
      </div>
    </Modal>
  );
}
export function Toast() {
  const { toast } = useStore();
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          role="status"
          className="toast"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          <CheckCircle2 size={19} />
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export const ErrorMessage = ({ message }: { message: string }) =>
  message ? (
    <div className="form-error" role="alert">
      <AlertCircle size={17} />
      {message}
    </div>
  ) : null;
export const TextLink = ({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) => (
  <button className="text-link" onClick={onClick}>
    {children}
    <ArrowUpRight size={15} />
  </button>
);
