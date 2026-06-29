"""Single source of truth for the Exercise Recognition module.

Every path used by inference, training, or tooling must come from this file so
the module remains relocatable. Production runtime depends only on ``models/``
and ``artifacts/`` — ``dataset/`` is referenced for training only and is never
loaded at import time.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Tuple

MODULE_ROOT: Path = Path(__file__).resolve().parent
DIETIN_ROOT: Path = MODULE_ROOT.parent.parent
AI_ROOT: Path = MODULE_ROOT.parent

MODELS_DIR: Path = MODULE_ROOT / "models"
ARTIFACTS_DIR: Path = MODULE_ROOT / "artifacts"
TRAINING_DIR: Path = MODULE_ROOT / "training"
INFERENCE_DIR: Path = MODULE_ROOT / "inference"
DOCS_DIR: Path = MODULE_ROOT / "docs"

DATASET_DIR: Path = AI_ROOT / "dataset"
DATASET_LANDMARKS_DIR: Path = DATASET_DIR / "landmarks"
DATASET_METADATA_DIR: Path = DATASET_DIR / "metadata"
DATASET_WINDOWS_DIR: Path = DATASET_DIR / "windows"
DATASET_REPORTS_DIR: Path = DATASET_DIR / "reports"

MODEL_PATH: Path = MODELS_DIR / "exercise_classifier_22ex.keras"
SCALER_PATH: Path = ARTIFACTS_DIR / "feature_scaler_angles.pkl"
LABEL_ENCODER_PATH: Path = ARTIFACTS_DIR / "label_encoder.pkl"
TRAINING_METADATA_PATH: Path = ARTIFACTS_DIR / "training_metadata.json"
CLASS_WEIGHTS_PATH: Path = ARTIFACTS_DIR / "class_weights.json"


@dataclass(frozen=True)
class Settings:
    app_name: str = "Dietin Exercise Recognition API"
    api_prefix: str = "/api"
    model_version: str = "22ex_bilstm_v1"

    model_path: Path = MODEL_PATH
    scaler_path: Path = SCALER_PATH
    label_encoder_path: Path = LABEL_ENCODER_PATH

    classifier_window_size: int = 45
    classifier_feature_count: int = 140
    classification_confidence_threshold: float = 0.80

    default_sets: int = 1
    default_target_reps: int = 12
    default_rest_timer: int = 60

    # Dev server origins — Vite auto-increments the port when the default is taken
    # (3000→3001, 5173→5174, etc.), so we whitelist the most common fallbacks too.
    cors_origins: Tuple[str, ...] = (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
