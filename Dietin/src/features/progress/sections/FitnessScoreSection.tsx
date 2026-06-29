import { useEffect, useMemo } from "react";
import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/stores/progressStore";
import { useUserStore } from "@/stores/userStore";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { CircularScore } from "../components/CircularScore";
import { AnimatedCounter } from "../components/AnimatedCounter";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SUBSCORE_META = [
  { key: "diet" as const,        labelKey: "progress.score.diet",        def: "Diet",        color: "#10b981" },
  { key: "workout" as const,     labelKey: "progress.score.workout",     def: "Workout",     color: "#3b82f6" },
  { key: "hydration" as const,   labelKey: "progress.score.hydration",   def: "Hydration",   color: "#06b6d4" },
  { key: "consistency" as const, labelKey: "progress.score.consistency", def: "Consistency", color: "#8b5cf6" },
];

export function FitnessScoreSection() {
  const { t } = useTranslation();
  const scores = useProgressStore((s) => s.fitnessScores);
  const recompute = useProgressStore((s) => s.recomputeFitnessScore);
  const hydrated = useProgressStore((s) => s.hydrated);
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    if (hydrated && user) void recompute();
  }, [hydrated, user, recompute]);

  const latest = scores[scores.length - 1] ?? null;
  const trendSeries = useMemo(() => scores.slice(-30), [scores]);

  const state = !hydrated
    ? "loading"
    : !latest
      ? "empty"
      : "populated";

  return (
    <DashboardCard
      state={state}
      empty={
        <EmptyState
          icon={Activity}
          title={t("progress.score.empty_title", { defaultValue: "Your fitness score appears once you log activity" })}
          description={t("progress.score.empty_desc", {
            defaultValue: "Log meals, hydration, and a workout to start scoring your day out of 100.",
          })}
        />
      }
    >
      <div className="p-5">
        <SectionHeader
          icon={<Activity className="h-5 w-5" />}
          title={t("progress.score.title", { defaultValue: "Fitness Score" })}
          description={t("progress.score.desc", { defaultValue: "Composite of diet, workouts, hydration and consistency." })}
        />
        {latest && (
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-5 items-center">
            <div className="flex justify-center">
              <CircularScore
                value={latest.overall}
                size={148}
                color="#10b981"
                label={
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      <AnimatedCounter value={latest.overall} decimals={0} />
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">/100</div>
                  </div>
                }
              />
            </div>
            <ul className="space-y-2.5">
              {SUBSCORE_META.map((m) => {
                const value = latest[m.key] ?? 0;
                return (
                  <li key={m.key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-text-muted">
                        {t(m.labelKey, { defaultValue: m.def })}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200/70 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${value}%`, background: m.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {trendSeries.length > 1 && (
          <div className="mt-5">
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              {t("progress.score.trends", { defaultValue: "Trends" })}
            </h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendSeries} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }}
                    labelFormatter={(d) => d}
                  />
                  <Line type="monotone" dataKey="overall" stroke="#10b981" strokeWidth={2.5} dot={false} name={t("progress.score.overall", { defaultValue: "Overall" })} />
                  <Line type="monotone" dataKey="consistency" stroke="#8b5cf6" strokeWidth={1.6} dot={false} name={t("progress.score.consistency", { defaultValue: "Consistency" })} />
                  <Line type="monotone" dataKey="diet" stroke="#10b981" strokeWidth={1.2} strokeDasharray="3 3" dot={false} name={t("progress.score.diet", { defaultValue: "Diet" })} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
