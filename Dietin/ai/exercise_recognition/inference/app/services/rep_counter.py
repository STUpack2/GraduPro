import math
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

from .classifier import normalize_exercise_label


@dataclass
class RepetitionState:
    total_reps: int = 0
    stage: Optional[str] = None
    stage_left: Optional[str] = None
    stage_right: Optional[str] = None
    last_angles: Dict[str, float] = field(default_factory=dict)


@dataclass
class RepCountResult:
    exercise: Optional[str]
    total_reps: int = 0
    delta: int = 0
    stage: Optional[str] = None
    angles: Dict[str, float] = field(default_factory=dict)
    feedback: List[str] = field(default_factory=list)
    supported: bool = True


CounterHandler = Callable[[List[List[int]], RepetitionState], None]


def _angle_360(landmarks: List[List[int]], p1: int, p2: int, p3: int) -> float:
    x1, y1 = landmarks[p1][1], landmarks[p1][2]
    x2, y2 = landmarks[p2][1], landmarks[p2][2]
    x3, y3 = landmarks[p3][1], landmarks[p3][2]
    angle = math.degrees(math.atan2(y3 - y2, x3 - x2) - math.atan2(y1 - y2, x1 - x2))
    if angle < 0:
        angle += 360
    return angle


def _angle_180(landmarks: List[List[int]], p1: int, p2: int, p3: int) -> float:
    """Shorter-arc joint angle in [0, 180]. 0° = fully flexed, 180° = straight."""
    a = _angle_360(landmarks, p1, p2, p3)
    return a if a <= 180 else 360 - a


class RepCounter:
    """Exercise-specific repetition counter registry.

    Every classifier label MUST have a registered handler so update() returns
    supported=True. A label without a handler silently sits at delta=0 — the
    historical reason the UI counter stayed pegged at zero for 18 of 22 classes.
    """

    def __init__(self):
        self._states: Dict[str, RepetitionState] = {}
        self._handlers: Dict[str, CounterHandler] = {}

        # Original handcrafted counters (atan2 / 0-360 convention). Preserved
        # untouched — they're verified by the runtime trace.
        self.register_counter("push_up", self._count_push_up)
        self.register_counter("squat", self._count_squat)
        # "bicep curl" normalizes to "barbell_biceps_curl" via LABEL_ALIASES.
        self.register_counter("bicep_curl", self._count_bicep_curl)
        self.register_counter("shoulder_press", self._count_shoulder_press)

        # Joint-extension counters (inside angle, 0-180 convention) covering the
        # remaining 18 classifier labels. Tuples are (down_max, up_min, joint).
        # "joint" is the MediaPipe triplet (p1, p2, p3) where p2 is the vertex.
        extension_counters: List[Tuple[str, Tuple[int, int, int], float, float]] = [
            # Arms — elbow flex/extend (left arm: 11-13-15)
            ("hammer_curl",          (11, 13, 15),  60.0, 150.0),
            ("tricep_dips",          (11, 13, 15),  90.0, 160.0),
            ("tricep_pushdown",      (11, 13, 15),  60.0, 160.0),
            # Chest presses — right elbow flex/extend (12-14-16)
            ("bench_press",          (12, 14, 16),  90.0, 160.0),
            ("incline_bench_press",  (12, 14, 16),  90.0, 160.0),
            ("decline_bench_press",  (12, 14, 16),  90.0, 160.0),
            # Pulls — elbow flex/extend
            ("lat_pulldown",         (12, 14, 16),  70.0, 160.0),
            ("pull_up",              (12, 14, 16),  70.0, 160.0),
            ("t_bar_row",            (12, 14, 16),  80.0, 160.0),
            # Shoulder abduction (chest fly + lateral raise): upper arm vs torso
            ("chest_fly_machine",    (14, 12, 24),  50.0,  85.0),
            ("lateral_raise",        (14, 12, 24),  30.0,  80.0),
            # Hip hinge (deadlift family + hip thrust)
            ("deadlift",             (12, 24, 26), 100.0, 165.0),
            ("romanian_deadlift",    (12, 24, 26), 110.0, 165.0),
            ("hip_thrust",           (12, 24, 26),  90.0, 160.0),
            # Knee extension (leg extension on the machine)
            ("leg_extension",        (24, 26, 28),  90.0, 165.0),
            # Hip flexion for hanging/lying leg raises
            ("leg_raises",           (12, 24, 26), 100.0, 165.0),
        ]
        for name, joint, down_max, up_min in extension_counters:
            self.register_counter(
                name, self._make_extension_counter(name, joint, down_max, up_min)
            )

        # Bespoke counters for the two remaining classes.
        self.register_counter("plank", self._count_plank)
        self.register_counter("russian_twist", self._count_russian_twist)

    def register_counter(self, exercise: str, handler: CounterHandler) -> None:
        canonical = normalize_exercise_label(exercise)
        if not canonical:
            raise ValueError("Exercise name is required to register a rep counter.")
        self._handlers[canonical] = handler
        self._states.setdefault(canonical, RepetitionState())

    def supported_exercises(self) -> List[str]:
        return sorted(self._handlers.keys())

    def update(
        self, exercise: Optional[str], landmarks: List[List[int]]
    ) -> RepCountResult:
        canonical = normalize_exercise_label(exercise)
        if not canonical:
            return RepCountResult(
                exercise=None,
                supported=False,
                feedback=["Waiting for exercise classification before counting reps."],
            )

        if len(landmarks) < 29:
            return RepCountResult(
                exercise=canonical,
                supported=False,
                feedback=[
                    "Pose landmarks are incomplete; rep counter skipped this frame."
                ],
            )

        handler = self._handlers.get(canonical)
        state = self._states.setdefault(canonical, RepetitionState())
        if handler is None:
            return RepCountResult(
                exercise=canonical,
                total_reps=state.total_reps,
                supported=False,
                feedback=[f"No rep counter is configured for '{canonical}'."],
            )

        previous_total = state.total_reps
        handler(landmarks, state)
        delta = state.total_reps - previous_total
        return RepCountResult(
            exercise=canonical,
            total_reps=state.total_reps,
            delta=delta,
            stage=state.stage,
            angles=dict(state.last_angles),
            supported=True,
        )

    # ---- Generic factory ---------------------------------------------------

    def _make_extension_counter(
        self,
        name: str,
        joint: Tuple[int, int, int],
        down_max: float,
        up_min: float,
    ) -> CounterHandler:
        """Build a down → up handler from a single joint angle in [0, 180]."""
        p1, p2, p3 = joint

        def handler(landmarks: List[List[int]], state: RepetitionState) -> None:
            angle = _angle_180(landmarks, p1, p2, p3)
            state.last_angles = {name: angle}
            if angle < down_max:
                state.stage = "down"
            if angle > up_min and state.stage == "down":
                state.stage = "up"
                state.total_reps += 1

        handler.__name__ = f"_count_{name}"
        return handler

    # ---- Original handcrafted counters (unchanged) -------------------------

    def _count_push_up(
        self, landmarks: List[List[int]], state: RepetitionState
    ) -> None:
        right_arm_angle = _angle_360(landmarks, 12, 14, 16)
        left_arm_angle = _angle_360(landmarks, 11, 13, 15)
        state.last_angles = {
            "right_arm": right_arm_angle,
            "left_arm": left_arm_angle,
        }

        if left_arm_angle < 220:
            state.stage = "down"
        if left_arm_angle > 240 and state.stage == "down":
            state.stage = "up"
            state.total_reps += 1

    def _count_squat(self, landmarks: List[List[int]], state: RepetitionState) -> None:
        right_leg_angle = _angle_360(landmarks, 24, 26, 28)
        left_leg_angle = _angle_360(landmarks, 23, 25, 27)
        state.last_angles = {
            "right_leg": right_leg_angle,
            "left_leg": left_leg_angle,
        }

        if right_leg_angle > 160 and left_leg_angle < 220:
            state.stage = "down"
        if right_leg_angle < 140 and left_leg_angle > 210 and state.stage == "down":
            state.stage = "up"
            state.total_reps += 1

    def _count_bicep_curl(
        self, landmarks: List[List[int]], state: RepetitionState
    ) -> None:
        right_arm_angle = _angle_360(landmarks, 12, 14, 16)
        left_arm_angle = _angle_360(landmarks, 11, 13, 15)
        state.last_angles = {
            "right_arm": right_arm_angle,
            "left_arm": left_arm_angle,
        }

        if 160 < right_arm_angle < 200:
            state.stage_right = "down"
        if 140 < left_arm_angle < 200:
            state.stage_left = "down"

        if (
            state.stage_right == "down"
            and state.stage_left == "down"
            and (right_arm_angle > 310 or right_arm_angle < 60)
            and (left_arm_angle > 310 or left_arm_angle < 60)
        ):
            state.stage_right = "up"
            state.stage_left = "up"
            state.stage = "up"
            state.total_reps += 1

    def _count_shoulder_press(
        self, landmarks: List[List[int]], state: RepetitionState
    ) -> None:
        right_arm_angle = _angle_360(landmarks, 12, 14, 16)
        left_arm_angle = _angle_360(landmarks, 11, 13, 15)
        state.last_angles = {
            "right_arm": right_arm_angle,
            "left_arm": left_arm_angle,
        }

        if right_arm_angle > 280 and left_arm_angle < 80:
            state.stage = "down"
        if right_arm_angle < 240 and left_arm_angle > 120 and state.stage == "down":
            state.stage = "up"
            state.total_reps += 1

    # ---- Bespoke counters for non-extension movements ----------------------

    def _count_plank(
        self, landmarks: List[List[int]], state: RepetitionState
    ) -> None:
        # Isometric hold — no rep increments. We still mark the state as
        # supported so the API stops emitting "no counter configured" feedback,
        # and surface the hip angle for form feedback.
        hip_angle = _angle_180(landmarks, 12, 24, 26)
        state.last_angles = {"hip": hip_angle}
        state.stage = "hold"

    def _count_russian_twist(
        self, landmarks: List[List[int]], state: RepetitionState
    ) -> None:
        # Each full left↔right rotation of the wrists past the hip midline is
        # one rep (one twist out + one twist back).
        right_wrist_x = float(landmarks[16][1])
        midline_x = (float(landmarks[23][1]) + float(landmarks[24][1])) / 2.0
        threshold = 30.0
        state.last_angles = {
            "right_wrist_x": right_wrist_x,
            "midline_x": midline_x,
        }
        if right_wrist_x < midline_x - threshold:
            state.stage = "left"
        elif right_wrist_x > midline_x + threshold:
            if state.stage == "left":
                state.total_reps += 1
            state.stage = "right"
