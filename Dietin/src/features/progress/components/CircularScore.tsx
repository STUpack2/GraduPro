import { CircularProgressbarWithChildren, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CircularScoreProps {
  value: number; // 0-100
  size?: number; // px
  thickness?: number; // stroke width in percentage of size
  label?: ReactNode;
  /** Pass a color string for the path; defaults to the brand primary. */
  color?: string;
  className?: string;
}

export function CircularScore({
  value,
  size = 132,
  thickness = 10,
  label,
  color = "#10b981",
  className,
}: CircularScoreProps) {
  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <CircularProgressbarWithChildren
        value={Math.max(0, Math.min(100, value))}
        strokeWidth={thickness}
        styles={buildStyles({
          pathColor: color,
          trailColor: "rgba(0,0,0,0.08)",
          strokeLinecap: "round",
          pathTransitionDuration: 0.6,
        })}
      >
        {label}
      </CircularProgressbarWithChildren>
    </div>
  );
}
