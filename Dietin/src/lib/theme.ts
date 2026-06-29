export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const CLASS_NAME = 'theme-dark-invert';

export function getStoredTheme(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY);
  return (v === 'dark' || v === 'light') ? v : 'light';
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement; // <html>
  if (mode === 'dark') {
    root.classList.add(CLASS_NAME);
  } else {
    root.classList.remove(CLASS_NAME);
  }
  // Notify listeners (e.g., pages/components) that theme changed
  window.dispatchEvent(new CustomEvent('themechange', { detail: { mode } }));
}

export function setTheme(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode);
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getStoredTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function initTheme(defaultMode: ThemeMode = 'light') {
  const stored = getStoredTheme();
  const mode: ThemeMode = stored || defaultMode;
  applyTheme(mode);
}
