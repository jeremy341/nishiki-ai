import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App.jsx";
import { I18nProvider } from "./i18n/context.jsx";
import "./index.css";
import "./redesign.css";

import "./style.js"; // the look (classic or koi), applied before the first render

// The light or dark choice made in the app is kept for the next visit (no choice: the phone or computer setting).
{
  const stored = (() => {
    try {
      return localStorage.getItem("theme");
    } catch {
      return null;
    }
  })();
  if (stored === "light" || stored === "dark") document.documentElement.dataset.theme = stored;
}

// Makes the app installable on computers and Android. Only over HTTPS, or on localhost.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
    <Toaster position="top-center" closeButton toastOptions={{ className: "!bg-overlay !text-fg !border-border" }} />
  </React.StrictMode>,
);
