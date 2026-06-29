# Progress 2.0 — Transformation & Progress Intelligence System

**Status:** Implemented (all 12 roadmap steps shipped against `main` HEAD on 2026-06-28).
**Scope:** Replace `/progress` with a 10-feature transformation hub.

---

## 1. Context — what we have today

| Concern | Current state | File |
|---|---|---|
| Progress route | Single page; lists last-7-days workouts + (Pro-only) Gemini per-workout insights | `src/pages/Progress.tsx` (519 LOC) |
| Workout history | `localStorage["workoutHistory"]` JSON array, written from `src/pages/Plan.tsx:954–1007` | `Plan.tsx`, read by `Progress.tsx` + `MuscleRadarChart.tsx` |
| User doc | Single Firestore `users/{uid}` doc; weight/height/goal/targetWeight already exist | `lib/types.ts` `UserProfile`, hydrated in `App.tsx:184–293` |
| Weight history | **Does not exist.** Only current `user.weight` is stored. | — |
| Body measurements | Does not exist | — |
| Progress photos | Does not exist (only `profilePicture` base64) | — |
| Streaks | Single visit streak in `analyticsStore` | `src/stores/analyticsStore.ts:76–109` |
| Hydration history | Cup count is component-local state only, **not persisted** | `src/components/HydrationTracker.tsx:26` |
| Mood | Persisted in `user.moodHistory[]` on the user doc | `src/components/MoodTracker.tsx` |
| AI | Gemini via `@google/generative-ai`, key in `lib/gemini.ts:8` | `lib/gemini.ts` |
| Charts | Recharts available; Chart.js also installed (don't add new chart libs) | `package.json` |
| UI primitives | Full shadcn kit at `src/components/ui/*`; Framer Motion, `react-circular-progressbar`, embla carousel, vaul drawer all already installed | `package.json` |
| Routing | React Router v6 in `App.tsx`; `BottomNav` collapses Plan/Workouts/Progress under one "workouts" tab | `App.tsx:518–522`, `BottomNav.tsx:189` |
| Storage rules | Only `profilePictures/` + `mealImages/` paths writable | `storage.rules` |
| Firestore rules | Owner-only on `users/{uid}` and **all subcollections** (`/{subcollection}/{docId}`) — no rule changes needed for new per-user subcollections | `firestore.rules:30–32` |
| i18n | `react-i18next` is project standard; every string goes through `t('progress.xxx')` | `Progress.tsx:69, 261` |
| Dark mode | CSS-filter inversion via `.theme-dark-invert` on `<html>` — must not break under inversion | `DESIGN_GUIDELINES.md:198–207` |

**Big takeaways for design:**

1. The hardest problem isn't UI — it's that **weight history, hydration history, photos, and measurements don't exist yet.** Everything else is presentation on top of new data sources.
2. The Firestore subcollection rule (`match /{subcollection}/{docId}`) already allows us to add `users/{uid}/weights`, `users/{uid}/measurements`, etc. **without touching `firestore.rules`** — only indexes and storage rules need additions.
3. `workoutHistory` lives only in localStorage and is written from `Plan.tsx`. We must (a) keep that writer untouched on day 1 (no regressions) and (b) shadow-mirror to Firestore so the new analytics survive device changes.
4. The Pro gate already exists (`user.isPro`); reuse it for the Weekly AI Report and projection insights, not for the basic dashboard.

---

## 2. Component architecture

A feature module under `src/features/progress/` keeps the existing `src/pages/Progress.tsx` swap minimal: the page becomes a thin shell that mounts the dashboard.

```
src/features/progress/
├── ProgressDashboard.tsx          # top-level layout + section orchestrator
├── sections/                      # one file per Feature 1–10
│   ├── WeightJourneySection.tsx
│   ├── WeeklyTrendSection.tsx
│   ├── ProjectionSection.tsx
│   ├── PhotosSection.tsx
│   ├── MeasurementsSection.tsx
│   ├── FitnessScoreSection.tsx
│   ├── StreaksSection.tsx
│   ├── WorkoutAnalyticsSection.tsx
│   ├── PersonalRecordsSection.tsx
│   ├── WeeklyReportSection.tsx
│   └── GoalRoadmapSection.tsx
├── components/                    # shared progress-specific UI atoms
│   ├── DashboardCard.tsx          # 3-state shell (loading | empty | populated)
│   ├── AnimatedCounter.tsx        # number ticker (framer-motion useMotionValue)
│   ├── TrendArrow.tsx
│   ├── DeltaBadge.tsx             # ±value pill, color by direction × goal
│   ├── MiniChart.tsx              # 40-point sparkline (Recharts)
│   ├── CircularScore.tsx          # 0–100 radial (react-circular-progressbar)
│   ├── SegmentedTabs.tsx          # week/month/year toggle
│   ├── PhotoUploader.tsx          # front/side/back capture (react-webcam + dropzone)
│   ├── BeforeAfterSlider.tsx      # swipe-to-compare (react-use-gesture)
│   ├── PhotoLightbox.tsx          # fullscreen + zoom
│   ├── StreakBadge.tsx
│   ├── PRBadge.tsx
│   ├── MilestoneMarker.tsx        # goal roadmap checkpoints
│   ├── ConfidenceBar.tsx          # projection confidence
│   ├── HeatmapGrid.tsx            # 7×N muscle/volume heatmap
│   ├── EmptyState.tsx
│   └── SectionHeader.tsx          # title + optional CTA
├── hooks/
│   ├── useWeightHistory.ts        # subscribes to users/{uid}/weights
│   ├── useMeasurements.ts
│   ├── useProgressPhotos.ts
│   ├── useStreaks.ts              # derives streaks from logs
│   ├── useFitnessScore.ts         # composes 4 sub-scores
│   ├── useWorkoutAnalytics.ts     # volume rollups, PR detection
│   ├── useProjection.ts           # linear regression on weight series
│   └── useWeeklyReport.ts         # current + history
├── lib/
│   ├── projection.ts              # pure: trend regression + ETA calc
│   ├── fitnessScore.ts            # pure: 4-sub-score → 0–100
│   ├── streaks.ts                 # pure: longest/current streak from date set
│   ├── prDetection.ts             # pure: e1RM + max-set detection
│   ├── volumeCalc.ts              # pure: Σ weight·reps·sets, per muscle group
│   ├── reportPrompt.ts            # Gemini prompt builder for weekly report
│   └── illustrations/             # SVG cartoon placeholders for empty photos
│       ├── front.svg, side.svg, back.svg
└── types.ts                       # WeightEntry, BodyMeasurement, ProgressPhoto,
                                   #  FitnessScore, StreakKind, PR, WeeklyReport, etc.
```

**Why a `features/` folder instead of dumping into `components/`:** the existing `src/components` is 33 flat files — adding 30 more would make it unmaintainable. `features/progress/` is a clean seam, easy to delete or extract later.

**Page swap:** `src/pages/Progress.tsx` becomes:

```tsx
import ProgressDashboard from "@/features/progress/ProgressDashboard";
export default function Progress() { return <ProgressDashboard />; }
```

The old in-page logic (AI insights, recent workouts) is **moved**, not deleted:
- AI per-workout insights → `WeeklyReportSection` (consolidated into weekly summary)
- Recent workouts list → `WorkoutAnalyticsSection` (with rollup, not raw cards)

---

## 3. Folder structure (final)

```
src/
├── features/
│   └── progress/              # new — see §2
├── stores/
│   ├── progressStore.ts       # NEW — weights/measurements/photos/PRs subscriptions + cache
│   ├── analyticsStore.ts      # EXTEND — add per-kind streaks, fitness score history
│   └── (unchanged: userStore, mealStore, hydrationStore, workoutStore, nutritionStore)
├── lib/
│   ├── firebase.ts            # unchanged
│   ├── firestoreProgress.ts   # NEW — CRUD helpers for new subcollections
│   ├── storageProgress.ts     # NEW — upload/resize/delete photo helpers
│   └── (unchanged)
├── pages/
│   └── Progress.tsx           # thin shell wrapping ProgressDashboard
├── components/
│   └── (unchanged; ProgressChart.tsx & MuscleRadarChart.tsx kept until §11 cleanup)
firestore.rules                # unchanged (subcollection rule already covers us)
firestore.indexes.json         # EXTEND — add composite indexes (§5)
storage.rules                  # EXTEND — add progressPhotos/{uid}/** rule
```

---

## 4. Firebase schema updates

All new collections are **subcollections of `users/{uid}`** to inherit existing rules. Document keys are deterministic where possible so re-syncing from a second device is idempotent.

### 4.1 `users/{uid}/weights/{yyyy-MM-dd}`
```ts
{
  date: "2026-06-28",        // local date key (matches userStore.getLocalDateKey)
  weightKg: 78.2,
  source: "manual" | "import",
  note?: string,
  createdAt: serverTimestamp(),
}
```
One doc per day; subsequent same-day entries overwrite. Used by: weight journey, projection, weekly trend, goal roadmap.

### 4.2 `users/{uid}/measurements/{yyyy-MM-dd}`
```ts
{
  date: "2026-06-28",
  waistCm?: number, chestCm?: number, armsCm?: number,
  hipsCm?: number, thighsCm?: number, neckCm?: number,
  createdAt: serverTimestamp(),
}
```
Partial fields allowed; merge on write.

### 4.3 `users/{uid}/progressPhotos/{weekId}`
`weekId = ISO week, e.g. "2026-W26"`.
```ts
{
  weekId: "2026-W26",
  capturedAt: "2026-06-28T...",
  front?: { path: string, width: number, height: number, thumbPath: string },
  side?:  { ... },
  back?:  { ... },
  weightKgAtCapture?: number,    // snapshot for before/after comparisons
}
```
Image binaries in **Firebase Storage** at `progressPhotos/{uid}/{weekId}/{view}.jpg` + `{view}_thumb.jpg`. One photo per view per week (overwrite-on-reupload).

### 4.4 `users/{uid}/workoutSessions/{sessionId}` (mirror of localStorage)
```ts
{
  date: "2026-06-28",
  muscleGroup: "Chest",
  completionPercentage: number,
  totalVolumeKg: number,       // precomputed for analytics
  exercises: [{
    name, musclesWorked, setsCompleted, totalSets, reps, weight,
    restTime, rpm?, volume,    // volume = weight * reps * setsCompleted
  }],
  createdAt: serverTimestamp(),
}
```
`sessionId = ${date}-${muscleGroup}-${slug(exercises[0].name)}`. **Plan.tsx writes both localStorage AND Firestore** (shadow-write — see §10). No retroactive backfill on first load; the dashboard treats absent-history as empty state.

### 4.5 `users/{uid}/personalRecords/{exerciseSlug}`
```ts
{
  exercise: "Bench Press",
  bestWeightKg: 80, bestWeightReps: 8,
  bestE1rmKg: 95,             // Epley: w * (1 + reps/30)
  bestVolumeKg: 1280,         // single-set
  history: [{ date, weightKg, reps, e1rmKg, volumeKg }],  // capped 50 entries
  updatedAt: serverTimestamp(),
}
```
Updated by `lib/prDetection.ts` after each workout write.

### 4.6 `users/{uid}/fitnessScores/{yyyy-MM-dd}`
```ts
{
  date: "2026-06-28",
  diet: 92, workout: 81, hydration: 88, consistency: 95, overall: 89,
}
```
Generated client-side daily from logs (no server function required for v1).

### 4.7 `users/{uid}/weeklyReports/{yyyy-Www}`
```ts
{
  weekId: "2026-W26",
  weekStart: "2026-06-22",
  weekEnd: "2026-06-28",
  weightDeltaKg: -0.7,
  workoutsCompleted: 5,
  proteinHitDays: 6, calorieHitDays: 5, hydrationHitDays: 7,
  consistencyScoreDelta: 12,
  summaryText: "You lost 0.7 kg this week...",   // Gemini output
  summaryHighlights: ["..."],                     // bullets for shareable card
  shareImagePath?: string,                        // optional rendered PNG in Storage
  generatedAt: serverTimestamp(),
  model: "gemini-2.0-flash",
}
```
Generated once per week (Friday local time, lazy on dashboard open if missing).

### 4.8 `users/{uid}/hydrationDaily/{yyyy-MM-dd}` (new — required because `HydrationTracker` currently doesn't persist)
```ts
{ date, ml: number, goalMl: number }
```

### 4.9 `users/{uid}/streaks` (single doc, not a subcollection)
```ts
{
  workout:    { current, longest, lastDate },
  protein:    { current, longest, lastDate },
  calories:   { current, longest, lastDate },
  hydration:  { current, longest, lastDate },
  visit:      { current, longest, lastDate },  // mirror of analyticsStore
  updatedAt:  serverTimestamp(),
}
```

### 4.10 No changes to `users/{uid}` doc
We **add new fields** if needed (`startWeightKg`, `startWeightDate`) but no rewrites. `startWeightKg` is set the first time we write a weight entry, never overwritten.

---

## 5. Firestore + Storage rules + indexes

### 5.1 `firestore.rules` — **no edits needed.**
The existing `match /{subcollection}/{docId}` block (lines 30–32) already permits the owner to read/write everything we add.

### 5.2 `storage.rules` — extend
Add one rule:
```
match /progressPhotos/{userId}/{allPaths=**} {
  allow read:  if isOwner(userId);
  allow write: if isOwner(userId) &&
               request.resource.size < 5 * 1024 * 1024 &&
               request.resource.contentType.matches('image/.*');
}
```

### 5.3 `firestore.indexes.json` — extend
```json
{
  "collectionGroup": "weights",        "queryScope": "COLLECTION_GROUP", "fields": [
    {"fieldPath": "date", "order": "DESCENDING"}]
},
{
  "collectionGroup": "workoutSessions","queryScope": "COLLECTION_GROUP", "fields": [
    {"fieldPath": "date", "order": "DESCENDING"}]
},
{
  "collectionGroup": "weeklyReports",  "queryScope": "COLLECTION_GROUP", "fields": [
    {"fieldPath": "weekStart", "order": "DESCENDING"}]
}
```
Per-user reads use `query(collection(db, 'users', uid, 'weights'), orderBy('date', 'desc'), limit(180))` which doesn't strictly require an index for single-field sorts, but the explicit declaration makes admin queries (analytics, exports) safe.

---

## 6. Zustand store updates

### 6.1 New: `stores/progressStore.ts`
One store owning the in-memory cache for all new collections + the subscribe-once pattern (call from `ProgressDashboard` mount).

```ts
type ProgressState = {
  weights:        WeightEntry[];        // sorted ascending by date
  measurements:   BodyMeasurement[];
  photos:         ProgressPhoto[];      // by weekId desc
  prs:            Record<string, PR>;   // by exerciseSlug
  workouts:       WorkoutSession[];     // last 180 days
  hydrationDaily: Record<string, number>; // date -> ml
  fitnessScores:  FitnessScore[];       // last 90 days
  weeklyReports:  WeeklyReport[];       // last 12 weeks
  hydrated:       boolean;              // first-load gate

  // mutations
  addWeight:        (kg: number, date?: string, note?: string) => Promise<void>;
  addMeasurement:   (partial: Partial<BodyMeasurement>) => Promise<void>;
  uploadPhoto:      (view: 'front'|'side'|'back', file: File) => Promise<void>;
  deletePhoto:      (weekId: string, view: 'front'|'side'|'back') => Promise<void>;
  recordWorkout:    (session: WorkoutSession) => Promise<void>;  // called by Plan.tsx
  recordHydration:  (ml: number, date?: string) => Promise<void>; // called by HydrationTracker
  recomputeScores:  (date?: string) => Promise<void>;
  generateWeeklyReport: (force?: boolean) => Promise<WeeklyReport>;
  subscribeAll:     (uid: string) => () => void;    // returns unsubscribe
};
```

Persisted to localStorage via the same `persist` + `partialize` pattern as `userStore` so the dashboard renders instantly offline.

### 6.2 Extend: `stores/analyticsStore.ts`
Add per-kind streaks and fitness-score history; reuse `updateStreak` shape. Keep the existing `currentStreak`/`longestStreak` fields (used by `Index.tsx`) untouched.

### 6.3 No changes to: `userStore`, `mealStore`, `hydrationStore`, `workoutStore`, `nutritionStore`.

### 6.4 Bridge: `HydrationTracker.tsx` calls `progressStore.recordHydration(ml)` on add/subtract (component-local state preserved for instant UI).

---

## 7. UI implementation plan

### 7.1 Layout pattern (mobile-first, max-w 1920px on desktop)

```
┌─ ProgressDashboard ─────────────────────────────────┐
│  Sticky header: page title + Plan/Library/Progress │
│  pill (existing pattern from Progress.tsx:264-290)  │
├─────────────────────────────────────────────────────┤
│  Sticky horizontal tab bar (SegmentedTabs):         │
│  [Overview] [Weight] [Photos] [Body] [Score]        │
│  [Streaks] [Workouts] [PRs] [AI] [Goal]             │
│  — scrolls horizontally on mobile, wraps on lg+     │
├─────────────────────────────────────────────────────┤
│  Active section renders below                        │
│  — Overview = condensed cards from every section    │
│  — Other tabs = one full Section component          │
└─────────────────────────────────────────────────────┘
```

Tab state lives in the URL (`?tab=weight`) so deep-links and back-button work.

### 7.2 Card 3-state pattern (`DashboardCard`)
```tsx
<DashboardCard
  state={loading ? 'loading' : entries.length === 0 ? 'empty' : 'populated'}
  loading={<SkeletonRows count={3} />}
  empty={<EmptyState
    icon={Scale} title={t('progress.weight.empty.title')}
    cta={{ label: t('progress.weight.empty.cta'), onClick: openLogModal }}
  />}
>
  {/* populated children */}
</DashboardCard>
```
Every section uses this; no hand-rolled loading states.

### 7.3 Animations
- Counters: Framer Motion `useMotionValue` + `useTransform` → `useSpring` (300ms stiffness 60). One reusable `<AnimatedCounter value={n} format="kg" />` component.
- Section reveals: `motion.div` with `initial={{opacity:0, y:8}} animate={{opacity:1, y:0}}` staggered by 60ms (use existing pattern from `Progress.tsx:422-426`).
- Milestone celebrations: framer `<motion.div animate={{scale:[1,1.1,1]}}>` + confetti via inline SVG (no new dep — `canvas-confetti` not installed and is heavy).
- Photo before/after slider: `react-use-gesture` (already installed) `useDrag`.

### 7.4 Charts (Recharts — already used in Index/Diet)
| Section | Chart |
|---|---|
| Weight Journey | `<LineChart>` with `<Area>` underlay, projection dashed extension |
| Weekly Trend | `<BarChart>` for 8-week deltas |
| Measurements | Small `<LineChart>` per metric in a 2-col grid |
| Fitness Score | `<RadialBarChart>` for overall + 3 stacked `<LineChart>`s for trends |
| Workout Analytics | `<BarChart>` (volume by muscle) + `HeatmapGrid` (custom div-grid) |
| Health Score Timeline | `<LineChart>` with month dots |

Do **not** introduce Chart.js even though it's in the lockfile — Recharts is the existing pattern (`ProgressChart.tsx`, `Index.tsx`).

### 7.5 Photo capture flow
1. User taps "Add this week's photos" → vaul `<Drawer>` opens
2. Tabs: Front / Side / Back
3. Each tab: `<input type="file" accept="image/*" capture="environment">` (works on mobile + desktop fallback to dropzone) OR `react-webcam` for in-app capture
4. Client-side resize to max-edge 1600px via `<canvas>` → JPEG quality 0.85 → upload to Storage → write Firestore doc
5. Thumb generation: client downsample to 320px → upload `{view}_thumb.jpg`
6. Privacy: photos never sent to AI/Gemini. Clear copy on the upload UI.

### 7.6 Demo / placeholder illustrations
Empty-state SVGs (`front.svg`, `side.svg`, `back.svg`) in `features/progress/lib/illustrations/` — hand-stylized silhouette outlines. These are the "cartoon demo visuals" the spec asks for, not photos. **No lorem ipsum text anywhere.**

### 7.7 Internationalization
Every new string keyed under `progress.*` in `src/i18n/`. RTL handled by existing `document.dir` pattern; charts get `<XAxis reversed={isRTL}>` where it matters.

### 7.8 Dark mode
Avoid color filters that break under the `.theme-dark-invert` inversion: stick to semantic Tailwind tokens (`bg-card`, `text-foreground`, `border-border`) and let the inversion handle it — same approach the existing pages use.

---

## 8. Mobile UX wireframe (text)

Viewport: 390px. All sections full-width, 16px gutters.

```
┌────────────────────────────────────────┐
│ ← Progress              ⚙              │   sticky header
│ ┌──────────────────────────────────┐  │
│ │ [Plan] [Library] [▼Progress▼]   │  │   nav pill (existing)
│ └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│ ◀ Overview Weight Photos Body Score… ▶│   horizontal scroll tabs
├────────────────────────────────────────┤
│ ▒ Weight Journey ▒                     │
│ ┌──────────────────────────────────┐  │
│ │  78.2 kg ▼  -13.8 kg             │  │   AnimatedCounter
│ │  ─────────────────────           │  │
│ │  start 92.0 → now 78.2 → goal 75 │  │   mini timeline
│ │  ▁▂▃▅▆▇█▇▅  (8-week sparkline)   │  │   MiniChart
│ └──────────────────────────────────┘  │
│                                        │
│ ▒ This Week ▒                          │
│ ┌──────────────────────────────────┐  │
│ │ -0.8 kg ↓   vs -0.4 last week    │  │
│ │ Trend: Accelerating  ⚡          │  │
│ │ ▁▂▁▃▂▅▄  (last 7 days)           │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ▒ Projection ▒    "at your pace"       │
│ ┌──────────────────────────────────┐  │
│ │ 80 kg  ●──● 2 wks    confid: ▓▓░ │  │
│ │ 75 kg  ●──────● 9 wks            │  │
│ │ 70 kg  ●────────────● 18 wks     │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ▒ Photos ▒                  + Add      │
│ ┌──────────────────────────────────┐  │
│ │ ◀ W22  W23  [W24]  W25  W26 ▶    │  │   week strip
│ │ Front | Side | Back   tabs       │  │
│ │  ┌─────────┐  ┌─────────┐        │  │
│ │  │ before  │  │  after  │ ⇆ swipe│  │
│ │  └─────────┘  └─────────┘        │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ▒ Fitness Score ▒                      │
│ ┌──────────────────────────────────┐  │
│ │         ╭─────╮                  │  │
│ │         │ 89  │  Diet 92 ▓▓▓▓▓░  │  │
│ │         │ /100│  Wrkt 81 ▓▓▓▓░░  │  │
│ │         ╰─────╯  Hyd  88 ▓▓▓▓▓░  │  │
│ │                  Cons 95 ▓▓▓▓▓▓  │  │
│ │   trend: consistency ▁▂▃▄▆▇       │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ▒ Streaks ▒                            │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│ │ 🔥 │ │ 💪 │ │ 🍗 │ │ 💧 │           │
│ │ 12d│ │ 7d │ │ 15d│ │ 20d│           │   StreakBadge ×4
│ └────┘ └────┘ └────┘ └────┘           │
│  badges scroll horiz if >4 active     │
│                                        │
│ ▒ Workout Analytics ▒                  │
│  Volume by muscle  [Week|Month]        │
│  Chest  +22%  ▓▓▓▓▓▓▓▓▓░              │
│  Back   +18%  ▓▓▓▓▓▓▓░░░              │
│  Legs   +11%  ▓▓▓▓▓░░░░░              │
│  ┌──── 7×8 heatmap grid ───┐          │
│                                        │
│ ▒ Personal Records ▒                   │
│  Bench  80kg × 8   🏆 NEW              │
│  Deadlift 140 × 3  prev 135            │
│                                        │
│ ▒ Weekly AI Report (Fri) ▒             │
│  ┌──────────────────────────────────┐ │
│  │ "You lost 0.7 kg…"               │ │
│  │ 5 workouts • protein 6/7 • hyd 7/7│ │
│  │ [Share] [Archive]                │ │
│  └──────────────────────────────────┘ │
│                                        │
│ ▒ Goal Roadmap ▒                       │
│  92 ●────●────● 75   70% complete      │
│      start now  goal                   │
│  ETA: ~12 weeks                        │
└────────────────────────────────────────┘
            [Bottom nav stays]
```

Floating action button `<PlusButton>` already exists in BottomNav for quick log — extend its sheet to include "Log weight", "Log measurements", "Upload photos".

---

## 9. Desktop UX wireframe (text)

Viewport: 1440px+. Two-column grid above the fold, full-width sections below.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Progress                                              ⚙  EN ▾  ☀/🌙  │
│ [Plan] [Library] [Progress]                                          │
│ [Overview][Weight][Photos][Body][Score][Streaks][Workouts][PRs][AI][Goal]│
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────┐  ┌────────────────────────────┐ │
│ │  Weight Journey                │  │  Fitness Score             │ │
│ │  78.2 kg ↓ -13.8 since start   │  │     ◯ 89                   │ │
│ │  ┌────────── LineChart ─────┐  │  │      /100                  │ │
│ │  │  ●─●─●─●─●─●─●─●         │  │  │  Diet 92 Wrkt 81           │ │
│ │  └──────────────────────────┘  │  │  Hyd 88  Cons 95           │ │
│ └────────────────────────────────┘  └────────────────────────────┘ │
│ ┌────────────────────────────────┐  ┌────────────────────────────┐ │
│ │  Weekly Trend                  │  │  Streaks (4 badges)        │ │
│ │  -0.8 vs -0.4   Accelerating   │  │  🔥12 💪7 🍗15 💧20         │ │
│ └────────────────────────────────┘  └────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│  Projection                       (full width)                       │
│  80kg ●──● 2w    75kg ●──────● 9w    70kg ●──────────────● 18w       │
│  confidence ▓▓░░  based on last 8 weeks of data                       │
├──────────────────────────────────────────────────────────────────────┤
│  Photos                           (full width carousel)              │
│  W21 W22 W23 [W24] W25  | Front | Side | Back |  Before↔After slider │
├──────────────────────────────────────────────────────────────────────┤
│ ┌── Measurements (2 col) ──────┐  ┌── Workout Analytics ────────┐  │
│ │ Waist 82→78 ↓  small chart   │  │ Volume by muscle  bar chart │  │
│ │ Chest 100→105↑               │  │ Heatmap                     │  │
│ │ Arms  35→38 ↑                │  │ Frequency calendar          │  │
│ │ ...                          │  │                             │  │
│ └──────────────────────────────┘  └─────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│  PRs (grid 3-col)                                                    │
│  Bench 80×8 🏆 | Deadlift 140×3 | Squat 120×5 | ...                  │
├──────────────────────────────────────────────────────────────────────┤
│  Weekly AI Report  +  Goal Roadmap  (side-by-side, 1:1)              │
└──────────────────────────────────────────────────────────────────────┘
```

Same sections, just denser. Reuses the **same** Section components — desktop adds CSS grid in `ProgressDashboard.tsx`, doesn't fork the markup.

---

## 10. Database migration plan

### 10.1 Migration A — workoutHistory: localStorage → Firestore
**Risk:** Plan.tsx is the only writer; multiple readers (`Progress.tsx`, `MuscleRadarChart.tsx`).

**Approach:** shadow-write, never read-from-cloud on day 1.

1. In `Plan.tsx:984` after `setWorkoutHistory(prev => …)`, also call `progressStore.recordWorkout(entry)`.
2. `recordWorkout` writes to `users/{uid}/workoutSessions/{sessionId}` with `setDoc({merge:true})` and updates PRs via `prDetection.ts`.
3. Readers continue to read from localStorage for one release; the new dashboard reads from `progressStore.workouts` which is hydrated from Firestore (or falls back to localStorage if uid is null).
4. Add a one-shot backfill: when `progressStore.subscribeAll(uid)` first runs and the cloud `workoutSessions` query returns 0 docs but localStorage has entries, batch-write existing entries (idempotent by `sessionId`). Run only once per device — flag in `localStorage["workoutHistoryBackfilled"]`.

### 10.2 Migration B — hydration: ephemeral → Firestore
`HydrationTracker.tsx` resets on unmount. Add `recordHydration(ml)` calls on each add/subtract; the store persists today's total and pushes to `hydrationDaily/{date}`.

### 10.3 Migration C — startWeight
On first weight entry, if `users/{uid}.startWeightKg` is missing, set it (and `startWeightDate`). Never overwrite. If user opts to reset baseline, expose a "reset transformation" button in Profile (post-MVP).

### 10.4 No destructive migrations
We never delete `localStorage["workoutHistory"]` in this phase — readers will be removed in a later cleanup release once Firestore is the source of truth on every device.

---

## 11. Reusable component inventory

| Component | Reused from | New / Modified |
|---|---|---|
| `Card`, `Button`, `Tabs`, `Sheet`, `Drawer`, `Skeleton`, `Toast`, `Tooltip`, `Switch`, `Slider` | shadcn `components/ui/*` | reuse |
| `Progress` (radix) | `components/ui/progress.tsx` | reuse for goal bar |
| `CircularProgressbar` | `react-circular-progressbar` (installed) | reuse for FitnessScore |
| `LineChart` / `BarChart` / `RadialBarChart` / `AreaChart` | Recharts | reuse |
| `Drawer` (mobile sheet) | `vaul` (installed) | reuse for log modals |
| Carousel | `embla-carousel-react` (installed) | reuse for photo week strip |
| Webcam | `react-webcam` (installed) | reuse for photo capture |
| Dropzone | `react-dropzone` (installed) | reuse for desktop photo upload |
| Gestures | `react-use-gesture` (installed) | reuse for before/after slider |
| **AnimatedCounter** | — | NEW |
| **DashboardCard** (loading/empty/populated wrapper) | — | NEW |
| **DeltaBadge** | — | NEW |
| **TrendArrow** | — | NEW |
| **MiniChart** (sparkline) | — | NEW |
| **CircularScore** (wrapper over react-circular-progressbar) | — | NEW |
| **SegmentedTabs** | extends shadcn `Tabs` | NEW |
| **PhotoUploader / BeforeAfterSlider / PhotoLightbox** | — | NEW |
| **StreakBadge / PRBadge / MilestoneMarker / ConfidenceBar / HeatmapGrid** | — | NEW |
| **EmptyState / SectionHeader** | — | NEW |
| `ProgressChart.tsx`, `MuscleRadarChart.tsx` | existing | keep for now; deprecate in cleanup phase (Roadmap step 12) |

---

## 12. Step-by-step implementation roadmap

Ordered by dependency and value-per-effort. Each step ends in a shippable state with no regressions; check after each step that `/progress` still renders for users with zero new data.

| # | Step | Touches | Why now |
|---|------|---------|---------|
| 1 | **Foundation:** create `features/progress/` skeleton, types, empty `progressStore`, `firestoreProgress.ts` CRUD, `storageProgress.ts`. Wire `Progress.tsx` to mount `ProgressDashboard` with stub sections rendering `EmptyState`. | new files only; `Progress.tsx` rewritten | Unblocks every later step; nothing breaks because every section is "empty" |
| 2 | **Rules + indexes:** add `storage.rules` photo rule, `firestore.indexes.json` entries. Deploy with `deploy-rules.js`. | infra | Required before any Firestore/Storage writes succeed in prod |
| 3 | **Reusable atoms:** `DashboardCard`, `AnimatedCounter`, `DeltaBadge`, `TrendArrow`, `MiniChart`, `SectionHeader`, `EmptyState`, `SegmentedTabs`. Storybook-style demo route gated by env flag (optional). | `features/progress/components` | Every section needs them |
| 4 | **Weight Journey + Weekly Trend + Projection (Features 1):** weight log modal (vaul Drawer) → `addWeight` → renders Sections 1–3. Includes `lib/projection.ts` linear-regression. | sections, store, hooks | Highest perceived value, smallest data dependency (just weights) |
| 5 | **Goal Roadmap (Feature 10):** computed from existing `user.targetWeight` + new weights. Reuses Projection. | section | Cheap given step 4 |
| 6 | **Streaks (Feature 5):** extend `analyticsStore` per kind. Backed by existing hydration/meal/workout signals. Show whatever kinds have data, hide rest. | store, section | No new data sources needed |
| 7 | **Body Measurements (Feature 3):** log sheet + 6 mini charts + highlights. | section, store | Independent from photos/PRs |
| 8 | **Workout Analytics + PRs (Features 6, 7):** shadow-write from `Plan.tsx`, one-shot backfill, volume rollups, PR detection. | `Plan.tsx` (1-line addition), store, sections | Depends on workout shadow-write — riskiest data step, do here in isolation |
| 9 | **Progress Photos (Feature 2):** upload, week strip, before/after slider, lightbox, illustration placeholders. | section, storage rules already deployed | Heaviest UI work; isolate after data steps are stable |
| 10 | **Fitness Score (Feature 4):** compose 4 sub-scores from existing logs + new weights/workouts. Daily snapshot to `fitnessScores/`. | `fitnessScore.ts`, store, section | Needs steps 4–8 to produce non-trivial sub-scores |
| 11 | **Weekly AI Report + Health Score Timeline (Features 8, 9):** Friday lazy-generation, Gemini prompt, archive list, shareable card render via `html-to-image` (post-MVP) or pre-rendered template. | `lib/reportPrompt.ts`, section | Needs steps 4, 6, 8, 10 to have meaningful inputs |
| 12 | **Cleanup:** remove the old AI per-workout insights flow from `Progress.tsx` (now lives in WeeklyReport), retire `ProgressChart.tsx` if unused outside progress page, prune `localStorage["workoutHistory"]` reads. | cleanup | Only safe once all consumers migrated |

**Out of scope for v1 (call out so the user can decide):**
- Server-side weekly report generation (Cloud Function) — current plan generates client-side on dashboard open
- Public leaderboards (PR "leaderboard-ready" architecture means PR docs are queryable by `bestE1rmKg`, not that we build a leaderboard page)
- Wearable / Apple Health import for weight + hydration (huge scope, defer)
- Body-fat % tracking (the field exists in `UserProfile` but no input flow today)

---

## 13. Verification plan

After each roadmap step:

1. **Type safety:** `pnpm tsc --noEmit` (use the project's package manager — lockfile is `bun.lockb`, so `bun run lint && bun run build` is the project's CI shape).
2. **Local smoke:** `bun run dev`, sign in, visit `/progress`. Each section must render its empty state cleanly with zero new data.
3. **Mobile viewport:** Chrome devtools iPhone 14 Pro. All sections fit 390px, no horizontal scroll except where intentional (week strip, tab bar).
4. **Dark mode:** Toggle `.theme-dark-invert` on `<html>`; no broken contrast, no inverted charts.
5. **Offline:** kill network in devtools; dashboard still renders from persisted store; writes queue (Firestore offline persistence is already enabled in `firebase.ts:67`).
6. **Firestore data:** confirm new docs appear under `users/{uid}/weights`, `…/measurements`, etc., in the Firebase console.
7. **Photo upload:** confirm files land at `progressPhotos/{uid}/{weekId}/{view}.jpg` with size <5MB and thumbnail sibling.
8. **No regressions:** `/plan` still logs workouts to localStorage; `Index.tsx` streak still works; `HydrationTracker.tsx` still increments visually.
9. **i18n:** switch to Arabic; no untranslated keys, RTL layout intact.
10. **Pro gating:** non-Pro users see Weekly AI Report locked with the existing `ProSubscriptionPanel` pattern.

---

## 14. Open questions for the user

These do not block writing the plan, but should be answered before implementation step 8 or 11:

1. **Workout shadow-write scope.** OK to mirror every saved workout to Firestore (small docs, ~1–5 KB each)? Alternative: only mirror summaries. Recommendation: full mirror — enables PR history and analytics.
2. **Weekly report cadence.** Generate on Friday local-time on first dashboard open, or via a Cloud Function on a fixed cron? Recommendation: client-side lazy generation for v1; defer Cloud Functions to phase 2.
3. **Gemini API key.** Currently hard-coded in `lib/gemini.ts:8`. For the Weekly AI Report, do you want to keep this client-side or move it behind a Cloud Function (recommended for any growth in usage volume).
4. **Photo retention.** Keep photos forever or auto-prune after N months? Recommendation: keep forever, expose "delete week" action.
5. **Demo/seed data toggle.** Want a `?demo=true` query param that loads sample WeightEntries/Photos/Workouts so screenshots and design reviews look populated without polluting real user data?

---

## 15. Summary

- **Folder seam:** `src/features/progress/` — one section file per feature, one `progressStore`, one Firestore subcollection per data domain.
- **Zero schema-rule changes**, only one storage rule + three indexes.
- **No retraining or destructive migrations.** Existing localStorage workout log continues to work; we shadow-write to Firestore.
- **Reuse everything already installed:** Recharts, Framer Motion, vaul, embla, react-webcam, react-circular-progressbar, react-use-gesture, shadcn — no new dependencies.
- **Ship in 12 ordered steps**, each independently shippable, with the dashboard rendering a clean empty state from day 1.

Awaiting approval to begin Step 1 (foundation skeleton).
