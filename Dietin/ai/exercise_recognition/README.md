# Exercise Recognition Module

Real-time exercise classification + rep counting for Dietin. Webcam frames in,
classification + rep metrics out. The model and artifacts are immutable — this
module only provides the inference runtime, training scripts, and the
configuration glue around them.

## Folder layout

```
ai/
├── exercise_recognition/
│   ├── config.py           # single source of truth for all paths
│   ├── requirements.txt
│   ├── models/             # .keras weights (production)
│   ├── artifacts/          # scaler, label encoder, training metadata, class weights
│   ├── inference/          # FastAPI app, MediaPipe pose, rep counters
│   │   ├── main.py
│   │   ├── angle_features.py
│   │   ├── app/
│   │   │   ├── api.py
│   │   │   ├── schemas.py
│   │   │   ├── core/config.py        # shim → ai/exercise_recognition/config.py
│   │   │   └── services/
│   │   │       ├── classifier.py
│   │   │       ├── pose.py
│   │   │       ├── rep_counter.py
│   │   │       ├── sessions.py
│   │   │       └── exercise_catalog.py
│   │   └── tests/
│   ├── training/           # train + validate scripts (only run on demand)
│   │   ├── train_classifier_22ex.py
│   │   ├── environment.yml
│   │   └── scripts/
│   └── docs/               # reports, plots, original README
└── dataset/                # MediaPipe landmark data — training only
    ├── landmarks/
    ├── metadata/
    ├── windows/
    └── reports/
```

## Architecture

| Layer | Stack |
|---|---|
| API | FastAPI + Uvicorn |
| Vision | MediaPipe Pose (33 landmarks) |
| Classifier | 2-layer Bidirectional LSTM (TensorFlow / Keras) |
| Feature extraction | 132 raw landmarks + 8 biomechanical 3D joint angles |
| Rep counting | Per-exercise joint-angle / position state machines |

```
Webcam frame
  → MediaPipe pose (33 keypoints × xyzv)
  → angle_features.extract_features  (132 raw + 8 angles = 140)
  → 45-frame sliding window
  → BiLSTM classifier (22 classes)
  → confidence + majority-vote stabilization
  → RepCounter (per-exercise) updates session metrics
```

## Model

* **Type:** stacked Bidirectional LSTM (128 → 64) + Dense (128 → 64 → 22) with
  BatchNorm and dropout. Output: 22-class softmax.
* **File:** `models/exercise_classifier_22ex.keras`
* **Test accuracy:** 86.31% (top-1), 98.72% (top-5).
* **Stabilization:** 10-frame majority vote with a 0.80 confidence floor before
  switching the active exercise.

## Input format

* Per frame: 33 MediaPipe landmarks × (x, y, z, visibility) = 132 raw + 8
  biomechanical angles → **140 features**.
* Per inference call: window of **45 consecutive frames** → tensor shape
  `(1, 45, 140)`, scaled with `feature_scaler_angles.pkl`.

## Output classes (22)

`barbell_biceps_curl`, `bench_press`, `chest_fly_machine`, `deadlift`,
`decline_bench_press`, `hammer_curl`, `hip_thrust`, `incline_bench_press`,
`lat_pulldown`, `lateral_raise`, `leg_extension`, `leg_raises`, `plank`,
`pull_up`, `push_up`, `romanian_deadlift`, `russian_twist`, `shoulder_press`,
`squat`, `t_bar_row`, `tricep_dips`, `tricep_pushdown`.

Canonical mapping is stored in `artifacts/label_encoder.pkl` and exposed via
`/api/exercises`.

## Inference flow

1. Client `POST /api/session/start` with target exercise / sets / reps.
2. Client streams base64 JPEG frames to `POST /api/frame { session_id, image }`.
3. Backend:
   * decodes the frame,
   * runs MediaPipe pose,
   * extracts 140-dim feature vector,
   * pushes onto the session's 45-frame ring buffer,
   * runs the BiLSTM when the buffer is full,
   * updates the session classification and per-exercise rep counter,
   * returns `{ pose_detected, classification, metrics, feedback, annotated_frame? }`.
4. Client `POST /api/session/end` to close the session and read final metrics.

## Required artifacts (production runtime)

| Path | Purpose |
|---|---|
| `models/exercise_classifier_22ex.keras` | Trained BiLSTM weights + arch |
| `artifacts/feature_scaler_angles.pkl` | `sklearn` StandardScaler for 140-dim features |
| `artifacts/label_encoder.pkl` | `sklearn` LabelEncoder for 22 class strings |
| `artifacts/training_metadata.json` | Frozen training hyperparameters / class list |
| `artifacts/class_weights.json` | Imbalance weights used at training time |

Dataset under `ai/dataset/` is **not loaded** by the inference runtime; only
training/validation scripts touch it.

## Configuration

All paths live in `config.py` — there is no other source. Inference reads them
through the shim at `inference/app/core/config.py`, and training scripts import
them directly. Move the module and everything follows.

## Run

```bash
# Inference server (production)
cd ai/exercise_recognition/inference
pip install -r ../requirements.txt
uvicorn app.api:app --host 0.0.0.0 --port 8000
```

The training scripts under `training/` are explicit, opt-in entrypoints — they
are never imported by the runtime.
