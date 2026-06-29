// TS mirror of the FastAPI Pydantic schemas in
// Dietin/ai/exercise_recognition/inference/app/schemas.py.
// Keep these names + nullability identical to the Python side.

export interface Exercise {
  id: string;
  name: string;
  category: string;
  target_muscle: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}

export interface ClassificationResult {
  exercise: string | null;
  confidence: number;
  raw_label: string | null;
  ready: boolean;
  stable_prediction: boolean;
  message: string | null;
}

export interface WorkoutMetrics {
  exercise: string | null;
  sets: number;
  target_reps: number;
  completed_reps: number;
  current_set: number;
  rest_timer: number;
  rest_remaining: number;
  total_reps: number;
  active: boolean;
  session_complete: boolean;
  exercise_totals: Record<string, number>;
}

export interface FrameResponse {
  session_id: string;
  pose_detected: boolean;
  classification: ClassificationResult;
  metrics: WorkoutMetrics;
  feedback: string[];
  annotated_frame: string | null;
}

export interface SessionStartRequest {
  exercise?: string | null;
  sets?: number;
  target_reps?: number;
  rest_timer?: number;
}

export interface SessionStartResponse {
  session_id: string;
  metrics: WorkoutMetrics;
  supported_exercises: string[];
}

export interface SessionStatusResponse {
  session_id: string;
  metrics: WorkoutMetrics;
  classification: ClassificationResult;
  pose_detected: boolean;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number;
}

export interface SessionEndResponse {
  session_id: string;
  metrics: WorkoutMetrics;
  duration_seconds: number;
}

export interface HealthResponse {
  status: "healthy" | "degraded";
  classifier_loaded: boolean;
  model_version: string;
  num_classes: number;
  supported_exercises: string[];
  classifier_error?: string;
}
