import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClassificationResult } from "../types";

export interface LiveClassificationCardProps {
  classification: ClassificationResult | null;
  poseDetected: boolean;
}

function humanize(id: string | null | undefined): string {
  if (!id) return "—";
  return id.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function LiveClassificationCard({ classification, poseDetected }: LiveClassificationCardProps) {
  const exercise = classification?.exercise ?? null;
  const confidence = classification?.confidence ?? 0;
  const stable = !!classification?.stable_prediction;
  const ready = !!classification?.ready;

  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 rounded-xl text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Live exercise</p>
          <motion.h3
            key={exercise ?? "none"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-lg font-semibold text-gray-900 dark:text-white truncate"
          >
            {humanize(exercise) || (ready ? "No exercise detected" : "Warming up…")}
          </motion.h3>
        </div>
        <span
          className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            stable
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : ready
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "bg-gray-200/70 text-gray-600 dark:bg-white/5 dark:text-text-muted",
          )}
        >
          {stable ? "Stable" : ready ? "Detecting" : "Warming up"}
        </span>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Confidence</span>
          <span className="font-medium text-gray-700 dark:text-text-muted">{Math.round(confidence * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200/70 dark:bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, Math.min(100, confidence * 100))}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        {poseDetected
          ? classification?.message ?? "Pose tracked"
          : "Step fully into the camera frame to track your pose."}
      </p>
    </div>
  );
}
