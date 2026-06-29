// Pure volume + muscle-group analytics for the Workout Analytics section.

import { daysBetween, localDateKey } from "./dates";
import type { DateKey, WorkoutSession } from "../types";

export function sessionVolume(session: WorkoutSession): number {
  if (session.totalVolumeKg) return session.totalVolumeKg;
  return session.exercises.reduce((sum, ex) => {
    const v = ex.volume ?? ex.weight * ex.reps * ex.setsCompleted;
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
}

const MUSCLE_GROUP_BUCKETS: { id: string; match: RegExp }[] = [
  { id: "chest",     match: /chest|pec|bench|fly/i },
  { id: "back",      match: /back|lat|row|pull|deadlift/i },
  { id: "legs",      match: /leg|quad|hamstring|squat|lunge|calf|glute|hip/i },
  { id: "shoulders", match: /shoulder|delt|press|lateral|raise/i },
  { id: "arms",      match: /bicep|tricep|curl|extension|arm/i },
  { id: "core",      match: /abs|core|plank|crunch|twist|leg.?raise/i },
];

export function bucketMuscleGroup(label: string): string {
  for (const b of MUSCLE_GROUP_BUCKETS) if (b.match.test(label)) return b.id;
  return "other";
}

export interface MuscleVolumeRow {
  group: string;
  currentVolumeKg: number;
  previousVolumeKg: number;
  deltaPct: number | null;
}

/**
 * Volume by muscle group for `currentWindowDays` (default 7) vs the immediately
 * preceding window of the same size. Returns rows sorted by current volume.
 */
export function volumeByMuscle(
  sessions: WorkoutSession[],
  currentWindowDays = 7,
  today: DateKey = localDateKey(),
): MuscleVolumeRow[] {
  const totals = new Map<string, { current: number; previous: number }>();
  for (const s of sessions) {
    const age = daysBetween(s.date, today);
    if (age < 0) continue;
    const bucket = age < currentWindowDays
      ? "current"
      : age < currentWindowDays * 2
        ? "previous"
        : null;
    if (!bucket) continue;

    for (const ex of s.exercises) {
      const muscles = ex.musclesWorked?.length ? ex.musclesWorked : [s.muscleGroup, ex.name];
      const group = bucketMuscleGroup(muscles.join(" "));
      const vol = ex.volume ?? ex.weight * ex.reps * ex.setsCompleted;
      if (!Number.isFinite(vol)) continue;
      const row = totals.get(group) ?? { current: 0, previous: 0 };
      row[bucket as "current" | "previous"] += vol;
      totals.set(group, row);
    }
  }
  const rows: MuscleVolumeRow[] = [];
  for (const [group, { current, previous }] of totals) {
    const deltaPct = previous > 0
      ? ((current - previous) / previous) * 100
      : current > 0 ? null : null;
    rows.push({
      group,
      currentVolumeKg: Math.round(current),
      previousVolumeKg: Math.round(previous),
      deltaPct: deltaPct === null ? null : Number(deltaPct.toFixed(0)),
    });
  }
  rows.sort((a, b) => b.currentVolumeKg - a.currentVolumeKg);
  return rows;
}

/**
 * 7×N volume heatmap, N weeks deep. Returns a row per weekday (Mon..Sun) and
 * a column per week (oldest first). Cell value is total volume that day.
 */
export interface HeatmapMatrix {
  weeks: number;
  weekdays: string[];
  matrix: number[][]; // [weekday][weekIndex]
  max: number;
}
export function workoutHeatmap(
  sessions: WorkoutSession[],
  weeks = 8,
  today: DateKey = localDateKey(),
): HeatmapMatrix {
  const matrix: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: weeks }, () => 0),
  );
  let max = 0;
  for (const s of sessions) {
    const age = daysBetween(s.date, today);
    if (age < 0 || age >= weeks * 7) continue;
    const wkBack = Math.floor(age / 7);
    const wkIndex = weeks - 1 - wkBack;
    const weekday = (new Date(s.date).getDay() + 6) % 7; // Mon=0
    const v = sessionVolume(s);
    matrix[weekday][wkIndex] += v;
    if (matrix[weekday][wkIndex] > max) max = matrix[weekday][wkIndex];
  }
  return {
    weeks,
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    matrix,
    max,
  };
}
