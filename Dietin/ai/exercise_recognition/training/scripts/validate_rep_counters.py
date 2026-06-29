"""Validate every rep counter against the real win45_angles dataset.

For every classifier class:

1. Load every `.npy` window for that class.
2. Replay each frame through the corresponding rep counter (via the real
   ``RepCounter`` registry — no synthetic poses).
3. Record observed angle ranges, total reps counted, and per-window means.
4. Emit ``counter_validation.csv`` and a short structured summary used by
   ``rep_counter_report.md``.

The dataset windows hold 132 raw MediaPipe values + 8 biomechanical angles per
frame. The first 132 values pack 33 keypoints × (x, y, z, visibility) in
normalized coordinates. We convert them to *pixel-space* triples ``[idx, px, py]``
(image size 1280×720) so the existing ``RepCounter`` (which works in pixels)
runs unmodified.

A counter is considered VALID when:

* its observed joint angles span both the down-threshold and the up-threshold,
  i.e. the dataset actually contains the full motion the counter expects, AND
* at least one rep is counted across the sequence of windows.

Special cases:

* ``plank`` is an isometric hold — the validator records the hip angle band but
  does not require a rep increment.
* ``russian_twist`` uses wrist-versus-hip-midline pixel position, not a joint
  angle — its row reports an OK status whenever at least one full L↔R toggle
  is detected.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from statistics import mean
from typing import Dict, List, Tuple

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
MODULE_ROOT = PROJECT_ROOT.parent
sys.path.insert(0, str(MODULE_ROOT))
sys.path.insert(0, str(MODULE_ROOT / "inference"))

from app.services.rep_counter import RepCounter, _angle_180  # noqa: E402
from config import DATASET_WINDOWS_DIR  # noqa: E402

DATASET_DIR = DATASET_WINDOWS_DIR / "win45_angles"
OUT_CSV = PROJECT_ROOT / "counter_validation.csv"
OUT_JSON = PROJECT_ROOT / "counter_validation_summary.json"

FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# Joint each extension counter monitors (must mirror RepCounter constructor).
COUNTER_JOINT: Dict[str, Tuple[int, int, int]] = {
    "hammer_curl": (11, 13, 15),
    "tricep_dips": (11, 13, 15),
    "tricep_pushdown": (11, 13, 15),
    "bench_press": (12, 14, 16),
    "incline_bench_press": (12, 14, 16),
    "decline_bench_press": (12, 14, 16),
    "lat_pulldown": (12, 14, 16),
    "pull_up": (12, 14, 16),
    "t_bar_row": (12, 14, 16),
    "chest_fly_machine": (14, 12, 24),
    "lateral_raise": (14, 12, 24),
    "deadlift": (12, 24, 26),
    "romanian_deadlift": (12, 24, 26),
    "hip_thrust": (12, 24, 26),
    "leg_extension": (24, 26, 28),
    "leg_raises": (12, 24, 26),
    "plank": (12, 24, 26),
    # Handcrafted counters — joint shown is the primary angle they track.
    "push_up": (11, 13, 15),
    "squat": (24, 26, 28),
    "barbell_biceps_curl": (12, 14, 16),
    "shoulder_press": (12, 14, 16),
    # Russian twist uses a position threshold, not an angle.
}

# Down/up thresholds wired into the extension counters (must mirror constructor).
COUNTER_THRESHOLDS: Dict[str, Tuple[float, float]] = {
    "hammer_curl": (60.0, 150.0),
    "tricep_dips": (90.0, 160.0),
    "tricep_pushdown": (60.0, 160.0),
    "bench_press": (90.0, 160.0),
    "incline_bench_press": (90.0, 160.0),
    "decline_bench_press": (90.0, 160.0),
    "lat_pulldown": (70.0, 160.0),
    "pull_up": (70.0, 160.0),
    "t_bar_row": (80.0, 160.0),
    "chest_fly_machine": (50.0, 85.0),
    "lateral_raise": (30.0, 80.0),
    "deadlift": (100.0, 165.0),
    "romanian_deadlift": (110.0, 165.0),
    "hip_thrust": (90.0, 160.0),
    "leg_extension": (90.0, 165.0),
    "leg_raises": (100.0, 165.0),
    # Handcrafted counters use atan2 (0–360) — included for completeness but
    # the validator reports observed [0, 180] band on the primary joint instead.
    "push_up": (float("nan"), float("nan")),
    "squat": (float("nan"), float("nan")),
    "barbell_biceps_curl": (float("nan"), float("nan")),
    "shoulder_press": (float("nan"), float("nan")),
    "plank": (float("nan"), float("nan")),
    "russian_twist": (float("nan"), float("nan")),
}


def frame_to_pixel_landmarks(frame: np.ndarray) -> List[List[int]]:
    """Decode one 140-feature frame into pixel-landmark triples for RepCounter."""
    raw = frame[:132].reshape(33, 4)
    pixels: List[List[int]] = []
    for idx in range(33):
        x = int(float(raw[idx, 0]) * FRAME_WIDTH)
        y = int(float(raw[idx, 1]) * FRAME_HEIGHT)
        pixels.append([idx, x, y])
    return pixels


def observed_primary_angle(
    pixels: List[List[int]], joint: Tuple[int, int, int] | None
) -> float:
    if joint is None:
        return float("nan")
    return _angle_180(pixels, *joint)


def validate_class(class_name: str) -> Dict[str, object]:
    class_dir = DATASET_DIR / class_name
    if not class_dir.exists():
        return {
            "exercise": class_name,
            "joint": COUNTER_JOINT.get(class_name),
            "windows_seen": 0,
            "frames_seen": 0,
            "observed_min": None,
            "observed_max": None,
            "observed_mean": None,
            "down_threshold": COUNTER_THRESHOLDS.get(class_name, (None, None))[0],
            "up_threshold": COUNTER_THRESHOLDS.get(class_name, (None, None))[1],
            "reps_counted": 0,
            "validation_status": "MISSING_DATA",
            "notes": "No windows directory.",
        }

    counter = RepCounter()
    joint = COUNTER_JOINT.get(class_name)
    angles_seen: List[float] = []
    reps_total = 0
    windows_seen = 0
    frames_seen = 0
    last_total = 0

    for npy_path in sorted(class_dir.glob("*.npy")):
        try:
            arr = np.load(npy_path)
        except Exception:
            continue
        if arr.size == 0:
            continue
        if arr.ndim == 2 and arr.shape == (45, 140):
            windows = arr.reshape(1, 45, 140)
        elif arr.ndim == 3 and arr.shape[1:] == (45, 140):
            windows = arr
        else:
            continue
        windows_seen += len(windows)
        for window in windows:
            if not np.isfinite(window).all():
                continue
            for frame in window:
                pixels = frame_to_pixel_landmarks(frame)
                angle = observed_primary_angle(pixels, joint)
                if np.isfinite(angle):
                    angles_seen.append(angle)
                counter.update(class_name, pixels)
                frames_seen += 1
        new_total = counter._states[class_name].total_reps  # type: ignore[attr-defined]
        reps_total += new_total - last_total
        last_total = new_total

    down, up = COUNTER_THRESHOLDS.get(class_name, (float("nan"), float("nan")))
    observed_min = min(angles_seen) if angles_seen else None
    observed_max = max(angles_seen) if angles_seen else None
    observed_mean = mean(angles_seen) if angles_seen else None

    if class_name == "plank":
        status = "OK" if angles_seen else "MISSING_DATA"
        notes = "Isometric hold — no rep increment expected. Angle band measured."
    elif class_name == "russian_twist":
        status = "OK" if reps_total > 0 else "NO_REPS"
        notes = "Counter uses wrist vs hip-midline position threshold (px)."
    elif not (np.isfinite(down) and np.isfinite(up)):
        # Handcrafted atan2 (0-360) counter — the 0-180 band check does not apply.
        status = "OK" if reps_total > 0 else "NO_REPS"
        notes = "Handcrafted counter (0-360 atan2 convention); reps-only check."
    else:
        spans_down = observed_min is not None and observed_min <= down
        spans_up = observed_max is not None and observed_max >= up
        if reps_total == 0:
            status = "NO_REPS"
        elif spans_down and spans_up:
            status = "OK"
        elif not spans_down:
            status = "SHALLOW_DOWN"
        elif not spans_up:
            status = "SHALLOW_UP"
        else:
            status = "REVIEW"
        notes = ""

    return {
        "exercise": class_name,
        "joint": joint,
        "windows_seen": windows_seen,
        "frames_seen": frames_seen,
        "observed_min": observed_min,
        "observed_max": observed_max,
        "observed_mean": observed_mean,
        "down_threshold": down,
        "up_threshold": up,
        "reps_counted": reps_total,
        "validation_status": status,
        "notes": notes,
    }


def main() -> None:
    counter = RepCounter()
    classes = counter.supported_exercises()
    results = [validate_class(class_name) for class_name in classes]

    with OUT_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "exercise",
                "joint",
                "observed_min",
                "observed_max",
                "observed_mean",
                "down_threshold",
                "up_threshold",
                "reps_counted",
                "windows_seen",
                "frames_seen",
                "validation_status",
                "notes",
            ]
        )
        for row in results:
            joint = row["joint"]
            writer.writerow(
                [
                    row["exercise"],
                    "-".join(str(idx) for idx in joint) if joint else "",
                    f"{row['observed_min']:.2f}" if row["observed_min"] is not None else "",
                    f"{row['observed_max']:.2f}" if row["observed_max"] is not None else "",
                    f"{row['observed_mean']:.2f}" if row["observed_mean"] is not None else "",
                    f"{row['down_threshold']:.2f}" if row["down_threshold"] == row["down_threshold"] else "",
                    f"{row['up_threshold']:.2f}" if row["up_threshold"] == row["up_threshold"] else "",
                    row["reps_counted"],
                    row["windows_seen"],
                    row["frames_seen"],
                    row["validation_status"],
                    row["notes"],
                ]
            )

    OUT_JSON.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {OUT_CSV.name} and {OUT_JSON.name} ({len(results)} exercises).")
    for row in results:
        print(
            f"  {row['exercise']:<22} "
            f"min={row['observed_min']!s:<7} max={row['observed_max']!s:<7} "
            f"reps={row['reps_counted']:<3} status={row['validation_status']}"
        )


if __name__ == "__main__":
    main()
