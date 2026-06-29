import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/stores/progressStore";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { parseDateKey } from "../lib/dates";

function monthLabel(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function HealthTimelineSection() {
  const { t } = useTranslation();
  const scores = useProgressStore((s) => s.fitnessScores);
  const hydrated = useProgressStore((s) => s.hydrated);

  const monthly = useMemo(() => {
    if (scores.length === 0) return [] as { month: string; value: number }[];
    const buckets = new Map<string, { sum: number; n: number; key: string }>();
    for (const s of scores) {
      const key = s.date.slice(0, 7); // yyyy-MM
      const cur = buckets.get(key) ?? { sum: 0, n: 0, key: `${key}-15` };
      cur.sum += s.overall;
      cur.n += 1;
      buckets.set(key, cur);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ month: monthLabel(`${k}-15`), value: Math.round(v.sum / v.n) }));
  }, [scores]);

  const state = !hydrated && scores.length === 0
    ? "loading"
    : monthly.length === 0
      ? "empty"
      : "populated";

  const best = monthly.reduce<{ month: string; value: number } | null>((acc, cur) => {
    if (!acc || cur.value > acc.value) return cur;
    return acc;
  }, null);

  return (
    <DashboardCard
      state={state}
      empty={
        <EmptyState
          icon={Calendar}
          title={t("progress.timeline.empty_title", { defaultValue: "Your monthly evolution shows once we have a month of data" })}
          description={t("progress.timeline.empty_desc", { defaultValue: "Keep logging — your average fitness score by month will appear here." })}
        />
      }
    >
      <div className="p-5">
        <SectionHeader
          icon={<Calendar className="h-5 w-5" />}
          title={t("progress.timeline.title", { defaultValue: "Health Score Timeline" })}
          description={
            best
              ? t("progress.timeline.best", { defaultValue: "Best month: {{month}} ({{value}})", month: best.month, value: best.value })
              : t("progress.timeline.desc", { defaultValue: "Monthly average of your overall fitness score." })
          }
        />
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              <defs>
                <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={28} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }} />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} fill="url(#timelineFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DashboardCard>
  );
}
