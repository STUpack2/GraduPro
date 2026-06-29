from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class Exercise(BaseModel):
    id: str = Field(..., description="Classifier label, e.g. barbell_biceps_curl.")
    name: str
    category: str
    target_muscle: str
    difficulty: Literal["Beginner", "Intermediate", "Advanced"]


class SessionStartRequest(BaseModel):
    exercise: Optional[str] = Field(
        default=None,
        description="Optional initial exercise hint. Live classification can override it.",
    )
    sets: int = Field(default=1, ge=1)
    target_reps: int = Field(default=12, ge=1)
    rest_timer: int = Field(
        default=60, ge=0, description="Rest timer in seconds between sets."
    )


class SessionEndRequest(BaseModel):
    session_id: str = Field(..., min_length=1)


class FrameRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    image: str = Field(
        ...,
        min_length=1,
        description="Base64 encoded webcam frame. Raw base64 and data:image/... URLs are supported.",
    )
    return_annotated_frame: bool = Field(
        default=True,
        description="Return the frame with pose landmarks and metrics overlay as a JPEG data URL.",
    )


class ClassificationResult(BaseModel):
    exercise: Optional[str] = None
    confidence: float = 0.0
    raw_label: Optional[str] = None
    ready: bool = False
    stable_prediction: bool = False
    message: Optional[str] = None


class WorkoutMetrics(BaseModel):
    exercise: Optional[str] = None
    sets: int
    target_reps: int
    completed_reps: int
    current_set: int
    rest_timer: int
    rest_remaining: int = 0
    total_reps: int = 0
    active: bool = True
    session_complete: bool = False
    exercise_totals: Dict[str, int] = Field(default_factory=dict)


class SessionStartResponse(BaseModel):
    session_id: str
    metrics: WorkoutMetrics
    supported_exercises: List[str]


class FrameResponse(BaseModel):
    session_id: str
    pose_detected: bool
    classification: ClassificationResult
    metrics: WorkoutMetrics
    feedback: List[str] = Field(default_factory=list)
    annotated_frame: Optional[str] = None


class SessionStatusResponse(BaseModel):
    session_id: str
    metrics: WorkoutMetrics
    classification: ClassificationResult
    pose_detected: bool
    started_at: float
    ended_at: Optional[float] = None
    duration_seconds: float


class SessionEndResponse(BaseModel):
    session_id: str
    metrics: WorkoutMetrics
    duration_seconds: float
