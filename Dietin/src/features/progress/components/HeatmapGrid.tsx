import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface HeatmapGridProps {
  matrix: number[][]; // [row][col]
  max: number;
  rowLabels?: string[];
  colLabels?: string[];
  ariaLabel?: string;
}

export function HeatmapGrid({ matrix, max, rowLabels, colLabels, ariaLabel }: HeatmapGridProps) {
  const cols = matrix[0]?.length ?? 0;
  return (
    <div className="w-full overflow-x-auto" aria-label={ariaLabel} role="img">
      <div
        className="inline-grid gap-1"
        style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(18px, 1fr))` }}
      >
        <span />
        {colLabels?.map((c) => (
          <span key={c} className="text-[10px] text-gray-400 text-center">{c}</span>
        ))}
        {matrix.map((row, rIdx) => (
          <Fragment key={`r-${rIdx}`}>
            <span className="text-[10px] text-gray-400 self-center pr-1">
              {rowLabels?.[rIdx] ?? ""}
            </span>
            {row.map((v, cIdx) => {
              const intensity = max > 0 ? v / max : 0;
              const op = v === 0 ? 0.06 : 0.18 + intensity * 0.8;
              return (
                <div
                  key={`c-${rIdx}-${cIdx}`}
                  title={`${rowLabels?.[rIdx] ?? ""} ${colLabels?.[cIdx] ?? ""}: ${Math.round(v)}`}
                  className={cn(
                    "aspect-square rounded-md",
                    v === 0 ? "bg-gray-200 dark:bg-white/5" : "bg-emerald-500",
                  )}
                  style={{ opacity: op }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
