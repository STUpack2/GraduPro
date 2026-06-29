import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MilestoneMarkerProps {
  label: string;
  value: string;
  state: "done" | "active" | "future";
  side?: "left" | "right" | "center";
}

export function MilestoneMarker({ label, value, state, side = "center" }: MilestoneMarkerProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center min-w-[80px]",
        side === "left" && "items-start text-left",
        side === "right" && "items-end text-right",
      )}
    >
      <span
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold mb-1.5 border-2",
          state === "done"
            ? "bg-emerald-500 text-white border-emerald-500"
            : state === "active"
              ? "bg-white text-emerald-600 border-emerald-500 ring-4 ring-emerald-500/20"
              : "bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/5 dark:border-white/10",
        )}
      >
        {state === "done" ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white leading-none">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-gray-500 mt-1">{label}</span>
    </div>
  );
}
