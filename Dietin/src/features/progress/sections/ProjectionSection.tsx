import { useMemo } from "react";
import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUserStore } from "@/stores/userStore";
import { useProgressStore } from "@/stores/progressStore";
import { projectTargets } from "../lib/projection";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { ConfidenceBar } from "../components/ConfidenceBar";

function buildTargets(latestKg: number, goalKg: number | null): number[] {
  if (!goalKg) {
    // Three intermediate rounded targets relative to current weight.
    const losing = latestKg > 0;
    return losing
      ? [Math.round(latestKg) - 3, Math.round(latestKg) - 8, Math.round(latestKg) - 13]
      : [Math.round(latestKg) + 3, Math.round(latestKg) + 8, Math.round(latestKg) + 13];
  }
  const goal = Math.round(goalKg);
  if (latestKg > goalKg) {
    const span = latestKg - goalKg;
    if (span < 4) return [Math.round(latestKg - span / 2), goal, goal - 2].filter((v, i, a) => a.indexOf(v) === i);
    return [Math.round(latestKg - span / 3), Math.round(latestKg - (2 * span) / 3), goal];
  }
  const span = goalKg - latestKg;
  return [Math.round(latestKg + span / 3), Math.round(latestKg + (2 * span) / 3), goal];
}

export function ProjectionSection() {
  const { t } = useTranslation();
  const weights = useProgressStore((s) => s.weights);
  const hydrated = useProgressStore((s) => s.hydrated);
  const user = useUserStore((s) => s.user);

  const latest = weights[weights.length - 1] ?? null;
  const targets = useMemo(() => {
    if (!latest) return [];
    return buildTargets(latest.weightKg, user?.targetWeight ?? null);
  }, [latest, user?.targetWeight]);

  const result = useMemo(() => projectTargets(weights, targets), [weights, targets]);

  const state = !hydrated && weights.length === 0
    ? "loading"
    : weights.length < 3
      ? "empty"
      : "populated";

  return (
    <DashboardCard
      state={state}
      empty={
        <EmptyState
          icon={Target}
          title={t("progress.projection.empty_title", { defaultValue: "Projections unlock at 3 weigh-ins" })}
          description={t("progress.projection.empty_desc", { defaultValue: "Add a few more entries — predictions get more accurate with each log." })}
        />
      }
    >
      <div className="p-5">
        <SectionHeader
          icon={<Target className="h-5 w-5" />}
          title={t("progress.projection.title", { defaultValue: "Projection" })}
          description={t("progress.projection.desc", {
            defaultValue: "At your current pace, here's when you reach the next milestones.",
          })}
          action={<ConfidenceBar level={result.confidence} />}
        />
        <ul className="space-y-2">
          {result.points.map((p) => {
            const reachable = p.weeks !== null;
            return (
              <li
                key={p.targetKg}
                className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2.5"
              >
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{p.targetKg} kg</span>
                <span className="flex-1 mx-2 h-px bg-gray-200 dark:bg-white/10 relative">
                  <span
                    className="absolute inset-y-0 left-0 bg-primary"
                    style={{
                      width: reachable
                        ? `${Math.max(8, Math.min(100, ((p.weeks ?? 0) / 26) * 100))}%`
                        : "100%",
                      opacity: reachable ? 1 : 0.15,
                    }}
                  />
                </span>
                <span className="text-xs text-gray-600 dark:text-text-muted whitespace-nowrap min-w-[88px] text-right">
                  {reachable
                    ? t("progress.projection.weeks", { count: p.weeks ?? 0, defaultValue: "{{count}} weeks" })
                    : t("progress.projection.unreachable", { defaultValue: "Trend not converging" })}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-gray-500 dark:text-text-muted mt-3">
          {t("progress.projection.basis", {
            defaultValue: "Based on the last {{weeks}} weeks of weigh-ins.",
            weeks: result.basisWeeks,
          })}
        </p>
      </div>
    </DashboardCard>
  );
}
