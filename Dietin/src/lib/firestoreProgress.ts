// Firestore CRUD for the Progress 2.0 subcollections under users/{uid}.
// Subcollection writes are owner-only per firestore.rules; no rule changes.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  BodyMeasurement,
  FitnessScore,
  HydrationDailyEntry,
  PersonalRecord,
  ProgressPhoto,
  StreaksDoc,
  WeeklyReport,
  WeightEntry,
  WorkoutSession,
} from "@/features/progress/types";

const userCol = (uid: string, name: string) => collection(db, "users", uid, name);
const userDoc = (uid: string, name: string, id: string) => doc(db, "users", uid, name, id);

// --- Weights ---------------------------------------------------------------
export async function upsertWeight(uid: string, entry: WeightEntry) {
  await setDoc(
    userDoc(uid, "weights", entry.date),
    { ...entry, source: entry.source ?? "manual", createdAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadWeights(uid: string, max = 365): Promise<WeightEntry[]> {
  const snap = await getDocs(
    query(userCol(uid, "weights"), orderBy("date", "desc"), limit(max)),
  );
  return snap.docs
    .map((d) => d.data() as WeightEntry)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// --- Measurements ----------------------------------------------------------
export async function upsertMeasurement(uid: string, entry: BodyMeasurement) {
  await setDoc(
    userDoc(uid, "measurements", entry.date),
    { ...entry, createdAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadMeasurements(uid: string, max = 365): Promise<BodyMeasurement[]> {
  const snap = await getDocs(
    query(userCol(uid, "measurements"), orderBy("date", "desc"), limit(max)),
  );
  return snap.docs
    .map((d) => d.data() as BodyMeasurement)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// --- Photos ----------------------------------------------------------------
export async function upsertPhotoDoc(uid: string, photo: ProgressPhoto) {
  await setDoc(userDoc(uid, "progressPhotos", photo.weekId), photo, { merge: true });
}

export async function loadPhotos(uid: string, max = 60): Promise<ProgressPhoto[]> {
  const snap = await getDocs(
    query(userCol(uid, "progressPhotos"), orderBy("weekId", "desc"), limit(max)),
  );
  return snap.docs.map((d) => d.data() as ProgressPhoto);
}

// --- Workouts --------------------------------------------------------------
export async function upsertWorkoutSession(uid: string, session: WorkoutSession) {
  await setDoc(
    userDoc(uid, "workoutSessions", session.sessionId),
    { ...session, createdAt: serverTimestamp() },
    { merge: true },
  );
}

export async function batchUpsertWorkouts(uid: string, sessions: WorkoutSession[]) {
  // Firestore batch limit is 500. Chunk if needed.
  const chunkSize = 400;
  for (let i = 0; i < sessions.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const s of sessions.slice(i, i + chunkSize)) {
      batch.set(
        userDoc(uid, "workoutSessions", s.sessionId),
        { ...s, createdAt: serverTimestamp() },
        { merge: true },
      );
    }
    await batch.commit();
  }
}

export async function loadWorkouts(uid: string, max = 365): Promise<WorkoutSession[]> {
  const snap = await getDocs(
    query(userCol(uid, "workoutSessions"), orderBy("date", "desc"), limit(max)),
  );
  return snap.docs.map((d) => d.data() as WorkoutSession);
}

// --- Personal Records ------------------------------------------------------
export async function upsertPersonalRecord(uid: string, pr: PersonalRecord) {
  await setDoc(userDoc(uid, "personalRecords", pr.exerciseSlug), pr, { merge: true });
}

export async function loadPersonalRecords(uid: string): Promise<Record<string, PersonalRecord>> {
  const snap = await getDocs(userCol(uid, "personalRecords"));
  const out: Record<string, PersonalRecord> = {};
  for (const d of snap.docs) {
    const data = d.data() as PersonalRecord;
    out[d.id] = data;
  }
  return out;
}

// --- Fitness Scores --------------------------------------------------------
export async function upsertFitnessScore(uid: string, score: FitnessScore) {
  await setDoc(userDoc(uid, "fitnessScores", score.date), score, { merge: true });
}

export async function loadFitnessScores(uid: string, max = 180): Promise<FitnessScore[]> {
  const snap = await getDocs(
    query(userCol(uid, "fitnessScores"), orderBy("date", "desc"), limit(max)),
  );
  return snap.docs
    .map((d) => d.data() as FitnessScore)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// --- Weekly Reports --------------------------------------------------------
export async function upsertWeeklyReport(uid: string, report: WeeklyReport) {
  await setDoc(
    userDoc(uid, "weeklyReports", report.weekId),
    { ...report, generatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadWeeklyReports(uid: string, max = 26): Promise<WeeklyReport[]> {
  const snap = await getDocs(
    query(userCol(uid, "weeklyReports"), orderBy("weekStart", "desc"), limit(max)),
  );
  return snap.docs.map((d) => d.data() as WeeklyReport);
}

// --- Streaks (single doc) --------------------------------------------------
export async function loadStreaks(uid: string): Promise<StreaksDoc | null> {
  const snap = await getDoc(doc(db, "users", uid, "meta", "streaks"));
  return snap.exists() ? (snap.data() as StreaksDoc) : null;
}

export async function saveStreaks(uid: string, streaks: StreaksDoc) {
  await setDoc(
    doc(db, "users", uid, "meta", "streaks"),
    { ...streaks, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// --- Hydration Daily -------------------------------------------------------
export async function upsertHydrationDaily(uid: string, entry: HydrationDailyEntry) {
  await setDoc(userDoc(uid, "hydrationDaily", entry.date), entry, { merge: true });
}

export async function loadHydrationDaily(
  uid: string,
  max = 60,
): Promise<HydrationDailyEntry[]> {
  const snap = await getDocs(
    query(userCol(uid, "hydrationDaily"), orderBy("date", "desc"), limit(max)),
  );
  return snap.docs.map((d) => d.data() as HydrationDailyEntry);
}

// Convenience: fetch the users/{uid} doc to read startWeightKg, etc.
export async function loadUserBase(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function saveStartWeightIfMissing(uid: string, weightKg: number, dateKey: string) {
  // Pure read-then-write; idempotent. Uses merge so we never overwrite anything else.
  const base = await loadUserBase(uid);
  if (base && typeof base.startWeightKg === "number") return;
  await setDoc(
    doc(db, "users", uid),
    { startWeightKg: weightKg, startWeightDate: dateKey, lastUpdated: new Date().toISOString() },
    { merge: true },
  );
}

// Used by the WeeklyReportSection to find a specific report quickly.
export async function getWeeklyReport(uid: string, weekId: string): Promise<WeeklyReport | null> {
  const snap = await getDoc(userDoc(uid, "weeklyReports", weekId));
  return snap.exists() ? (snap.data() as WeeklyReport) : null;
}
