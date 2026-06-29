// Lightweight in-memory seeding for design reviews. Activated via ?demo=true.
// We do NOT touch Firestore from here — only the in-memory progressStore so
// designers can inspect populated states without polluting real user data.
import { useProgressStore } from "@/stores/progressStore";
import { addDays, isoWeekId, localDateKey } from "./dates";
import { evaluateSession } from "./prDetection";
import type { BodyMeasurement, FitnessScore, PersonalRecord, ProgressPhoto, WeeklyReport, WeightEntry, WorkoutSession } from "../types";

const TODAY = localDateKey();

function dateOffset(days: number) {
  return localDateKey(addDays(new Date(), -days));
}

function buildWeights(): WeightEntry[] {
  const start = 92;
  const out: WeightEntry[] = [];
  for (let i = 84; i >= 0; i -= 2) {
    const progress = (84 - i) / 84;
    const noise = (i % 6 === 0 ? 0.4 : -0.2);
    out.push({
      date: dateOffset(i),
      weightKg: Number((start - progress * 14 + noise).toFixed(1)),
      source: "manual",
    });
  }
  return out;
}

function buildMeasurements(): BodyMeasurement[] {
  return [60, 30, 0].map((d) => ({
    date: dateOffset(d),
    waistCm: 92 - d * 0.05,
    chestCm: 100 + (60 - d) * 0.08,
    armsCm: 35 + (60 - d) * 0.05,
    hipsCm: 102 - d * 0.04,
    thighsCm: 58 + (60 - d) * 0.03,
    neckCm: 39,
  }));
}

function buildWorkouts(): WorkoutSession[] {
  const groups = ["Chest", "Back", "Legs", "Shoulders", "Arms"];
  const exercises: Record<string, { name: string; muscle: string[] }[]> = {
    Chest:     [{ name: "Bench Press", muscle: ["chest"] }, { name: "Incline Dumbbell", muscle: ["chest"] }, { name: "Cable Fly", muscle: ["chest"] }],
    Back:      [{ name: "Deadlift", muscle: ["back"] }, { name: "Pull Up", muscle: ["back"] }, { name: "Seated Row", muscle: ["back"] }],
    Legs:      [{ name: "Squat", muscle: ["legs"] }, { name: "Romanian Deadlift", muscle: ["legs"] }, { name: "Leg Press", muscle: ["legs"] }],
    Shoulders: [{ name: "Shoulder Press", muscle: ["shoulders"] }, { name: "Lateral Raise", muscle: ["shoulders"] }],
    Arms:      [{ name: "Barbell Curl", muscle: ["arms"] }, { name: "Tricep Pushdown", muscle: ["arms"] }],
  };
  const out: WorkoutSession[] = [];
  for (let i = 0; i < 24; i++) {
    const group = groups[i % groups.length];
    const date = dateOffset(i * 2);
    const exs = exercises[group].map((e, idx) => {
      const baseWeight = 40 + idx * 10 + (i % 5) * 1.25;
      const reps = 8 + (i % 3);
      return {
        name: e.name,
        musclesWorked: e.muscle,
        setsCompleted: 4,
        totalSets: 4,
        reps,
        weight: Number(baseWeight.toFixed(1)),
        restTime: 90,
        volume: Number((baseWeight * reps * 4).toFixed(1)),
      };
    });
    const total = exs.reduce((s, ex) => s + (ex.volume ?? 0), 0);
    out.push({
      sessionId: `${date}-${group.toLowerCase()}`,
      date,
      muscleGroup: group,
      completionPercentage: 100,
      totalVolumeKg: total,
      exercises: exs,
    });
  }
  return out;
}

function buildPRs(workouts: WorkoutSession[]): Record<string, PersonalRecord> {
  const ordered = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const prs: Record<string, PersonalRecord> = {};
  for (const session of ordered) {
    const updates = evaluateSession(session, prs);
    for (const u of updates) prs[u.slug] = u.record;
  }
  return prs;
}

function buildHydration(): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    out[dateOffset(i)] = 1800 + (i % 3) * 400;
  }
  return out;
}

function buildScores(): FitnessScore[] {
  const out: FitnessScore[] = [];
  for (let i = 60; i >= 0; i--) {
    const t = (60 - i) / 60;
    const drift = Math.sin(i / 4) * 4;
    out.push({
      date: dateOffset(i),
      diet: Math.round(60 + t * 30 + drift),
      workout: Math.round(55 + t * 30),
      hydration: Math.round(70 + t * 20),
      consistency: Math.round(50 + t * 45),
      overall: Math.round(60 + t * 28),
    });
  }
  return out;
}

function buildPhotos(): ProgressPhoto[] {
  return [];
}

function buildReports(): WeeklyReport[] {
  return [];
}

export async function seedDemoData(): Promise<void> {
  const store = useProgressStore.getState();
  if (store.workouts.length > 0 && store.weights.length > 0) return;
  const weights = buildWeights();
  const measurements = buildMeasurements();
  const workouts = buildWorkouts();
  const prs = buildPRs(workouts);
  const hydrationDaily = buildHydration();
  const fitnessScores = buildScores();
  useProgressStore.setState({
    hydrated: true,
    startWeightKg: weights[0]?.weightKg ?? null,
    startWeightDate: weights[0]?.date ?? null,
    weights,
    measurements,
    workouts,
    prs,
    hydrationDaily,
    fitnessScores,
    photos: buildPhotos(),
    weeklyReports: buildReports(),
  });
  await store.recomputeStreaks();
  void TODAY; // keep referenced
  void isoWeekId; // future use for photo seeding
}
