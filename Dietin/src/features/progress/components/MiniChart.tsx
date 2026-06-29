import { Area, AreaChart, ResponsiveContainer } from "recharts";

export interface MiniChartProps {
  data: number[];
  /** When losing is desirable (weight), pass positiveIsUp=false. */
  positiveIsUp?: boolean;
  height?: number;
  /** Optional override color (CSS color string). */
  color?: string;
  ariaLabel?: string;
}

export function MiniChart({
  data,
  positiveIsUp = false,
  height = 40,
  color,
  ariaLabel,
}: MiniChartProps) {
  const series = data.map((v, i) => ({ i, v }));
  const first = data[0];
  const last = data[data.length - 1];
  const isGood =
    data.length < 2
      ? true
      : positiveIsUp
        ? last >= first
        : last <= first;
  const stroke = color ?? (isGood ? "#10b981" : "#f43f5e");
  return (
    <div style={{ height }} aria-label={ariaLabel} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id={`mini-${ariaLabel ?? "g"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#mini-${ariaLabel ?? "g"})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
