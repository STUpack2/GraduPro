# Exercise Recognition — Migration Report

Date: 2026-06-28
Source: `Fitness-AI-Trainer-With-Automatic-Exercise-Recognition-and-Counting/` (sibling repo)
Destination: `Dietin/ai/exercise_recognition/` + `Dietin/ai/dataset/`

This was a pure migration. No retraining, no weight changes, no logic edits to
inference or training. Only file moves, dedup, and path rewiring through a new
single `config.py`.

## Moved files

### Models / artifacts
| From | To |
|---|---|
| `models/exercise_classifier_22ex.keras` | `ai/exercise_recognition/models/exercise_classifier_22ex.keras` |
| `models/feature_scaler_angles.pkl` | `ai/exercise_recognition/artifacts/feature_scaler_angles.pkl` |
| `models/label_encoder.pkl` | `ai/exercise_recognition/artifacts/label_encoder.pkl` |
| `models/training_metadata.json` | `ai/exercise_recognition/artifacts/training_metadata.json` |
| `models/class_weights.json` | `ai/exercise_recognition/artifacts/class_weights.json` |

### Inference (production runtime)
| From | To |
|---|---|
| `main.py` | `ai/exercise_recognition/inference/main.py` |
| `angle_features.py` | `ai/exercise_recognition/inference/angle_features.py` |
| `app/api.py` | `ai/exercise_recognition/inference/app/api.py` |
| `app/schemas.py` | `ai/exercise_recognition/inference/app/schemas.py` |
| `app/__init__.py` | `ai/exercise_recognition/inference/app/__init__.py` |
| `app/core/config.py` | `ai/exercise_recognition/inference/app/core/config.py` (rewritten as shim) |
| `app/core/__init__.py` | `ai/exercise_recognition/inference/app/core/__init__.py` |
| `app/services/classifier.py` | `ai/exercise_recognition/inference/app/services/classifier.py` |
| `app/services/exercise_catalog.py` | `ai/exercise_recognition/inference/app/services/exercise_catalog.py` |
| `app/services/pose.py` | `ai/exercise_recognition/inference/app/services/pose.py` |
| `app/services/rep_counter.py` | `ai/exercise_recognition/inference/app/services/rep_counter.py` |
| `app/services/sessions.py` | `ai/exercise_recognition/inference/app/services/sessions.py` |
| `app/services/__init__.py` | `ai/exercise_recognition/inference/app/services/__init__.py` |
| `tests/test_api.py` | `ai/exercise_recognition/inference/tests/test_api.py` |
| `tests/test_classifier.py` | `ai/exercise_recognition/inference/tests/test_classifier.py` |
| `tests/test_rep_counter.py` | `ai/exercise_recognition/inference/tests/test_rep_counter.py` |
| `tests/__init__.py` | `ai/exercise_recognition/inference/tests/__init__.py` |

### Training
| From | To |
|---|---|
| `train_classifier_22ex.py` | `ai/exercise_recognition/training/train_classifier_22ex.py` |
| `scripts/replay_frame_pipeline.py` | `ai/exercise_recognition/training/scripts/replay_frame_pipeline.py` |
| `scripts/validate_rep_counters.py` | `ai/exercise_recognition/training/scripts/validate_rep_counters.py` |
| `scripts/run_replay.sh` | `ai/exercise_recognition/training/scripts/run_replay.sh` |
| `scripts/run_validate.sh` | `ai/exercise_recognition/training/scripts/run_validate.sh` |
| `environment.yml` | `ai/exercise_recognition/training/environment.yml` |

### Docs / reports
| From | To |
|---|---|
| `README.md` | `ai/exercise_recognition/docs/original_README.md` |
| `final_audit_report.md` | `ai/exercise_recognition/docs/final_audit_report.md` |
| `rep_counter_report.md` | `ai/exercise_recognition/docs/rep_counter_report.md` |
| `test_report.md` | `ai/exercise_recognition/docs/test_report.md` |
| `cleanup_report.md` | `ai/exercise_recognition/docs/cleanup_report.md` |
| `models/classification_report.txt` | `ai/exercise_recognition/docs/classification_report.txt` |
| `models/confusion_matrix.png` | `ai/exercise_recognition/docs/confusion_matrix.png` |
| `models/accuracy_curve.png` | `ai/exercise_recognition/docs/accuracy_curve.png` |
| `models/loss_curve.png` | `ai/exercise_recognition/docs/loss_curve.png` |

### Top-level
| From | To |
|---|---|
| `requirements.txt` | `ai/exercise_recognition/requirements.txt` |

### Dataset
| From | To |
|---|---|
| `dataset/landmarks/**` | `Dietin/ai/dataset/landmarks/**` |
| `dataset/metadata/**` | `Dietin/ai/dataset/metadata/**` |
| `dataset/windows/**` | `Dietin/ai/dataset/windows/**` |
| `dataset/reports/**` | `Dietin/ai/dataset/reports/**` |

## Created files
| Path | Purpose |
|---|---|
| `ai/exercise_recognition/config.py` | Single source of truth for every path + tunable |
| `ai/exercise_recognition/README.md` | Module README (architecture, IO, inference flow, artifacts) |
| `ai/exercise_recognition/migration_report.md` | This file |

## Rewritten files
| Path | Change |
|---|---|
| `inference/app/core/config.py` | Now a thin shim re-exporting from the unified `config.py` so existing `from .core.config import get_settings` imports keep working. |
| `training/train_classifier_22ex.py` | Default dataset/metadata/model paths replaced with imports from `config.py`. Training logic untouched. |
| `training/scripts/replay_frame_pipeline.py` | Dataset path replaced with `DATASET_WINDOWS_DIR` from `config.py`. |
| `training/scripts/validate_rep_counters.py` | Dataset path replaced with `DATASET_WINDOWS_DIR`; sys.path bootstrap updated for new layout. |
| `inference/tests/test_classifier.py` | Dataset path replaced with `DATASET_WINDOWS_DIR`. |
| `inference/tests/test_rep_counter.py` | Same. |
| `inference/tests/test_api.py` | sys.path bootstrap extended to include module root. |

## Deleted files / dirs
| Path | Reason |
|---|---|
| `__pycache__/` (all) | Build cache |
| `.pytest_cache/` | Test cache |
| `archive/` | Legacy artifacts, superseded |
| `frontend/` | Spec: do not touch frontend; demo HTML/JS not part of the integrated module |
| `exercise_classifier.py` (root) | Duplicate of `app/services/classifier.py` — production version retained, legacy standalone dropped |
| `counter_validation.csv`, `counter_validation_summary.json` | Stale validation outputs from prior runs |
| `.git/`, `.gitignore` | Old repo metadata — Dietin owns versioning now |
| `.DS_Store` (recursive) | macOS Finder cruft |
| Original empty `models/` dir | Contents redistributed into `models/` (weights), `artifacts/`, `docs/` |

## Final folder tree

```
Dietin/ai/
├── dataset/
│   ├── landmarks/                  (22 class folders, 649 .npy windows + meta)
│   ├── metadata/
│   │   ├── classes.json
│   │   ├── extraction_index.csv
│   │   └── videos_index.csv
│   ├── reports/                    (pipeline reports, plots, verification samples)
│   └── windows/                    (win30/win45/win45_angles/win60 pre-windowed)
└── exercise_recognition/
    ├── README.md
    ├── migration_report.md
    ├── config.py
    ├── requirements.txt
    ├── artifacts/
    │   ├── class_weights.json
    │   ├── feature_scaler_angles.pkl
    │   ├── label_encoder.pkl
    │   └── training_metadata.json
    ├── docs/
    │   ├── accuracy_curve.png
    │   ├── classification_report.txt
    │   ├── cleanup_report.md
    │   ├── confusion_matrix.png
    │   ├── final_audit_report.md
    │   ├── loss_curve.png
    │   ├── original_README.md
    │   ├── rep_counter_report.md
    │   └── test_report.md
    ├── inference/
    │   ├── angle_features.py
    │   ├── main.py
    │   ├── app/
    │   │   ├── __init__.py
    │   │   ├── api.py
    │   │   ├── schemas.py
    │   │   ├── core/
    │   │   │   ├── __init__.py
    │   │   │   └── config.py        (shim → ../../../config.py)
    │   │   └── services/
    │   │       ├── __init__.py
    │   │       ├── classifier.py
    │   │       ├── exercise_catalog.py
    │   │       ├── pose.py
    │   │       ├── rep_counter.py
    │   │       └── sessions.py
    │   └── tests/
    │       ├── __init__.py
    │       ├── test_api.py
    │       ├── test_classifier.py
    │       └── test_rep_counter.py
    ├── models/
    │   └── exercise_classifier_22ex.keras
    └── training/
        ├── environment.yml
        ├── train_classifier_22ex.py
        └── scripts/
            ├── replay_frame_pipeline.py
            ├── run_replay.sh
            ├── run_validate.sh
            └── validate_rep_counters.py
```

## Runtime entrypoints

| Mode | Command (from `ai/exercise_recognition/`) | Notes |
|---|---|---|
| Inference API | `uvicorn app.api:app --host 0.0.0.0 --port 8000` (run from `inference/`) | Loads model + artifacts via `config.py`. No dataset access. |
| Direct script | `python inference/main.py` | Equivalent — calls uvicorn on `app.api:app`. |
| Training | `python training/train_classifier_22ex.py [--dataset-dir … --model-dir …]` | Opt-in only. Touches dataset. |
| Rep counter validation | `bash training/scripts/run_validate.sh` | Replays dataset windows through `RepCounter`. |
| Frame pipeline replay | `bash training/scripts/run_replay.sh` | E2E replay against a running API. |
| Tests | `pytest inference/tests/` | Skip dataset-dependent tests gracefully when dataset absent. |

## Missing dependencies

None introduced by the migration. The module's runtime + training dependencies
are listed in `requirements.txt` and `training/environment.yml`. Notable
production requirements (must be installable in Dietin's venv before serving):

* `tensorflow` (2.x) — BiLSTM inference
* `mediapipe` — pose extraction
* `opencv-python` — frame decode/encode
* `fastapi`, `uvicorn` — HTTP layer
* `joblib`, `scikit-learn`, `numpy` — scaler/encoder + feature ops

Recommendation: install via `pip install -r ai/exercise_recognition/requirements.txt`
inside Dietin's existing Python environment, or keep a dedicated venv for the
exercise module. (Per the existing memory, the working venv on this machine is
`exercise_model/venv`.)

## Verification not run

The unified config is wired and all moved files have their imports updated, but
end-to-end smoke tests (uvicorn boot, model load via `config.py`, pytest run)
were not executed during this migration — sandbox restrictions blocked Python
exec. Suggested verification on first run:

```bash
cd Dietin/ai/exercise_recognition
python -c "from config import get_settings, MODEL_PATH, SCALER_PATH, LABEL_ENCODER_PATH; \
           print('OK', MODEL_PATH.exists(), SCALER_PATH.exists(), LABEL_ENCODER_PATH.exists())"
cd inference && uvicorn app.api:app --port 8000      # confirms model load
pytest tests/                                         # confirms behavior unchanged
```

## What was explicitly NOT done

* No model weights were modified.
* No training was re-run.
* No classifier, rep counter, pose, or API logic was edited beyond import-path rewires.
* No frontend files were touched.
* `app/services/classifier.py` was left intact; the legacy duplicate at
  `exercise_classifier.py` was deleted instead.
