import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedTabsProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  ariaLabel,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex bg-gray-100/80 dark:bg-white/5 rounded-full p-1 gap-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full font-medium transition-colors",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              active
                ? "bg-white dark:bg-white/15 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-text-muted hover:text-gray-900",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
