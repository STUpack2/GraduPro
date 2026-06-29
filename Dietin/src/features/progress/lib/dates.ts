// Date helpers shared by every progress feature.
// Keep these in sync with userStore.getLocalDateKey ("yyyy-MM-dd" in LOCAL time).

import type { DateKey, WeekId } from "../types";

export function localDateKey(d: Date = new Date()): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysBetween(a: DateKey, b: DateKey): number {
  const da = parseDateKey(a).getTime();
  const db = parseDateKey(b).getTime();
  return Math.round((db - da) / 86_400_000);
}

export function addDays(date: Date | DateKey, days: number): Date {
  const d = typeof date === "string" ? parseDateKey(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ISO 8601 week id ("yyyy-Www"). Thursday rule.
export function isoWeekId(d: Date = new Date()): WeekId {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Monday-anchored start-of-week (local time) for a given local date.
export function startOfIsoWeek(d: Date = new Date()): Date {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7; // 0=Mon
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - day);
  return out;
}

export function endOfIsoWeek(d: Date = new Date()): Date {
  const start = startOfIsoWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function weekIdForDateKey(key: DateKey): WeekId {
  return isoWeekId(parseDateKey(key));
}

export function* iterateDateKeys(from: DateKey, to: DateKey): Generator<DateKey> {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  const d = new Date(start);
  while (d <= end) {
    yield localDateKey(d);
    d.setDate(d.getDate() + 1);
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
