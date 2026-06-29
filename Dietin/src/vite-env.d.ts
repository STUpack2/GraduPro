/// <reference types="vite/client" />

interface Window {
  process: {
    env: Record<string, string>;
    browser: boolean;
    version: string;
    nextTick: (callback: () => void) => void;
    [key: string]: any;
  };
}

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}
