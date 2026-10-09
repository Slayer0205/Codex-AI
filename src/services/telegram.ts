type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  onEvent: (name: string, fn: () => void) => void;
  offEvent: (name: string, fn: () => void) => void;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
  };
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: string) => void;
    notificationOccurred: (style: string) => void;
  };
};
declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}
export async function loadTelegram() {
  if (window.Telegram?.WebApp) return;
  if (
    !new URLSearchParams(location.search).has("tgWebAppData") &&
    !location.hash.includes("tgWebAppData") &&
    !new URLSearchParams(location.search).has("mini")
  )
    return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Telegram SDK vaqti tugadi")),
      5000,
    );
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Telegram SDK yuklanmadi"));
    };
    document.head.appendChild(script);
  });
}
export const haptic = () =>
  window.Telegram?.WebApp.HapticFeedback?.impactOccurred("light");
