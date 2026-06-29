import { cn } from "@/lib/utils";
import { TrendArrow, TrendDirection } from "./TrendArrow";

export interface DeltaBadgeProps {
  value: number;
  unit?: string;
  decimals?: number;
  /** When losing weight is positive, set positiveIsUp=false (default). */
  positiveIsUp?: boolean;
  /** Compact pill vs full chip. */
  size?: "sm" | "md";
  className?: string;
}

export function DeltaBadge({
  value,
  unit = "",
  decimals = 1,
  positiveIsUp = false,
  size = "md",
  className,
}: DeltaBadgeProps) {
  const direction: TrendDirection = value === 0 ? "flat" : value > 0 ? "up" : "down";
  const isGood =
    direction === "flat"
      ? false
      : positiveIsUp
        ? direction === "up"
        : direction === "down";
  const sign = value > 0 ? "+" : value < 0 ? "" : "±";
  const label = `${sign}${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        isGood
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : direction === "flat"
            ? "bg-gray-200/60 text-gray-700 dark:bg-white/10 dark:text-gray-300"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        className,
      )}
    >
      <TrendArrow direction={direction} positiveIsUp={positiveIsUp} size={size === "sm" ? 12 : 14} />
      {label}
    </span>
  );
}
