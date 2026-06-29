import { motion } from "framer-motion";
import { Flame, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StreakBadgeProps {
  current: number;
  longest?: number;
  label: string;
  icon?: LucideIcon;
  /** Optional accent gradient (CSS string). Defaults to fire gradient. */
  accent?: string;
  unit?: string;
}

export function StreakBadge({
  current,
  longest,
  label,
  icon: Icon = Flame,
  accent = "linear-gradient(140deg,#f97316 0%,#ef4444 60%,#a855f7 100%)",
  unit,
}: StreakBadgeProps) {
  const hasStreak = current > 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32 }}
      className="rounded-2xl p-3 flex flex-col items-center text-center min-w-[88px] shrink-0 border border-black/5 dark:border-white/10 bg-white dark:bg-bg-card shadow-sm"
    >
      <div
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center mb-2",
          hasStreak ? "text-white" : "bg-gray-100 dark:bg-white/5 text-gray-400",
        )}
        style={hasStreak ? { background: accent } : undefined}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-lg font-semibold text-gray-900 dark:text-white leading-none">
        {current}
        {unit && <span className="text-xs ml-0.5 font-normal text-gray-500">{unit}</span>}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-text-muted mt-1">
        {label}
      </div>
      {longest && longest > current ? (
        <div className="text-[10px] text-gray-400 mt-0.5">best {longest}</div>
      ) : null}
    </motion.div>
  );
}
