import { useMemo } from "react";
import { CalendarRange, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/stores/progressStore";
import { computeWeeklyTrend } from "../lib/projection";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { DeltaBadge } from "../components/DeltaBadge";
import { MiniChart } from "../components/MiniChart";
import { useUserStore } from "@/stores/userStore";

const TREND_COPY = {
  accelerating: { defaultValue: "Accelerating" },
  steady:       { defaultValue: "Steady" },
  slowing:      { defaultValue: "Slowing" },
  reversing:    { defaultValue: "Reversing" },
  insufficient: { defaultValue: "Need more data" },
} as const;

export function WeeklyTrendSection() {
  const { t } = useTranslation();
  const weights = useProgressStore((s) => s.weights);
  const hydrated = useProgressStore((s) => s.hydrated);
  const user = useUserStore((s) => s.user);

  const trend = useMemo(() => computeWeeklyTrend(weights), [weights]);
  const wantLoss = !(user?.goal === "GAIN_MUSCLE" || user?.goal === "GAIN_WEIGHT");

  const state = !hydrated && weights.length === 0
    ? "loading"
    : weights.length < 2
      ? "empty"
      : "populated";

  const sparkline = trend.weeklyHistory.slice(-8).map((w) => w.deltaKg);

  return (
    <DashboardCard
      state={state}
      empty={
        <EmptyState
          icon={CalendarRange}
          title={t("progress.weekly.empty_title", { defaultValue: "Weekly trends unlock at 2 weigh-ins" })}
          description={t("progress.weekly.empty_desc", { defaultValue: "Log another weight tomorrow to start tracking week-over-week change." })}
        />
      }
    >
      <div className="p-5">
        <SectionHeader
          icon={<TrendingUp className="h-5 w-5" />}
          title={t("progress.weekly.title", { defaultValue: "Weekly Trend" })}
          description={t("progress.weekly.desc", { defaultValue: "This week vs last week, at a glance." })}
        />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              {t("progress.weekly.this_week", { defaultValue: "This week" })}
            </div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white mt-1">
              {trend.thisWeekDeltaKg !== null ? `${trend.thisWeekDeltaKg > 0 ? "+" : ""}${trend.thisWeekDeltaKg.toFixed(1)} kg` : "—"}
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              {t("progress.weekly.last_week", { defaultValue: "Last week" })}
            </div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white mt-1">
              {trend.lastWeekDeltaKg !== null ? `${trend.lastWeekDeltaKg > 0 ? "+" : ""}${trend.lastWeekDeltaKg.toFixed(1)} kg` : "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-gray-600 dark:text-text-muted">
            {t("progress.weekly.trend_label", { defaultValue: "Trend" })}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="text-gray-900 dark:text-white font-medium">
              {t(`progress.weekly.trend.${trend.trend}`, TREND_COPY[trend.trend])}
            </span>
            {trend.thisWeekDeltaKg !== null && (
              <DeltaBadge
                value={trend.thisWeekDeltaKg}
                unit="kg"
                positiveIsUp={!wantLoss}
                size="sm"
              />
            )}
          </span>
        </div>
        {sparkline.length > 1 && (
          <div className="mt-3 rounded-xl bg-white/40 dark:bg-white/5 p-2">
            <MiniChart data={sparkline} positiveIsUp={!wantLoss} height={48} ariaLabel="weekly deltas" />
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
