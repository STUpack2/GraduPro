import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export interface AnimatedCounterProps {
  value: number;
  /** Number of decimals to render. */
  decimals?: number;
  /** Suffix appended to the rendered value (e.g. " kg"). Not localized — pass already-translated. */
  suffix?: string;
  /** Prefix prepended to the rendered value (e.g. "+"). */
  prefix?: string;
  /** Optional className for the wrapping span. */
  className?: string;
  /** When true, animates from 0 on mount; otherwise animates from previous value. */
  fromZero?: boolean;
}

export function AnimatedCounter({
  value,
  decimals = 1,
  suffix = "",
  prefix = "",
  className,
  fromZero,
}: AnimatedCounterProps) {
  const initial = fromZero ? 0 : value;
  const motionVal = useMotionValue(initial);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 18, mass: 0.6 });
  const rounded = useTransform(spring, (v) =>
    `${prefix}${Number(v).toFixed(decimals)}${suffix}`,
  );

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
