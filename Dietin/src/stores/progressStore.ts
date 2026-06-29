// Progress 2.0 store — single owner of weights, measurements, photos, workouts,
// PRs, hydration log, fitness scores, weekly reports, and per-kind streaks.
//
// Persists slim cache to localStorage so the dashboard renders instantly offline,
// then hydrates from Firestore on first auth.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { auth } from "@/lib/firebase";
import {
  batchUpsertWorkouts,
  loadFitnessScores,
  loadHydrationDaily,
  loadMeasurements,
  loadPersonalRecords,
  loadPhotos,
  loadStreaks,
  loadUserBase,
  loadWeeklyReports,
  loadWeights,
  loadWorkouts,
  saveStartWeightIfMissing,
  saveStreaks,
  upsertFitnessScore,
  upsertHydrationDaily,
  upsertMeasurement,
  upsertPersonalRecord,
  upsertPhotoDoc,
  upsertWeeklyReport,
  upsertWeight,
  upsertWorkoutSession,
} from "@/lib/firestoreProgress";
import {
  deleteProgressPhoto,
  uploadProgressPhoto,
} from "@/lib/storageProgress";
import {
  isoWeekId,
  localDateKey,
  slugify,
} from "@/features/progress/lib/dates";
import { evaluateSession } from "@/features/progress/lib/prDetection";
import { composeFitnessScore } from "@/features/progress/lib/fitnessScore";
import { computeStreak } from "@/features/progress/lib/streaks";
import type {
  BodyMeasurement,
  DateKey,
  ExerciseRecord,
  FitnessScore,
  HydrationDailyEntry,
  PersonalRecord,
  PhotoAsset,
  PhotoView,
  ProgressPhoto,
  StreaksDoc,
  StreakKind,
  WeeklyReport,
  WeekId,
  WeightEntry,
  WorkoutSession,
} from "@/features/progress/types";

const BACKFILL_FLAG = "progressStore.workoutHistoryBackfilled";

interface ProgressState {
  hydrated: boolean;
  loading: boolean;
  uid: string | null;
  startWeightKg: number | null;
  startWeightDate: DateKey | null;

  weights: WeightEntry[];
  measurements: BodyMeasurement[];
  photos: ProgressPhoto[];
  workouts: WorkoutSession[];
  prs: Record<string, PersonalRecord>;
  hydrationDaily: Record<DateKey, number>; // local mirror keyed by date
  fitnessScores: FitnessScore[];
  weeklyReports: WeeklyReport[];
  streaks: StreaksDoc;

  // photo url cache (volatile, never persisted)
  photoUrlCache: Record<string, string>;

  hydrate: (uid: string) => Promise<void>;
  reset: () => void;

  addWeight: (kg: number, opts?: { date?: DateKey; note?: string; source?: "manual" | "import" }) => Promise<void>;
  addMeasurement: (partial: Partial<BodyMeasurement> & { date?: DateKey }) => Promise<void>;

  uploadPhoto: (view: PhotoView, file: File, opts?: { weekId?: WeekId; weightKg?: number }) => Promise<void>;
  removePhoto: (weekId: WeekId, view: PhotoView) => Promise<void>;
  rememberPhotoUrl: (path: string, url: string) => void;

  recordWorkout: (legacy: LegacyWorkoutPayload) => Promise<void>;
  backfillFromLocalStorage: () => Promise<void>;

  recordHydration: (ml: number, opts?: { date?: DateKey; goalMl?: number }) => Promise<void>;

  recomputeFitnessScore: (today?: DateKey) => Promise<FitnessScore | null>;
  recomputeStreaks: () => Promise<StreaksDoc>;

  cacheWeeklyReport: (report: WeeklyReport) => Promise<void>;
}

// Legacy shape that Plan.tsx already writes — see Plan.tsx:954.
export interface LegacyWorkoutPayload {
  date: string; // ISO datetime
  muscleGroup: string;
  exercises: ExerciseRecord[];
  completionPercentage: number;
}

const emptyStreak = (): StreaksDoc => ({
  workout: { current: 0, longest: 0 },
  protein: { current: 0, longest: 0 },
  calories: { current: 0, longest: 0 },
  hydration: { current: 0, longest: 0 },
  visit: { current: 0, longest: 0 },
});

function legacyToSession(legacy: LegacyWorkoutPayload): WorkoutSession {
  const date = legacy.date?.slice(0, 10) || localDateKey();
  const firstName = legacy.exercises?.[0]?.name ?? legacy.muscleGroup ?? "workout";
  const sessionId = `${date}-${slugify(legacy.muscleGroup ?? "workout")}-${slugify(firstName)}`;
  const exercises = (legacy.exercises ?? []).map((ex) => ({
    ...ex,
    volume: ex.volume ?? ex.weight * ex.reps * ex.setsCompleted,
  }));
  const totalVolumeKg = exercises.reduce(
    (s, ex) => s + (Number.isFinite(ex.volume!) ? (ex.volume as number) : 0),
    0,
  );
  return {
    sessionId,
    date,
    muscleGroup: legacy.muscleGroup,
    completionPercentage: legacy.completionPercentage,
    totalVolumeKg,
    exercises,
  };
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      loading: false,
      uid: null,
      startWeightKg: null,
      startWeightDate: null,

      weights: [],
      measurements: [],
      photos: [],
      workouts: [],
      prs: {},
      hydrationDaily: {},
      fitnessScores: [],
      weeklyReports: [],
      streaks: emptyStreak(),

      photoUrlCache: {},

      hydrate: async (uid) => {
        if (!uid) return;
        const current = get();
        if (current.uid === uid && current.hydrated) return;
        set({ uid, loading: true });
        try {
          const [weights, measurements, photos, workouts, prs, hydrationRows, scores, reports, streaks, base] = await Promise.all([
            loadWeights(uid),
            loadMeasurements(uid),
            loadPhotos(uid),
            loadWorkouts(uid),
            loadPersonalRecords(uid),
            loadHydrationDaily(uid),
            loadFitnessScores(uid),
            loadWeeklyReports(uid),
            loadStreaks(uid),
            loadUserBase(uid),
          ]);
          const hydrationDaily: Record<DateKey, number> = {};
          for (const h of hydrationRows) hydrationDaily[h.date] = h.ml;
          set({
            weights,
            measurements,
            photos,
            workouts,
            prs,
            hydrationDaily,
            fitnessScores: scores,
            weeklyReports: reports,
            streaks: streaks ?? emptyStreak(),
            startWeightKg: typeof base?.startWeightKg === "number" ? (base.startWeightKg as number) : null,
            startWeightDate: typeof base?.startWeightDate === "string" ? (base.startWeightDate as string) : null,
            hydrated: true,
            loading: false,
          });
          // Fire-and-forget — never block hydrate.
          get().backfillFromLocalStorage().catch((err) => console.warn("backfill failed", err));
        } catch (err) {
          console.warn("progressStore.hydrate failed", err);
          set({ loading: false, hydrated: true });
        }
      },

      reset: () =>
        set({
          hydrated: false,
          loading: false,
          uid: null,
          startWeightKg: null,
          startWeightDate: null,
          weights: [],
          measurements: [],
          photos: [],
          workouts: [],
          prs: {},
          hydrationDaily: {},
          fitnessScores: [],
          weeklyReports: [],
          streaks: emptyStreak(),
          photoUrlCache: {},
        }),

      addWeight: async (kg, opts) => {
        if (!Number.isFinite(kg) || kg <= 0) return;
        const date = opts?.date ?? localDateKey();
        const entry: WeightEntry = {
          date,
          weightKg: Number(kg.toFixed(2)),
          source: opts?.source ?? "manual",
          note: opts?.note,
        };
        // Local first for instant UI.
        set((s) => {
          const filtered = s.weights.filter((w) => w.date !== entry.date);
          return {
            weights: [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date)),
            startWeightKg: s.startWeightKg ?? entry.weightKg,
            startWeightDate: s.startWeightDate ?? entry.date,
          };
        });
        const uid = get().uid ?? auth.currentUser?.uid ?? null;
        if (!uid) return;
        await upsertWeight(uid, entry);
        await saveStartWeightIfMissing(uid, entry.weightKg, entry.date);
        await get().recomputeFitnessScore();
      },

      addMeasurement: async (partial) => {
        const date = partial.date ?? localDateKey();
        const next: BodyMeasurement = {
          ...partial,
          date,
        };
        set((s) => {
          const prev = s.measurements.find((m) => m.date === date);
          const merged: BodyMeasurement = { ...prev, ...next, date };
          const filtered = s.measurements.filter((m) => m.date !== date);
          return {
            measurements: [...filtered, merged].sort((a, b) => a.date.localeCompare(b.date)),
          };
        });
        const uid = get().uid ?? auth.currentUser?.uid ?? null;
        if (!uid) return;
        const merged = get().measurements.find((m) => m.date === date)!;
        await upsertMeasurement(uid, merged);
      },

      uploadPhoto: async (view, file, opts) => {
        const uid = get().uid ?? auth.currentUser?.uid ?? null;
        if (!uid) throw new Error("auth required to upload photos");
        const weekId = opts?.weekId ?? isoWeekId();
        const result = await uploadProgressPhoto(uid, weekId, view, file);
        const existing = get().photos.find((p) => p.weekId === weekId);
        const merged: ProgressPhoto = {
          ...(existing ?? {}),
          weekId,
          capturedAt: new Date().toISOString(),
          weightKgAtCapture: opts?.weightKg ?? existing?.weightKgAtCapture,
          [view]: result.full as PhotoAsset,
        } as ProgressPhoto;
        await upsertPhotoDoc(uid, merged);
        set((s) => {
          const filtered = s.photos.filter((p) => p.weekId !== weekId);
          return {
            photos: [merged, ...filtered].sort((a, b) => b.weekId.localeCompare(a.weekId)),
            photoUrlCache: {
              ...s.photoUrlCache,
              [result.full.path]: result.fullUrl,
              [result.full.thumbPath as string]: result.thumbUrl,
            },
          };
        });
      },

      removePhoto: async (weekId, view) => {
        const uid = get().uid ?? auth.currentUser?.uid ?? null;
        if (!uid) return;
        await deleteProgressPhoto(uid, weekId, view);
        const existing = get().photos.find((p) => p.weekId === weekId);
        if (!existing) return;
        const next = { ...existing };
        delete (next as Record<string, unknown>)[view];
        const hasAny = next.front || next.side || next.back;
        if (hasAny) {
          await upsertPhotoDoc(uid, next);
        }
        set((s) => {
          const filtered = s.photos.filter((p) => p.weekId !== weekId);
          return {
            photos: hasAny
              ? [next, ...filtered].sort((a, b) => b.weekId.localeCompare(a.weekId))
              : filtered,
          };
        });
      },

      rememberPhotoUrl: (path, url) =>
        set((s) => ({ photoUrlCache: { ...s.photoUrlCache, [path]: url } })),

      recordWorkout: async (legacy) => {
        const session = legacyToSession(legacy);
        set((s) => {
          const filtered = s.workouts.filter((w) => w.sessionId !== session.sessionId);
          return {
            workouts: [session, ...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 365),
          };
        });
        const uid = get().uid ?? auth.currentUser?.uid ?? null;
        if (!uid) return;
        await upsertWorkoutSession(uid, session);

        const updates = evaluateSession(session, get().prs);
        if (updates.length) {
          const nextPrs = { ...get().prs };
          for (const u of updates) nextPrs[u.slug] = u.record;
          set({ prs: nextPrs });
          for (const u of updates) {
            await upsertPersonalRecord(uid, u.record);
          }
        }
        await get().recomputeFitnessScore();
        await get().recomputeStreaks();
      },

      backfillFromLocalStorage: async () => {
        const uid = get().uid ?? auth.currentUser?.uid ?? null;
        if (!uid) return;
        if (localStorage.getItem(BACKFILL_FLAG) === uid) return;
        const raw = localStorage.getItem("workoutHistory");
        if (!raw) {
          localStorage.setItem(BACKFILL_FLAG, uid);
          return;
        }
        try {
          const legacy = JSON.parse(raw) as LegacyWorkoutPayload[];
          if (!Array.isArray(legacy) || legacy.length === 0) {
            localStorage.setItem(BACKFILL_FLAG, uid);
            return;
          }
          const sessions = legacy
            .filter((l) => l && Array.isArray(l.exercises))
            .map(legacyToSession);
          const known = new Set(get().workouts.map((w) => w.sessionId));
          const fresh = sessions.filter((s) => !known.has(s.sessionId));
          if (fresh.length === 0) {
            localStorage.setItem(BACKFILL_FLAG, uid);
            return;
          }
          await batchUpsertWorkouts(uid, fresh);
          set((s) => {
            const seen = new Set(s.workouts.map((w) => w.sessionId));
            const additions = fresh.filter((f) => !seen.has(f.sessionId));
            const merged = [...additions, ...s.workouts]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 365);
            return { workouts: merged };
          });
          // Re-evaluate PRs across all known workouts in date order.
          const nextPrs: Record<string, PersonalRecord> = { ...get().prs };
          const ordered = [...get().workouts].sort((a, b) => a.date.localeCompare(b.date));
          for (const session of ordered) {
            const updates = evaluateSession(session, nextPrs);
            for (const u of updates) nextPrs[u.slug] = u.record;
          }
          set({ prs: nextPrs });
          await Promise.all(Object.values(nextPrs).map((pr) => upsertPersonalRecord(uid, pr)));
          localStorage.setItem(BACKFILL_FLAG, uid);
        } catch (err) {
          console.warn("backfill parse failed", err);
          localStorage.setItem(BACKFILL_FLAG, uid);
        }
      },

      recordHydration: async (ml, opts) => {
        const date = opts?.date ?? localDateKey();
        const entry: HydrationDailyEntry = {
          date,
          ml: Math.max(0, Math.round(ml)),
          goalMl: opts?.goalMl ?? 2500,
        };
        set((s) => ({ hydrationDaily: { ...s.hydrationDaily, [date]: entry.ml } }));
        const uid = get().uid ?? auth.currentUser?.uid ?? null;
        if (!uid) return;
        await upsertHydrationDaily(uid, entry);
        await get().recomputeFitnessScore();
        await get().recomputeStreaks();
      },

      recomputeFitnessScore: async (today = localDateKey()) => {
        try {
          // Lazy import to avoid a userStore <-> progressStore cycle.
          const { useUserStore } = await import("@/stores/userStore");
          const userState = useUserStore.getState();
          const u = userState.user;
          if (!u) return null;
          const calorieGoal = (u as { calorieGoal?: number }).calorieGoal ?? 2000;
          const proteinGoal = (u as { proteinGoal?: number }).proteinGoal ?? 150;
          const hydrationGoalMl = 2500;
          const dailyCalories: Record<string, { totalCalories: number; totalProtein: number }> = {};
          for (const [d, data] of Object.entries(userState.dailyCalories ?? {})) {
            dailyCalories[d] = {
              totalCalories: data.totalCalories ?? 0,
              totalProtein: data.totalProtein ?? 0,
            };
          }
          const activitySet = new Set<DateKey>();
          for (const d of Object.keys(dailyCalories)) activitySet.add(d);
          for (const w of get().workouts) activitySet.add(w.date);
          for (const d of Object.keys(get().hydrationDaily)) activitySet.add(d);

          const composed = composeFitnessScore({
            today,
            dailyCalories,
            goals: { calorieGoal, proteinGoal },
            hydrationDaily: get().hydrationDaily,
            hydrationGoalMl,
            workouts: get().workouts,
            workoutDaysPerWeek: (u as { workoutDays?: number }).workoutDays ?? 4,
            activityDateSet: activitySet,
          });
          set((s) => {
            const filtered = s.fitnessScores.filter((f) => f.date !== composed.date);
            return {
              fitnessScores: [...filtered, composed].sort((a, b) => a.date.localeCompare(b.date)).slice(-180),
            };
          });
          const uid = get().uid ?? auth.currentUser?.uid ?? null;
          if (uid) await upsertFitnessScore(uid, composed);
          return composed;
        } catch (err) {
          console.warn("recomputeFitnessScore failed", err);
          return null;
        }
      },

      recomputeStreaks: async () => {
        const today = localDateKey();
        const next: StreaksDoc = emptyStreak();
        try {
          const { useUserStore } = await import("@/stores/userStore");
          const userState = useUserStore.getState();
          const u = userState.user;
          const calorieGoal = u?.calorieGoal ?? 2000;
          const proteinGoal = u?.proteinGoal ?? 150;
          const hydrationGoalMl = 2500;

          const calorieHits: DateKey[] = [];
          const proteinHits: DateKey[] = [];
          for (const [d, data] of Object.entries(userState.dailyCalories ?? {})) {
            if (!data?.entries?.length) continue;
            const calPct = calorieGoal ? data.totalCalories / calorieGoal : 0;
            if (calPct >= 0.9 && calPct <= 1.1) calorieHits.push(d);
            if (proteinGoal && data.totalProtein / proteinGoal >= 0.9) proteinHits.push(d);
          }
          const hydrationHits: DateKey[] = [];
          for (const [d, ml] of Object.entries(get().hydrationDaily)) {
            if (ml >= hydrationGoalMl) hydrationHits.push(d);
          }
          const workoutHits: DateKey[] = get().workouts
            .filter((w) => w.completionPercentage > 0)
            .map((w) => w.date);
          const visitHits = (() => {
            try {
              const raw = localStorage.getItem("dietin.visitDays");
              return raw ? (JSON.parse(raw) as DateKey[]) : [today];
            } catch {
              return [today];
            }
          })();

          const kinds: Record<StreakKind, DateKey[]> = {
            calories: calorieHits,
            protein: proteinHits,
            hydration: hydrationHits,
            workout: workoutHits,
            visit: visitHits,
          };
          for (const [kind, hits] of Object.entries(kinds)) {
            next[kind as StreakKind] = computeStreak(hits, today);
          }
          set({ streaks: next });
          const uid = get().uid ?? auth.currentUser?.uid ?? null;
          if (uid) await saveStreaks(uid, next);
        } catch (err) {
          console.warn("recomputeStreaks failed", err);
        }
        return next;
      },

      cacheWeeklyReport: async (report) => {
        set((s) => {
          const filtered = s.weeklyReports.filter((r) => r.weekId !== report.weekId);
          return {
            weeklyReports: [report, ...filtered].sort((a, b) => b.weekId.localeCompare(a.weekId)),
          };
        });
        const uid = get().uid ?? auth.currentUser?.uid ?? null;
        if (uid) await upsertWeeklyReport(uid, report);
      },
    }),
    {
      name: "progress-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        weights: state.weights,
        measurements: state.measurements,
        photos: state.photos,
        workouts: state.workouts,
        prs: state.prs,
        hydrationDaily: state.hydrationDaily,
        fitnessScores: state.fitnessScores,
        weeklyReports: state.weeklyReports,
        streaks: state.streaks,
        startWeightKg: state.startWeightKg,
        startWeightDate: state.startWeightDate,
      }),
    },
  ),
);

// Lightweight selectors / accessors used by hooks.
export function selectLatestWeight(state: ProgressState): WeightEntry | null {
  return state.weights.length ? state.weights[state.weights.length - 1] : null;
}
