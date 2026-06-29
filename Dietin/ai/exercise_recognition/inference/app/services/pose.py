import base64
from dataclasses import dataclass
from threading import Lock
from typing import Any, List, Optional

import cv2
import mediapipe as mp
import numpy as np
from angle_features import normalize_landmarks_hip_center

mp_pose = mp.solutions.pose


@dataclass
class PoseDetection:
    pose_detected: bool
    relevant_landmarks: List[List[float]]
    pixel_landmarks: List[List[int]]
    annotated_frame: np.ndarray
    raw_results: Optional[Any] = None


def decode_frame(image_payload: str) -> np.ndarray:
    """Decode a raw base64 or data-URL image payload into an OpenCV BGR frame."""
    encoded = image_payload.split(",", 1)[1] if "," in image_payload else image_payload
    encoded = "".join(encoded.split())

    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError("Frame image must be valid base64.") from exc

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Frame image could not be decoded as JPEG/PNG/WebP.")
    return frame


def encode_frame_as_data_url(frame: np.ndarray, quality: int = 85) -> str:
    ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("Could not encode annotated frame.")
    encoded = base64.b64encode(buffer).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


class PoseService:
    """MediaPipe pose detector for webcam frames."""

    def __init__(
        self,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ):
        self._drawing_utils = mp.solutions.drawing_utils
        self._lock = Lock()
        self._pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )

    def process(self, frame: np.ndarray, draw: bool = True) -> PoseDetection:
        if frame is None or frame.size == 0:
            raise ValueError("Frame is empty.")

        annotated_frame = frame.copy()
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        with self._lock:
            results = self._pose.process(rgb_frame)
        rgb_frame.flags.writeable = True

        if not results.pose_landmarks:
            return PoseDetection(
                pose_detected=False,
                relevant_landmarks=[],
                pixel_landmarks=[],
                annotated_frame=annotated_frame,
                raw_results=results,
            )

        if draw:
            self._drawing_utils.draw_landmarks(
                annotated_frame,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
            )

        raw_landmarks: List[List[float]] = []
        for landmark in results.pose_landmarks.landmark:
            raw_landmarks.append(
                [
                    float(landmark.x),
                    float(landmark.y),
                    float(landmark.z),
                    float(landmark.visibility),
                ]
            )
        relevant_landmarks = normalize_landmarks_hip_center(raw_landmarks).tolist()

        height, width = frame.shape[:2]
        pixel_landmarks: List[List[int]] = []
        for idx, landmark in enumerate(results.pose_landmarks.landmark):
            pixel_landmarks.append(
                [idx, int(landmark.x * width), int(landmark.y * height)]
            )

        return PoseDetection(
            pose_detected=True,
            relevant_landmarks=relevant_landmarks,
            pixel_landmarks=pixel_landmarks,
            annotated_frame=annotated_frame,
            raw_results=results,
        )

    def close(self) -> None:
        self._pose.close()
