# Repository Cleanup Report

Generated as part of the graduation-demo readiness sprint.

This report enumerates every file that was identified as legacy, unused, or
non-production. Items marked **safe to delete = yes** were removed or moved out
of the project root; items marked **safe to delete = no** are required at
runtime.

## Action key

| Action | Meaning |
|---|---|
| `archive` | Moved to `archive/` for reproducibility; not deleted. |
| `delete` | Permanently removed from the working tree. |
| `keep` | Stays — currently used. |
| `gitignore` | Removed from tracking; added to `.gitignore`. |

## Files Audited

| Path | Reason | Action | Safe to delete? |
|---|---|---|---|
| `final_forthesis_bidirectionallstm_and_encoders_exercise_classifier_model.h5` | Legacy 4-class BiLSTM weights. Replaced by `models/exercise_classifier_22ex.keras`. | archive → `archive/legacy_4class_model/` | yes (kept for thesis reproducibility) |
| `thesis_bidirectionallstm_label_encoder.pkl` | Legacy 4-class label encoder. | archive → `archive/legacy_4class_model/` | yes |
| `thesis_bidirectionallstm_scaler.pkl` | Legacy 4-class feature scaler. | archive → `archive/legacy_4class_model/` | yes |
| `AiTrainer_utils.py` | Streamlit-era helper utilities; not imported by `app/` or any current entrypoint. Already removed in working tree. | delete (commit the existing removal) | yes |
| `ExerciseAiTrainer.py` | Streamlit-era trainer UI; superseded by `app/` + React frontend. Already removed in working tree. | delete | yes |
| `PoseModule2.py` | Old MediaPipe wrapper; replaced by `app/services/pose.py`. Already removed in working tree. | delete | yes |
| `chatbot.py` | OpenAI/LangChain coach chatbot — explicitly out of scope per README. Already removed in working tree. | delete | yes |
| `create_sequence_of_features.py` | One-off training-data prep script for the legacy 4-class pipeline. Already removed in working tree. | delete | yes |
| `extract_features.py` | Legacy feature extractor; replaced by `angle_features.py` (140-D representation). Already removed in working tree. | delete | yes |
| `train_bidirectionallstm.py` | Trainer for the legacy 4-class model. Replaced by `train_classifier_22ex.py`. Already removed in working tree. | delete | yes |
| `demo_2.mp4` | Demo video tied to the legacy 4-class flow; not referenced anywhere. Already removed in working tree. | delete | yes |
| `shoulder_press_form.mp4` | Same — legacy demo asset. Already removed in working tree. | delete | yes |
| `packages.txt` | Streamlit-era system-packages list. No longer relevant. Already removed in working tree. | delete | yes |
| `backend.log` | Local runtime log; not source. | gitignore (do not commit) | yes |
| `__pycache__/` (every level) | Python bytecode cache. | gitignore | yes |
| `frontend/node_modules/` | Node dependencies; reproducible from `package-lock.json`. | gitignore | yes |
| `frontend/vite.log` | Local log; not source. | gitignore | yes |
| `models/smoke_test/` | Smoke-test artifacts from short `--quick-test` runs of `train_classifier_22ex.py`. Not used at inference. | archive → `archive/smoke_test/` (Phase 6) | yes |
| `models/confusion_matrix_raw.json` | Numeric companion to `confusion_matrix_raw.png`; useful for reports but not loaded by the app. | keep | n/a (documentation artifact) |
| `models/confusion_matrix_normalized.json` | Same as above. | keep | n/a |
| `models/exercise_classifier_22ex.keras` | **Active** production model. | keep | **no** |
| `models/feature_scaler_angles.pkl` | **Active** scaler used by `app/services/classifier.py`. | keep | **no** |
| `models/label_encoder.pkl` | **Active** label encoder. | keep | **no** |
| `models/training_metadata.json`, `class_weights.json`, `class_distribution.json` | Documentation; loaded by training, not by inference. | keep | n/a |
| `models/classification_report.txt`, `training_report.md`, `*_curve.png`, `confusion_matrix*.png`, `training_log.csv`, `training_history.json`, `data_validation_summary.json` | Documentation. | keep | n/a |
| `app/`, `frontend/src/`, `main.py`, `angle_features.py`, `exercise_classifier.py`, `train_classifier_22ex.py`, `requirements.txt`, `environment.yml` | Active source. | keep | **no** |

## Mock-data / legacy-alias audit

Searched (case-insensitive, all source extensions):

```bash
grep -rn -E "mockData|mockExercises|AUTO_EXERCISE|AUTO_EXERCISE_ID|bicep_curl alias|legacy exercise" \
  --include='*.py' --include='*.ts' --include='*.tsx' --include='*.json' .
```

Result: **no remaining references** in Python or TypeScript sources. The only
hits were in `README.md` (descriptive text about the old 4-class model), which
is replaced in Phase 5.

Legacy artifact-name search:

```bash
grep -rn -E "final_forthesis|thesis_bidirectionallstm" \
  --include='*.py' --include='*.ts' --include='*.tsx' .
```

Result: **no source references** — only `README.md`, which Phase 5 rewrites.

## Outcome

- 3 legacy `.h5` / `.pkl` files moved to `archive/legacy_4class_model/`.
- 10 already-deleted legacy Python and media files committed as removed.
- `.gitignore` added so caches/logs/build outputs stop polluting commits.
- No source files reference the legacy artifacts after the move.
