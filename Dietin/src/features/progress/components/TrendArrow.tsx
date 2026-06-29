import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrendDirection = "up" | "down" | "flat";

export interface TrendArrowProps {
  direction: TrendDirection;
  /** Set to true when "up" is the desired outcome (e.g. workout volume). When false, "down" is good (e.g. weight loss). */
  positiveIsUp?: boolean;
  className?: string;
  size?: number;
}

export function TrendArrow({
  direction,
  positiveIsUp = false,
  className,
  size = 16,
}: TrendArrowProps) {
  const Icon = direction === "flat" ? ArrowRight : direction === "up" ? ArrowUp : ArrowDown;
  const isGood =
    direction === "flat"
      ? false
      : positiveIsUp
        ? direction === "up"
        : direction === "down";
  return (
    <Icon
      width={size}
      height={size}
      strokeWidth={2.5}
      className={cn(
        isGood ? "text-emerald-500" : direction === "flat" ? "text-gray-400" : "text-rose-500",
        className,
      )}
    />
  );
}
