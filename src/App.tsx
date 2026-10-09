import { Component, useEffect, useState, type ReactNode } from "react";
import { MotionConfig, AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ShoppingBag,
  Package,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  ArrowRight,
  Command,
  WifiOff,
  RefreshCw,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { StoreProvider, useStore } from "./store";
import { api } from "./services/api";
import { navigation } from "./config/i18n";
import { remaining } from "./lib";
import {
  Button,
  Avatar,
  Toast,
  Modal,
  Empty,
  Skeleton,
  ErrorMessage,
} from "./components/ui";
import { RecordForm } from "./components/Forms";
import { Dashboard } from "./pages/Dashboard";
import { Debts } from "./pages/Debts";
import { Customers } from "./pages/Customers";
import { Sales } from "./pages/Sales";
import { Products } from "./pages/Products";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import type { Page, DialogState } from "./types";
const navItems = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "debts", icon: BookOpen },
  { id: "customers", icon: Users },
  { id: "sales", icon: ShoppingBag },
  { id: "products", icon: Package },
  { id: "reports", icon: ChartNoAxesCombined },
] as const;
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>Ilova ko‘rsatilmadi</h1>
        <p>Sahifani qayta yuklab ko‘ring. Ma’lumotlar serverda saqlangan.</p>
        <Button onClick={() => location.reload()}>Qayta yuklash</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Login() {
  const { login, error } = useStore();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(error),
    [demo, setDemo] = useState(false);
  useEffect(() => {
    api
      .request<{ mode: string }>("/health")
      .then((h) => setDemo(h.mode === "demo"))
      .catch((e) => setMessage(e.message));
  }, []);
  const enter = async (mode: "demo" | "login" | "telegram") => {
    setBusy(true);
    setMessage("");
    try {
      await login(
        mode,
        mode === "login"
          ? { email, password }
          : mode === "telegram"
            ? { initData: window.Telegram?.WebApp.initData }
            : {},
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <div className="login-art">
        <div className="brand">
          <div className="brand-symbol">
            s
            <span>
              <ArrowUpRight size={23} strokeWidth={3} />
            </span>
          </div>
          <span>
            smart<span className="brand-light">savdo</span>
            <small>SAVDO & QARZ DAFTAR</small>
          </span>
        </div>
        <div className="login-pitch">
          <span className="eyebrow">BIZNESINGIZGA YANGI QARASH</span>
          <h1>
            Hisoblar aniq.
            <br />
            Imkoniyatlar
            <br />
            <span>cheksiz.</span>
          </h1>
          <p>
            Savdo, qarz va ombor — barchasi bir joyda.
            <br />
            Siz biznesingizni o‘stiring, hisobni bizga qoldiring.
          </p>
          <div className="login-proof">
            <ShieldCheck size={18} />
            Ma’lumotlar doim o‘z nazoratingizda
          </div>
        </div>
        <div className="art-ring ring-one" />
        <div className="art-ring ring-two" />
        <div className="login-mini-stat">
          <span>Biznesingiz nazoratda</span>
          <strong>
            Smart Savdo <ArrowUpRight size={25} />
          </strong>
          <div className="mini-bars">
            {[28, 50, 40, 65, 52, 82, 95].map((h, i) => (
              <i key={i} style={{ height: h }} />
            ))}
          </div>
        </div>
        <p className="login-copyright">
          SMART SAVDO · O‘ZBEKISTON UCHUN YARATILGAN
        </p>
      </div>
      <div className="login-form">
        <span className="login-label">XUSH KELIBSIZ</span>
        <h2>Yana bir ajoyib kun.</h2>
        <p>Biznesingizga kirish uchun hisobingizdan foydalaning.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enter("login");
          }}
        >
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="siz@kompaniya.uz"
            />
          </label>
          <label className="field">
            <span>Parol</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Parolingiz"
            />
          </label>
          <ErrorMessage message={message} />
          <Button className="full-width" disabled={busy}>
            {busy ? <LoaderCircle size={18} className="spin" /> : null}Hisobga
            kirish
            <ArrowRight size={18} />
          </Button>
        </form>
        {window.Telegram?.WebApp.initData && (
          <Button
            variant="secondary"
            className="full-width"
            disabled={busy}
            onClick={() => enter("telegram")}
          >
            Telegram orqali kirish
          </Button>
        )}
        {demo && (
          <>
            <div className="login-divider">
              <span>yoki avval sinab ko‘ring</span>
            </div>
            <Button
              variant="secondary"
              className="full-width demo-button"
              disabled={busy}
              onClick={() => enter("demo")}
            >
              Demo bilan tanishish
              <ArrowUpRight size={18} />
            </Button>
            <p className="demo-explanation">
              Kalit yoki ro‘yxatdan o‘tish kerak emas. Demo operatsiyalar bazada
              saqlanadi. Haqiqiy pul o‘tkazilmaydi.
            </p>
          </>
        )}
        <p className="login-footnote">
          Hisob ochish uchun tashkilotingiz administratoriga murojaat qiling.
        </p>
      </div>
    </div>
  );
}
function Workspace() {
  const { data, session, loading, error, offline, logout, reload, mutate } =
    useStore();
  const [page, setPage] = useState<Page>(
      () => (location.hash.slice(1) as Page) || "dashboard",
    ),
    [dialog, setDialog] = useState<DialogState | null>(null),
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [pageSearch, setPageSearch] = useState(""),
    [theme, setTheme] = useState<"light" | "dark" | "system">(
      () =>
        window.Telegram?.WebApp.colorScheme ||
        (localStorage.getItem("savdo-theme") as "light") ||
        "light",
    ),
    [refreshError, setRefreshError] = useState("");
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [page]);
  const navigate = (p: Page, q = "") => {
    setPage(p);
    setPageSearch(q);
    location.hash = p;
    setMobile(false);
  };
  useEffect(() => {
    const listener = () => {
      const p = location.hash.slice(1);
      if ([...navItems.map((n) => n.id), "settings"].includes(p))
        setPage(p as Page);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    if (data && !localStorage.getItem("savdo-theme"))
      setTheme(window.Telegram?.WebApp.colorScheme || data.settings.theme);
  }, [data]);
  useEffect(() => {
    localStorage.setItem("savdo-theme", theme);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (mq.matches ? "dark" : "light") : theme;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    const back = () => navigate("dashboard");
    if (page === "dashboard") tg.BackButton.hide();
    else tg.BackButton.show();
    tg.BackButton.onClick(back);
    const changed = () => setTheme(tg.colorScheme);
    tg.onEvent("themeChanged", changed);
    return () => {
      tg.BackButton.offClick(back);
      tg.offEvent("themeChanged", changed);
    };
  }, [page]);
  if (loading) return <Skeleton />;
  if (!session) return <Login />;
  if (!data)
    return (
      <div className="fatal">
        <ErrorMessage message={error || "Ma’lumotlar yuklanmadi"} />
        <Button
          onClick={() => reload().catch((e) => setRefreshError(e.message))}
        >
          Qayta urinish
        </Button>
        <ErrorMessage message={refreshError} />
      </div>
    );
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const labels = navigation[data.settings.language] || navigation.uz;
  const unread = data.notifications.filter((n) => !n.read).length;
  const expanded = [
    ...navItems,
    { id: "settings" as const, icon: SettingsIcon },
  ];
  const active = expanded.find((n) => n.id === page);
  const ActiveIcon = active?.icon || LayoutDashboard;
  const sidebar = (
    <>
      <button
        className="brand"
        onClick={() => navigate("dashboard")}
        aria-label="Smart Savdo bosh sahifa"
      >
        <div className="brand-symbol">
          s
          <span>
            <ArrowUpRight size={23} strokeWidth={3} />
          </span>
        </div>
        <span>
          smart<span className="brand-light">savdo</span>
          <small>SAVDO & QARZ DAFTAR</small>
        </span>
      </button>
      <button className="store-switch" onClick={() => navigate("settings")}>
        <span className="store-avatar">B</span>
        <span>
          <strong>{data.settings.storeName}</strong>
          <small>Biznes boshqaruvi</small>
        </span>
        <ChevronDown size={15} />
      </button>
      <div className="nav-caption">ISH MAYDONI</div>
      <nav aria-label="Asosiy navigatsiya">
        {navItems.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${page === n.id ? "active" : ""}`}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={20} />
            <span>{labels[n.id]}</span>
            {n.id === "debts" && (
              <span className="nav-count" aria-hidden="true">
                {data.debts.filter((d) => remaining(d, data) > 0).length}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="nav-caption management">BOSHQARUV</div>
      <button
        className={`nav-item ${page === "settings" ? "active" : ""}`}
        onClick={() => navigate("settings")}
      >
        <SettingsIcon size={20} />
        <span>{labels.settings}</span>
      </button>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="note-star">✦</span>
          <strong>
            Biznesingizga
            <br />
            aniqlik olib keling.
          </strong>
          <p>Har bir raqam — yangi imkoniyat.</p>
          <button onClick={() => navigate("reports")}>
            Natijalarni ko‘rish
            <ArrowUpRight size={16} />
          </button>
        </div>
        <button className="sidebar-user" onClick={() => navigate("settings")}>
          <Avatar name={session.name} />
          <span>
            <strong>{session.name}</strong>
            <small>
              {session.role === "admin" ? "Administrator" : session.role}
            </small>
          </span>
          <ChevronDown size={15} />
        </button>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">{sidebar}</aside>
      {mobile && (
        <div className="mobile-overlay" onClick={() => setMobile(false)}>
          <aside
            className="mobile-sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button mobile-close"
              onClick={() => setMobile(false)}
              aria-label="Menyuni yopish"
            >
              <X size={21} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <main className="main">
        <header className="header">
          <div className="header-location">
            <button
              className="icon-button hamburger"
              aria-label="Menyu"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <ActiveIcon size={18} />
            <span>Ish maydoni</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{labels[page] || labels.dashboard}</strong>
          </div>
          <div className="header-actions">
            <button className="global-search" onClick={() => setSearch(true)}>
              <Search size={17} />
              <span>Tezkor qidiruv</span>
              <kbd>
                <Command size={11} />K
              </kbd>
            </button>
            {session.demo && (
              <span className="demo-tag">
                <i />
                DEMO
              </span>
            )}
            <button
              className="icon-button"
              aria-label="Mavzuni almashtirish"
              onClick={() => setTheme(dark ? "light" : "dark")}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            {data.settings.notifications && (
              <button
                className="icon-button notification-trigger"
                aria-label="Bildirishnomalar"
                onClick={() => setNotifications(true)}
              >
                <Bell size={19} />
                {unread > 0 && <i />}
              </button>
            )}
            <span className="header-divider" />
            <button
              className="icon-button logout-button"
              aria-label="Hisobdan chiqish"
              onClick={() => logout().catch((e) => setRefreshError(e.message))}
            >
              <LogOut size={18} />
            </button>
            <Avatar name={session.name} />
          </div>
        </header>
        {(offline || error || refreshError) && (
          <div className="network-banner">
            <WifiOff size={17} />
            {offline
              ? "Internet uzilgan. Operatsiyalarni davom ettirish uchun ulanish kerak."
              : error || refreshError}
            <button
              onClick={() =>
                reload()
                  .then(() => setRefreshError(""))
                  .catch((e) => setRefreshError(e.message))
              }
            >
              <RefreshCw size={15} />
              Yangilash
            </button>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {page === "dashboard" ? (
              <Dashboard navigate={navigate} open={setDialog} />
            ) : page === "debts" ? (
              <Debts
                key={pageSearch}
                initialSearch={pageSearch}
                open={setDialog}
              />
            ) : page === "customers" ? (
              <Customers
                key={pageSearch}
                initialSearch={pageSearch}
                open={setDialog}
              />
            ) : page === "sales" ? (
              <Sales />
            ) : page === "products" ? (
              <Products
                key={pageSearch}
                initialSearch={pageSearch}
                open={setDialog}
              />
            ) : page === "reports" ? (
              <Reports open={setDialog} />
            ) : page === "settings" ? (
              <Settings setTheme={setTheme} />
            ) : (
              <Dashboard navigate={navigate} open={setDialog} />
            )}
          </motion.div>
        </AnimatePresence>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Smart Savdo</span>
          <span>
            <i />
            Ma’lumotlar serverda saqlanadi
          </span>
          <span>Biznesingiz nazoratda.</span>
        </footer>
      </main>
      <nav className="mobile-bottom" aria-label="Mobil navigatsiya">
        {navItems.slice(0, 4).map((n) => (
          <button
            key={n.id}
            className={page === n.id ? "selected" : ""}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={21} />
            <span>{labels[n.id]}</span>
          </button>
        ))}
        <button onClick={() => setMobile(true)}>
          <Menu size={21} />
          <span>Ko‘proq</span>
        </button>
      </nav>
      {dialog && <RecordForm dialog={dialog} onClose={() => setDialog(null)} />}
      <Toast />
      {notifications && (
        <Modal
          title="Bildirishnomalar"
          description={`${unread} ta o‘qilmagan xabar`}
          onClose={() => setNotifications(false)}
        >
          {data.notifications.map((n) => (
            <div
              className={`notification-row ${n.read ? "" : "unread"}`}
              key={n.id}
            >
              <span className="notification-icon">
                <Bell size={18} />
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <small>
                  {new Date(n.createdAt).toLocaleString("uz-UZ")} ·{" "}
                  {n.status === "demo"
                    ? "Demo — haqiqiy xabar yuborilmagan"
                    : n.status}
                </small>
              </div>
            </div>
          ))}
          {!data.notifications.length && <Empty />}
          <div className="modal-footer">
            <Button
              variant="secondary"
              onClick={() =>
                mutate(
                  "/notifications/read",
                  "POST",
                  {},
                  "Xabarlar o‘qilgan deb belgilandi",
                ).catch((e) => setRefreshError(e.message))
              }
            >
              Barchasini o‘qilgan deb belgilash
            </Button>
          </div>
        </Modal>
      )}
      {search && (
        <Modal
          title="Tezkor qidiruv"
          description="Mijoz, mahsulot yoki bo‘limni toping"
          onClose={() => setSearch(false)}
        >
          <div className="search-input command-search">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Qidirish…"
              aria-label="Global qidiruv"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="command-results">
            {expanded
              .filter((n) =>
                labels[n.id].toLowerCase().includes(query.toLowerCase()),
              )
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    navigate(n.id);
                    setSearch(false);
                  }}
                >
                  <n.icon size={19} />
                  <span>{labels[n.id]}</span>
                  <ArrowRight size={16} />
                </button>
              ))}
            {query &&
              data.customers
                .filter((c) =>
                  `${c.name} ${c.phone}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      navigate("customers", c.name);
                      setSearch(false);
                    }}
                  >
                    <Users size={19} />
                    <span>
                      {c.name}
                      <small>Mijoz</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
            {query &&
              data.products
                .filter((p) =>
                  `${p.name} ${p.sku}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      navigate("products", p.name);
                      setSearch(false);
                    }}
                  >
                    <Package size={19} />
                    <span>
                      {p.name}
                      <small>Mahsulot</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <StoreProvider>
          <Workspace />
        </StoreProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
