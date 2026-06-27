import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/App";
import { initTheme } from "./modules/settings/themeStore";
import "./styles.css";

initTheme();

const root = document.getElementById("root");
if (!root) throw new Error("Root element não encontrado");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
