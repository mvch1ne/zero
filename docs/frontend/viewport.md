# Viewport

**File:** `frontend/src/components/dashboard/viewport/Viewport.tsx`

The Viewport is the central orchestrator of the application. It manages video playback, hosts all canvas overlays, triggers pose inference, and publishes computed metrics to `VideoContext` for the Telemetry panel to consume.

## Responsibilities

- **Video loading** — accepts a user-selected file, probes its true FPS using FFmpeg.js (browser metadata is unreliable), and sets up an `<video>` element
- **Playback control** — frame-by-frame stepping, variable speed (1/16×–4×), seek bar, zoom/pan transforms (1×–8×)
- **Pose inference** — invokes `usePoseLandmarker` to POST the video to the backend and receive keypoints
- **Overlay management** — renders `PoseOverlay`, `CalibrationOverlay`, `MeasurementOverlay`, and `CropOverlay` on stacked canvases
- **Manual contact annotation** — lets the user click to place ground contact events that the algorithm missed or got wrong
- **Sprint markers** — frame-accurate start and finish markers for both static and flying timing modes
- **Metric publication** — calls `useSprintMetrics` and writes the result into `VideoContext`
- **Export** — passes video + overlay data to FFmpeg.js for trimmed/cropped MP4 export

## View Modes

The toolbar exposes seven view modes that control how the pose is rendered. The active mode is stored in `viewMode` state and passed as a prop to `PoseOverlay`.

| Mode | Label | Background | Style |
|---|---|---|---|
| `video` | VIDEO | Video | Skeleton line + dot overlay over the video |
| `skeleton` | SKELETON | Dark | Region-coloured bone lines and joint dots |
| `body` | BODY | Dark | Filled ellipses per segment — blue body, green left, cyan right |
| `neon` | NEON | Dark | Two-pass `ctx.shadowBlur` glow — cyan body, lime left, magenta right |
| `grad` | GRAD | Dark | Perpendicular `createLinearGradient` per segment for a cylindrical 3D sheen |
| `analytics` | ANALYTICS | **Video** | Thick coloured lines over the video — blue left, red right, white torso |
| `bio` | BIO | Dark | Bold filled ellipses (1.15× scale, 2.5 px stroke) — amber left, sky right, near-white body |

`analytics` is the only mode that keeps the video visible underneath and does not set `skeletonOnly` on the `VideoLayer`. All other non-video modes render on a `bg-zinc-950` background.

## Overlay Stack

Overlays are absolutely positioned canvases stacked on top of the video:

```
┌─────────────────────────────┐
│  <video>                    │  base layer — playback
├─────────────────────────────┤
│  PoseOverlay (canvas)       │  pose rendering (mode-dependent)
├─────────────────────────────┤
│  CalibrationOverlay (canvas)│  reference line drawing
├─────────────────────────────┤
│  MeasurementOverlay (canvas)│  freehand measurements
├─────────────────────────────┤
│  CropOverlay (canvas)       │  crop region selection
└─────────────────────────────┘
```

Only one overlay is active (interactive) at a time. A mode enum controls which overlay receives pointer events.

## Zoom and Pan

The entire overlay stack is wrapped in a `transform: scale(zoom) translate(panX, panY)` CSS transform. All overlay canvases share the same transform, so they stay aligned regardless of zoom level.

Pointer coordinates from any overlay must be transformed back to video-space coordinates before use:

```typescript
const videoX = (pointerX - panX) / zoom;
const videoY = (pointerY - panY) / zoom;
```

## FPS Probing

Browser `video.duration` and `video.videoWidth/Height` are reliable, but `currentTime` stepping to measure frame rate is not. SprintLab uses FFmpeg.js to probe the container metadata and extract the true frame rate before any analysis begins. This matters for velocity and acceleration calculations — a 10% FPS error produces a 10% error in all angular velocity values.

## Playback Loop

Playback is driven by `requestAnimationFrame`. At each tick:

1. The video's `currentTime` is advanced by `1/fps * speed`
2. The current frame index is computed: `Math.round(currentTime * fps)`
3. `VideoContext.setFrame(frameIdx)` is called
4. All overlays re-render for the new frame

This makes the frame index the single source of truth — the Telemetry panel updates its playhead by reading `VideoContext.frame`.
