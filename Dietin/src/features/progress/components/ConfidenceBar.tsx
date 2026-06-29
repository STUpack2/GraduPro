import { cn } from "@/lib/utils";

export interface ConfidenceBarProps {
  level: "high" | "medium" | "low";
  className?: string;
  label?: string;
}

const COPY: Record<ConfidenceBarProps["level"], { dots: number; cls: string }> = {
  low:    { dots: 1, cls: "bg-amber-500" },
  medium: { dots: 2, cls: "bg-blue-500" },
  high:   { dots: 3, cls: "bg-emerald-500" },
};

export function ConfidenceBar({ level, className, label }: ConfidenceBarProps) {
  const { dots, cls } = COPY[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-text-muted", className)}>
      <span className="inline-flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              i < dots ? cls : "bg-gray-300/70 dark:bg-white/15",
            )}
          />
        ))}
      </span>
      <span className="capitalize">{label ?? level}</span>
    </span>
  );
}
