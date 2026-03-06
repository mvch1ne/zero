// ─── Pose Overlay Canvas ────────────────────────────────────────────────────
// Sits on Layer 1 inside the transform wrapper.
// Draws skeleton + landmarks on every frame via rAF.
// Accepts a visibility map and hover-labels toggle from parent.

import { useEffect, useRef, useCallback } from 'react';
import type { NormalizedLandmark, PoseResult } from './usePoseLandmarker';
import { LANDMARKS, CONNECTIONS, REGION_COLORS } from './poseConfig';

interface Props {
  result: PoseResult | null;
  visibilityMap: Record<number, boolean>;
  showLabels: boolean;
  transform: { scale: number; x: number; y: number };
}

const VISIBILITY_THRESHOLD = 0.5;
const DOT_RADIUS = 4;
const LINE_WIDTH = 1.5;

export const PoseOverlay = ({
  result,
  visibilityMap,
  showLabels,
  transform,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  const normToCanvas = useCallback(
    (nx: number, ny: number, w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      return {
        x: (nx * w - cx) * transform.scale + cx + transform.x,
        y: (ny * h - cy) * transform.scale + cy + transform.y,
      };
    },
    [transform],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);
    ctx.clearRect(0, 0, w, h);

    if (!result || result.landmarks.length === 0) return;
    const landmarks: NormalizedLandmark[] = result.landmarks[0]; // first person only

    // Lookup for quick access
    const lmMap = new Map(LANDMARKS.map((l) => [l.index, l]));

    const isVisible = (idx: number): boolean => {
      if (!visibilityMap[idx]) return false;
      const lm = landmarks[idx];
      if (!lm) return false;
      if ((lm.visibility ?? 1) < VISIBILITY_THRESHOLD) return false;
      return true;
    };

    // ── Draw connections ──────────────────────────────────────────────────
    for (const [a, b] of CONNECTIONS) {
      if (!isVisible(a) || !isVisible(b)) continue;
      const pa = normToCanvas(landmarks[a].x, landmarks[a].y, w, h);
      const pb = normToCanvas(landmarks[b].x, landmarks[b].y, w, h);
      // Color by the "more distal" landmark's region
      const regionA = lmMap.get(a)?.region ?? 'upper';
      const regionB = lmMap.get(b)?.region ?? 'upper';
      const color = REGION_COLORS[regionA === regionB ? regionA : regionB];

      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = color + 'aa'; // semi-transparent
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    }

    // ── Draw dots ─────────────────────────────────────────────────────────
    for (const lmDef of LANDMARKS) {
      if (!isVisible(lmDef.index)) continue;
      const lm = landmarks[lmDef.index];
      const { x, y } = normToCanvas(lm.x, lm.y, w, h);
      const color = REGION_COLORS[lmDef.region];

      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── Hover labels ──────────────────────────────────────────────────────
    if (showLabels && mousePosRef.current) {
      const { x: mx, y: my } = mousePosRef.current;
      const HOVER_RADIUS = 20;
      let closest: {
        dist: number;
        label: string;
        x: number;
        y: number;
      } | null = null;

      for (const lmDef of LANDMARKS) {
        if (!isVisible(lmDef.index)) continue;
        const lm = landmarks[lmDef.index];
        const { x, y } = normToCanvas(lm.x, lm.y, w, h);
        const dist = Math.hypot(x - mx, y - my);
        if (dist < HOVER_RADIUS && (!closest || dist < closest.dist)) {
          closest = { dist, label: lmDef.name, x, y };
        }
      }

      if (closest) {
        const pad = { x: 5, y: 3 };
        ctx.font = '10px "DM Mono", monospace';
        const tw = ctx.measureText(closest.label).width;
        const bx = closest.x + 10;
        const by = closest.y - 7;
        ctx.fillStyle = 'rgba(9,9,11,0.88)';
        ctx.fillRect(bx - pad.x, by - pad.y, tw + pad.x * 2, 14 + pad.y * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - pad.x, by - pad.y, tw + pad.x * 2, 14 + pad.y * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(closest.label, bx, by + 7);
      }
    }
  }, [result, visibilityMap, showLabels, normToCanvas]);

  // Re-draw whenever inputs change
  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    draw();
  };

  const handleMouseLeave = () => {
    mousePosRef.current = null;
    draw();
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      onMouseMove={showLabels ? handleMouseMove : undefined}
      onMouseLeave={showLabels ? handleMouseLeave : undefined}
    />
  );
};
