import { useEffect, useState } from "react";
import { isAiConfigured } from "@/lib/aiCoachApi";
import { getHealth } from "../api";
import type { HealthResponse } from "../types";

export type HealthStatus =
  | { state: "not_configured" }
  | { state: "loading" }
  | { state: "healthy"; data: HealthResponse }
  | { state: "degraded"; data: HealthResponse }
  | { state: "unreachable"; error: string };

// One-shot /api/health probe on mount, plus a manual refetch. We keep it
// intentionally simple — sections poll their own frame loop; a long-lived
// health subscription is overkill.
export function useAIHealth() {
  const [status, setStatus] = useState<HealthStatus>(
    isAiConfigured() ? { state: "loading" } : { state: "not_configured" },
  );

  const refresh = async () => {
    if (!isAiConfigured()) {
      setStatus({ state: "not_configured" });
      return;
    }
    setStatus({ state: "loading" });
    try {
      const data = await getHealth();
      setStatus({
        state: data.classifier_loaded ? "healthy" : "degraded",
        data,
      });
    } catch (err) {
      setStatus({
        state: "unreachable",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAiConfigured()) return;
      try {
        const data = await getHealth();
        if (cancelled) return;
        setStatus({
          state: data.classifier_loaded ? "healthy" : "degraded",
          data,
        });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          state: "unreachable",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, refresh };
}
