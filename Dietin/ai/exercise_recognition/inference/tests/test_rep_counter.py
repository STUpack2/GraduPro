"""Behavioral tests for the per-exercise rep counter.

Each test loads real `.npy` landmark windows from
`dataset/windows/win45_angles/<class_name>/`, converts them to pixel-space
landmark triples (the format `RepCounter.update` consumes), and asserts the
counter increments. All 22 classifier classes are covered by parametrization.

Two classes are special-cased:

* `plank` — isometric hold; the counter should NOT increment but should still
  enter the `"hold"` stage.
* `russian_twist` — uses wrist-vs-midline pixel position, not a joint angle;
  the assertion is just "at least one rep registered".
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import List

import numpy as np
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODULE_ROOT = PROJECT_ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(MODULE_ROOT))

from app.services.rep_counter import RepCounter  # noqa: E402
from config import DATASET_WINDOWS_DIR  # noqa: E402

DATASET_DIR = DATASET_WINDOWS_DIR / "win45_angles"

FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

ALL_CLASSES = [
    "barbell_biceps_curl",
    "bench_press",
    "chest_fly_machine",
    "deadlift",
    "decline_bench_press",
    "hammer_curl",
    "hip_thrust",
    "incline_bench_press",
    "lat_pulldown",
    "lateral_raise",
    "leg_extension",
    "leg_raises",
    "pull_up",
    "push_up",
    "romanian_deadlift",
    "russian_twist",
    "shoulder_press",
    "squat",
    "t_bar_row",
    "tricep_dips",
    "tricep_pushdown",
]


def _frame_to_pixels(frame: np.ndarray) -> List[List[int]]:
    raw = frame[:132].reshape(33, 4)
    pixels: List[List[int]] = []
    for idx in range(33):
        x = int(float(raw[idx, 0]) * FRAME_WIDTH)
        y = int(float(raw[idx, 1]) * FRAME_HEIGHT)
        pixels.append([idx, x, y])
    return pixels


def _replay_class(class_name: str, counter: RepCounter) -> int:
    class_dir = DATASET_DIR / class_name
    if not class_dir.exists():
        pytest.skip(f"Missing dataset class directory: {class_dir}")
    npy_files = sorted(class_dir.glob("*.npy"))
    if not npy_files:
        pytest.skip(f"No .npy windows for {class_name}")
    total_reps = 0
    for npy_path in npy_files[:10]:  # first 10 files is plenty for a unit test
        arr = np.load(npy_path)
        if arr.ndim == 2 and arr.shape == (45, 140):
            arr = arr.reshape(1, 45, 140)
        if arr.ndim != 3 or arr.shape[1:] != (45, 140):
            continue
        for window in arr:
            if not np.isfinite(window).all():
                continue
            for frame in window:
                pixels = _frame_to_pixels(frame)
                result = counter.update(class_name, pixels)
                total_reps = result.total_reps
    return total_reps


def test_all_22_classes_have_handlers() -> None:
    counter = RepCounter()
    supported = set(counter.supported_exercises())
    assert "plank" in supported
    assert "russian_twist" in supported
    for class_name in ALL_CLASSES:
        assert class_name in supported, f"Missing handler for {class_name}"


@pytest.mark.parametrize("class_name", ALL_CLASSES)
def test_counter_increments_on_real_data(class_name: str) -> None:
    counter = RepCounter()
    total = _replay_class(class_name, counter)
    assert total >= 1, (
        f"Expected at least one rep for {class_name} after replaying real "
        f"windows, but counter stayed at {total}."
    )


def test_plank_is_an_isometric_hold() -> None:
    counter = RepCounter()
    class_dir = DATASET_DIR / "plank"
    if not class_dir.exists():
        pytest.skip("Plank windows missing")
    npy_files = sorted(class_dir.glob("*.npy"))[:5]
    last_result = None
    for npy_path in npy_files:
        arr = np.load(npy_path)
        if arr.ndim == 2:
            arr = arr.reshape(1, *arr.shape)
        for window in arr:
            for frame in window:
                last_result = counter.update("plank", _frame_to_pixels(frame))
    assert last_result is not None
    assert last_result.total_reps == 0
    assert last_result.stage == "hold"


def test_unknown_exercise_is_unsupported() -> None:
    counter = RepCounter()
    result = counter.update("not_a_real_exercise", [[i, 100, 100] for i in range(33)])
    assert result.supported is False
    assert result.total_reps == 0
