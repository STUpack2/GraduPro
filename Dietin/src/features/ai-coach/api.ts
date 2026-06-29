// Typed wrappers around the AI Coach REST endpoints.
import { aiFetch } from "@/lib/aiCoachApi";
import type {
  Exercise,
  FrameResponse,
  HealthResponse,
  SessionEndResponse,
  SessionStartRequest,
  SessionStartResponse,
  SessionStatusResponse,
} from "./types";

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return aiFetch<HealthResponse>("/api/health", { method: "GET", signal });
}

export function listExercises(signal?: AbortSignal): Promise<Exercise[]> {
  return aiFetch<Exercise[]>("/api/exercises", { method: "GET", signal });
}

export function startSession(payload: SessionStartRequest): Promise<SessionStartResponse> {
  return aiFetch<SessionStartResponse>("/api/session/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function postFrame(
  session_id: string,
  image: string,
  return_annotated_frame = true,
  signal?: AbortSignal,
): Promise<FrameResponse> {
  return aiFetch<FrameResponse>("/api/frame", {
    method: "POST",
    body: JSON.stringify({ session_id, image, return_annotated_frame }),
    signal,
  });
}

export function getStatus(session_id: string): Promise<SessionStatusResponse> {
  return aiFetch<SessionStatusResponse>(`/api/session/status?session_id=${encodeURIComponent(session_id)}`);
}

export function endSession(session_id: string): Promise<SessionEndResponse> {
  return aiFetch<SessionEndResponse>("/api/session/end", {
    method: "POST",
    body: JSON.stringify({ session_id }),
  });
}
