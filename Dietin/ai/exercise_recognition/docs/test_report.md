# Automated Test Report

| Suite | Tests | Status |
|---|---:|---|
| `tests/test_classifier.py` | 6 | ✅ pass |
| `tests/test_rep_counter.py` | 24 | ✅ pass |
| `tests/test_api.py` | 5 | ✅ pass |
| **Total** | **35** | **✅ pass** |

Wall-clock: ~21 s on macOS Darwin 24.6.0, Python 3.11.0.

## How to run

```bash
python3 -m pip install pytest httpx
python3 -m pytest tests/
```

Or one-suite-at-a-time:

```bash
python3 -m pytest tests/test_classifier.py -v
python3 -m pytest tests/test_rep_counter.py -v
python3 -m pytest tests/test_api.py -v
```

## Coverage

The tests are **behavioral**, not synthetic. Every test that needs a pose
sample loads a real `.npy` window from `dataset/windows/win45_angles/` and
replays it through the production code path.

### `test_classifier.py`

| # | Test | What it verifies |
|---:|---|---|
| 1 | `test_classifier_loads` | `model.keras`, `feature_scaler_angles.pkl`, `label_encoder.pkl` all load and 22 classes are present. |
| 2 | `test_inference_returns_classification` | A 45-frame real squat window through `ExerciseClassifier.predict` returns a `Classification` with `ready=True`, valid `confidence`, non-null `raw_label` and `exercise`. |
| 3 | `test_recognized_on_real_window[squat]` | One real squat window decodes through the full pipeline. |
| 4 | `test_recognized_on_real_window[push_up]` | Same for push_up. |
| 5 | `test_recognized_on_real_window[plank]` | Same for plank. |
| 6 | `test_recognized_on_real_window[lateral_raise]` | Same for lateral_raise. |

The four parametrized recognition tests don't require an exact label match —
single-window classifier accuracy is 86.31% per the training report, so a
sibling-class hit on a borderline window is acceptable. They assert the
classifier produced a label from its known vocabulary, which is the contract
the rest of the system depends on.

### `test_rep_counter.py`

| # | Test | What it verifies |
|---:|---|---|
| 1 | `test_all_22_classes_have_handlers` | Every classifier label is registered in `RepCounter`. |
| 2 | `test_plank_is_an_isometric_hold` | Plank counter returns 0 reps but enters the `"hold"` stage. |
| 3 | `test_unknown_exercise_is_unsupported` | An unknown exercise name surfaces `supported=False`. |
| 4–24 | `test_counter_increments_on_real_data[<class>]` | Each of the other 21 classes counts at least one rep when ~10 real `.npy` files are replayed through the counter. Covers: `barbell_biceps_curl`, `bench_press`, `chest_fly_machine`, `deadlift`, `decline_bench_press`, `hammer_curl`, `hip_thrust`, `incline_bench_press`, `lat_pulldown`, `lateral_raise`, `leg_extension`, `leg_raises`, `pull_up`, `push_up`, `romanian_deadlift`, `russian_twist`, `shoulder_press`, `squat`, `t_bar_row`, `tricep_dips`, `tricep_pushdown`. |

### `test_api.py`

| # | Test | What it verifies |
|---:|---|---|
| 1 | `test_health` | `GET /api/health` returns 200 with the required spec shape (`status`, `classifier_loaded`, `model_version`, `num_classes`). |
| 2 | `test_exercises_catalog` | `GET /api/exercises` returns the 22-entry catalog when the classifier is loaded. |
| 3 | `test_session_lifecycle` | `POST /api/session/start` → `GET /api/session/status` → `POST /api/session/end` round-trip is intact and `active=false` after end. |
| 4 | `test_missing_session_returns_404` | Status for an unknown session id is a 404. |
| 5 | `test_frame_pipeline_responds` | `POST /api/frame` with a synthetic JPEG returns 200 (or 503 on a host without the classifier) and includes `metrics` + `classification`. |

The API suite uses FastAPI's `TestClient`, so the backend does not need to be
running separately to exercise these tests.

## Skip conditions

Tests skip (don't fail) when:

* The dataset window directory is missing (`dataset/windows/win45_angles/<class>/`).
* The trained `.keras`/`.pkl` artifacts are missing.
* OpenCV is not installed (only affects `test_api.py::test_frame_pipeline_responds`).

This keeps the suite green on fresh checkouts that don't include the
multi-GB dataset.

## Warnings

None as of the last run. The earlier `on_event is deprecated` warning was
resolved by moving startup logging into a FastAPI `lifespan` handler.
