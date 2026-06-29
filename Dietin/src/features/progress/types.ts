// Domain types for the Progress 2.0 transformation hub.
// All dates are stored as local "yyyy-MM-dd" keys to match userStore.getLocalDateKey.
// Week ids are ISO ("yyyy-Www", e.g. "2026-W26").

export type DateKey = string;
export type WeekId = string;
export type ExerciseSlug = string;
export type PhotoView = "front" | "side" | "back";
export type StreakKind =
  | "workout"
  | "protein"
  | "calories"
  | "hydration"
  | "visit";

export interface WeightEntry {
  date: DateKey;
  weightKg: number;
  source?: "manual" | "import";
  note?: string;
}

export interface BodyMeasurement {
  date: DateKey;
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  hipsCm?: number;
  thighsCm?: number;
  neckCm?: number;
}

export interface PhotoAsset {
  path: string;
  thumbPath?: string;
  width?: number;
  height?: number;
}

export interface ProgressPhoto {
  weekId: WeekId;
  capturedAt: string;
  weightKgAtCapture?: number;
  front?: PhotoAsset;
  side?: PhotoAsset;
  back?: PhotoAsset;
}

export interface ExerciseRecord {
  name: string;
  musclesWorked: string[];
  setsCompleted: number;
  totalSets: number;
  reps: number;
  weight: number;
  restTime: number;
  rpm?: number;
  volume?: number;
}

export interface WorkoutSession {
  sessionId: string;
  date: DateKey;
  muscleGroup: string;
  completionPercentage: number;
  totalVolumeKg: number;
  exercises: ExerciseRecord[];
  createdAt?: string;
}

export interface PrAttempt {
  date: DateKey;
  weightKg: number;
  reps: number;
  e1rmKg: number;
  volumeKg: number;
}

export interface PersonalRecord {
  exercise: string;
  exerciseSlug: ExerciseSlug;
  bestWeightKg: number;
  bestWeightReps: number;
  bestE1rmKg: number;
  bestVolumeKg: number;
  history: PrAttempt[];
  updatedAt?: string;
}

export interface FitnessScore {
  date: DateKey;
  diet: number;
  workout: number;
  hydration: number;
  consistency: number;
  overall: number;
}

export interface WeeklyReport {
  weekId: WeekId;
  weekStart: DateKey;
  weekEnd: DateKey;
  weightDeltaKg: number;
  workoutsCompleted: number;
  proteinHitDays: number;
  calorieHitDays: number;
  hydrationHitDays: number;
  consistencyScoreDelta: number;
  summaryText: string;
  summaryHighlights: string[];
  shareImagePath?: string;
  generatedAt?: string;
  model?: string;
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastDate?: DateKey;
}

export type StreaksDoc = Record<StreakKind, StreakInfo> & {
  updatedAt?: string;
};

export interface HydrationDailyEntry {
  date: DateKey;
  ml: number;
  goalMl: number;
}

export interface ProjectionPoint {
  targetKg: number;
  weeks: number | null;
  etaDate: DateKey | null;
}

export interface ProjectionResult {
  slopePerWeek: number;
  intercept: number;
  rSquared: number;
  confidence: "high" | "medium" | "low";
  points: ProjectionPoint[];
  basisWeeks: number;
}

export interface WeeklyTrendStats {
  thisWeekDeltaKg: number | null;
  lastWeekDeltaKg: number | null;
  trend: "accelerating" | "steady" | "slowing" | "reversing" | "insufficient";
  weeklyHistory: { weekId: WeekId; deltaKg: number }[];
}
