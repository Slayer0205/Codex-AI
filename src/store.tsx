import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "./services/api";
import type { Session, Snapshot } from "./types";
import { haptic } from "./services/telegram";
type Store = {
  data: Snapshot | null;
  session: Session | null;
  loading: boolean;
  error: string;
  offline: boolean;
  toast: string;
  reload: () => Promise<void>;
  login: (
    method: "demo" | "login" | "telegram",
    data?: unknown,
  ) => Promise<void>;
  logout: () => Promise<void>;
  mutate: <T>(
    path: string,
    method: string,
    body?: unknown,
    message?: string,
  ) => Promise<T>;
  notify: (s: string) => void;
};
const Context = createContext<Store>(null!);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const notify = useCallback((s: string) => {
    setToast(s);
    haptic();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const reload = useCallback(async () => {
    const d = await api.request<Snapshot>("/snapshot");
    setData(d);
    setError("");
  }, []);
  const login = useCallback(
    async (method: "demo" | "login" | "telegram", body?: unknown) => {
      await api.request(`/auth/${method}`, "POST", {
        ...((body as object) || {}),
        miniApp: Boolean(window.Telegram?.WebApp),
      });
      setSession(await api.request<Session>("/session"));
      await reload();
    },
    [reload],
  );
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (window.Telegram?.WebApp.initData)
          await api.request("/auth/telegram", "POST", {
            initData: window.Telegram.WebApp.initData,
          });
        const s = await api.request<Session>("/session");
        if (active) {
          setSession(s);
          await reload();
        }
      } catch (e) {
        if ((e as { status: number }).status !== 401 && active)
          setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    const on = () => setOffline(false),
      off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const mutate = useCallback(
    async <T,>(
      path: string,
      method: string,
      body?: unknown,
      message = "Muvaffaqiyatli saqlandi",
    ) => {
      const result = await api.request<T>(path, method, body);
      try {
        await reload();
      } catch {
        setError(
          "Operatsiya saqlandi, ammo ro‘yxat yangilanmadi. Yangilash tugmasini bosing.",
        );
      }
      notify(message);
      return result;
    },
    [reload, notify],
  );
  const logout = async () => {
    await api.request("/auth/logout", "POST", {});
    setData(null);
    setSession(null);
  };
  return (
    <Context.Provider
      value={{
        data,
        session,
        loading,
        error,
        offline,
        toast,
        reload,
        login,
        logout,
        mutate,
        notify,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
