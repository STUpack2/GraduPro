import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/stores/progressStore";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { SegmentedTabs } from "../components/SegmentedTabs";
import { DeltaBadge } from "../components/DeltaBadge";
import { HeatmapGrid } from "../components/HeatmapGrid";
import { volumeByMuscle, workoutHeatmap } from "../lib/volumeCalc";

const GROUP_LABELS: Record<string, { key: string; def: string }> = {
  chest:     { key: "progress.workout.muscle.chest",     def: "Chest" },
  back:      { key: "progress.workout.muscle.back",      def: "Back" },
  legs:      { key: "progress.workout.muscle.legs",      def: "Legs" },
  shoulders: { key: "progress.workout.muscle.shoulders", def: "Shoulders" },
  arms:      { key: "progress.workout.muscle.arms",      def: "Arms" },
  core:      { key: "progress.workout.muscle.core",      def: "Core" },
  other:     { key: "progress.workout.muscle.other",     def: "Other" },
};

export function WorkoutAnalyticsSection() {
  const { t } = useTranslation();
  const workouts = useProgressStore((s) => s.workouts);
  const hydrated = useProgressStore((s) => s.hydrated);
  const [range, setRange] = useState<"week" | "month">("week");
  const days = range === "week" ? 7 : 30;

  const rows = useMemo(() => volumeByMuscle(workouts, days), [workouts, days]);
  const heatmap = useMemo(() => workoutHeatmap(workouts, range === "week" ? 8 : 12), [workouts, range]);
  const maxVolume = rows[0]?.currentVolumeKg ?? 0;

  const state = !hydrated && workouts.length === 0
    ? "loading"
    : workouts.length === 0
      ? "empty"
      : "populated";

  return (
    <DashboardCard
      state={state}
      empty={
        <EmptyState
          icon={BarChart3}
          title={t("progress.workout.empty_title", { defaultValue: "Finish a workout to see analytics" })}
          description={t("progress.workout.empty_desc", {
            defaultValue: "Complete sets in the Plan tab. Your volume by muscle group will appear here.",
          })}
        />
      }
    >
      <div className="p-5">
        <SectionHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title={t("progress.workout.title", { defaultValue: "Workout Analytics" })}
          description={t("progress.workout.desc", {
            defaultValue: "Training volume by muscle group, week-over-week.",
          })}
          action={
            <SegmentedTabs<"week" | "month">
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: "week", label: t("progress.common.week", { defaultValue: "Week" }) },
                { value: "month", label: t("progress.common.month", { defaultValue: "Month" }) },
              ]}
            />
          }
        />
        <div className="space-y-2 mb-4">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-text-muted px-1">
              {t("progress.workout.no_volume", { defaultValue: "No completed volume in this window yet." })}
            </p>
          ) : (
            rows.map((row) => {
              const meta = GROUP_LABELS[row.group] ?? { key: "", def: row.group };
              const label = meta.key ? t(meta.key, { defaultValue: meta.def }) : meta.def;
              const pct = maxVolume > 0 ? (row.currentVolumeKg / maxVolume) * 100 : 0;
              return (
                <div key={row.group} className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                    <div className="flex items-center gap-2">
                      {row.deltaPct !== null && <DeltaBadge value={row.deltaPct} unit="%" positiveIsUp size="sm" />}
                      <span className="text-xs text-gray-600 dark:text-text-muted">{row.currentVolumeKg} kg</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200/70 dark:bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
            {t("progress.workout.heatmap_title", { defaultValue: "Frequency heatmap" })}
          </h3>
          <HeatmapGrid
            matrix={heatmap.matrix}
            max={heatmap.max}
            rowLabels={heatmap.weekdays}
            ariaLabel={t("progress.workout.heatmap_alt", { defaultValue: "Volume heatmap by weekday and week" })}
          />
        </div>
      </div>
    </DashboardCard>
  );
}
