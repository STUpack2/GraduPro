import { useCallback, useEffect, useRef, useState } from "react";
import { endSession, postFrame, startSession } from "../api";
import type {
  FrameResponse,
  SessionStartRequest,
  SessionStartResponse,
} from "../types";

export interface SessionState {
  sessionId: string | null;
  latest: FrameResponse | null;
  starting: boolean;
  ending: boolean;
  error: string | null;
  supportedExercises: string[];
}

const EMPTY: SessionState = {
  sessionId: null,
  latest: null,
  starting: false,
  ending: false,
  error: null,
  supportedExercises: [],
};

/**
 * Owns the AI Coach session lifecycle: start → stream frames → end. Stays
 * idle if `auto` is false — callers can call `start()` themselves. When the
 * component unmounts mid-session we fire `endSession` as a best-effort
 * cleanup so the backend doesn't leak session state.
 */
export function useAICoachSession(opts?: { auto?: SessionStartRequest }) {
  const [state, setState] = useState<SessionState>(EMPTY);
  const sessionRef = useRef<string | null>(null);

  const start = useCallback(async (payload: SessionStartRequest = {}) => {
    setState((s) => ({ ...s, starting: true, error: null }));
    try {
      const res: SessionStartResponse = await startSession(payload);
      sessionRef.current = res.session_id;
      setState({
        sessionId: res.session_id,
        latest: null,
        starting: false,
        ending: false,
        error: null,
        supportedExercises: res.supported_exercises,
      });
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, starting: false, error: msg }));
      throw err;
    }
  }, []);

  const end = useCallback(async () => {
    const id = sessionRef.current;
    if (!id) return;
    setState((s) => ({ ...s, ending: true }));
    try {
      await endSession(id);
    } catch {
      /* swallow — server may already be down */
    } finally {
      sessionRef.current = null;
      setState({ ...EMPTY });
    }
  }, []);

  const sendFrame = useCallback(async (image: string, signal?: AbortSignal) => {
    const id = sessionRef.current;
    if (!id) return null;
    try {
      const res = await postFrame(id, image, true, signal);
      setState((s) => ({ ...s, latest: res, error: null }));
      return res;
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return null;
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, error: msg }));
      return null;
    }
  }, []);

  // Auto-start when caller passes opts.auto
  useEffect(() => {
    if (opts?.auto) {
      void start(opts.auto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best-effort end on unmount
  useEffect(() => {
    return () => {
      const id = sessionRef.current;
      if (!id) return;
      void endSession(id).catch(() => undefined);
      sessionRef.current = null;
    };
  }, []);

  return { state, start, end, sendFrame };
}
