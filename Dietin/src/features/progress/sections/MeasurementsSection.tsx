import { useMemo, useState } from "react";
import { Ruler, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/stores/progressStore";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { DeltaBadge } from "../components/DeltaBadge";
import { MiniChart } from "../components/MiniChart";
import { LogMeasurementsDrawer } from "../components/LogMeasurementsDrawer";
import { daysBetween, localDateKey } from "../lib/dates";
import { Button } from "@/components/ui/button";
import type { BodyMeasurement } from "../types";

type Key = "waistCm" | "chestCm" | "armsCm" | "hipsCm" | "thighsCm" | "neckCm";

const METRICS: { key: Key; labelKey: string; defaultLabel: string; positiveIsUp: boolean }[] = [
  { key: "waistCm",  labelKey: "progress.measurements.waist",  defaultLabel: "Waist",  positiveIsUp: false },
  { key: "chestCm",  labelKey: "progress.measurements.chest",  defaultLabel: "Chest",  positiveIsUp: true  },
  { key: "armsCm",   labelKey: "progress.measurements.arms",   defaultLabel: "Arms",   positiveIsUp: true  },
  { key: "hipsCm",   labelKey: "progress.measurements.hips",   defaultLabel: "Hips",   positiveIsUp: false },
  { key: "thighsCm", labelKey: "progress.measurements.thighs", defaultLabel: "Thighs", positiveIsUp: true  },
  { key: "neckCm",   labelKey: "progress.measurements.neck",   defaultLabel: "Neck",   positiveIsUp: false },
];

interface MetricRow {
  key: Key;
  label: string;
  positiveIsUp: boolean;
  series: { date: string; value: number }[];
  current: number | null;
  previous: number | null;
  delta: number | null;
}

function buildRow(measurements: BodyMeasurement[], key: Key, label: string, positiveIsUp: boolean): MetricRow {
  const today = localDateKey();
  const series = measurements
    .filter((m) => typeof m[key] === "number" && (m[key] as number) > 0)
    .map((m) => ({ date: m.date, value: m[key] as number }));
  const current = series[series.length - 1]?.value ?? null;
  const prior = series
    .slice(0, -1)
    .reverse()
    .find((p) => daysBetween(p.date, today) >= 28) ?? series[0];
  const previous = prior?.value ?? null;
  const delta = current !== null && previous !== null && prior !== series[series.length - 1]
    ? Number((current - previous).toFixed(1))
    : null;
  return { key, label, positiveIsUp, series, current, previous, delta };
}

export function MeasurementsSection() {
  const { t } = useTranslation();
  const measurements = useProgressStore((s) => s.measurements);
  const hydrated = useProgressStore((s) => s.hydrated);
  const [logOpen, setLogOpen] = useState(false);

  const rows = useMemo(
    () =>
      METRICS.map((m) =>
        buildRow(measurements, m.key, t(m.labelKey, { defaultValue: m.defaultLabel }), m.positiveIsUp),
      ),
    [measurements, t],
  );

  const anyData = rows.some((r) => r.current !== null);
  const state = !hydrated && measurements.length === 0
    ? "loading"
    : !anyData
      ? "empty"
      : "populated";

  return (
    <>
      <DashboardCard
        state={state}
        empty={
          <EmptyState
            icon={Ruler}
            title={t("progress.measurements.empty_title", { defaultValue: "Track inches, not just the scale" })}
            description={t("progress.measurements.empty_desc", {
              defaultValue: "Log waist, chest, arms and more to see where your body is changing.",
            })}
            cta={{
              label: t("progress.measurements.log_cta", { defaultValue: "Log measurements" }),
              onClick: () => setLogOpen(true),
            }}
          />
        }
      >
        <div className="p-5">
          <SectionHeader
            icon={<Ruler className="h-5 w-5" />}
            title={t("progress.measurements.title", { defaultValue: "Body Measurements" })}
            description={t("progress.measurements.desc", { defaultValue: "Monthly inches tell the real transformation story." })}
            action={
              <Button size="sm" variant="ghost" className="text-primary -mr-1" onClick={() => setLogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t("progress.measurements.log_cta", { defaultValue: "Log measurements" })}
              </Button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rows.map((row) => (
              <div
                key={row.key}
                className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{row.label}</span>
                  {row.delta !== null && (
                    <DeltaBadge value={row.delta} unit="cm" positiveIsUp={row.positiveIsUp} size="sm" />
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {row.current !== null ? `${row.current.toFixed(1)}` : "—"}
                  </span>
                  <span className="text-xs text-gray-500 mb-1">cm</span>
                </div>
                {row.series.length > 1 && (
                  <MiniChart
                    data={row.series.slice(-12).map((p) => p.value)}
                    positiveIsUp={row.positiveIsUp}
                    height={36}
                    ariaLabel={`${row.label} trend`}
                  />
                )}
              </div>
            ))}
          </div>
          {anyData && (
            <p className="text-[11px] text-gray-500 dark:text-text-muted mt-3">
              {t("progress.measurements.month_compare", {
                defaultValue: "Change shown vs your last measurement at least 4 weeks ago.",
              })}
            </p>
          )}
        </div>
      </DashboardCard>
      <LogMeasurementsDrawer
        open={logOpen}
        onOpenChange={setLogOpen}
        defaults={measurements[measurements.length - 1]}
      />
    </>
  );
}
