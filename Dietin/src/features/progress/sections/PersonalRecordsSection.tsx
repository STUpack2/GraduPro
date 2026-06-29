import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/stores/progressStore";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { PRBadge } from "../components/PRBadge";
import { daysBetween, localDateKey } from "../lib/dates";

export function PersonalRecordsSection() {
  const { t } = useTranslation();
  const prs = useProgressStore((s) => s.prs);
  const hydrated = useProgressStore((s) => s.hydrated);

  const list = useMemo(() => {
    const today = localDateKey();
    return Object.values(prs)
      .map((pr) => {
        const sorted = [...pr.history].sort((a, b) => b.date.localeCompare(a.date));
        const latest = sorted[0];
        const prior = sorted.find((h) => h.weightKg < pr.bestWeightKg);
        const isNew = !!latest && daysBetween(latest.date, today) <= 7
          && latest.weightKg === pr.bestWeightKg && latest.reps === pr.bestWeightReps;
        return { pr, isNew, prior };
      })
      .sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.pr.bestE1rmKg - a.pr.bestE1rmKg)
      .slice(0, 12);
  }, [prs]);

  const state = !hydrated && list.length === 0
    ? "loading"
    : list.length === 0
      ? "empty"
      : "populated";

  return (
    <DashboardCard
      state={state}
      empty={
        <EmptyState
          icon={Trophy}
          title={t("progress.pr.empty_title", { defaultValue: "Personal records appear after a workout" })}
          description={t("progress.pr.empty_desc", {
            defaultValue: "Complete a set with weight and reps to start tracking PRs automatically.",
          })}
        />
      }
    >
      <div className="p-5">
        <SectionHeader
          icon={<Trophy className="h-5 w-5" />}
          title={t("progress.pr.title", { defaultValue: "Personal Records" })}
          description={t("progress.pr.desc", { defaultValue: "Heaviest lift, best estimated 1RM, top set volume." })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map(({ pr, isNew, prior }) => (
            <PRBadge
              key={pr.exerciseSlug}
              exercise={pr.exercise}
              weightKg={pr.bestWeightKg}
              reps={pr.bestWeightReps}
              isNew={isNew}
              previousWeightKg={prior?.weightKg}
              previousReps={prior?.reps}
            />
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
