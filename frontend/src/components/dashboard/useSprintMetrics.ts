// Not sure yet but will likely contain something that summarizes...don't know but we'll see
// ─── Sprint Metrics Engine ────────────────────────────────────────────────────
// All computation from raw 2-D keypoint arrays + fps + optional px/m calibration.
// Called from Viewport after pose data is ready; result stored in VideoContext.
//
// Wholebody3d keypoint indices (MMPose / COCO Wholebody):
//   0  Nose       1  L.Eye     2  R.Eye     3  L.Ear     4  R.Ear
//   5  L.Shoulder 6  R.Shoulder 7  L.Elbow  8  R.Elbow
//   9  L.Wrist   10  R.Wrist  11  L.Hip    12  R.Hip
//  13  L.Knee    14  R.Knee   15  L.Ankle  16  R.Ankle
//  17  L.BigToe  18  L.SmallToe 19  L.Heel
//  20  R.BigToe  21  R.SmallToe 22  R.Heel

import { useMemo } from 'react';
import type { Keypoint } from './viewport/PoseEngine/usePoseLandmarker';
import type { CalibrationData } from './viewport/CalibrationAndMeasurements/CalibrationOverlay';

// ── Public types ───────────────────────────────────────────────────────────────

export interface GroundContactEvent {
  id?: string;        // set for manually-placed contacts
  isManual?: boolean;
  foot: 'left' | 'right';
  contactFrame: number; // first frame foot is on ground
  liftFrame: number; // first frame foot leaves ground
  contactTime: number; // seconds
  flightTimeBefore: number; // seconds airborne before this contact
  contactSite: { x: number; y: number }; // heel pixel coords at touchdown
  comAtContact: { x: number; y: number }; // hip-midpoint at touchdown
  comDistance: number; // distance CoM→contact site (m or px)
  strideLength: number | null; // step length: to previous contact of either foot (m)
  strideFrequency: number | null; // Hz — 1 / step cycle time
}

export interface JointTimeSeries {
  frames: number[]; // frame indices (identity: 0…N-1)
  angle: number[]; // degrees, smoothed
  velocity: number[]; // deg/s, smoothed
  accel: number[]; // deg/s², smoothed
}

export interface SprintMetrics {
  // ── Temporal ────────────────────────────────────────────────────────────────
  groundContacts: GroundContactEvent[];
  avgContactTime: number; // s
  avgFlightTime: number; // s
  avgStrideLength: number | null; // m or px
  avgStrideFreq: number | null; // Hz
  // ── Angular — per joint, every frame ────────────────────────────────────────
  leftHip: JointTimeSeries;
  rightHip: JointTimeSeries;
  leftKnee: JointTimeSeries;
  rightKnee: JointTimeSeries;
  leftAnkle: JointTimeSeries;
  rightAnkle: JointTimeSeries;
  leftShoulder: JointTimeSeries;
  rightShoulder: JointTimeSeries;
  leftElbow: JointTimeSeries;
  rightElbow: JointTimeSeries;
  leftWrist: JointTimeSeries;
  rightWrist: JointTimeSeries;
  torso: JointTimeSeries; // trunk lean from vertical
  leftThigh: JointTimeSeries; // thigh angle from vertical
  rightThigh: JointTimeSeries;
  leftShin: JointTimeSeries; // shin angle from vertical
  rightShin: JointTimeSeries;
  // ── CoM trajectory ─────────────────────────────────────────────────────────
  com: { frame: number; x: number; y: number }[];
}

// ── Internal helpers ───────────────────────────────────────────────────────────

const SCORE_MIN = 0.35;
type P2 = { x: number; y: number };

function pt(keypoints: Keypoint[], idx: number): P2 | null {
  const p = keypoints[idx];
  if (!p || p.score < SCORE_MIN) return null;
  return { x: p.x, y: p.y };
}

/** Interior angle at vertex B in the triangle A-B-C, degrees [0, 180]. */
function angleDeg(a: P2, b: P2, c: P2): number {
  const ax = a.x - b.x,
    ay = a.y - b.y;
  const cx = c.x - b.x,
    cy = c.y - b.y;
  const dot = ax * cx + ay * cy;
  const mag = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (mag < 1e-6) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

/** Angle of segment p1→p2 measured from the downward vertical, in degrees.
 *  Positive = leaning forward (to the right of vertical in a left-to-right run). */
function segAngleDeg(p1: P2, p2: P2): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y; // y increases downward
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

function smooth(arr: number[], w: number): number[] {
  const half = Math.floor(w / 2);
  return arr.map((_, i) => {
    let s = 0,
      n = 0;
    for (let k = i - half; k <= i + half; k++) {
      if (k >= 0 && k < arr.length) {
        s += arr[k];
        n++;
      }
    }
    return s / n;
  });
}

/** Central-difference derivative, then smooth. */
function derivative(arr: number[], fps: number): number[] {
  const n = arr.length;
  const d = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) d[i] = ((arr[i + 1] - arr[i - 1]) * fps) / 2;
  d[0] = d[1];
  d[n - 1] = d[n - 2];
  return smooth(d, 5);
}

function buildSeries(raw: (number | null)[], fps: number): JointTimeSeries {
  // Forward-fill then backward-fill nulls
  const filled = raw.slice() as number[];
  for (let i = 1; i < filled.length; i++)
    if (filled[i] == null) filled[i] = filled[i - 1] ?? 0;
  for (let i = filled.length - 2; i >= 0; i--)
    if (filled[i] == null) filled[i] = filled[i + 1] ?? 0;

  const angle = smooth(smooth(filled, 3), 3);
  const velocity = derivative(angle, fps);
  const accel = derivative(velocity, fps);
  return { frames: raw.map((_, i) => i), angle, velocity, accel };
}

type ScaleOps = {
  /** Convert a horizontal inference-frame pixel distance → metres. */
  h: (dx: number) => number;
  /** Convert a 2-D inference-frame pixel displacement → metres. */
  xy: (dx: number, dy: number) => number;
} | null;

/** Detect ground contact windows for one foot.
 *  Strategy: use whichever of toe/heel is closest to ground (largest Y in screen space).
 *  This captures toe-first contacts common in sprinting where the heel stays elevated.
 *  Threshold = 12% of total vertical travel — works for any camera height/distance. */
function detectContacts(
  heelPts: (P2 | null)[],
  toePts: (P2 | null)[],
  fps: number,
  foot: 'left' | 'right',
  comPts: (P2 | null)[],
  prev: GroundContactEvent[],
  scaleOps: ScaleOps,
): GroundContactEvent[] {
  // Combined foot Y: whichever landmark is closer to ground (larger Y in screen coords)
  const footYs: (number | null)[] = heelPts.map((h, i) => {
    const t = toePts[i];
    if (h && t) return Math.max(h.y, t.y);
    if (h) return h.y;
    if (t) return t.y;
    return null;
  });
  const validYs = footYs.flatMap((y) => (y != null ? [y] : []));
  if (!validYs.length) return [];
  const maxY = Math.max(...validYs);
  const minY = Math.min(...validYs);
  const thr = (maxY - minY) * 0.12;
  const floor = maxY - thr;

  const onGnd = footYs.map((y) => y != null && y >= floor);

  const events: GroundContactEvent[] = [];
  let start: number | null = null;

  for (let i = 0; i <= onGnd.length; i++) {
    const cur = i < onGnd.length ? onGnd[i] : false;
    if (cur && start === null) {
      start = i;
    } else if (!cur && start !== null) {
      const duration = (i - start) / fps;
      // Reasonable sprint contact: 50–600 ms
      if (duration >= 0.05 && duration <= 0.6) {
        // Contact site: whichever of toe/heel is closest to the ground (larger Y)
        const h = heelPts[start];
        const t = toePts[start];
        const site = h && t ? (h.y > t.y ? h : t) : (h ?? t);
        const com = comPts[start];
        // Only report CoM distance when calibrated.
        const comDist =
          site && com && scaleOps
            ? scaleOps.xy(site.x - com.x, site.y - com.y)
            : 0;

        // Step: distance to the previous contact of EITHER foot (foot-to-next-foot)
        const prevEvt = [...prev, ...events].at(-1) ?? null;
        let strideLength: number | null = null;
        let strideFrequency: number | null = null;
        if (prevEvt && site) {
          const dx = Math.abs(site.x - prevEvt.contactSite.x);
          // Only report stride length when calibrated — pixel values are meaningless here.
          strideLength = scaleOps ? scaleOps.h(dx) : null;
          const dt = (start - prevEvt.contactFrame) / fps;
          strideFrequency = dt > 0 ? 1 / dt : null;
        }
        const flightTimeBefore = prevEvt
          ? Math.max(0, (start - prevEvt.liftFrame) / fps)
          : 0;

        events.push({
          foot,
          contactFrame: start,
          liftFrame: i,
          contactTime: duration,
          flightTimeBefore,
          contactSite: site ?? { x: 0, y: 0 },
          comAtContact: com ?? { x: 0, y: 0 },
          comDistance: comDist,
          strideLength,
          strideFrequency,
        });
      }
      start = null;
    }
  }
  return events;
}

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// ── Main hook ──────────────────────────────────────────────────────────────────

export function useSprintMetrics(
  getKeypoints: (frame: number) => Keypoint[],
  totalFrames: number,
  fps: number,
  calibration: CalibrationData | null,
  /** Inference-frame pixel dimensions — required for correct metre conversion. */
  frameWidth: number,
  frameHeight: number,
): SprintMetrics | null {
  return useMemo(() => {
    if (totalFrames < 2 || fps <= 0) return null;
    // Require calibration — without it, all distance-based metrics are meaningless
    // and angular-only data is not yet sufficient to unlock the panel.
    if (!calibration) return null;

    // Build per-frame point series for every landmark we need
    const all = Array.from({ length: totalFrames }, (_, i) => getKeypoints(i));
    const col = (idx: number) => all.map((f) => pt(f, idx));

    const nose = col(0);
    const lSho = col(5);
    const rSho = col(6);
    const lElb = col(7);
    const rElb = col(8);
    const lWri = col(9);
    const rWri = col(10);
    const lHip = col(11);
    const rHip = col(12);
    const lKne = col(13);
    const rKne = col(14);
    const lAnk = col(15);
    const rAnk = col(16);
    const lToe = col(17);
    const lHeel = col(19);
    const rToe = col(20);
    const rHeel = col(22);

    // CoM ≈ hip midpoint
    const com: (P2 | null)[] = lHip.map((l, i) => {
      const r = rHip[i];
      if (!l || !r) return null;
      return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
    });

    // Build scale operations only when calibration AND inference-frame dims are known.
    // Keypoints are in inference-frame pixel coords; calibration was computed in
    // normalised (0-1) video space with aspect-ratio correction applied to the
    // horizontal axis. We therefore normalise each component before applying ppm.
    const scaleOps: ScaleOps =
      calibration && frameWidth > 0 && frameHeight > 0
        ? {
            h: (dx: number) =>
              ((Math.abs(dx) / frameWidth) * calibration.aspectRatio) /
              calibration.pixelsPerMeter,
            xy: (dx: number, dy: number) => {
              const nx = (dx / frameWidth) * calibration.aspectRatio;
              const ny = dy / frameHeight;
              return Math.sqrt(nx * nx + ny * ny) / calibration.pixelsPerMeter;
            },
          }
        : null;

    // ── Ground contacts ─────────────────────────────────────────────────────
    const leftC = detectContacts(lHeel, lToe, fps, 'left', com, [], scaleOps);
    const rightC = detectContacts(rHeel, rToe, fps, 'right', com, leftC, scaleOps);
    const contacts = [...leftC, ...rightC].sort(
      (a, b) => a.contactFrame - b.contactFrame,
    );

    const contactTimes = contacts.map((e) => e.contactTime);
    const flightTimes = contacts
      .map((e) => e.flightTimeBefore)
      .filter((t) => t > 0);
    const strideLengths = contacts.flatMap((e) =>
      e.strideLength !== null ? [e.strideLength] : [],
    );
    const strideFreqs = contacts.flatMap((e) =>
      e.strideFrequency !== null ? [e.strideFrequency] : [],
    );

    // ── Angular helpers ─────────────────────────────────────────────────────
    const jA = (a: (P2 | null)[], b: (P2 | null)[], c: (P2 | null)[]) =>
      a.map((pa, i) => {
        const pb = b[i],
          pc = c[i];
        return pa && pb && pc ? angleDeg(pa, pb, pc) : null;
      });

    const sA = (from: (P2 | null)[], to: (P2 | null)[]) =>
      from.map((p1, i) => {
        const p2 = to[i];
        return p1 && p2 ? segAngleDeg(p1, p2) : null;
      });

    // Trunk direction: hip-midpoint → nose
    const trunkDir = com.map((c, i) => {
      const n = nose[i];
      if (!c || !n) return null;
      return segAngleDeg(c, n);
    });

    return {
      groundContacts: contacts,
      avgContactTime: avg(contactTimes),
      avgFlightTime: avg(flightTimes),
      avgStrideLength: strideLengths.length ? avg(strideLengths) : null,
      avgStrideFreq: strideFreqs.length ? avg(strideFreqs) : null,

      // Lower body — anatomical angles
      leftHip: buildSeries(jA(lKne, lHip, lSho), fps),
      rightHip: buildSeries(jA(rKne, rHip, rSho), fps),
      leftKnee: buildSeries(jA(lHip, lKne, lAnk), fps),
      rightKnee: buildSeries(jA(rHip, rKne, rAnk), fps),
      leftAnkle: buildSeries(jA(lKne, lAnk, lToe), fps),
      rightAnkle: buildSeries(jA(rKne, rAnk, rToe), fps),

      // Upper body
      leftShoulder: buildSeries(jA(lElb, lSho, lHip), fps),
      rightShoulder: buildSeries(jA(rElb, rSho, rHip), fps),
      leftElbow: buildSeries(jA(lSho, lElb, lWri), fps),
      rightElbow: buildSeries(jA(rSho, rElb, rWri), fps),
      leftWrist: buildSeries(jA(lElb, lWri, lToe), fps), // proxy: wrist extension
      rightWrist: buildSeries(jA(rElb, rWri, rToe), fps),

      // Segment angles from vertical
      torso: buildSeries(trunkDir, fps),
      leftThigh: buildSeries(sA(lHip, lKne), fps),
      rightThigh: buildSeries(sA(rHip, rKne), fps),
      leftShin: buildSeries(sA(lKne, lAnk), fps),
      rightShin: buildSeries(sA(rKne, rAnk), fps),

      com: com.map((p, i) => ({ frame: i, x: p?.x ?? 0, y: p?.y ?? 0 })),
    };
  }, [getKeypoints, totalFrames, fps, calibration, frameWidth, frameHeight]);
}
