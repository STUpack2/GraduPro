import { useEffect, useMemo, useState } from "react";
import { Sparkles, Lock, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUserStore } from "@/stores/userStore";
import { useProgressStore } from "@/stores/progressStore";
import { genAI } from "@/lib/gemini";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { SegmentedTabs } from "../components/SegmentedTabs";
import { endOfIsoWeek, isoWeekId, localDateKey, startOfIsoWeek } from "../lib/dates";
import { buildWeeklyReportPrompt, parseReportResponse, reportFromFallback } from "../lib/reportPrompt";
import type { WeeklyReport } from "../types";

const GEMINI_MODEL = "gemini-2.0-flash";

function summarizeWeek(args: {
  weekStart: string;
  weekEnd: string;
  weights: Array<{ date: string; weightKg: number }>;
  workoutsCompleted: number;
  workoutsTarget: number;
  dailyCalories: Record<string, { totalCalories: number; totalProtein: number }>;
  hydrationDaily: Record<string, number>;
  goals: { calorieGoal: number; proteinGoal: number; hydrationMl: number };
  consistencyScoreDelta: number;
  prCount: number;
  userName?: string;
  lang: string;
}) {
  const inWeek = (d: string) => d >= args.weekStart && d <= args.weekEnd;
  const weekWeights = args.weights.filter((w) => inWeek(w.date));
  const weightStartKg = weekWeights[0]?.weightKg;
  const weightEndKg = weekWeights[weekWeights.length - 1]?.weightKg;

  let proteinHit = 0;
  let calorieHit = 0;
  for (const [d, data] of Object.entries(args.dailyCalories)) {
    if (!inWeek(d) || !data) continue;
    const proteinPct = args.goals.proteinGoal ? data.totalProtein / args.goals.proteinGoal : 0;
    const caloriePct = args.goals.calorieGoal ? data.totalCalories / args.goals.calorieGoal : 0;
    if (proteinPct >= 0.9) proteinHit += 1;
    if (caloriePct >= 0.9 && caloriePct <= 1.1) calorieHit += 1;
  }
  let hydrationHit = 0;
  for (const [d, ml] of Object.entries(args.hydrationDaily)) {
    if (!inWeek(d)) continue;
    if (ml >= args.goals.hydrationMl) hydrationHit += 1;
  }
  return {
    weightStartKg,
    weightEndKg,
    proteinHit,
    calorieHit,
    hydrationHit,
  };
}

export function WeeklyReportSection() {
  const { t, i18n } = useTranslation();
  const user = useUserStore((s) => s.user);
  const reports = useProgressStore((s) => s.weeklyReports);
  const cache = useProgressStore((s) => s.cacheWeeklyReport);
  const hydrated = useProgressStore((s) => s.hydrated);
  const weights = useProgressStore((s) => s.weights);
  const workouts = useProgressStore((s) => s.workouts);
  const hydrationDaily = useProgressStore((s) => s.hydrationDaily);
  const fitnessScores = useProgressStore((s) => s.fitnessScores);
  const prs = useProgressStore((s) => s.prs);
  const dailyCalories = useUserStore((s) => s.dailyCalories);

  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"current" | "archive">("current");
  const isPro = !!user?.isPro;

  const currentWeekId = isoWeekId();
  const weekStart = localDateKey(startOfIsoWeek());
  const weekEnd = localDateKey(endOfIsoWeek());

  const cachedCurrent = reports.find((r) => r.weekId === currentWeekId) ?? null;

  const stats = useMemo(() => {
    const goals = {
      calorieGoal: user?.calorieGoal ?? 2000,
      proteinGoal: user?.proteinGoal ?? 150,
      hydrationMl: 2500,
    };
    const workoutsCompleted = workouts.filter((w) => w.date >= weekStart && w.date <= weekEnd && w.completionPercentage > 0).length;
    const workoutsTarget = user?.workoutDays ?? 4;
    const calMap: Record<string, { totalCalories: number; totalProtein: number }> = {};
    for (const [d, data] of Object.entries(dailyCalories ?? {})) {
      calMap[d] = { totalCalories: data.totalCalories ?? 0, totalProtein: data.totalProtein ?? 0 };
    }
    const summary = summarizeWeek({
      weekStart,
      weekEnd,
      weights,
      workoutsCompleted,
      workoutsTarget,
      dailyCalories: calMap,
      hydrationDaily,
      goals,
      consistencyScoreDelta: 0,
      prCount: 0,
      userName: user?.name,
      lang: i18n.language,
    });
    const thisOverall = fitnessScores.find((f) => f.date >= weekStart)?.overall ?? 0;
    const priorOverall = fitnessScores.find((f) => f.date < weekStart)?.overall ?? 0;
    const consistencyScoreDelta = thisOverall - priorOverall;

    const prCount = Object.values(prs).filter((pr) => pr.history[0]?.date >= weekStart && pr.history[0]?.date <= weekEnd).length;

    return { ...summary, workoutsCompleted, workoutsTarget, consistencyScoreDelta, prCount };
  }, [weights, workouts, dailyCalories, hydrationDaily, user, weekStart, weekEnd, fitnessScores, prs, i18n.language]);

  // Auto-generate Friday or later if no cached report yet.
  useEffect(() => {
    if (!isPro || !hydrated || cachedCurrent || busy) return;
    const day = new Date().getDay(); // 0=Sun..5=Fri
    if (day < 5 && day !== 0) return; // only after Friday (or Sun)
    if (stats.workoutsCompleted === 0 && stats.calorieHit === 0 && stats.hydrationHit === 0) return;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, hydrated, cachedCurrent, stats.workoutsCompleted, stats.calorieHit, stats.hydrationHit]);

  async function generate() {
    if (busy) return;
    setBusy(true);
    try {
      const prompt = buildWeeklyReportPrompt({
        weekStart,
        weekEnd,
        weightStartKg: stats.weightStartKg,
        weightEndKg: stats.weightEndKg,
        workoutsCompleted: stats.workoutsCompleted,
        workoutsTarget: stats.workoutsTarget,
        proteinHitDays: stats.proteinHit,
        calorieHitDays: stats.calorieHit,
        hydrationHitDays: stats.hydrationHit,
        consistencyScoreDelta: stats.consistencyScoreDelta,
        prCount: stats.prCount,
        lang: i18n.language,
        userName: user?.name,
      });

      let summaryText = "";
      let summaryHighlights: string[] = [];
      try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent(prompt);
        const parsed = parseReportResponse(result.response.text());
        summaryText = parsed.summary;
        summaryHighlights = parsed.highlights;
      } catch (err) {
        console.warn("Gemini report failed, using fallback", err);
        const fb = reportFromFallback({
          weekStart,
          weekEnd,
          weightStartKg: stats.weightStartKg,
          weightEndKg: stats.weightEndKg,
          workoutsCompleted: stats.workoutsCompleted,
          workoutsTarget: stats.workoutsTarget,
          proteinHitDays: stats.proteinHit,
          calorieHitDays: stats.calorieHit,
          hydrationHitDays: stats.hydrationHit,
          consistencyScoreDelta: stats.consistencyScoreDelta,
          prCount: stats.prCount,
          lang: i18n.language,
        });
        summaryText = fb.summaryText;
        summaryHighlights = fb.summaryHighlights;
      }

      const report: WeeklyReport = {
        weekId: currentWeekId,
        weekStart,
        weekEnd,
        weightDeltaKg:
          stats.weightStartKg !== undefined && stats.weightEndKg !== undefined
            ? Number((stats.weightEndKg - stats.weightStartKg).toFixed(2))
            : 0,
        workoutsCompleted: stats.workoutsCompleted,
        proteinHitDays: stats.proteinHit,
        calorieHitDays: stats.calorieHit,
        hydrationHitDays: stats.hydrationHit,
        consistencyScoreDelta: stats.consistencyScoreDelta,
        summaryText,
        summaryHighlights,
        generatedAt: new Date().toISOString(),
        model: GEMINI_MODEL,
      };
      await cache(report);
    } finally {
      setBusy(false);
    }
  }

  const shareReport = async (report: WeeklyReport) => {
    const text = [`Dietin weekly recap (${report.weekId})`, report.summaryText, ...report.summaryHighlights].filter(Boolean).join("\n");
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title: "Dietin", text });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const archive = reports.filter((r) => r.weekId !== currentWeekId).slice(0, 12);
  const showLocked = !isPro;

  const state = !hydrated
    ? "loading"
    : showLocked
      ? "populated"
      : !cachedCurrent && stats.workoutsCompleted === 0 && stats.calorieHit === 0 && stats.hydrationHit === 0
        ? "empty"
        : "populated";

  return (
    <DashboardCard
      state={state}
      empty={
        <EmptyState
          icon={Sparkles}
          title={t("progress.ai_report.empty_title", { defaultValue: "Your AI recap arrives every Friday" })}
          description={t("progress.ai_report.empty_desc", {
            defaultValue: "Log workouts, meals, or hydration this week and Gemini will summarise it for you.",
          })}
        />
      }
    >
      <div className="p-5">
        <SectionHeader
          icon={<Sparkles className="h-5 w-5" />}
          title={t("progress.ai_report.title", { defaultValue: "Weekly AI Report" })}
          description={t("progress.ai_report.desc", { defaultValue: "Friday recap powered by Gemini." })}
          action={
            !showLocked && (
              <SegmentedTabs<"current" | "archive">
                size="sm"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "current", label: t("progress.ai_report.this_week", { defaultValue: "This week" }) },
                  { value: "archive", label: t("progress.ai_report.archive", { defaultValue: "Archive" }) },
                ]}
              />
            )
          }
        />

        {showLocked ? (
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 p-5 text-center">
            <Lock className="h-7 w-7 mx-auto text-primary mb-2" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {t("progress.ai_report.locked_title", { defaultValue: "Dietin Pro unlocks your weekly recap" })}
            </h3>
            <p className="text-sm text-gray-600 dark:text-text-muted mt-1">
              {t("progress.ai_report.locked_desc", {
                defaultValue: "Get a personalised Gemini summary of your week, plus shareable highlights.",
              })}
            </p>
          </div>
        ) : tab === "current" ? (
          cachedCurrent ? (
            <article className="rounded-2xl border border-black/5 dark:border-white/10 p-4 bg-gray-50 dark:bg-white/5">
              <p className="text-sm text-gray-800 dark:text-text-default whitespace-pre-line">
                {cachedCurrent.summaryText}
              </p>
              {cachedCurrent.summaryHighlights.length > 0 && (
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {cachedCurrent.summaryHighlights.map((h, i) => (
                    <li key={i} className="text-xs bg-white dark:bg-bg-card rounded-xl px-3 py-2 border border-black/5 dark:border-white/10">
                      {h}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => shareReport(cachedCurrent)}>
                  <Share2 className="h-4 w-4 mr-1.5" />
                  {t("progress.common.share", { defaultValue: "Share" })}
                </Button>
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 p-5 text-center">
              <p className="text-sm text-gray-600 dark:text-text-muted">
                {t("progress.ai_report.not_yet", {
                  defaultValue: "Generate this week's recap once you've logged a few days of activity.",
                })}
              </p>
              <Button onClick={generate} disabled={busy} className="mt-3">
                {busy
                  ? t("progress.ai_report.generating", { defaultValue: "Generating…" })
                  : t("progress.ai_report.generate", { defaultValue: "Generate now" })}
              </Button>
            </div>
          )
        ) : archive.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-text-muted">
            {t("progress.ai_report.no_archive", { defaultValue: "Past reports will appear here once we have a few weeks." })}
          </p>
        ) : (
          <ul className="space-y-2">
            {archive.map((r) => (
              <li key={r.weekId} className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white">{r.weekId}</span>
                  <span>{r.weekStart} → {r.weekEnd}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-text-muted line-clamp-3">{r.summaryText}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
