# AI Coach — Runbook

How to bring the AI Coach online and verify it end-to-end.

The model + FastAPI server live at `Dietin/ai/exercise_recognition/`. The React
client lives at `Dietin/src/features/ai-coach/` and talks to the server via
`VITE_AI_API_URL` (see `.env.development`).

---

## 1. Start the Python server (one-time setup)

```bash
cd "Dietin/ai/exercise_recognition"

# Fresh venv. Python 3.10 or 3.11 both work with tensorflow 2.16.x.
python3.11 -m venv .venv
source .venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

### Apple Silicon fallback

If `pip install` fails on `tensorflow==2.16.1`, swap to:

```bash
pip install tensorflow-macos==2.16.1 tensorflow-metal
```

(everything else from `requirements.txt` still applies).

### Verify the artifacts load

```bash
python -c "import sys; sys.path.insert(0,'.'); from config import get_settings, MODEL_PATH, SCALER_PATH, LABEL_ENCODER_PATH; \
           s=get_settings(); print('app:', s.app_name); \
           print('model exists:', MODEL_PATH.exists()); \
           print('scaler exists:', SCALER_PATH.exists()); \
           print('encoder exists:', LABEL_ENCODER_PATH.exists())"
```

All three `exists` lines should print `True`.

### Boot the server

```bash
cd inference
uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
```

You should see a startup banner like:

```
============================================================
  Dietin Exercise Recognition API starting up
  Model Loaded:    exercise_classifier_22ex.keras
  Scaler Loaded:   feature_scaler_angles.pkl
  Encoder Loaded:  label_encoder.pkl
  Classifier ready: True
  Classes:         22
  Model version:   22ex_bilstm_v1
============================================================
```

If `Classifier ready: False`, the next line in the banner names the load error.
Common cause: TF/Keras version mismatch on Apple Silicon — see the fallback above.

---

## 2. Smoke-test the server

```bash
curl -s http://localhost:8000/api/health | python -m json.tool
# Expect: {"status":"healthy","classifier_loaded":true,"num_classes":22,...}

curl -s http://localhost:8000/api/exercises | python -m json.tool | head -20
# Expect: list of {id,name,category,target_muscle,difficulty}
```

---

## 3. Start the frontend

In a separate terminal:

```bash
cd Dietin
npm install                                  # only if you haven't yet
npm run dev                                  # or: bun run dev
```

Visit `http://localhost:5173/ai-coach`.

**Expected:**
- The readiness banner shows briefly then disappears (server reachable).
- Camera prompt fires once. Live `<video>` shows your feed.
- Tap "Start" → green status pill → after ~5 s the classification card shows
  an exercise name with a confidence bar.
- Repeat a clear motion (bicep curl, squat) — the rep counter increments.

If `VITE_AI_API_URL` is unset, the page shows the **BackendOfflineEmpty** card
with copy-pasteable commands. Set the env var, restart `npm run dev`, reload.

---

## 4. End-to-end with the Plan flow

1. `/plan` → start a workout with a single exercise (e.g. Squat).
2. Tap **AI Mode** in the exercise card header.
3. The AICoachPanel appears below the sets. Tap **Start**.
4. Do reps in front of the camera.
5. The active set's `reps` field increments in lockstep with the AI's
   `metrics.completed_reps`.
6. Finish the workout. The standard "workout completed" flow runs:
   `setWorkoutHistory` updates localStorage AND
   `progressStore.recordWorkout` shadow-writes to Firestore — see PRs and
   workout analytics light up on `/progress`.

---

## 5. Failure modes & what the UI shows

| Failure | UI |
|---|---|
| `VITE_AI_API_URL` empty | BackendOfflineEmpty card |
| Server unreachable | Rose readiness banner with Retry |
| Server up, model not loaded | Amber readiness banner with Retry |
| Camera permission denied | Black overlay inside the CameraView with "Grant camera permission…" |

---

## 6. Deploying the Python server

Out of scope for now — everything is localhost. When you're ready:

- **Cloud Run** (matches the existing GCP/Firebase footprint):
  - Build a `python:3.10-slim` image with `requirements.txt` baked in.
  - Copy `inference/`, `artifacts/`, `models/`, and `config.py`.
  - Expose port 8000, set memory to ≥1 GiB (TF + MediaPipe load weight).
  - Set `VITE_AI_API_URL` in `.env.production` to the deployed URL.
  - Add a Firebase ID-token auth check in `inference/app/api.py` middleware
    before exposing publicly.
- **Fly.io / Render** are equivalent options.

---

## 7. Notes

- Frame rate is 3 fps (~333 ms). Tune in `useFrameLoop.intervalMs`.
- JPEG quality 0.6 keeps payloads ~25-50 KB.
- Sessions are in-memory only on the server. Restarting `uvicorn` wipes them;
  the frontend handles this gracefully via the readiness banner — user just
  retaps "Start".
