import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "auto";

interface ThemeState {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "auto" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

const STORAGE_KEY = "metaboard:theme";

export const useThemeStore = create<ThemeState>((set) => ({
  mode: ((typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as ThemeMode) || "auto",
  setMode: (mode) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
    set({ mode });
  },
}));

export function initTheme() {
  if (typeof window === "undefined") return;
  const mode = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "auto";
  applyTheme(mode);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    const m = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "auto";
    if (m === "auto") applyTheme("auto");
  });
}
