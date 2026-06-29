from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Any, Deque, Dict, List, Optional

import numpy as np
from angle_features import FEATURE_COUNT, extract_features

try:
    import joblib
except Exception:  # pragma: no cover - surfaced through load_error at runtime
    joblib = None

try:
    from tensorflow.keras.models import load_model
except Exception:  # pragma: no cover - fallback for standalone Keras installs
    try:
        from keras.models import load_model  # type: ignore
    except Exception:  # pragma: no cover
        load_model = None  # type: ignore


WINDOW_SIZE = 45
PREDICTION_BUFFER_SIZE = 10
STABLE_FRAMES = 6
SWITCH_CONFIDENCE = 0.80

LABEL_ALIASES: Dict[str, str] = {
    "barbell biceps curl": "barbell_biceps_curl",
    "barbell_biceps_curl": "barbell_biceps_curl",
    "biceps curl": "barbell_biceps_curl",
    "bicep curl": "barbell_biceps_curl",
    "curl": "barbell_biceps_curl",
    "bench press": "bench_press",
    "chest fly machine": "chest_fly_machine",
    "deadlift": "deadlift",
    "decline bench press": "decline_bench_press",
    "hammer curl": "hammer_curl",
    "hip thrust": "hip_thrust",
    "incline bench press": "incline_bench_press",
    "lat pulldown": "lat_pulldown",
    "lateral raise": "lateral_raise",
    "leg extension": "leg_extension",
    "leg raises": "leg_raises",
    "leg raise": "leg_raises",
    "plank": "plank",
    "pull up": "pull_up",
    "pullup": "pull_up",
    "push up": "push_up",
    "pushup": "push_up",
    "romanian deadlift": "romanian_deadlift",
    "russian twist": "russian_twist",
    "shoulder press": "shoulder_press",
    "overhead press": "shoulder_press",
    "squat": "squat",
    "t bar row": "t_bar_row",
    "t-bar row": "t_bar_row",
    "tricep dips": "tricep_dips",
    "triceps dips": "tricep_dips",
    "tricep pushdown": "tricep_pushdown",
    "triceps pushdown": "tricep_pushdown",
}


class ClassifierNotReadyError(RuntimeError):
    pass


@dataclass
class Classification:
    exercise: Optional[str]
    confidence: float = 0.0
    raw_label: Optional[str] = None
    ready: bool = False
    stable_prediction: bool = False
    message: Optional[str] = None

    def to_dict(self) -> Dict[str, object]:
        return {
            "exercise": self.exercise,
            "confidence": self.confidence,
            "raw_label": self.raw_label,
            "ready": self.ready,
            "stable_prediction": self.stable_prediction,
            "message": self.message,
        }


@dataclass
class ClassifierState:
    features_window: Deque[np.ndarray]
    prediction_buffer: Deque[str]
    confidence_buffer: Deque[float]
    current_exercise: Optional[str] = None
    current_confidence: float = 0.0
    last_result: Classification = field(
        default_factory=lambda: Classification(
            exercise=None,
            confidence=0.0,
            raw_label=None,
            ready=False,
            stable_prediction=False,
            message="Collecting pose frames for classification.",
        )
    )


def normalize_exercise_label(label: Optional[str]) -> Optional[str]:
    if not label:
        return None
    normalized = label.strip().lower().replace("_", " ").replace("-", " ")
    normalized = " ".join(normalized.split())
    if normalized in {"auto", "auto detect", "auto detect workout"}:
        return None
    return LABEL_ALIASES.get(normalized, normalized.replace(" ", "_"))


class ExerciseClassifier:
    """Continuous 22-exercise BiLSTM classifier with stabilized predictions."""

    def __init__(
        self,
        model_path: Path,
        scaler_path: Path,
        label_encoder_path: Path,
        window_size: int = WINDOW_SIZE,
        feature_count: int = FEATURE_COUNT,
        prediction_buffer_size: int = PREDICTION_BUFFER_SIZE,
        stable_frames: int = STABLE_FRAMES,
        switch_confidence: float = SWITCH_CONFIDENCE,
    ):
        self.model_path = Path(model_path)
        self.scaler_path = Path(scaler_path)
        self.label_encoder_path = Path(label_encoder_path)
        self.window_size = window_size
        self.feature_count = feature_count
        self.prediction_buffer_size = prediction_buffer_size
        self.stable_frames = stable_frames
        self.switch_confidence = switch_confidence
        self.model: Optional[Any] = None
        self.scaler: Optional[Any] = None
        self.label_encoder: Optional[Any] = None
        self.exercise_classes: List[str] = []
        self.load_error: Optional[str] = None
        self._predict_lock = Lock()
        self._default_state = self.create_state()
        self._load_artifacts()

    def _load_artifacts(self) -> None:
        try:
            if load_model is None:
                raise RuntimeError("TensorFlow/Keras is not installed.")
            if joblib is None:
                raise RuntimeError("joblib is not installed.")
            if not self.model_path.exists():
                raise FileNotFoundError(f"Missing classifier model: {self.model_path}")
            if not self.scaler_path.exists():
                raise FileNotFoundError(
                    f"Missing classifier scaler: {self.scaler_path}"
                )
            if not self.label_encoder_path.exists():
                raise FileNotFoundError(
                    f"Missing classifier label encoder: {self.label_encoder_path}"
                )

            self.model = load_model(self.model_path, compile=False)
            self.scaler = joblib.load(self.scaler_path)
            label_encoder = joblib.load(self.label_encoder_path)
            self.label_encoder = label_encoder
            self.exercise_classes = [str(label) for label in label_encoder.classes_]
            self.load_error = None
        except Exception as exc:  # The API remains available and reports 503 on /frame.
            self.model = None
            self.scaler = None
            self.label_encoder = None
            self.exercise_classes = []
            self.load_error = str(exc)

    @property
    def is_ready(self) -> bool:
        return bool(
            self.model is not None and self.scaler is not None and self.exercise_classes
        )

    def create_state(self) -> ClassifierState:
        return ClassifierState(
            features_window=deque(maxlen=self.window_size),
            prediction_buffer=deque(maxlen=self.prediction_buffer_size),
            confidence_buffer=deque(maxlen=self.prediction_buffer_size),
        )

    def reset(self, state: Optional[ClassifierState] = None) -> None:
        classifier_state = state or self._default_state
        classifier_state.features_window.clear()
        classifier_state.prediction_buffer.clear()
        classifier_state.confidence_buffer.clear()
        classifier_state.current_exercise = None
        classifier_state.current_confidence = 0.0
        classifier_state.last_result = Classification(
            exercise=None,
            confidence=0.0,
            raw_label=None,
            ready=False,
            stable_prediction=False,
            message="Collecting pose frames for classification.",
        )

    def supported_exercises(self) -> List[str]:
        exercises = {normalize_exercise_label(label) for label in self.exercise_classes}
        return sorted(exercise for exercise in exercises if exercise)

    def _scale_window(self, window: np.ndarray):
        scaler = self.scaler
        if scaler is None:
            raise ClassifierNotReadyError(
                self.load_error or "Exercise classifier scaler is not loaded."
            )
        scaled_window = scaler.transform(window.reshape(-1, self.feature_count))
        return scaled_window.reshape(1, self.window_size, self.feature_count)

    def _predict_window(self, window: np.ndarray) -> tuple[str, float]:
        model = self.model
        if model is None:
            raise ClassifierNotReadyError(
                self.load_error or "Exercise classifier model is not loaded."
            )
        model_input = self._scale_window(window)
        with self._predict_lock:
            prediction = model.predict(model_input, verbose=0)

        if prediction.ndim != 2 or prediction.shape[1] != len(self.exercise_classes):
            raise ClassifierNotReadyError(
                f"Unexpected classifier output shape: {prediction.shape}"
            )

        predicted_index = int(np.argmax(prediction, axis=1)[0])
        confidence = float(np.max(prediction))
        return self.exercise_classes[predicted_index], confidence

    def _stabilize(
        self,
        raw_label: str,
        confidence: float,
        state: ClassifierState,
    ) -> Classification:
        exercise = normalize_exercise_label(raw_label) or raw_label
        state.prediction_buffer.append(exercise)
        state.confidence_buffer.append(confidence)

        counts = Counter(state.prediction_buffer)
        majority_exercise, majority_count = counts.most_common(1)[0]
        majority_confidences = [
            conf
            for label, conf in zip(state.prediction_buffer, state.confidence_buffer)
            if label == majority_exercise
        ]
        smoothed_confidence = (
            float(np.mean(majority_confidences)) if majority_confidences else confidence
        )
        stable_prediction = (
            majority_count >= self.stable_frames
            and smoothed_confidence >= self.switch_confidence
        )

        if state.current_exercise is None and stable_prediction:
            state.current_exercise = majority_exercise
            state.current_confidence = smoothed_confidence
        elif majority_exercise != state.current_exercise and stable_prediction:
            state.current_exercise = majority_exercise
            state.current_confidence = smoothed_confidence
        elif majority_exercise == state.current_exercise:
            state.current_confidence = smoothed_confidence

        result = Classification(
            exercise=state.current_exercise or majority_exercise,
            confidence=state.current_confidence
            if state.current_exercise
            else smoothed_confidence,
            raw_label=raw_label,
            ready=True,
            stable_prediction=stable_prediction,
            message=None,
        )
        state.last_result = result
        return result

    def predict(
        self,
        landmarks: List[List[float]],
        state: Optional[ClassifierState] = None,
    ) -> Classification:
        """Add one normalized MediaPipe frame and return the latest classification."""
        if not self.is_ready:
            raise ClassifierNotReadyError(
                self.load_error or "Exercise classifier artifacts are not loaded."
            )

        classifier_state = state or self._default_state
        try:
            features = extract_features(landmarks, normalize=False)
        except ValueError as exc:
            classifier_state.last_result = Classification(
                exercise=classifier_state.last_result.exercise,
                confidence=classifier_state.last_result.confidence,
                raw_label=classifier_state.last_result.raw_label,
                ready=False,
                stable_prediction=False,
                message=str(exc),
            )
            return classifier_state.last_result

        if features.shape != (self.feature_count,) or not np.isfinite(features).all():
            classifier_state.last_result = Classification(
                exercise=classifier_state.last_result.exercise,
                confidence=classifier_state.last_result.confidence,
                raw_label=classifier_state.last_result.raw_label,
                ready=False,
                stable_prediction=False,
                message="Invalid 140-feature pose frame for classification.",
            )
            return classifier_state.last_result

        classifier_state.features_window.append(features)
        if len(classifier_state.features_window) < self.window_size:
            classifier_state.last_result = Classification(
                exercise=classifier_state.last_result.exercise,
                confidence=classifier_state.last_result.confidence,
                raw_label=classifier_state.last_result.raw_label,
                ready=False,
                stable_prediction=False,
                message=(
                    f"Collecting pose frames for classification "
                    f"({len(classifier_state.features_window)}/{self.window_size})."
                ),
            )
            return classifier_state.last_result

        window = np.asarray(list(classifier_state.features_window), dtype=np.float32)
        raw_label, confidence = self._predict_window(window)
        return self._stabilize(raw_label, confidence, classifier_state)
