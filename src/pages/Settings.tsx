import { useEffect, useState } from "react";
import {
  Store,
  Shield,
  Link,
  Bell,
  Download,
  Save,
  Sun,
  Moon,
  Monitor,
  Check,
  KeyRound,
  Send,
  Users,
} from "lucide-react";
import { useStore } from "../store";
import { api } from "../services/api";
import { downloadBlob } from "../lib";
import { PageHeading, Button, ErrorMessage, Badge } from "../components/ui";
import type { Settings as SettingsType } from "../types";
export function Settings({
  setTheme,
}: {
  setTheme: (t: "light" | "dark" | "system") => void;
}) {
  const { data, session, mutate, notify } = useStore();
  const [form, setForm] = useState<SettingsType>(data!.settings),
    [tab, setTab] = useState("store"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tg, setTg] = useState(""),
    [members, setMembers] = useState<
      { id: string; name: string; email: string; role: string }[]
    >([]),
    [health, setHealth] = useState<{ mode: string; telegram: string } | null>(
      null,
    );
  useEffect(() => {
    if (tab === "roles" && session?.role === "admin")
      api
        .request<typeof members>("/memberships")
        .then(setMembers)
        .catch((e) => setError(e.message));
    if (tab === "integrations")
      api
        .request<typeof health>("/health")
        .then(setHealth)
        .catch((e) => setError(e.message));
  }, [tab, session?.role]);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await mutate("/settings", "PUT", form, "Sozlamalar saqlandi");
      setTheme(form.theme);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const backup = async () => {
    try {
      const backup = await api.request("/backup");
      downloadBlob(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
        "smart-savdo-backup.json",
      );
      notify("Biznes ma’lumotlari eksport qilindi");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const tabs = [
    ["store", "Do‘kon", Store],
    ["appearance", "Ko‘rinish", Sun],
    ["notifications", "Bildirishnomalar", Bell],
    ["security", "Xavfsizlik", Shield],
    ["roles", "Foydalanuvchilar", Users],
    ["integrations", "Integratsiyalar", Link],
  ] as const;
  return (
    <div className="page">
      <PageHeading
        eyebrow="SIZNING BIZNESINGIZ, SIZNING QOIDALARINGIZ"
        title="Sozlamalar"
        description="Ish joyingizni o‘zingizga moslang."
      />
      <div className="settings-layout">
        <aside className="panel settings-nav">
          {tabs.map(([k, t, Icon]) => (
            <button
              key={k}
              className={tab === k ? "selected" : ""}
              onClick={() => {
                setTab(k);
                setError("");
              }}
            >
              <Icon size={19} />
              {t}
            </button>
          ))}
        </aside>
        <section className="panel settings-content">
          <ErrorMessage message={error} />
          {tab === "store" && (
            <>
              <h2>Do‘kon va profil</h2>
              <p className="muted">Asosiy biznes ma’lumotlari.</p>
              <div className="form-grid">
                <label className="field full">
                  <span>Do‘kon nomi</span>
                  <input
                    value={form.storeName}
                    onChange={(e) =>
                      setForm({ ...form, storeName: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Valyuta</span>
                  <input value="UZS — O‘zbekiston so‘mi" disabled />
                </label>
                <label className="field">
                  <span>Til</span>
                  <select
                    value={form.language}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        language: e.target.value as SettingsType["language"],
                      })
                    }
                  >
                    <option value="uz">O‘zbekcha</option>
                    <option value="ru">Русский (menyu)</option>
                    <option value="en">English (navigation)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Qarz muddati (kun)</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={form.debtDays}
                    onChange={(e) =>
                      setForm({ ...form, debtDays: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  <span>Do‘kon bildirishnomalari uchun Telegram ID</span>
                  <input
                    value={form.telegramId}
                    onChange={(e) =>
                      setForm({ ...form, telegramId: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Hisob egasi</span>
                  <input disabled value={session?.name} />
                </label>
              </div>
              <p className="setting-note">
                Ruscha va inglizcha navigatsiya mavjud. Modullarning to‘liq
                tarjimasi hali tayyor emas.
              </p>
            </>
          )}
          {tab === "appearance" && (
            <>
              <h2>Sizga mos ko‘rinish</h2>
              <p className="muted">Ko‘zga qulay. Har bir ekranda izchil.</p>
              <div className="theme-options">
                {[
                  ["light", "Yorug‘", Sun],
                  ["dark", "Qorong‘i", Moon],
                  ["system", "Qurilma", Monitor],
                ].map(([k, t, Icon]) => {
                  const I = Icon as typeof Sun;
                  return (
                    <button
                      key={String(k)}
                      className={form.theme === k ? "selected" : ""}
                      onClick={() => {
                        setForm({ ...form, theme: k as SettingsType["theme"] });
                        setTheme(k as SettingsType["theme"]);
                      }}
                    >
                      <div className={`theme-preview ${k}`}>
                        <span />
                        <span />
                        <span />
                      </div>
                      <I size={19} />
                      {String(t)}
                      {form.theme === k && <Check size={16} />}
                    </button>
                  );
                })}
              </div>
              <p className="setting-note">
                Telegram ichida ilovaning boshlang‘ich mavzusi Telegram
                sozlamasiga mos keladi.
              </p>
            </>
          )}
          {tab === "notifications" && (
            <>
              <h2>Bildirishnomalar</h2>
              <div className="setting-row">
                <div>
                  <strong>Ilovadagi bildirishnomalar</strong>
                  <p>Eslatmalar va operatsiyalar markazini ko‘rsatish</p>
                </div>
                <button
                  className={`switch ${form.notifications ? "on" : ""}`}
                  role="switch"
                  aria-checked={form.notifications}
                  aria-label="Bildirishnomalar"
                  onClick={() =>
                    setForm({ ...form, notifications: !form.notifications })
                  }
                >
                  <span />
                </button>
              </div>
              <p className="setting-note">
                Qarz eslatmasi qarz daftaridan qo‘lda yuboriladi. Avtomatik
                rejalashtirilgan yuborish hali yoqilmagan.
              </p>
            </>
          )}
          {tab === "security" && (
            <>
              <h2>Hisob xavfsizligi</h2>
              <div className="security-card">
                <Shield size={23} />
                <div>
                  <strong>
                    {session?.demo ? "Demo sessiya" : "Himoyalangan sessiya"}
                  </strong>
                  <p>
                    {session?.demo
                      ? "Demo ma’lumotlarga administrator kirishi. Bu production autentifikatsiyasi emas."
                      : "HttpOnly cookie, 8 soatlik JWT va tashkilotga bog‘langan ruxsatlar."}
                  </p>
                </div>
                <Badge value={session?.demo ? "demo" : "active"} />
              </div>
              <h3>Telegram hisobini bog‘lash</h3>
              <p className="muted">
                Bot va Mini App uchun o‘zingizning raqamli Telegram ID’ingizni
                kiriting.
              </p>
              <div className="inline-form">
                <input
                  aria-label="Shaxsiy Telegram ID"
                  placeholder="Telegram ID"
                  value={tg}
                  onChange={(e) => setTg(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await mutate(
                        "/profile/telegram",
                        "PUT",
                        {
                          telegramId: tg,
                          initData: window.Telegram?.WebApp.initData,
                        },
                        "Telegram hisobi bog‘landi",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Send size={16} />
                  Bog‘lash
                </Button>
              </div>
              <h3>Zaxira va audit</h3>
              <p className="muted">
                JSON eksport biznes yozuvlarini saqlaydi. Parollar va tokenlar
                eksport qilinmaydi. Tiklash uchun ma’muriy jarayon talab
                qilinadi.
              </p>
              <Button variant="secondary" onClick={backup}>
                <Download size={17} />
                Zaxira nusxasini olish
              </Button>
              <div className="audit-list">
                {data!.audit_logs.slice(0, 8).map((x) => (
                  <div key={x.id}>
                    <code>{x.action}</code>
                    <small>
                      {new Date(x.createdAt).toLocaleString("uz-UZ")}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "roles" && (
            <>
              <h2>Rollar va ruxsatlar</h2>
              <p className="muted">
                Administrator · Menejer · Kassir · Kuzatuvchi
              </p>
              {session?.role === "admin" ? (
                members.map((m) => (
                  <div className="setting-row" key={m.id}>
                    <div>
                      <strong>{m.name}</strong>
                      <p>{m.email}</p>
                    </div>
                    {m.role === "admin" ? (
                      <Badge value="Administrator" />
                    ) : (
                      <select
                        value={m.role}
                        onChange={async (e) => {
                          try {
                            await mutate(
                              `/memberships/${m.id}`,
                              "PATCH",
                              { role: e.target.value },
                              "Rol yangilandi",
                            );
                            setMembers(await api.request("/memberships"));
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <option value="manager">Menejer</option>
                        <option value="cashier">Kassir</option>
                        <option value="viewer">Kuzatuvchi</option>
                      </select>
                    )}
                  </div>
                ))
              ) : (
                <p className="setting-note">
                  Ro‘yxat faqat administrator uchun.
                </p>
              )}
              <p className="setting-note">
                Yangi hisob serverdagi <code>npm run user:create</code> buyrug‘i
                orqali xavfsiz yaratiladi. README’da yo‘riqnoma bor.
              </p>
            </>
          )}
          {tab === "integrations" && (
            <>
              <h2>Tashqi servislar</h2>
              <p className="muted">
                Kalitlar faqat serverdagi .env faylida saqlanadi.
              </p>
              <div className="integration-card">
                <Send size={24} />
                <div>
                  <h3>Telegram Bot</h3>
                  <p>
                    {health?.telegram === "configured"
                      ? "Token sozlangan; ulanishni bot orqali tekshiring."
                      : "Mock adapter. Haqiqiy xabar yuborilmaydi."}
                  </p>
                </div>
                <Badge
                  value={health?.telegram === "configured" ? "active" : "demo"}
                />
              </div>
              <div className="integration-card">
                <KeyRound size={24} />
                <div>
                  <h3>Ma’lumotlar bazasi</h3>
                  <p>SQLite demo · PostgreSQL uchun DATABASE_URL</p>
                </div>
                <Badge value={health?.mode || "demo"} />
              </div>
              <div className="integration-guide">
                <h3>Haqiqiy rejimni ulash</h3>
                <ol>
                  <li>.env.example asosida server .env faylini yarating.</li>
                  <li>DATABASE_URL, JWT_SECRET va DEMO_MODE=false sozlang.</li>
                  <li>
                    Telegram uchun TELEGRAM_BOT_TOKEN va HTTPS WEB_APP_URL
                    kiriting.
                  </li>
                  <li>Foydalanuvchini yarating va Telegram ID’ni bog‘lang.</li>
                  <li>
                    Botni <code>npm run bot</code> orqali ishga tushiring.
                  </li>
                </ol>
              </div>
            </>
          )}
          {["store", "appearance", "notifications"].includes(tab) && (
            <div className="settings-footer">
              <Button disabled={busy} onClick={save}>
                <Save size={17} />
                {busy ? "Saqlanmoqda…" : "O‘zgarishlarni saqlash"}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
