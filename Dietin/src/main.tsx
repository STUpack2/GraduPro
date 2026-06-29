// Provide process polyfill for Next.js components
if (typeof window !== 'undefined' && !window.process) {
  (window as any).process = {
    env: {} as Record<string, string>,
    browser: true,
    version: '',
    nextTick: (fn: () => void) => setTimeout(fn, 0)
  } as any;
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n/i18n'
// removed GoogleOAuthProvider
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register'
import { initTheme } from './lib/theme'

// Register PWA Service Worker with auto update
if (typeof window !== 'undefined') {
  // Apply stored theme (default light) as early as possible
  try { initTheme('light'); } catch { }
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() { },
    onOfflineReady() { }
  })
    // Optionally expose for manual update trigger
    ; (window as any).updateSW = updateSW
}

// Ensure the system status bar color matches the app's top background
function updateThemeColorFromBody() {
  try {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) return;
    const bg = getComputedStyle(document.body).backgroundColor || '#ffffff';
    if (meta.content !== bg) meta.content = bg;
  } catch { }
}

// Ensure iOS PWA status bar (standalone) matches theme (white when light, black when dark)
function updateAppleStatusBarStyle() {
  try {
    const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
    if (!appleMeta) return;
    const isDark = document.documentElement.classList.contains('theme-dark-invert');
    // Options: default, black, black-translucent
    appleMeta.content = isDark ? 'black' : 'default';
  } catch { }
}

if (typeof window !== 'undefined') {
  const applyThemeColor = () => updateThemeColorFromBody();
  // Apply at key lifecycle moments
  window.addEventListener('load', applyThemeColor, { once: true });
  document.addEventListener('visibilitychange', applyThemeColor);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyThemeColor as any);
  window.addEventListener('resize', applyThemeColor);
  // Observe body attribute/class changes that might flip background
  try {
    const mo = new MutationObserver(() => applyThemeColor());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
  } catch { }
  // Also keep iOS status bar style aligned
  const syncApple = () => updateAppleStatusBarStyle();
  window.addEventListener('load', syncApple, { once: true });
  document.addEventListener('visibilitychange', syncApple);
  try {
    const mo2 = new MutationObserver(() => syncApple());
    mo2.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  } catch { }
}

// Helper to hide and remove the splash overlay after mount
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  el.classList.add('hide');
  // Remove after transition
  window.setTimeout(() => {
    el.parentElement?.removeChild(el);
  }, 400);
}

// Use HashRouter for native/webview schemes (non-http/https), BrowserRouter for web
const isNativeLike = typeof window !== 'undefined' && !/^https?:/.test(window.location.protocol);
const isWeb = typeof window !== 'undefined' && /^https?:/.test(window.location.protocol);
const Router: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  isNativeLike ? <HashRouter>{children}</HashRouter> : <BrowserRouter>{children}</BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
)

// Hide the splash when window finishes loading (ensures assets are fetched),
// with a safe fallback so it doesn't hang on slow networks.
if (typeof window !== 'undefined') {
  let done = false;
  const doHide = () => {
    if (done) return;
    done = true;
    requestAnimationFrame(() => requestAnimationFrame(hideSplash));
  };
  // Prefer full load
  window.addEventListener('load', doHide, { once: true });
  // Fallback after ~2s so it’s not too fast but also doesn’t feel stuck
  window.setTimeout(doHide, 2000);
}
