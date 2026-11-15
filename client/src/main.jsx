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

// On an iPhone, the app added to the home screen is sometimes shorter than the screen (the page ends above the bottom edge,
// leaving a blank strip under the message box). When the page height is clearly less than the screen height, the app uses
// the screen height instead. Nothing changes in a normal browser tab, where the browser's own bars take that space.
{
  const fit = () => {
    const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
    const phone = window.innerWidth <= 500 && Math.abs(window.innerWidth - window.screen.width) <= 2;
    const missing = window.screen.height - window.innerHeight;
    const root = document.documentElement.style;
    if (standalone && phone && missing > 8 && missing < 120) root.setProperty("--app-h", `${window.screen.height}px`);
    else root.removeProperty("--app-h");
  };
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => setTimeout(fit, 250));
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
