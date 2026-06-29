import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type CardState = "loading" | "empty" | "populated";

export interface DashboardCardProps {
  state: CardState;
  loading?: ReactNode;
  empty?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Optional flat surface (no shadow / border) — used by section sub-grids. */
  bare?: boolean;
}

const surface =
  "bg-white dark:bg-bg-card shadow-lg border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden";

export function DashboardCard({
  state,
  loading,
  empty,
  children,
  className,
  bare,
}: DashboardCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className={cn(bare ? "" : surface, className)}
      role="group"
    >
      {state === "loading" && (loading ?? <CardSkeleton />)}
      {state === "empty" && (empty ?? null)}
      {state === "populated" && children}
    </motion.div>
  );
}

function CardSkeleton() {
  return (
    <div className="p-5 space-y-3">
      <div className="h-4 w-1/3 rounded-full bg-gray-200/80 animate-pulse" />
      <div className="h-3 w-1/2 rounded-full bg-gray-200/60 animate-pulse" />
      <div className="h-24 rounded-xl bg-gray-100/80 animate-pulse mt-2" />
    </div>
  );
}
