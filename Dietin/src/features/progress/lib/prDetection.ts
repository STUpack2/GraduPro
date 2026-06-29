// PR detection. Updates a PR doc for each exercise present in a session.

import { slugify } from "./dates";
import type { ExerciseRecord, PersonalRecord, PrAttempt, WorkoutSession } from "../types";

// Epley one-rep-max estimate. Returns 0 for invalid inputs.
export function epley1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return Math.round(weightKg * (1 + reps / 30) * 100) / 100;
}

export interface PrUpdate {
  slug: string;
  record: PersonalRecord;
  isNewPr: boolean;
  // What broke (used for celebrations / weekly report highlights)
  prKinds: ("weight" | "e1rm" | "volume")[];
}

function setVolume(ex: ExerciseRecord): number {
  return ex.weight * ex.reps; // single-set volume for PR purposes
}

export function evaluateSession(
  session: WorkoutSession,
  existing: Record<string, PersonalRecord>,
): PrUpdate[] {
  const out: PrUpdate[] = [];
  for (const ex of session.exercises) {
    if (!ex.weight || !ex.reps || ex.setsCompleted <= 0) continue;
    const slug = slugify(ex.name);
    if (!slug) continue;
    const prev = existing[slug];

    const e1rm = epley1rm(ex.weight, ex.reps);
    const vol = setVolume(ex);
    const attempt: PrAttempt = {
      date: session.date,
      weightKg: ex.weight,
      reps: ex.reps,
      e1rmKg: e1rm,
      volumeKg: vol,
    };

    const prKinds: PrUpdate["prKinds"] = [];
    if (!prev || ex.weight > prev.bestWeightKg) prKinds.push("weight");
    if (!prev || e1rm > prev.bestE1rmKg) prKinds.push("e1rm");
    if (!prev || vol > prev.bestVolumeKg) prKinds.push("volume");

    const record: PersonalRecord = {
      exercise: ex.name,
      exerciseSlug: slug,
      bestWeightKg: Math.max(prev?.bestWeightKg ?? 0, ex.weight),
      bestWeightReps: prKinds.includes("weight")
        ? ex.reps
        : prev?.bestWeightReps ?? ex.reps,
      bestE1rmKg: Math.max(prev?.bestE1rmKg ?? 0, e1rm),
      bestVolumeKg: Math.max(prev?.bestVolumeKg ?? 0, vol),
      history: [attempt, ...(prev?.history ?? [])].slice(0, 50),
      updatedAt: new Date().toISOString(),
    };
    out.push({ slug, record, isNewPr: prKinds.length > 0, prKinds });
  }
  return out;
}
