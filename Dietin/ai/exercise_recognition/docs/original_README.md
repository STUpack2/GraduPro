# AI Fitness Coaching App

Real-time, webcam-only fitness coaching. The browser streams frames to a FastAPI
backend, which runs MediaPipe pose detection, a 22-class BiLSTM exercise
classifier, and per-exercise rep counting, and returns metrics + an annotated
frame to the React UI.

```
Webcam
  → MediaPipe (33 keypoints)
  → Feature Extraction (132 raw + 8 biomechanical angles)
  → BiLSTM Classification (22 classes)
  → Rep Counting
  → Workout Tracking
```

---

## Architecture

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind, Zustand |
| Backend | FastAPI, Uvicorn, Pydantic |
| Vision | MediaPipe Pose (33 landmarks) |
| Model | TensorFlow / Keras 2-layer Bidirectional LSTM |
| Inference | Per-session 45-frame sliding window, majority-vote stabilization |

```mermaid
flowchart LR
    A[Browser Webcam] --> B[POST /api/frame]
    B --> C[MediaPipe Pose]
    C --> D[Feature Extraction<br/>132 + 8]
    D --> E[BiLSTM Classifier<br/>22 classes]
    E --> F[Rep Counter Registry]
    F --> G[Session Metrics]
    G --> H[React UI Cards]
```

### Model at a glance

* Input: window of 45 frames × 140 features.
* Features: 33 MediaPipe landmarks × (x, y, z, visibility) = 132, plus 8
  biomechanical 3D joint angles.
* Architecture: stacked Bidirectional LSTM (128 → 64) + Dense(128 → 64 → 22)
  with BatchNorm and heavy dropout.
* Test accuracy: 86.31%, top-5: 98.72%.
* Stabilization: 10-frame majority vote + 0.80 confidence floor before
  switching exercises.

Full numbers live in `models/training_report.md` and
`models/training_metadata.json`. The active model and assets:

```
models/
├── exercise_classifier_22ex.keras
├── feature_scaler_angles.pkl
└── label_encoder.pkl
```

---

## Supported Exercises (22)

`barbell_biceps_curl`, `bench_press`, `chest_fly_machine`, `deadlift`,
`decline_bench_press`, `hammer_curl`, `hip_thrust`, `incline_bench_press`,
`lat_pulldown`, `lateral_raise`, `leg_extension`, `leg_raises`, `plank`,
`pull_up`, `push_up`, `romanian_deadlift`, `russian_twist`, `shoulder_press`,
`squat`, `t_bar_row`, `tricep_dips`, `tricep_pushdown`.

Every class has a registered rep counter wired through
`app/services/rep_counter.py`. Coverage and per-exercise validation are
documented in `rep_counter_report.md` and `counter_validation.csv`.

---

## Setup

### Prerequisites

* Python 3.10 or 3.11
* Node 20+
* macOS, Linux, or WSL

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Quick smoke test:

```bash
curl http://localhost:8000/api/health
```

OpenAPI / Swagger:

* http://localhost:8000/docs
* http://localhost:8000/redoc

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open the URL Vite prints (defaults to http://localhost:5173). The Vite
dev server proxies `/api/*` to `http://localhost:8000`. Use a different
backend with:

```bash
VITE_API_BASE_URL=http://your-backend-url npm run dev
```

### Training (optional)

If you want to retrain the 22-class model from the precomputed windows in
`dataset/windows/win45_angles/`:

```bash
python3 train_classifier_22ex.py \
  --dataset-dir ../dataset/windows/win45_angles \
  --metadata-classes ../dataset/metadata/classes.json \
  --model-dir models \
  --epochs 100
```

Add `--quick-test` for a 2-epoch smoke run.

### Inference (programmatic)

```python
from exercise_classifier import ExerciseClassifier

clf = ExerciseClassifier()
result = clf.add_landmarks(landmarks_33x4)  # MediaPipe pose landmarks
print(result["exercise"], result["confidence"])
```

---

## API

All endpoints are JSON in / JSON out.

### `GET /api/health`

Liveness and readiness probe.

```json
{
  "status": "healthy",
  "classifier_loaded": true,
  "model_version": "22ex_bilstm_v1",
  "num_classes": 22,
  "supported_exercises": ["barbell_biceps_curl", "..."]
}
```

`status` is `"degraded"` when the classifier failed to load; an additional
`classifier_error` string is returned in that case. The route always returns
200.

### `GET /api/exercises`

The 22-entry exercise catalog used by the React library. Returned ids match
`label_encoder.classes_` exactly.

### `POST /api/session/start`

```json
{ "exercise": "squat", "sets": 4, "target_reps": 12, "rest_timer": 60 }
```

Response includes a fresh `session_id`, the current `metrics`, and the
`supported_exercises` set. `exercise` is optional — live classification will
override the initial hint as soon as a stable prediction lands.

### `POST /api/frame`

```json
{
  "session_id": "abc123",
  "image": "data:image/jpeg;base64,...",
  "return_annotated_frame": true
}
```

Returns:

```json
{
  "session_id": "abc123",
  "pose_detected": true,
  "classification": {
    "exercise": "squat",
    "confidence": 0.94,
    "ready": true,
    "stable_prediction": true,
    "raw_label": "squat",
    "message": null
  },
  "metrics": {
    "exercise": "squat",
    "sets": 4,
    "target_reps": 12,
    "completed_reps": 9,
    "current_set": 2,
    "rest_timer": 60,
    "rest_remaining": 0,
    "total_reps": 21,
    "active": true,
    "session_complete": false,
    "exercise_totals": {"squat": 21}
  },
  "feedback": ["Tracking workout."],
  "annotated_frame": "data:image/jpeg;base64,..."
}
```

### `GET /api/session/status?session_id=...`

Latest metrics + classification + session timing.

### `POST /api/session/end`

```json
{ "session_id": "abc123" }
```

Marks the session inactive; later `GET /api/session/status` calls still work.

---

## Repository Layout

```
.
├── app/
│   ├── api.py                       # FastAPI routes
│   ├── schemas.py                   # Pydantic request/response models
│   ├── core/config.py               # Paths, thresholds, CORS
│   └── services/
│       ├── pose.py                  # MediaPipe pose detection + frame I/O
│       ├── classifier.py            # 22-class BiLSTM service + stabilization
│       ├── rep_counter.py           # Per-exercise counter registry (22 of 22)
│       ├── sessions.py              # Workout session lifecycle and metrics
│       └── exercise_catalog.py      # Display metadata for the 22 classes
├── frontend/                        # React + Vite UI
├── models/                          # Active production artifacts
├── scripts/
│   └── validate_rep_counters.py     # Replays real windows through counters
├── archive/
│   └── legacy_4class_model/         # Old 4-class artifacts (unused, kept for thesis)
├── dataset/                         # win45_angles windows + metadata (parent dir)
├── angle_features.py                # 140-D feature extractor (shared)
├── exercise_classifier.py           # Standalone inference wrapper
├── train_classifier_22ex.py         # Training pipeline
├── main.py                          # FastAPI entrypoint
├── cleanup_report.md
├── rep_counter_report.md
├── counter_validation.csv
└── README.md
```

---

## Screenshots

_(placeholders — capture during demo)_

```
docs/screenshots/library.png       # Exercise library
docs/screenshots/config.png        # Set / rep / rest configuration
docs/screenshots/workout.png       # Live workout with skeleton + cards
docs/screenshots/finished.png      # Completed workout summary
```

Drop the images at the paths above and they will render here once the file
list is updated.

---

## Live UI Behavior

The webcam panel shows **only** the camera feed plus the MediaPipe pose
skeleton. All metrics — exercise name, current set, current rep, confidence,
total reps, status, coach feedback — live in React cards beside the video.
No text or numeric overlays are drawn on the video feed itself.

---

## Notes

* The backend never accepts uploaded video files; only individual base64 frames
  via `POST /api/frame`.
* No OpenAI key or chatbot dependency is required — those were removed during
  the production cleanup.
* The classifier is loaded once at startup. If `GET /api/health` reports
  `classifier_loaded: false`, check that TensorFlow can load the `.keras`
  model and that the scaler and label encoder are present in `models/`.
* The legacy 4-class model (`final_forthesis_*`, `thesis_bidirectionallstm_*`)
  has been archived under `archive/legacy_4class_model/` and is not used at
  runtime. See `archive/legacy_4class_model/README.md` for restore
  instructions.
