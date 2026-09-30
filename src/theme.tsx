/**
 * ライト/ダークテーマ (旧 theme.js と等価)。
 * localStorageキー "theme"、documentElement の data-theme 属性、
 * is-theme-animating クラス、storage イベント同期を維持する。
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "theme";

export function getInitialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* private mode などでは既定にフォールバック */
  }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.add("is-theme-animating");
  window.setTimeout(() => root.classList.remove("is-theme-animating"), 600);
}

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    applyTheme(getInitialTheme());
    setTheme(readTheme());
    const onStorage = (e: StorageEvent): void => {
      if (e.key === STORAGE_KEY) {
        const next = e.newValue === "dark" || e.newValue === "light" ? e.newValue : getInitialTheme();
        applyTheme(next);
        setTheme(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
