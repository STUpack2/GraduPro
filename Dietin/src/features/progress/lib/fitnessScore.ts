// Compose a 0-100 fitness score from the 4 subdomains. Each sub-score is a
// 7-day rolling adherence ratio expressed 0-100. The overall score is the
// arithmetic mean — equally weighted by design (matches the spec's example).

import { daysBetween, localDateKey } from "./dates";
import type { DateKey, FitnessScore, WorkoutSession } from "../types";

const round = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

interface FitnessInputs {
  today?: DateKey;
  /** map of yyyy-MM-dd -> {calories, protein} totals from userStore.dailyCalories */
  dailyCalories: Record<string, { totalCalories: number; totalProtein: number }>;
  goals: { calorieGoal: number; proteinGoal: number };
  /** map of yyyy-MM-dd -> ml */
  hydrationDaily: Record<string, number>;
  hydrationGoalMl: number;
  /** workout sessions, any dates — we filter to last 7 */
  workouts: WorkoutSession[];
  /** target workouts per week (default 4 if missing) */
  workoutDaysPerWeek?: number;
  /** for consistency: how many of last 7 days had ANY logged activity */
  activityDateSet?: Set<DateKey>;
}

export function dietScore(inputs: FitnessInputs): number {
  const { today = localDateKey(), dailyCalories, goals } = inputs;
  let hit = 0;
  let evaluated = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const day = dailyCalories[key];
    if (!day) continue;
    evaluated += 1;
    const calPct = goals.calorieGoal ? day.totalCalories / goals.calorieGoal : 0;
    const proteinPct = goals.proteinGoal ? day.totalProtein / goals.proteinGoal : 0;
    // Calorie target is "within ±10%", protein is "≥90% of goal".
    const calHit = calPct >= 0.9 && calPct <= 1.1;
    const protHit = proteinPct >= 0.9;
    if (calHit && protHit) hit += 1;
    else if (calHit || protHit) hit += 0.5;
  }
  if (evaluated === 0) return 0;
  return round((hit / evaluated) * 100);
}

export function hydrationScore(inputs: FitnessInputs): number {
  const { today = localDateKey(), hydrationDaily, hydrationGoalMl } = inputs;
  if (!hydrationGoalMl) return 0;
  let hit = 0;
  let evaluated = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const ml = hydrationDaily[key];
    if (ml === undefined) continue;
    evaluated += 1;
    if (ml >= hydrationGoalMl) hit += 1;
    else hit += Math.max(0, ml / hydrationGoalMl);
  }
  if (evaluated === 0) return 0;
  return round((hit / evaluated) * 100);
}

export function workoutScore(inputs: FitnessInputs): number {
  const { today = localDateKey(), workouts, workoutDaysPerWeek = 4 } = inputs;
  const last7 = new Set<string>();
  for (const s of workouts) {
    const age = daysBetween(s.date, today);
    if (age >= 0 && age < 7 && s.completionPercentage > 0) last7.add(s.date);
  }
  return round((last7.size / workoutDaysPerWeek) * 100);
}

export function consistencyScore(inputs: FitnessInputs): number {
  const { today = localDateKey(), activityDateSet } = inputs;
  if (!activityDateSet || activityDateSet.size === 0) return 0;
  let hit = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (activityDateSet.has(localDateKey(d))) hit += 1;
  }
  return round((hit / 7) * 100);
}

export function composeFitnessScore(inputs: FitnessInputs): FitnessScore {
  const date = inputs.today ?? localDateKey();
  const diet = dietScore(inputs);
  const workout = workoutScore(inputs);
  const hydration = hydrationScore(inputs);
  const consistency = consistencyScore(inputs);
  const overall = round((diet + workout + hydration + consistency) / 4);
  return { date, diet, workout, hydration, consistency, overall };
}
