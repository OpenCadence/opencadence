"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { parseTheme, themeKey, type Theme } from "@/lib/theme";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
] as const;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function sync() {
      const mode = parseTheme(
        document.documentElement.dataset.themeMode || null,
      );
      document.documentElement.dataset.theme =
        mode === "system" ? (media.matches ? "dark" : "light") : mode;
      setTheme(mode);
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== themeKey && event.key !== null) return;
      document.documentElement.dataset.themeMode = parseTheme(event.newValue);
      sync();
    }
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function change(mode: Theme) {
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dataset.theme =
      mode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : mode;
    setTheme(mode);
    try {
      localStorage.setItem(themeKey, mode);
    } catch {
      /* Session-only preference. */
    }
  }

  return (
    <fieldset className="theme-control">
      <legend>Appearance</legend>
      <div className="theme-options">
        {options.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            title={
              value === "system"
                ? "Follow your browser or system appearance"
                : `${label} appearance`
            }
          >
            <input
              type="radio"
              name="appearance"
              value={value}
              checked={theme === value}
              onChange={() => change(value)}
            />
            <span>
              <Icon size={14} strokeWidth={1.7} />
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
