"""Shim — delegates to the module-level unified config at ai/exercise_recognition/config.py."""
from __future__ import annotations

import sys
from pathlib import Path

_MODULE_ROOT = Path(__file__).resolve().parents[3]
if str(_MODULE_ROOT) not in sys.path:
    sys.path.insert(0, str(_MODULE_ROOT))

from config import Settings, get_settings, MODULE_ROOT  # noqa: E402

ROOT_DIR = MODULE_ROOT

__all__ = ["Settings", "get_settings", "ROOT_DIR"]
