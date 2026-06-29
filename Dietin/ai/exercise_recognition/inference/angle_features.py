"""140-feature pose representation used by the 22-exercise BiLSTM classifier.

The precomputed training windows in `dataset/windows/win45_angles/` use:

- 132 flattened MediaPipe Pose landmark values: 33 landmarks × (x, y, z, visibility)
- 8 biomechanical 3D joint-angle features

This module is intentionally small and dependency-light so the same feature extraction
can be used during training utilities and real-time backend inference.
"""

from __future__ import annotations

from typing import Iterable, Sequence

import numpy as np

LANDMARK_COUNT = 33
LANDMARK_VALUES = 4
RAW_FEATURE_COUNT = LANDMARK_COUNT * LANDMARK_VALUES
ANGLE_FEATURE_COUNT = 8
FEATURE_COUNT = RAW_FEATURE_COUNT + ANGLE_FEATURE_COUNT

# MediaPipe Pose landmark indices.
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_ELBOW = 13
RIGHT_ELBOW = 14
LEFT_WRIST = 15
RIGHT_WRIST = 16
LEFT_HIP = 23
RIGHT_HIP = 24
LEFT_KNEE = 25
RIGHT_KNEE = 26
LEFT_ANKLE = 27
RIGHT_ANKLE = 28

# Angle order used for the appended 8-dimensional biomechanical vector.
# The first four and last two match the stored win45_angles columns exactly.
# The hip-angle columns are standard left/right hip 3D flexion angles and are
# included for real-time feature generation when raw webcam landmarks are used.
ANGLE_TRIPLES = (
    (LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST),
    (RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST),
    (LEFT_ELBOW, LEFT_SHOULDER, LEFT_HIP),
    (RIGHT_ELBOW, RIGHT_SHOULDER, RIGHT_HIP),
    (LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE),
    (RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE),
    (LEFT_HIP, LEFT_KNEE, LEFT_ANKLE),
    (RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE),
)


def _as_landmark_array(landmarks: Sequence[Sequence[float]] | np.ndarray) -> np.ndarray:
    """Return landmarks as a finite float32 array of shape `(33, 4)`."""
    arr = np.asarray(landmarks, dtype=np.float32)

    if arr.shape == (RAW_FEATURE_COUNT,):
        arr = arr.reshape(LANDMARK_COUNT, LANDMARK_VALUES)
    elif arr.shape == (LANDMARK_COUNT, 3):
        visibility = np.ones((LANDMARK_COUNT, 1), dtype=np.float32)
        arr = np.concatenate([arr, visibility], axis=1)
    elif arr.shape != (LANDMARK_COUNT, LANDMARK_VALUES):
        raise ValueError(
            f"Expected landmarks with shape (33,4), (33,3), or (132,), got {arr.shape}."
        )

    if not np.isfinite(arr).all():
        raise ValueError("Landmarks contain NaN or infinite values.")
    return arr


def calculate_3d_angle(
    a: Sequence[float] | np.ndarray,
    b: Sequence[float] | np.ndarray,
    c: Sequence[float] | np.ndarray,
) -> float:
    """Calculate the smaller 3D angle ABC in degrees using x/y/z coordinates."""
    a_np = np.asarray(a, dtype=np.float32)[:3]
    b_np = np.asarray(b, dtype=np.float32)[:3]
    c_np = np.asarray(c, dtype=np.float32)[:3]

    ba = a_np - b_np
    bc = c_np - b_np
    denominator = float(np.linalg.norm(ba) * np.linalg.norm(bc))
    if denominator <= 1e-8:
        return 0.0

    cosine = float(np.dot(ba, bc) / denominator)
    cosine = float(np.clip(cosine, -1.0, 1.0))
    return float(np.degrees(np.arccos(cosine)))


def extract_angle_features(
    landmarks: Sequence[Sequence[float]] | np.ndarray,
) -> np.ndarray:
    """Compute the 8 biomechanical angle features for one MediaPipe frame."""
    arr = _as_landmark_array(landmarks)
    angles = [calculate_3d_angle(arr[a], arr[b], arr[c]) for a, b, c in ANGLE_TRIPLES]
    return np.asarray(angles, dtype=np.float32)


def normalize_landmarks_hip_center(
    landmarks: Sequence[Sequence[float]] | np.ndarray,
) -> np.ndarray:
    """Normalize MediaPipe landmarks using the dataset's hip-center convention.

    The dataset metadata marks landmark normalization as `hip_center`. This keeps
    visibility unchanged, centers x/y/z around the midpoint of both hips, and
    scales by torso length with shoulder/hip-width fallbacks.
    """
    arr = _as_landmark_array(landmarks).copy()
    hip_center = (arr[LEFT_HIP, :3] + arr[RIGHT_HIP, :3]) / 2.0
    shoulder_center = (arr[LEFT_SHOULDER, :3] + arr[RIGHT_SHOULDER, :3]) / 2.0
    torso_scale = float(np.linalg.norm(shoulder_center - hip_center))
    shoulder_width = float(
        np.linalg.norm(arr[LEFT_SHOULDER, :3] - arr[RIGHT_SHOULDER, :3])
    )
    hip_width = float(np.linalg.norm(arr[LEFT_HIP, :3] - arr[RIGHT_HIP, :3]))
    scale = next(
        (
            value
            for value in (torso_scale, shoulder_width, hip_width, 1.0)
            if value > 1e-6
        ),
        1.0,
    )
    arr[:, :3] = (arr[:, :3] - hip_center) / scale
    return arr.astype(np.float32)


def extract_features(
    landmarks: Sequence[Sequence[float]] | np.ndarray,
    normalize: bool = False,
) -> np.ndarray:
    """Return a single 140-dimensional frame feature vector."""
    arr = (
        normalize_landmarks_hip_center(landmarks)
        if normalize
        else _as_landmark_array(landmarks)
    )
    raw_features = arr.reshape(-1).astype(np.float32)
    angle_features = extract_angle_features(arr)
    return np.concatenate([raw_features, angle_features]).astype(np.float32)


def extract_sequence_features(
    landmark_frames: Iterable[Sequence[Sequence[float]] | np.ndarray],
) -> np.ndarray:
    """Return a `(frames, 140)` feature matrix from an iterable of landmark frames."""
    return np.asarray(
        [extract_features(frame) for frame in landmark_frames], dtype=np.float32
    )
