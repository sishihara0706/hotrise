"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem("theme") as Theme | null;
    return stored ?? "system";
  });
  const [hasMounted, setHasMounted] = useState(false);

  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement;

    if (newTheme === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    } else {
      root.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
    }
  }, []);

  useEffect(() => {
    const initialTheme = localStorage.getItem("theme") as Theme | null;
    if (initialTheme) {
      applyTheme(initialTheme);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true);
  }, [applyTheme]);

  function toggleTheme() {
    const nextTheme: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  if (!hasMounted) return null;

  const icon = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🔄";

  return (
    <button
      onClick={toggleTheme}
      className="themeToggle"
      aria-label={`現在のテーマ: ${theme}`}
      title="テーマ切替 (ライト/ダーク/システム)"
    >
      {icon}
    </button>
  );
}
