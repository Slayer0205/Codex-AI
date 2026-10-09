import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { loadTelegram } from "./services/telegram";
await loadTelegram().catch(() => {});
window.Telegram?.WebApp.ready();
window.Telegram?.WebApp.expand();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
