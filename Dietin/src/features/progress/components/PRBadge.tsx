import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PRBadgeProps {
  exercise: string;
  weightKg: number;
  reps: number;
  isNew?: boolean;
  previousWeightKg?: number;
  previousReps?: number;
  className?: string;
}

export function PRBadge({
  exercise,
  weightKg,
  reps,
  isNew,
  previousWeightKg,
  previousReps,
  className,
}: PRBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative rounded-2xl p-4 border border-black/5 dark:border-white/10 bg-white dark:bg-bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{exercise}</h4>
        {isNew && (
          <motion.span
            initial={{ scale: 0.8 }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-600"
          >
            <Trophy className="h-3 w-3" /> NEW PR
          </motion.span>
        )}
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">
        {weightKg} <span className="text-sm font-normal text-gray-500">kg</span> × {reps}
      </div>
      {previousWeightKg ? (
        <div className="text-xs text-gray-500 mt-1">
          previous {previousWeightKg} kg × {previousReps ?? "—"}
        </div>
      ) : null}
    </motion.div>
  );
}
