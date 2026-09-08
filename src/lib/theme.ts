export const themeKey = "cadence-theme";
export type Theme = "light" | "dark" | "system";
export function parseTheme(value: string | null): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

// Runs in the head, before the page is painted. Storage can be unavailable in
// privacy-restricted browsers; system appearance still works in that case.
export const themeScript = `(() => {
  let mode = 'system';
  try {
    const saved = localStorage.getItem('${themeKey}');
    if (saved === 'light' || saved === 'dark') mode = saved;
  } catch {}
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.theme = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
})();`;
