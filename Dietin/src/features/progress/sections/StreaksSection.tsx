import { useEffect } from "react";
import { Dumbbell, Drumstick, Flame, GlassWater } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/stores/progressStore";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { StreakBadge } from "../components/StreakBadge";
import type { StreakKind } from "../types";

const KIND_META: Record<Exclude<StreakKind, "visit">, {
  icon: typeof Flame;
  label: { key: string; defaultValue: string };
  accent: string;
}> = {
  workout:   { icon: Dumbbell,   label: { key: "progress.streak.workout",   defaultValue: "Workout" },   accent: "linear-gradient(140deg,#3b82f6,#8b5cf6)" },
  protein:   { icon: Drumstick,  label: { key: "progress.streak.protein",   defaultValue: "Protein" },   accent: "linear-gradient(140deg,#ef4444,#f97316)" },
  calories:  { icon: Flame,      label: { key: "progress.streak.calories",  defaultValue: "Calories" },  accent: "linear-gradient(140deg,#f59e0b,#ef4444)" },
  hydration: { icon: GlassWater, label: { key: "progress.streak.hydration", defaultValue: "Hydration" }, accent: "linear-gradient(140deg,#22d3ee,#3b82f6)" },
};

const ORDER: Exclude<StreakKind, "visit">[] = ["workout", "protein", "calories", "hydration"];

export function StreaksSection() {
  const { t } = useTranslation();
  const streaks = useProgressStore((s) => s.streaks);
  const recompute = useProgressStore((s) => s.recomputeStreaks);
  const hydrated = useProgressStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated) {
      void recompute();
    }
  }, [hydrated, recompute]);

  const anyActivity = ORDER.some((k) => (streaks[k]?.longest ?? 0) > 0);
  const state = !hydrated
    ? "loading"
    : !anyActivity
      ? "empty"
      : "populated";

  return (
    <DashboardCard
      state={state}
      empty={
        <EmptyState
          icon={Flame}
          title={t("progress.streaks.empty_title", { defaultValue: "Start a streak" })}
          description={t("progress.streaks.empty_desc", {
            defaultValue: "Log a meal, finish a workout, or hit your water target to begin tracking streaks.",
          })}
        />
      }
    >
      <div className="p-5">
        <SectionHeader
          icon={<Flame className="h-5 w-5" />}
          title={t("progress.streaks.title", { defaultValue: "Streaks" })}
          description={t("progress.streaks.desc", { defaultValue: "Daily consistency, separated by habit." })}
        />
        <div className="flex gap-3 overflow-x-auto -mx-1 px-1 pb-1 snap-x">
          {ORDER.map((kind) => {
            const meta = KIND_META[kind];
            const info = streaks[kind] ?? { current: 0, longest: 0 };
            return (
              <div key={kind} className="snap-start">
                <StreakBadge
                  current={info.current}
                  longest={info.longest}
                  label={t(meta.label.key, { defaultValue: meta.label.defaultValue })}
                  icon={meta.icon}
                  accent={meta.accent}
                  unit={t("progress.streaks.day_unit", { defaultValue: "d" })}
                />
              </div>
            );
          })}
        </div>
      </div>
    </DashboardCard>
  );
}
