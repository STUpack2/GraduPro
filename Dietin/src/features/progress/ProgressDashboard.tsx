import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  BarChart3,
  Calendar,
  ClipboardList,
  Dumbbell,
  Flag,
  Flame,
  Images,
  Ruler,
  Scale,
  Sparkles,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import { useProgressStore } from "@/stores/progressStore";
import { auth } from "@/lib/firebase";
import { SegmentedTabs } from "./components/SegmentedTabs";
import { WeightJourneySection } from "./sections/WeightJourneySection";
import { WeeklyTrendSection } from "./sections/WeeklyTrendSection";
import { ProjectionSection } from "./sections/ProjectionSection";
import { PhotosSection } from "./sections/PhotosSection";
import { MeasurementsSection } from "./sections/MeasurementsSection";
import { FitnessScoreSection } from "./sections/FitnessScoreSection";
import { StreaksSection } from "./sections/StreaksSection";
import { WorkoutAnalyticsSection } from "./sections/WorkoutAnalyticsSection";
import { PersonalRecordsSection } from "./sections/PersonalRecordsSection";
import { WeeklyReportSection } from "./sections/WeeklyReportSection";
import { HealthTimelineSection } from "./sections/HealthTimelineSection";
import { GoalRoadmapSection } from "./sections/GoalRoadmapSection";
import { localDateKey } from "./lib/dates";
import { seedDemoData } from "./lib/demoData";

type TabKey =
  | "overview" | "weight" | "photos" | "body" | "score"
  | "streaks" | "workouts" | "prs" | "ai" | "goal";

interface TabSpec {
  key: TabKey;
  labelKey: string;
  def: string;
  icon: typeof Activity;
}

const TABS: TabSpec[] = [
  { key: "overview", labelKey: "progress.tab.overview", def: "Overview",    icon: Activity },
  { key: "weight",   labelKey: "progress.tab.weight",   def: "Weight",      icon: Scale },
  { key: "photos",   labelKey: "progress.tab.photos",   def: "Photos",      icon: Images },
  { key: "body",     labelKey: "progress.tab.body",     def: "Body",        icon: Ruler },
  { key: "score",    labelKey: "progress.tab.score",    def: "Score",       icon: TrendingUp },
  { key: "streaks",  labelKey: "progress.tab.streaks",  def: "Streaks",     icon: Flame },
  { key: "workouts", labelKey: "progress.tab.workouts", def: "Workouts",    icon: BarChart3 },
  { key: "prs",      labelKey: "progress.tab.prs",      def: "PRs",         icon: Trophy },
  { key: "ai",       labelKey: "progress.tab.ai",       def: "AI Report",   icon: Sparkles },
  { key: "goal",     labelKey: "progress.tab.goal",     def: "Goal",        icon: Flag },
];

function markVisitToday() {
  try {
    const raw = localStorage.getItem("dietin.visitDays");
    const arr: string[] = raw ? JSON.parse(raw) : [];
    const today = localDateKey();
    if (!arr.includes(today)) {
      arr.push(today);
      // keep last 365
      const trimmed = arr.slice(-365);
      localStorage.setItem("dietin.visitDays", JSON.stringify(trimmed));
    }
  } catch {
    /* ignore */
  }
}

export default function ProgressDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabParam = (params.get("tab") as TabKey | null) ?? "overview";
  const [tab, setTab] = useState<TabKey>(tabParam);
  const user = useUserStore((s) => s.user);
  const hydrate = useProgressStore((s) => s.hydrate);
  const reset = useProgressStore((s) => s.reset);
  const hydrated = useProgressStore((s) => s.hydrated);

  // Demo seeding for design reviews / screenshots.
  useEffect(() => {
    if (params.get("demo") === "true") {
      void seedDemoData();
    }
  }, [params]);

  useEffect(() => {
    markVisitToday();
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      void hydrate(uid);
    } else {
      reset();
    }
  }, [hydrate, reset, user?.name]);

  useEffect(() => {
    if (tab !== tabParam) {
      const next = new URLSearchParams(params);
      if (tab === "overview") next.delete("tab");
      else next.set("tab", tab);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tabParam !== tab) setTab(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  const tabContent = useMemo(() => {
    switch (tab) {
      case "weight":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <WeightJourneySection />
            <WeeklyTrendSection />
            <div className="md:col-span-2">
              <ProjectionSection />
            </div>
          </div>
        );
      case "photos":
        return <PhotosSection />;
      case "body":
        return <MeasurementsSection />;
      case "score":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <FitnessScoreSection />
            <HealthTimelineSection />
          </div>
        );
      case "streaks":
        return <StreaksSection />;
      case "workouts":
        return <WorkoutAnalyticsSection />;
      case "prs":
        return <PersonalRecordsSection />;
      case "ai":
        return <WeeklyReportSection />;
      case "goal":
        return <GoalRoadmapSection />;
      case "overview":
      default:
        return (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <WeightJourneySection />
            <WeeklyTrendSection />
            <FitnessScoreSection />
            <StreaksSection />
            <ProjectionSection />
            <GoalRoadmapSection />
            <div className="md:col-span-2 xl:col-span-3">
              <PhotosSection />
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <WorkoutAnalyticsSection />
            </div>
            <MeasurementsSection />
            <PersonalRecordsSection />
            <div className="md:col-span-2 xl:col-span-2">
              <WeeklyReportSection />
            </div>
            <HealthTimelineSection />
          </div>
        );
    }
  }, [tab]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32 }}
      className="h-full overflow-y-auto -webkit-overflow-scrolling-touch"
    >
      <div className="container mx-auto space-y-6 p-4 sm:p-6 pb-28 max-w-[1920px]">
        <header className="flex flex-col gap-3">
          <h1 className="text-[1.75rem] tracking-tight text-gray-900 dark:text-white font-sf-display font-sf-bold">
            {t("plan.progress", { defaultValue: "Progress" })}
          </h1>
          {user && (
            <div className="flex justify-center w-full -mt-1">
              <div className="bg-gray-100 dark:bg-white/5 rounded-full p-1 flex items-center shadow-md border border-gray-200/50 dark:border-white/10">
                <Link to="/plan" className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70 dark:hover:bg-white/10">
                  <span className="text-sm font-medium text-gray-600 dark:text-text-muted">{t("plan.plan")}</span>
                  <ClipboardList className="w-4 h-4 text-gray-600 dark:text-text-muted" />
                </Link>
                <Link to="/workouts" className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70 dark:hover:bg-white/10">
                  <span className="text-sm font-medium text-gray-600 dark:text-text-muted">{t("plan.library")}</span>
                  <Dumbbell className="w-4 h-4 text-gray-600 dark:text-text-muted" />
                </Link>
                <Link to="/progress" className="px-5 py-2 rounded-full bg-white dark:bg-white/15 shadow-sm flex items-center gap-2.5 transition-all duration-200 border border-gray-100 dark:border-white/10">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{t("plan.progress")}</span>
                  <BarChart3 className="w-4 h-4 text-primary" />
                </Link>
              </div>
            </div>
          )}
        </header>

        <div className="sticky top-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 backdrop-blur-md bg-white/70 dark:bg-bg-DEFAULT/70 supports-[backdrop-filter]:bg-white/60">
          <div className="overflow-x-auto -mx-1 px-1 snap-x">
            <SegmentedTabs<TabKey>
              value={tab}
              onChange={setTab}
              ariaLabel="progress tabs"
              options={TABS.map((spec) => ({
                value: spec.key,
                label: (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <spec.icon className="h-3.5 w-3.5" />
                    {t(spec.labelKey, { defaultValue: spec.def })}
                  </span>
                ),
              }))}
            />
          </div>
        </div>

        <section aria-live="polite">{tabContent}</section>

        {!hydrated && !user && (
          <div className="text-center text-xs text-gray-500 dark:text-text-muted">
            {t("progress.signed_out_hint", { defaultValue: "Sign in to sync your transformation across devices." })}{" "}
            <button onClick={() => navigate("/auth")} className="text-primary underline-offset-2 hover:underline">
              {t("progress.sign_in", { defaultValue: "Sign in" })}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
