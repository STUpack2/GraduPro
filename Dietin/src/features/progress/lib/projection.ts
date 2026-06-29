// Pure projection / weekly-trend math. No React, no Firebase.

import { addDays, daysBetween, localDateKey, weekIdForDateKey } from "./dates";
import type {
  ProjectionPoint,
  ProjectionResult,
  WeeklyTrendStats,
  WeightEntry,
} from "../types";

const MIN_POINTS = 3;

// Ordinary least squares on (dayIndex, weightKg) where dayIndex is days from
// the first sample. Slope is reported per WEEK to match user mental model.
function linearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, rSquared: 0 };

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const yHat = slope * p.x + intercept;
    ssRes += (p.y - yHat) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, rSquared };
}

function confidenceFromR2(r2: number, samples: number): ProjectionResult["confidence"] {
  if (samples < 5 || r2 < 0.35) return "low";
  if (samples < 10 || r2 < 0.65) return "medium";
  return "high";
}

/**
 * Project ETA dates for a set of target weights using a linear fit on the
 * supplied weight series. Returns null weeks for targets the trend can't reach
 * (e.g., losing weight but target is heavier than today). Operates on a copy.
 */
export function projectTargets(
  weights: WeightEntry[],
  targets: number[],
): ProjectionResult {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < MIN_POINTS) {
    return {
      slopePerWeek: 0,
      intercept: sorted[0]?.weightKg ?? 0,
      rSquared: 0,
      confidence: "low",
      basisWeeks: 0,
      points: targets.map((t) => ({ targetKg: t, weeks: null, etaDate: null })),
    };
  }

  // Use only the most recent ~8 weeks for trend (matches user expectation
  // that "recent pace" drives projection — not their starting honeymoon).
  const today = sorted[sorted.length - 1].date;
  const recent = sorted.filter((w) => daysBetween(w.date, today) <= 56);
  const series = recent.length >= MIN_POINTS ? recent : sorted;

  const firstDate = series[0].date;
  const samples = series.map((w) => ({
    x: daysBetween(firstDate, w.date),
    y: w.weightKg,
  }));
  const { slope, intercept, rSquared } = linearRegression(samples);
  const slopePerWeek = slope * 7;
  const todayDayIndex = samples[samples.length - 1].x;
  const todayWeight = slope * todayDayIndex + intercept;

  const points: ProjectionPoint[] = targets.map((target) => {
    const delta = target - todayWeight;
    // direction mismatch (e.g. target is below current but slope is positive)
    const reachable = Math.sign(delta) === Math.sign(slope) || slope === 0
      ? false
      : true;
    if (!reachable || slope === 0 || Math.abs(slope) < 1e-6) {
      return { targetKg: target, weeks: null, etaDate: null };
    }
    const daysToTarget = delta / slope;
    if (!isFinite(daysToTarget) || daysToTarget < 0) {
      return { targetKg: target, weeks: null, etaDate: null };
    }
    const eta = addDays(today, Math.round(daysToTarget));
    return {
      targetKg: target,
      weeks: Math.max(1, Math.round(daysToTarget / 7)),
      etaDate: localDateKey(eta),
    };
  });

  const basisDays = daysBetween(firstDate, today);
  return {
    slopePerWeek,
    intercept,
    rSquared,
    confidence: confidenceFromR2(rSquared, series.length),
    basisWeeks: Math.max(1, Math.round(basisDays / 7)),
    points,
  };
}

/**
 * Compute this-week vs last-week weight deltas and an overall trend label.
 * Treats "delta" as (last entry of week) - (first entry of week). Returns
 * `insufficient` when there aren't enough samples on either side to compare.
 */
export function computeWeeklyTrend(weights: WeightEntry[]): WeeklyTrendStats {
  if (weights.length === 0) {
    return {
      thisWeekDeltaKg: null,
      lastWeekDeltaKg: null,
      trend: "insufficient",
      weeklyHistory: [],
    };
  }
  const buckets = new Map<string, WeightEntry[]>();
  for (const w of weights) {
    const wk = weekIdForDateKey(w.date);
    const arr = buckets.get(wk) ?? [];
    arr.push(w);
    buckets.set(wk, arr);
  }
  const orderedWeeks = [...buckets.keys()].sort();
  const weeklyHistory = orderedWeeks.map((wk) => {
    const arr = buckets.get(wk)!.sort((a, b) => a.date.localeCompare(b.date));
    const delta = arr[arr.length - 1].weightKg - arr[0].weightKg;
    return { weekId: wk, deltaKg: Number(delta.toFixed(2)) };
  });

  const thisWeekDeltaKg = weeklyHistory.at(-1)?.deltaKg ?? null;
  const lastWeekDeltaKg = weeklyHistory.at(-2)?.deltaKg ?? null;

  let trend: WeeklyTrendStats["trend"] = "insufficient";
  if (thisWeekDeltaKg !== null && lastWeekDeltaKg !== null) {
    // Negative delta = losing weight (user goal in most cases).
    // Accelerating means same direction and bigger magnitude.
    const sameDirection = Math.sign(thisWeekDeltaKg) === Math.sign(lastWeekDeltaKg)
      || Math.sign(thisWeekDeltaKg) === 0;
    const reversing = Math.sign(thisWeekDeltaKg) !== 0
      && Math.sign(lastWeekDeltaKg) !== 0
      && Math.sign(thisWeekDeltaKg) !== Math.sign(lastWeekDeltaKg);

    if (reversing) trend = "reversing";
    else if (sameDirection && Math.abs(thisWeekDeltaKg) > Math.abs(lastWeekDeltaKg) + 0.05) {
      trend = "accelerating";
    } else if (sameDirection && Math.abs(thisWeekDeltaKg) < Math.abs(lastWeekDeltaKg) - 0.05) {
      trend = "slowing";
    } else {
      trend = "steady";
    }
  }

  return { thisWeekDeltaKg, lastWeekDeltaKg, trend, weeklyHistory };
}
