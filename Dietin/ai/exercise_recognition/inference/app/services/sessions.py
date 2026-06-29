import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional

from .classifier import (
    Classification,
    ClassifierState,
    ExerciseClassifier,
    normalize_exercise_label,
)
from .rep_counter import RepCounter, RepCountResult


class SessionNotFoundError(KeyError):
    pass


@dataclass
class WorkoutSession:
    session_id: str
    classifier_state: ClassifierState
    exercise: Optional[str] = None
    target_exercise: Optional[str] = None
    sets: int = 1
    target_reps: int = 12
    rest_timer: int = 60
    current_set: int = 1
    completed_reps: int = 0
    total_reps: int = 0
    exercise_totals: Dict[str, int] = field(default_factory=dict)
    rep_counter: RepCounter = field(default_factory=RepCounter)
    last_classification: Classification = field(
        default_factory=lambda: Classification(
            exercise=None,
            confidence=0.0,
            raw_label=None,
            ready=False,
            message="No classification yet.",
        )
    )
    last_pose_detected: bool = False
    frame_count: int = 0
    active: bool = True
    started_at: float = field(default_factory=time.time)
    ended_at: Optional[float] = None
    rest_started_at: Optional[float] = None


class SessionManager:
    def __init__(self, classifier: ExerciseClassifier):
        self._classifier = classifier
        self._sessions: Dict[str, WorkoutSession] = {}

    def start(
        self,
        exercise: Optional[str] = None,
        sets: int = 1,
        target_reps: int = 12,
        rest_timer: int = 60,
    ) -> WorkoutSession:
        session_id = uuid.uuid4().hex
        initial_exercise = normalize_exercise_label(exercise)
        # Seed session.exercise with the user's selection so the rep counter can
        # fire on frame 1. Live classification can still override it via
        # record_classification once a stable prediction lands.
        session = WorkoutSession(
            session_id=session_id,
            classifier_state=self._classifier.create_state(),
            exercise=initial_exercise,
            target_exercise=initial_exercise,
            sets=sets,
            target_reps=target_reps,
            rest_timer=rest_timer,
        )
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> WorkoutSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise SessionNotFoundError(session_id)
        return session

    def end(self, session_id: str) -> WorkoutSession:
        session = self.get(session_id)
        if session.ended_at is None:
            session.ended_at = time.time()
        session.active = False
        return session

    def record_classification(
        self,
        session: WorkoutSession,
        classification: Classification,
        confidence_threshold: float,
    ) -> None:
        session.last_classification = classification
        if (
            classification.ready
            and classification.stable_prediction
            and classification.exercise
            and classification.confidence >= confidence_threshold
        ):
            session.exercise = classification.exercise

    def record_pose_status(self, session: WorkoutSession, pose_detected: bool) -> None:
        session.last_pose_detected = pose_detected
        session.frame_count += 1

    def record_repetition(
        self, session: WorkoutSession, result: RepCountResult
    ) -> None:
        if result.delta <= 0 or not result.exercise:
            return

        session.total_reps += result.delta
        session.exercise_totals[result.exercise] = (
            session.exercise_totals.get(result.exercise, 0) + result.delta
        )

        for _ in range(result.delta):
            session.completed_reps += 1
            if (
                session.completed_reps >= session.target_reps
                and session.current_set < session.sets
            ):
                session.current_set += 1
                session.completed_reps = 0
                session.rest_started_at = time.time()

    def metrics(self, session: WorkoutSession) -> Dict[str, object]:
        rest_remaining = 0
        if session.rest_started_at is not None:
            elapsed = int(time.time() - session.rest_started_at)
            rest_remaining = max(0, session.rest_timer - elapsed)
            if rest_remaining == 0:
                session.rest_started_at = None

        session_complete = (
            session.current_set >= session.sets
            and session.completed_reps >= session.target_reps
        )
        active = session.active and session.ended_at is None
        return {
            "exercise": session.exercise,
            "sets": session.sets,
            "target_reps": session.target_reps,
            "completed_reps": session.completed_reps,
            "current_set": session.current_set,
            "rest_timer": session.rest_timer,
            "rest_remaining": rest_remaining,
            "total_reps": session.total_reps,
            "active": active,
            "session_complete": session_complete,
            "exercise_totals": dict(session.exercise_totals),
        }

    def duration_seconds(self, session: WorkoutSession) -> float:
        end_time = session.ended_at or time.time()
        return max(0.0, end_time - session.started_at)
