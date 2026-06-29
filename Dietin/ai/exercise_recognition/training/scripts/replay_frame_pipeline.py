"""Verify the /api/frame pipeline end-to-end by replaying a real landmark
window through the running backend.

Steps:
1. Pick a `.npy` window from `dataset/windows/win45_angles/squat/`.
2. For each of its 45 frames, render the 33 pose landmarks into a synthetic
   1280x720 JPEG (drawing each landmark as a small filled circle).
3. POST it to `/api/frame` with the session id from a fresh `/api/session/start`.
4. Print per-frame classification + metrics every 5 frames.

This is not a beauty pageant — the goal is to confirm the full
decode -> MediaPipe -> classifier -> rep counter -> session metrics pipeline
runs without error against the running FastAPI process. Real-pose pixel
recovery (vs pose-by-circle) is the webcam demo's job."""

from __future__ import annotations

import base64
import json
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODULE_ROOT = PROJECT_ROOT.parent
if str(MODULE_ROOT) not in sys.path:
    sys.path.insert(0, str(MODULE_ROOT))
from config import DATASET_WINDOWS_DIR  # noqa: E402

DATASET_DIR = DATASET_WINDOWS_DIR / "win45_angles" / "squat"
API_BASE = "http://127.0.0.1:8000"

FRAME_WIDTH = 1280
FRAME_HEIGHT = 720


def post_json(path: str, payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_BASE + path,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(path: str) -> dict:
    with urllib.request.urlopen(API_BASE + path) as resp:
        return json.loads(resp.read().decode("utf-8"))


def render_frame(landmarks_132: np.ndarray) -> str:
    canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH, 3), dtype=np.uint8)
    raw = landmarks_132.reshape(33, 4)
    for idx in range(33):
        x = int(float(raw[idx, 0]) * FRAME_WIDTH)
        y = int(float(raw[idx, 1]) * FRAME_HEIGHT)
        cv2.circle(canvas, (x, y), 6, (255, 255, 255), -1)
    ok, buf = cv2.imencode(".jpg", canvas)
    assert ok
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def main() -> None:
    files = sorted(DATASET_DIR.glob("*.npy"))
    if not files:
        print("No squat windows found.", file=sys.stderr)
        sys.exit(1)
    window = np.load(files[0])
    if window.ndim == 3:
        window = window[0]
    if window.shape != (45, 140):
        print(f"unexpected shape {window.shape}", file=sys.stderr)
        sys.exit(1)

    start = post_json(
        "/api/session/start",
        {"exercise": "squat", "sets": 1, "target_reps": 5, "rest_timer": 5},
    )
    sid = start["session_id"]
    print(f"session id: {sid}")
    print(f"supported exercises: {len(start['supported_exercises'])}")

    for i, frame_features in enumerate(window):
        image = render_frame(frame_features[:132])
        resp = post_json(
            "/api/frame",
            {"session_id": sid, "image": image, "return_annotated_frame": False},
        )
        if i % 5 == 0 or i == len(window) - 1:
            cls = resp["classification"]
            metrics = resp["metrics"]
            print(
                f"frame {i:02d}: pose={resp['pose_detected']} "
                f"ready={cls['ready']} ex={cls['exercise']} "
                f"conf={cls['confidence']:.2f} reps={metrics['total_reps']}"
            )

    status = get_json(f"/api/session/status?session_id={sid}")
    end = post_json("/api/session/end", {"session_id": sid})
    print("final metrics:", json.dumps(status["metrics"], indent=2))
    print("end metrics:", json.dumps(end["metrics"], indent=2))


if __name__ == "__main__":
    main()
