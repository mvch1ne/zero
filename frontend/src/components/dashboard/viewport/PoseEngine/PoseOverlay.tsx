// ─── Pose Overlay Canvas ──────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react';
import type { Keypoint } from './usePoseLandmarker';
import type { GroundContactEvent } from '../../useSprintMetrics';
import { LANDMARKS, CONNECTIONS, REGION_COLORS } from './poseConfig';

export type ViewMode = 'video' | 'skeleton' | 'body';

export interface ManualContact {
  id: string;
  foot: 'left' | 'right';
  contactFrame: number;
  contactSite: { x: number; y: number }; // inference-frame pixel coords
}

interface Props {
  keypoints: Keypoint[];
  frameWidth: number;
  frameHeight: number;
  videoNatWidth: number;
  videoNatHeight: number;
  visibilityMap: Record<number, boolean>;
  showLabels: boolean;
  viewMode?: ViewMode;
  // Imperative ref — assign to allow rAF loop to call draw() directly
  // without going through React state (eliminates pose lag at non-1x speeds)
  drawRef?: React.MutableRefObject<((kp: Keypoint[]) => void) | null>;
  groundContacts?: GroundContactEvent[];
  // Annotation mode
  annotateMode?: 'off' | 'left' | 'right';
  currentFrame?: number;
  onAddContact?: (c: ManualContact) => void;
  onMoveContact?: (id: string, site: { x: number; y: number }) => void;
  onDeleteContact?: (id: string) => void;
}

const SCORE_THRESHOLD = 0.43;
const DOT_RADIUS = 4;
const LINE_WIDTH = 1.5;

function letterboxRect(cw: number, ch: number, nw: number, nh: number) {
  if (!nw || !nh) return { left: 0, top: 0, width: cw, height: ch };
  const scale = Math.min(cw / nw, ch / nh);
  const width = nw * scale;
  const height = nh * scale;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}

export const PoseOverlay = ({
  keypoints,
  frameWidth,
  frameHeight,
  videoNatWidth,
  videoNatHeight,
  visibilityMap,
  showLabels,
  viewMode = 'video',
  drawRef,
  groundContacts = [],
  annotateMode = 'off',
  currentFrame = 0,
  onAddContact,
  onMoveContact,
  onDeleteContact,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Keep latest non-keypoint params in refs so the imperative draw fn is
  // always fresh without needing to be recreated
  const frameWidthRef = useRef(frameWidth);
  const frameHeightRef = useRef(frameHeight);
  const natWidthRef = useRef(videoNatWidth);
  const natHeightRef = useRef(videoNatHeight);
  const visibilityMapRef = useRef(visibilityMap);
  const showLabelsRef = useRef(showLabels);
  const viewModeRef = useRef(viewMode);
  const groundContactsRef = useRef(groundContacts);
  const annotateModeRef = useRef(annotateMode);
  const currentFrameRef = useRef(currentFrame);
  const onAddContactRef = useRef(onAddContact);
  const onMoveContactRef = useRef(onMoveContact);
  const onDeleteContactRef = useRef(onDeleteContact);

  // Cached letterbox transform — populated each draw, used by event handlers
  const lbRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const sxRef = useRef(1);
  const syRef = useRef(1);

  // Annotation interaction state
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const tempDragRef = useRef<{ id: string; site: { x: number; y: number } } | null>(null);
  const pendingAddRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { frameWidthRef.current = frameWidth; }, [frameWidth]);
  useEffect(() => { frameHeightRef.current = frameHeight; }, [frameHeight]);
  useEffect(() => { natWidthRef.current = videoNatWidth; }, [videoNatWidth]);
  useEffect(() => { natHeightRef.current = videoNatHeight; }, [videoNatHeight]);
  useEffect(() => { visibilityMapRef.current = visibilityMap; }, [visibilityMap]);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { groundContactsRef.current = groundContacts; }, [groundContacts]);
  useEffect(() => { annotateModeRef.current = annotateMode; }, [annotateMode]);
  useEffect(() => { currentFrameRef.current = currentFrame; }, [currentFrame]);
  useEffect(() => { onAddContactRef.current = onAddContact; }, [onAddContact]);
  useEffect(() => { onMoveContactRef.current = onMoveContact; }, [onMoveContact]);
  useEffect(() => { onDeleteContactRef.current = onDeleteContact; }, [onDeleteContact]);

  // ── Core imperative draw — accepts keypoints directly ────────────────────
  const drawKp = useCallback((kp: Keypoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    if (!cw || !ch) return;
    canvas.width = cw;
    canvas.height = ch;
    ctx.clearRect(0, 0, cw, ch);

    const fw = frameWidthRef.current;
    const fh = frameHeightRef.current;
    if (!kp.length || !fw || !fh) return;

    const lb = letterboxRect(cw, ch, natWidthRef.current, natHeightRef.current);
    const sx = lb.width / fw;
    const sy = lb.height / fh;
    // Cache for event handlers
    lbRef.current = lb;
    sxRef.current = sx;
    syRef.current = sy;

    const toCanvas = (p: Keypoint) => ({
      x: lb.left + p.x * sx,
      y: lb.top + p.y * sy,
    });
    const vm = visibilityMapRef.current;
    const lmMap = new Map(LANDMARKS.map((l) => [l.index, l]));

    const isVisible = (idx: number) => {
      if (!vm[idx]) return false;
      const p = kp[idx];
      return !!p && p.score >= SCORE_THRESHOLD;
    };

    if (viewModeRef.current === 'body') {
      // ── Ralph Mann-style body mode: filled ellipses per segment ────────────
      const get = (idx: number) =>
        isVisible(idx) ? toCanvas(kp[idx]) : null;

      // Filled ellipse along segment pa→pb with half-width hw.
      const seg = (
        pa: { x: number; y: number } | null,
        pb: { x: number; y: number } | null,
        hw: number,
        fill: string,
      ) => {
        if (!pa || !pb) return;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy);
        if (len < 2) return;
        ctx.save();
        ctx.translate((pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.beginPath();
        ctx.ellipse(0, 0, len / 2 + hw * 0.35, hw, 0, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      };

      const lSho = get(5),  rSho = get(6);
      const lElb = get(7),  rElb = get(8);
      const lWri = get(9),  rWri = get(10);
      const lHip = get(11), rHip = get(12);
      const lKne = get(13), rKne = get(14);
      const lAnk = get(15), rAnk = get(16);
      const lToe = get(17), rToe = get(20);
      const lHeel = get(19), rHeel = get(22);
      const nose  = get(0);

      const shoMid = lSho && rSho
        ? { x: (lSho.x + rSho.x) / 2, y: (lSho.y + rSho.y) / 2 }
        : null;
      const hipMid = lHip && rHip
        ? { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 }
        : null;

      // Fully opaque colors — 3D model look. Blue body, teal left leg, cyan right leg.
      const bC = '#3b82f6';   // body — electric blue
      const lC = '#10b981';   // left leg — emerald green
      const rC = '#06b6d4';   // right leg — cyan

      // Right limbs first (visually "behind")
      seg(rHip, rKne,   8, rC);
      seg(rKne, rAnk,   6, rC);
      seg(rHeel, rToe,  3, rC);
      // Right arm (body color)
      seg(rSho, rElb,   6, bC);
      seg(rElb, rWri,   5, bC);

      // Torso
      seg(lSho, rSho,   5, bC);
      seg(lHip, rHip,   5, bC);
      seg(shoMid, hipMid, 11, bC);

      // Left limbs (visually "in front")
      seg(lHip, lKne,   8, lC);
      seg(lKne, lAnk,   6, lC);
      seg(lHeel, lToe,  3, lC);
      // Left arm (body color)
      seg(lSho, lElb,   6, bC);
      seg(lElb, lWri,   5, bC);

      // Hands
      for (const [wri, col] of [[lWri, bC], [rWri, bC]] as const) {
        if (!wri) continue;
        ctx.beginPath();
        ctx.arc(wri.x, wri.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Head
      if (nose) {
        ctx.beginPath();
        ctx.arc(nose.x, nose.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = bC;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else {
      // ── Standard skeleton mode ──────────────────────────────────────────────
      for (const [a, b] of CONNECTIONS) {
        if (!isVisible(a) || !isVisible(b)) continue;
        const pa = toCanvas(kp[a]);
        const pb = toCanvas(kp[b]);
        const rA = lmMap.get(a)?.region ?? 'upper';
        const rB = lmMap.get(b)?.region ?? 'upper';
        const color = REGION_COLORS[rA === rB ? rA : rB];
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = LINE_WIDTH;
        ctx.stroke();
      }

      for (const lmDef of LANDMARKS) {
        if (!isVisible(lmDef.index)) continue;
        const { x, y } = toCanvas(kp[lmDef.index]);
        const color = REGION_COLORS[lmDef.region];
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // ── Ground contacts + annotation ────────────────────────────────────────
    const contacts = groundContactsRef.current;
    const annotate = annotateModeRef.current;
    if ((contacts.length > 0 || annotate !== 'off') && fw && fh) {
      const toC = (p: { x: number; y: number }) => ({
        x: lb.left + p.x * sx,
        y: lb.top + p.y * sy,
      });

      // Effective positions (drag overrides stored site)
      const tempDrag = tempDragRef.current;
      const effSite = (c: GroundContactEvent) =>
        tempDrag && c.id && tempDrag.id === c.id ? tempDrag.site : c.contactSite;

      const mx = mousePosRef.current?.x ?? -9999;
      const my = mousePosRef.current?.y ?? -9999;
      const HOVER_R = 16;

      // Step brackets between consecutive contacts
      if (contacts.length > 1) {
        const drawStridePair = (
          a: GroundContactEvent,
          b: GroundContactEvent,
          color: string,
          labelColor: string,
        ) => {
          const pa = toC(effSite(a));
          const pb = toC(effSite(b));
          const groundY = Math.max(pa.y, pb.y) + 18;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(pa.x, groundY);
          ctx.lineTo(pb.x, groundY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(pa.x, groundY - 4); ctx.lineTo(pa.x, groundY + 4);
          ctx.moveTo(pb.x, groundY - 4); ctx.lineTo(pb.x, groundY + 4);
          ctx.stroke();
          if (b.strideLength !== null) {
            const mid = (pa.x + pb.x) / 2;
            ctx.font = '9px "DM Mono", monospace';
            ctx.fillStyle = labelColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${b.strideLength.toFixed(2)}m`, mid, groundY - 5);
          }
          ctx.restore();
        };
        for (let i = 1; i < contacts.length; i++) {
          const a = contacts[i - 1];
          const b = contacts[i];
          if (b.strideLength !== null) {
            const col = b.foot === 'left' ? '#10b981' : '#06b6d4';
            drawStridePair(a, b, col + '99', col);
          }
        }
      }

      // ── Contact nodes ─────────────────────────────────────────────────────
      // Hover detection: × delete button (manual only, annotate mode)
      let hoveredDeleteId: string | null = null;
      if (annotate !== 'off') {
        for (const c of contacts) {
          if (!c.isManual || !c.id) continue;
          const s = effSite(c);
          const cnx = lb.left + s.x * sx;
          const cny = lb.top + s.y * sy;
          if (Math.hypot((cnx + 9) - mx, (cny - 9) - my) < 8) {
            hoveredDeleteId = c.id;
            break;
          }
        }
      }
      // Hover detection: contact node (not on a delete button)
      let hoveredContact: GroundContactEvent | null = null;
      if (!hoveredDeleteId) {
        for (const c of contacts) {
          const s = effSite(c);
          const cnx = lb.left + s.x * sx;
          const cny = lb.top + s.y * sy;
          if (Math.hypot(cnx - mx, cny - my) < HOVER_R) {
            hoveredContact = c;
            break;
          }
        }
      }

      // Draw nodes
      contacts.forEach((c, idx) => {
        const s = effSite(c);
        const cnx = lb.left + s.x * sx;
        const cny = lb.top + s.y * sy;
        const isHov = hoveredContact === c;
        const r = isHov ? 7 : 5;
        const ncol = c.foot === 'left' ? '#10b981' : '#06b6d4';

        // Circle
        ctx.beginPath();
        ctx.arc(cnx, cny, r, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? ncol : ncol + '99';
        ctx.fill();
        if (c.isManual && annotate !== 'off') ctx.setLineDash([2, 2]);
        ctx.strokeStyle = isHov ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.55)';
        ctx.lineWidth = isHov ? 2 : 1.5;
        ctx.stroke();
        ctx.setLineDash([]);

        // Sequential number
        ctx.font = `bold ${r <= 5 ? 7 : 8}px "DM Mono", monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), cnx, cny);

        // × delete button (manual contacts in annotate mode)
        if (c.isManual && c.id && annotate !== 'off') {
          const bx = cnx + r + 2;
          const by = cny - r - 2;
          const isDelHov = hoveredDeleteId === c.id;
          ctx.beginPath();
          ctx.arc(bx, by, 5, 0, Math.PI * 2);
          ctx.fillStyle = isDelHov ? '#ef4444' : 'rgba(239,68,68,0.75)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.font = 'bold 7px sans-serif';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('×', bx, by);
        }
      });

      // Tooltip
      if (hoveredContact) {
        const hc = hoveredContact;
        const s = effSite(hc);
        const cnx = lb.left + s.x * sx;
        const cny = lb.top + s.y * sy;
        const tcol = hc.foot === 'left' ? '#10b981' : '#06b6d4';
        const contactIdx = contacts.indexOf(hc) + 1;
        const lines: string[] = [
          `#${contactIdx} — ${hc.foot === 'left' ? 'Left' : 'Right'} foot${hc.isManual ? ' (manual)' : ''}`,
          `Contact time: ${(hc.contactTime * 1000).toFixed(0)} ms`,
          hc.flightTimeBefore > 0.01
            ? `Flight before: ${(hc.flightTimeBefore * 1000).toFixed(0)} ms`
            : 'Flight before: —',
          hc.strideLength != null
            ? `Step: ${hc.strideLength.toFixed(2)} m`
            : 'Step: — (calibrate first)',
          ...(hc.strideFrequency != null
            ? [`Cadence: ${hc.strideFrequency.toFixed(2)} Hz`]
            : []),
          `Frame: ${hc.contactFrame}`,
        ];
        ctx.font = '10px "DM Mono", monospace';
        const lineH = 15;
        const pad = { x: 9, y: 6 };
        const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
        const bw = maxW + pad.x * 2;
        const bh = lines.length * lineH + pad.y * 2;
        let tx = cnx + 14;
        let ty = cny - bh / 2;
        if (tx + bw > cw - 4) tx = cnx - bw - 14;
        if (ty < 4) ty = 4;
        if (ty + bh > ch - 4) ty = ch - bh - 4;
        ctx.fillStyle = 'rgba(9,9,11,0.92)';
        ctx.fillRect(tx, ty, bw, bh);
        ctx.strokeStyle = tcol;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, bw, bh);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
          ctx.fillStyle = i === 0 ? tcol : '#d4d4d8';
          ctx.fillText(line, tx + pad.x, ty + pad.y + i * lineH);
        });
      }
    }

    if (showLabelsRef.current && mousePosRef.current) {
      const { x: mx, y: my } = mousePosRef.current;
      let closest: {
        dist: number;
        label: string;
        x: number;
        y: number;
      } | null = null;
      for (const lmDef of LANDMARKS) {
        if (!isVisible(lmDef.index)) continue;
        const { x, y } = toCanvas(kp[lmDef.index]);
        const dist = Math.hypot(x - mx, y - my);
        if (dist < 24 && (!closest || dist < closest.dist)) {
          closest = { dist, label: lmDef.name, x, y };
        }
      }
      if (closest) {
        const pad = { x: 6, y: 3 };
        ctx.font = '11px "DM Mono", monospace';
        const tw = ctx.measureText(closest.label).width;
        const bx = closest.x + 12;
        const by = closest.y - 8;
        ctx.fillStyle = 'rgba(9,9,11,0.88)';
        ctx.fillRect(bx - pad.x, by - pad.y, tw + pad.x * 2, 16 + pad.y * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - pad.x, by - pad.y, tw + pad.x * 2, 16 + pad.y * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(closest.label, bx, by + 8);
      }
    }
  }, []); // stable — reads everything from refs

  // ── Expose imperative draw to parent via drawRef ─────────────────────────
  useEffect(() => {
    if (drawRef) drawRef.current = drawKp;
    return () => {
      if (drawRef) drawRef.current = null;
    };
  }, [drawRef, drawKp]);

  // Keep latest keypoints in a ref so resize/visibility redraws always have them
  const currentKpRef = useRef<Keypoint[]>(keypoints);
  useEffect(() => {
    currentKpRef.current = keypoints;
    drawKp(keypoints);
  }, [keypoints, drawKp]);

  // Redraw when any display-affecting prop changes
  useEffect(() => {
    drawKp(currentKpRef.current);
  }, [visibilityMap, showLabels, viewMode, groundContacts, annotateMode, drawKp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => drawKp(currentKpRef.current));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [drawKp]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    mousePosRef.current = { x: mx, y: my };

    if (draggingRef.current) {
      const { id, offsetX, offsetY } = draggingRef.current;
      const lb = lbRef.current;
      tempDragRef.current = {
        id,
        site: {
          x: (mx - offsetX - lb.left) / sxRef.current,
          y: (my - offsetY - lb.top) / syRef.current,
        },
      };
    }
    drawKp(currentKpRef.current);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (annotateModeRef.current === 'off') return;
    e.stopPropagation(); // prevent viewport pan
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const lb = lbRef.current;
    const sx = sxRef.current;
    const sy = syRef.current;
    const contacts = groundContactsRef.current;

    // Check × delete buttons first
    for (const c of contacts) {
      if (!c.isManual || !c.id) continue;
      const s = tempDragRef.current?.id === c.id ? tempDragRef.current!.site : c.contactSite;
      const cnx = lb.left + s.x * sx;
      const cny = lb.top + s.y * sy;
      const r = 5;
      const bx = cnx + r + 2;
      const by = cny - r - 2;
      if (Math.hypot(bx - mx, by - my) < 8) {
        onDeleteContactRef.current?.(c.id);
        return;
      }
    }

    // Check if clicking on a draggable manual contact
    for (const c of contacts) {
      if (!c.isManual || !c.id) continue;
      const cnx = lb.left + c.contactSite.x * sx;
      const cny = lb.top + c.contactSite.y * sy;
      if (Math.hypot(cnx - mx, cny - my) < 12) {
        draggingRef.current = { id: c.id, offsetX: mx - cnx, offsetY: my - cny };
        return;
      }
    }

    // Otherwise mark for pending add on mouseup
    pendingAddRef.current = { x: mx, y: my };
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (annotateModeRef.current === 'off') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (draggingRef.current) {
      const id = draggingRef.current.id;
      const lb = lbRef.current;
      const site = tempDragRef.current?.site ?? {
        x: (mx - draggingRef.current.offsetX - lb.left) / sxRef.current,
        y: (my - draggingRef.current.offsetY - lb.top) / syRef.current,
      };
      onMoveContactRef.current?.(id, site);
      draggingRef.current = null;
      tempDragRef.current = null;
      drawKp(currentKpRef.current);
      return;
    }

    if (pendingAddRef.current) {
      const pa = pendingAddRef.current;
      pendingAddRef.current = null;
      if (Math.hypot(mx - pa.x, my - pa.y) < 8) {
        // Click (not drag) — add contact at this position
        const lb = lbRef.current;
        const ix = (mx - lb.left) / sxRef.current;
        const iy = (my - lb.top) / syRef.current;
        if (ix >= 0 && iy >= 0) {
          onAddContactRef.current?.({
            id: crypto.randomUUID(),
            foot: annotateModeRef.current as 'left' | 'right',
            contactFrame: currentFrameRef.current,
            contactSite: { x: ix, y: iy },
          });
        }
      }
    }
  };

  const handleMouseLeave = () => {
    mousePosRef.current = null;
    // If dragging and mouse leaves, cancel drag
    if (draggingRef.current) {
      draggingRef.current = null;
      tempDragRef.current = null;
    }
    pendingAddRef.current = null;
    drawKp(currentKpRef.current);
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ cursor: annotateMode !== 'off' ? 'crosshair' : 'default' }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
};
