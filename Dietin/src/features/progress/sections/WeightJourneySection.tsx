import { useMemo, useState } from "react";
import { Scale, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUserStore } from "@/stores/userStore";
import { useProgressStore } from "@/stores/progressStore";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { DeltaBadge } from "../components/DeltaBadge";
import { MiniChart } from "../components/MiniChart";
import { LogWeightDrawer } from "../components/LogWeightDrawer";
import { Button } from "@/components/ui/button";

export function WeightJourneySection() {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const weights = useProgressStore((s) => s.weights);
  const startWeightKg = useProgressStore((s) => s.startWeightKg);
  const hydrated = useProgressStore((s) => s.hydrated);
  const [logOpen, setLogOpen] = useState(false);

  const latest = weights[weights.length - 1] ?? null;
  const start = useMemo(() => {
    if (typeof startWeightKg === "number") return startWeightKg;
    return weights[0]?.weightKg ?? null;
  }, [weights, startWeightKg]);

  const state = !hydrated && weights.length === 0
    ? "loading"
    : weights.length === 0
      ? "empty"
      : "populated";

  const total = latest && start ? Number((latest.weightKg - start).toFixed(1)) : 0;
  const targetWeight = user?.targetWeight ?? null;
  const sparkline = weights.slice(-30).map((w) => w.weightKg);

  return (
    <>
      <DashboardCard
        state={state}
        empty={
          <EmptyState
            icon={Scale}
            title={t("progress.weight.empty_title", { defaultValue: "Start your weight journey" })}
            description={t("progress.weight.empty_desc", {
              defaultValue: "Log today's weight to unlock projections, weekly trends and goal tracking.",
            })}
            cta={{
              label: t("progress.weight.log_cta", { defaultValue: "Log weight" }),
              onClick: () => setLogOpen(true),
            }}
          />
        }
      >
        <div className="p-5">
          <SectionHeader
            icon={<Scale className="h-5 w-5" />}
            title={t("progress.weight.title", { defaultValue: "Weight Journey" })}
            description={t("progress.weight.desc", { defaultValue: "Where you started, where you are, and where you're going." })}
            action={
              <Button size="sm" variant="ghost" className="text-primary -mr-1" onClick={() => setLogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t("progress.weight.log_cta", { defaultValue: "Log weight" })}
              </Button>
            }
          />
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                {t("progress.weight.current", { defaultValue: "Current" })}
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                <AnimatedCounter value={latest?.weightKg ?? 0} suffix=" kg" />
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                {t("progress.weight.start", { defaultValue: "Start" })}
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                <AnimatedCounter value={start ?? 0} suffix=" kg" />
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                {total < 0
                  ? t("progress.weight.total_lost", { defaultValue: "Lost" })
                  : t("progress.weight.total_gained", { defaultValue: "Gained" })}
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                <AnimatedCounter value={Math.abs(total)} suffix=" kg" />
              </div>
            </div>
          </div>
          {sparkline.length > 1 && (
            <div className="rounded-xl bg-white/40 dark:bg-white/5 p-2">
              <MiniChart
                data={sparkline}
                positiveIsUp={(user?.goal === "GAIN_MUSCLE" || user?.goal === "GAIN_WEIGHT")}
                height={56}
                ariaLabel={t("progress.weight.spark_alt", { defaultValue: "Recent weight trend" })}
              />
            </div>
          )}
          {targetWeight && latest ? (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-gray-500">{t("progress.weight.goal", { defaultValue: "Goal" })}: {targetWeight} kg</span>
              <DeltaBadge
                value={Number((latest.weightKg - targetWeight).toFixed(1))}
                unit="kg"
                positiveIsUp={(user?.goal === "GAIN_MUSCLE" || user?.goal === "GAIN_WEIGHT")}
                size="sm"
              />
            </div>
          ) : null}
        </div>
      </DashboardCard>
      <LogWeightDrawer open={logOpen} onOpenChange={setLogOpen} defaultValue={latest?.weightKg} />
    </>
  );
}
