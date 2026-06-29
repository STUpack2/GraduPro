import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { isAiConfigured } from "@/lib/aiCoachApi";
import { CameraView } from "./CameraView";
import { ExercisePicker } from "./ExercisePicker";
import { useAIHealth } from "./hooks/useAIHealth";
import { useAICoachSession } from "./hooks/useAICoachSession";
import { useFrameLoop } from "./hooks/useFrameLoop";
import { LiveClassificationCard } from "./components/LiveClassificationCard";
import { ReadinessBanner } from "./components/ReadinessBanner";
import { BackendOfflineEmpty } from "./components/BackendOfflineEmpty";

export interface AICoachPanelProps {
  /** When set (e.g. from Plan), pre-fills the session and hides the picker. */
  exercise?: string | null;
  /** When set, the panel reports its detected rep count whenever it changes.
   *  Used by Plan.tsx to sync AI reps into the manual workoutProgress writer. */
  onRepDetected?: (totalReps: number) => void;
  /** Compact layout (used inside Plan exercise card). Default false = full page. */
  compact?: boolean;
}

export function AICoachPanel({ exercise, onRepDetected, compact }: AICoachPanelProps) {
  const { t } = useTranslation();
  const { status, refresh } = useAIHealth();
  const { state, start, end, sendFrame } = useAICoachSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pickedExercise, setPickedExercise] = useState<string | null>(exercise ?? null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    if (exercise !== undefined) setPickedExercise(exercise);
  }, [exercise]);

  // Bubble rep counts back to Plan.
  useEffect(() => {
    if (!onRepDetected) return;
    const reps = state.latest?.metrics?.completed_reps;
    if (typeof reps === "number") onRepDetected(reps);
  }, [state.latest?.metrics?.completed_reps, onRepDetected]);

  // Stop the loop when we're not actively in a session.
  const loopActive = cameraOn && !!state.sessionId;

  useFrameLoop({
    videoRef,
    active: loopActive,
    intervalMs: 333,
    quality: 0.6,
    maxEdge: 720,
    onFrame: async (dataUrl) => {
      await sendFrame(dataUrl);
    },
  });

  const handleStart = async () => {
    setCameraOn(true);
    try {
      await start({
        exercise: pickedExercise && pickedExercise !== "auto" ? pickedExercise : undefined,
        sets: 1,
        target_reps: 12,
        rest_timer: 60,
      });
    } catch {
      /* error surfaced via state.error */
    }
  };

  const handleStop = async () => {
    await end();
    setCameraOn(false);
  };

  const handleReset = async () => {
    await end();
    await handleStart();
  };

  if (status.state === "not_configured") {
    return <BackendOfflineEmpty />;
  }

  const metrics = state.latest?.metrics;
  const annotated = state.latest?.annotated_frame ?? null;
  const feedback = state.latest?.feedback ?? [];

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <ReadinessBanner status={status} onRetry={refresh} />

      <div className={compact ? "" : "grid gap-4 md:grid-cols-[1fr_360px]"}>
        <CameraView
          ref={videoRef}
          active={cameraOn}
          annotatedFrame={annotated}
          className={compact ? "max-h-[280px]" : ""}
        />
        <div className="space-y-3">
          {!state.sessionId && (
            <ExercisePicker
              value={pickedExercise}
              onChange={setPickedExercise}
              disabled={state.starting || !isAiConfigured() || !!exercise}
              fallbackList={status.state === "healthy" ? status.data.supported_exercises : []}
            />
          )}

          <LiveClassificationCard
            classification={state.latest?.classification ?? null}
            poseDetected={!!state.latest?.pose_detected}
          />

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-gray-500">{t("aiCoach.reps", { defaultValue: "Reps" })}</span>
              {metrics?.session_complete && (
                <span className="text-xs font-medium text-emerald-600">{t("aiCoach.set_done", { defaultValue: "Set done" })}</span>
              )}
            </div>
            <motion.div
              key={metrics?.completed_reps ?? -1}
              initial={{ scale: 0.9, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
              className="text-4xl font-bold text-gray-900 dark:text-white mt-1"
            >
              {metrics?.completed_reps ?? 0}
              <span className="text-base font-normal text-gray-500 ml-2">
                / {metrics?.target_reps ?? 12}
              </span>
            </motion.div>
            {metrics && (
              <p className="text-xs text-gray-500 mt-1">
                {t("aiCoach.set_n_of_m", {
                  defaultValue: "Set {{cur}} of {{total}}",
                  cur: metrics.current_set,
                  total: metrics.sets,
                })}
              </p>
            )}
          </div>

          {feedback.length > 0 && (
            <ul className="text-xs text-gray-600 dark:text-text-muted space-y-1 px-1">
              {feedback.slice(0, 3).map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          )}

          {state.error && (
            <p className="text-xs text-rose-600">{state.error}</p>
          )}

          <div className="flex gap-2">
            {!state.sessionId ? (
              <Button
                onClick={handleStart}
                disabled={state.starting || status.state === "unreachable"}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-1.5" />
                {state.starting ? t("aiCoach.starting", { defaultValue: "Starting…" }) : t("aiCoach.start", { defaultValue: "Start" })}
              </Button>
            ) : (
              <>
                <Button onClick={handleStop} variant="outline" className="flex-1">
                  <Square className="h-4 w-4 mr-1.5" />
                  {t("aiCoach.stop", { defaultValue: "Stop" })}
                </Button>
                <Button onClick={handleReset} variant="ghost">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
