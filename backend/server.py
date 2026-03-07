"""
SprintLab Pose Backend
POST /infer/video — multipart upload, SSE progress, compact response
"""

import tempfile, os, json, cv2, numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from rtmlib import BodyWithFeet

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

body = BodyWithFeet(to_openpose=False, backend='onnxruntime', device='cpu')
body(np.zeros((64, 64, 3), dtype=np.uint8))  # warmup

INFER_WIDTH = 640  # resize long edge to this before inference — matches rtmlib's internal target

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/infer/video")
async def infer_video(file: UploadFile = File(...)):
    ct = file.content_type or ""
    ext_map = {"video/mp4": ".mp4", "video/webm": ".webm",
               "video/quicktime": ".mov", "video/x-msvideo": ".avi", "video/x-matroska": ".mkv"}
    suffix = ext_map.get(ct, ".mp4")

    raw = await file.read()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(raw); tmp_path = f.name

    def generate():
        try:
            cap          = cv2.VideoCapture(tmp_path)
            fps          = cap.get(cv2.CAP_PROP_FPS)
            frame_width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total        = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            # Compute resize scale so long edge == INFER_WIDTH
            scale     = INFER_WIDTH / max(frame_width, frame_height)
            infer_w   = int(frame_width  * scale)
            infer_h   = int(frame_height * scale)
            # Make dims even (some codecs require it)
            infer_w  += infer_w % 2
            infer_h  += infer_h % 2

            frames       = []
            frame_idx    = 0
            last_flat    = []

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # Resize for inference speed
                small = cv2.resize(frame, (infer_w, infer_h), interpolation=cv2.INTER_LINEAR)
                keypoints, scores = body(small)

                if keypoints is not None and len(keypoints) > 0:
                    kps = keypoints[0]
                    sc  = scores[0]
                    # Scale keypoints back to original frame pixel space
                    flat = []
                    for (x, y), s in zip(kps, sc):
                        flat.extend([
                            round(float(x) / scale, 2),
                            round(float(y) / scale, 2),
                            round(float(s), 3)
                        ])
                    last_flat = flat
                else:
                    flat = last_flat  # carry forward if detection fails

                frames.append(flat)
                frame_idx += 1

                if frame_idx % 10 == 0 or frame_idx == total:
                    pct = round(frame_idx / total * 100) if total > 0 else 0
                    yield f"data: {json.dumps({'type':'progress','frame':frame_idx,'total':total,'pct':pct})}\n\n"

            cap.release()

            # Send total_frames as the ground truth — frontend should use this
            yield f"data: {json.dumps({'type':'result','fps':fps,'frame_width':frame_width,'frame_height':frame_height,'total_frames':frame_idx,'frames':frames})}\n\n"

        finally:
            os.unlink(tmp_path)

    return StreamingResponse(generate(), media_type="text/event-stream")