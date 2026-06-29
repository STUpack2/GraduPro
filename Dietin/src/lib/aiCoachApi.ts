// Shared helper for talking to the AI Coach FastAPI server.
// Base URL comes from VITE_AI_API_URL. When unset, isAiConfigured() returns
// false and the UI shows the BackendOfflineEmpty state instead of throwing.
const RAW = (import.meta.env.VITE_AI_API_URL as string | undefined)?.trim() ?? "";

export function aiBase(): string {
  return RAW.replace(/\/+$/, "");
}

export function isAiConfigured(): boolean {
  return aiBase().length > 0;
}

export class AiServerError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AiServerError";
  }
}

export async function aiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isAiConfigured()) {
    throw new AiServerError(0, "AI Coach is not configured (set VITE_AI_API_URL).");
  }
  const url = `${aiBase()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.text();
      if (body) detail = body.slice(0, 500);
    } catch {
      /* ignore */
    }
    throw new AiServerError(res.status, `${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}
