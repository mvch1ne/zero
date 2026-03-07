# SprintLab Pose Backend

FastAPI server wrapping [rtmlib](https://github.com/Tau-J/rtmlib) for per-frame pose estimation on sprint video.

---

## Model choices

### rtmlib + RTMPose

rtmlib is a lightweight inference wrapper around MMPose's RTMPose models. It runs on **ONNX Runtime** with no dependency on PyTorch or MMPose — just `pip install rtmlib`.

### BodyWithFeet (26 keypoints)

We use the `BodyWithFeet` preset, which is the COCO-17 body skeleton extended with 9 WholeBody foot keypoints. This gives us:

| Region | Keypoints                            |
| ------ | ------------------------------------ |
| Face   | Nose, eyes, ears                     |
| Upper  | Shoulders, elbows, wrists            |
| Core   | Left/right hip                       |
| Lower  | Knees, ankles                        |
| Feet   | Big toe, small toe, heel (both feet) |

For sprint analysis the feet keypoints (ankle → heel → big toe) are the most valuable — they track ground contact and toe-off with frame-level precision.

### Key settings

- `to_openpose=False` — uses MMPose-style keypoint ordering (index 0 = nose)
- `backend='onnxruntime'` — no GPU required, runs on CPU
- `device='cpu'`

---

## Architecture

The server processes the **entire video at once** rather than frame-by-frame on demand. This is the same approach rtmlib uses in its own demo scripts — read every frame, run inference, collect results. The frontend stores all keypoints in a `Map<frameNumber, Keypoint[]>` and does a simple lookup during playback.

**Why not per-frame on demand?**
Sending one HTTP request per frame during playback would be far too slow and would never stay in sync. Processing upfront means playback is instant with zero latency.

**Streaming progress**
The endpoint uses **Server-Sent Events (SSE)** to stream progress back to the frontend every 10 frames. The status bar shows live frame counts so the user knows it hasn't hung.

**Inference resize**
Each frame is resized so its long edge is 640px before being passed to rtmlib. This matches rtmlib's internal target resolution, so accuracy is unchanged but Python-side overhead is significantly reduced.

**Response format**
Keypoints are returned as compact flat arrays `[x, y, score, x, y, score, ...]` per frame rather than dicts. This is ~3× smaller and faster to serialize/parse than `[{x, y, score}, ...]`.

---

## Installation

### 1. Create a virtual environment

```bash
cd backend
python -m venv venv
```

Activate it:

```bash
# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

`requirements.txt` includes:

- `fastapi`
- `uvicorn[standard]`
- `python-multipart` — required for file upload
- `rtmlib` — downloads ONNX models on first run
- `opencv-python-headless`
- `numpy`

Raw Text:
fastapi
uvicorn[standard]
python-multipart
rtmlib
opencv-python-headless
numpy

> **First run note:** rtmlib will download the RTMPose ONNX model weights automatically on the first inference call. This happens once and is cached locally.

---

## Running the server

```bash
uvicorn server:app --port 8080 --reload
```

- `--reload` watches for file changes (remove in production)
- Default port is `8080` — set `VITE_POSE_BACKEND_URL=http://localhost:8080` in your frontend `.env` if needed

Check it's alive:

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

---

## API

### `GET /health`

Liveness check. Returns `{"status": "ok"}`.

### `POST /infer/video`

Accepts a multipart video file upload. Streams SSE progress events then a final result.

**Request:** `multipart/form-data` with field `file` containing the video (mp4, webm, mov, avi, mkv).

**SSE events:**

```json
// Progress (every 10 frames)
{"type": "progress", "frame": 40, "total": 300, "pct": 13}

// Final result
{
  "type": "result",
  "fps": 60.0,
  "frame_width": 1920,
  "frame_height": 1080,
  "total_frames": 300,
  "frames": [
    [x0, y0, s0, x1, y1, s1, ...],  // frame 0 — 26 keypoints × 3 values
    ...
  ]
}
```

Keypoint index order follows MMPose's BodyWithFeet convention (`to_openpose=False`): 0=Nose, 1=Left Eye, ..., 16=Right Ankle, 17=Left Big Toe, ..., 22=Right Heel.
