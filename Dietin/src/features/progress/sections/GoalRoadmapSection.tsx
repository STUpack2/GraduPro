import { useMemo } from "react";
import { Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUserStore } from "@/stores/userStore";
import { useProgressStore } from "@/stores/progressStore";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { MilestoneMarker } from "../components/MilestoneMarker";
import { projectTargets } from "../lib/projection";
import { Progress } from "@/components/ui/progress";

export function GoalRoadmapSection() {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const weights = useProgressStore((s) => s.weights);
  const startWeightKg = useProgressStore((s) => s.startWeightKg);
  const hydrated = useProgressStore((s) => s.hydrated);

  const latest = weights[weights.length - 1] ?? null;
  const start = startWeightKg ?? weights[0]?.weightKg ?? null;
  const goal = user?.targetWeight ?? null;

  const { pct, etaDate } = useMemo(() => {
    if (!latest || !start || !goal) return { pct: 0, etaDate: null as string | null };
    const total = start - goal;
    if (total === 0) return { pct: 100, etaDate: null };
    const done = start - latest.weightKg;
    const percent = Math.max(0, Math.min(100, (done / total) * 100));
    const projection = projectTargets(weights, [goal]);
    return { pct: percent, etaDate: projection.points[0]?.etaDate ?? null };
  }, [latest, start, goal, weights]);

  const ready = hydrated && latest && start && goal;
  const state = !hydrated && weights.length === 0
    ? "loading"
    : !ready
      ? "empty"
      : "populated";

  return (
    <DashboardCard
      state={state}
      empty={
        <EmptyState
          icon={Flag}
          title={t("progress.goal.empty_title", { defaultValue: "Pick a target weight to see your roadmap" })}
          description={t("progress.goal.empty_desc", {
            defaultValue: "Set a goal in your Profile and log a weight to see how close you are.",
          })}
        />
      }
    >
      <div className="p-5">
        <SectionHeader
          icon={<Flag className="h-5 w-5" />}
          title={t("progress.goal.title", { defaultValue: "Goal Roadmap" })}
          description={t("progress.goal.desc", { defaultValue: "Your journey from where you started to where you're heading." })}
        />
        {ready && (
          <>
            <div className="flex items-center justify-between gap-3 mb-3">
              <MilestoneMarker
                state="done"
                label={t("progress.goal.start", { defaultValue: "Start" })}
                value={`${start.toFixed(1)} kg`}
                side="left"
              />
              <MilestoneMarker
                state="active"
                label={t("progress.goal.now", { defaultValue: "Now" })}
                value={`${latest.weightKg.toFixed(1)} kg`}
              />
              <MilestoneMarker
                state={pct >= 100 ? "done" : "future"}
                label={t("progress.goal.goal", { defaultValue: "Goal" })}
                value={`${goal.toFixed(1)} kg`}
                side="right"
              />
            </div>
            <Progress value={pct} className="h-2" />
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-text-muted">
                {t("progress.goal.progress_label", { defaultValue: "Progress" })}: {Math.round(pct)}%
              </span>
              {etaDate ? (
                <span className="text-gray-500">
                  {t("progress.goal.eta", { defaultValue: "ETA" })}:{" "}
                  {new Date(etaDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              ) : (
                <span className="text-gray-500">
                  {t("progress.goal.eta_unknown", { defaultValue: "ETA: keep logging" })}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardCard>
  );
}
