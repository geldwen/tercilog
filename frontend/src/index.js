import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Supprimer définitivement l'erreur ResizeObserver (non critique)
if (typeof window !== "undefined") {
  const resizeObserverErrMsg = "ResizeObserver loop completed with undelivered notifications.";
  
  const resizeObserverErrHandler = (event) => {
    if (event.message === resizeObserverErrMsg || event.message?.includes("ResizeObserver")) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return true;
    }
  };
  
  const unhandledRejectionHandler = (event) => {
    if (event.reason?.message === resizeObserverErrMsg || event.reason?.message?.includes("ResizeObserver")) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return true;
    }
  };
  
  window.addEventListener("error", resizeObserverErrHandler, true);
  window.addEventListener("unhandledrejection", unhandledRejectionHandler, true);
  
  // Supprimer aussi les erreurs de la console
  const consoleError = console.error;
  console.error = (...args) => {
    if (args[0]?.includes?.("ResizeObserver")) {
      return;
    }
    consoleError.apply(console, args);
  };
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
// Build force: 1770570055
