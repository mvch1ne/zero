// ─── Procedural 3D Body Renderer ─────────────────────────────────────────────
// View-only: OrbitControls — no editing, calibration, or annotation.

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import type { Keypoint3D } from '../PoseEngine/usePoseLandmarker';

interface Props {
  getKeypoints3D: (frame: number) => Keypoint3D[];
  currentFrame: number;
}

type Vec3 = [number, number, number];

// ── Normalisation ─────────────────────────────────────────────────────────────
// Left/right index pairs — guarantee min z-separation so side-view videos
// don't collapse into a flat sheet.
const LR_PAIRS: [number, number][] = [
  [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16],
];
const MIN_HALF_SEP = 0.55 * 0.36; // ≈ body half-width in scene units

function normalize(raw: Keypoint3D[]): Vec3[] | null {
  const lh = raw[11], rh = raw[12];
  if (!lh || !rh) return null;

  const ox = (lh.x + rh.x) / 2;
  const oy = (lh.y + rh.y) / 2;
  const oz = (lh.z + rh.z) / 2;

  const ls = raw[5], rs = raw[6];
  const shoulderY = ls && rs ? (ls.y + rs.y) / 2 : null;
  const torsoH = shoulderY !== null ? Math.abs(shoulderY - oy) : 0;
  const scale  = torsoH > 0.001 ? 0.55 / torsoH : 0.01;
  const zScale = scale * 5;

  const pts: Vec3[] = raw.map((k) => [
    (k.x - ox) * scale,
    -(k.y - oy) * scale,
    (k.z - oz) * zScale,
  ]);

  // Always fix left at +sep and right at -sep from pair midpoint.
  // This prevents limbs from crossing sides regardless of swing direction.
  for (const [li, ri] of LR_PAIRS) {
    const lp = pts[li], rp = pts[ri];
    if (!lp || !rp) continue;
    const zMid = (lp[2] + rp[2]) / 2;
    lp[2] = zMid + MIN_HALF_SEP;
    rp[2] = zMid - MIN_HALF_SEP;
  }

  // Heels and toes follow their ankle's z so the foot segment stays coplanar.
  const lAnkle = pts[15], rAnkle = pts[16];
  if (lAnkle) { if (pts[17]) pts[17][2] = lAnkle[2]; if (pts[19]) pts[19][2] = lAnkle[2]; }
  if (rAnkle) { if (pts[18]) pts[18][2] = rAnkle[2]; if (pts[20]) pts[20][2] = rAnkle[2]; }

  return pts;
}

// ── Lathe profile builder ─────────────────────────────────────────────────────
// Y spans -0.5 → +0.5 to match CylinderGeometry's centred coordinate space.
// X is normalised radius (1.0 = full segment radius r after scale).
function lathGeo(profile: [number, number][], segs = 14) {
  return new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)), segs,
  );
}

// Muscle-shaped lathe profiles for each limb type (bottom = distal end):
//   thigh  : hip (top, wide) → knee (bottom, narrow)
//   shin   : knee (top) → calf bulge → ankle (bottom, narrow)
//   upperArm: shoulder (top) → bicep peak → elbow (bottom)
//   foreArm : elbow (top) → muscle → wrist (bottom, narrow)
const THIGH_GEO  = lathGeo([[0.78,-0.5],[0.88,-0.15],[1.0,0.1],[1.0,0.5]]);
const SHIN_GEO   = lathGeo([[0.60,-0.5],[0.85,-0.25],[1.0,0.0],[0.84,0.3],[0.78,0.5]]);
const UARM_GEO   = lathGeo([[0.78,-0.5],[1.0,-0.15],[1.0,0.1],[0.85,0.5]]);
const FARM_GEO   = lathGeo([[0.58,-0.5],[0.90,-0.2],[1.0,0.05],[0.80,0.5]]);

// ── Geometry helpers ──────────────────────────────────────────────────────────
const _up  = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _q   = new THREE.Quaternion();

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function orientCylinder(mesh: THREE.Mesh, a: Vec3, b: Vec3, r: number) {
  _dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _dir.length();
  if (len < 0.001) { mesh.visible = false; return; }
  _mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  _q.setFromUnitVectors(_up, _dir.divideScalar(len));
  mesh.position.copy(_mid);
  mesh.quaternion.copy(_q);
  mesh.scale.set(r, len, r);
  mesh.visible = true;
}

function placeSphere(mesh: THREE.Mesh, p: Vec3, r: number) {
  mesh.position.set(p[0], p[1], p[2]);
  mesh.scale.setScalar(r);
  mesh.visible = true;
}

// ── Colour palette ────────────────────────────────────────────────────────────
// Unified mannequin — slate family, darkest at the core, lightest at the head.
const COL_CORE  = 0x3d5a73; // spine, clavicles, pelvis
const COL_LIMB  = 0x4e7494; // upper arm, thigh
const COL_DISTAL = 0x6a96b8; // forearm, shin, foot
const COL_JOINT = 0x8fbcd4; // all joint spheres (lighter — they pop)
const COL_HEAD  = 0xc8dce8; // head (lightest)
const COL_NECK  = 0x4e7494;

const MAT_SEG   = { roughness: 0.72, metalness: 0.0 };
const MAT_JOINT = { roughness: 0.60, metalness: 0.0 };

// ── Mesh builder ──────────────────────────────────────────────────────────────
function makeCyl(geo: THREE.BufferGeometry, hex: number) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: hex, ...MAT_SEG }));
  m.visible = false;
  return m;
}
function makeSph(geo: THREE.BufferGeometry, hex: number) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: hex, ...MAT_JOINT }));
  m.visible = false;
  return m;
}

// ── Inner component ───────────────────────────────────────────────────────────
function ProceduralBody({ getKeypoints3D, currentFrame }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  // Named mesh refs — one per body part.
  const r = useRef({
    // Spine
    spine:   null as THREE.Mesh | null,
    // Shoulder stubs (clavicles): spine-top → shoulder joint
    lClav:   null as THREE.Mesh | null,
    rClav:   null as THREE.Mesh | null,
    // Hip stubs (pelvis): spine-bottom → hip joint
    lPelv:   null as THREE.Mesh | null,
    rPelv:   null as THREE.Mesh | null,
    // Arms
    lUArm:   null as THREE.Mesh | null,
    lFArm:   null as THREE.Mesh | null,
    rUArm:   null as THREE.Mesh | null,
    rFArm:   null as THREE.Mesh | null,
    // Legs
    lThigh:  null as THREE.Mesh | null,
    lShin:   null as THREE.Mesh | null,
    rThigh:  null as THREE.Mesh | null,
    rShin:   null as THREE.Mesh | null,
    // Neck + head
    neck:    null as THREE.Mesh | null,
    head:    null as THREE.Mesh | null,
    // Joints
    jLSh:    null as THREE.Mesh | null, // L shoulder
    jRSh:    null as THREE.Mesh | null,
    jLEl:    null as THREE.Mesh | null, // L elbow
    jREl:    null as THREE.Mesh | null,
    jLWr:    null as THREE.Mesh | null, // L wrist
    jRWr:    null as THREE.Mesh | null,
    jLHip:   null as THREE.Mesh | null, // L hip
    jRHip:   null as THREE.Mesh | null,
    jLKn:    null as THREE.Mesh | null, // L knee
    jRKn:    null as THREE.Mesh | null,
    jLAn:    null as THREE.Mesh | null, // L ankle
    jRAn:    null as THREE.Mesh | null,
    // Feet
    lFoot:   null as THREE.Mesh | null,
    rFoot:   null as THREE.Mesh | null,
    jLToe:   null as THREE.Mesh | null,
    jRToe:   null as THREE.Mesh | null,
  });

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
    const sph = new THREE.SphereGeometry(1, 14, 10);
    const m   = r.current;

    // Core
    m.spine  = makeCyl(cyl, COL_CORE);   group.add(m.spine);
    m.lClav  = makeCyl(cyl, COL_CORE);   group.add(m.lClav);
    m.rClav  = makeCyl(cyl, COL_CORE);   group.add(m.rClav);
    m.lPelv  = makeCyl(cyl, COL_CORE);   group.add(m.lPelv);
    m.rPelv  = makeCyl(cyl, COL_CORE);   group.add(m.rPelv);
    // Arms — lathe for organic muscle shape
    m.lUArm  = makeCyl(UARM_GEO, COL_LIMB);   group.add(m.lUArm);
    m.lFArm  = makeCyl(FARM_GEO, COL_DISTAL); group.add(m.lFArm);
    m.rUArm  = makeCyl(UARM_GEO, COL_LIMB);   group.add(m.rUArm);
    m.rFArm  = makeCyl(FARM_GEO, COL_DISTAL); group.add(m.rFArm);
    // Legs — lathe for organic muscle shape
    m.lThigh = makeCyl(THIGH_GEO, COL_LIMB);   group.add(m.lThigh);
    m.lShin  = makeCyl(SHIN_GEO,  COL_DISTAL); group.add(m.lShin);
    m.rThigh = makeCyl(THIGH_GEO, COL_LIMB);   group.add(m.rThigh);
    m.rShin  = makeCyl(SHIN_GEO,  COL_DISTAL); group.add(m.rShin);
    // Neck + head
    m.neck   = makeCyl(cyl, COL_NECK);   group.add(m.neck);
    m.head   = makeSph(sph, COL_HEAD);   group.add(m.head);
    // Joint spheres (all same colour — lighter than segments)
    m.jLSh   = makeSph(sph, COL_JOINT);  group.add(m.jLSh);
    m.jRSh   = makeSph(sph, COL_JOINT);  group.add(m.jRSh);
    m.jLEl   = makeSph(sph, COL_JOINT);  group.add(m.jLEl);
    m.jREl   = makeSph(sph, COL_JOINT);  group.add(m.jREl);
    m.jLWr   = makeSph(sph, COL_JOINT);  group.add(m.jLWr);
    m.jRWr   = makeSph(sph, COL_JOINT);  group.add(m.jRWr);
    m.jLHip  = makeSph(sph, COL_JOINT);  group.add(m.jLHip);
    m.jRHip  = makeSph(sph, COL_JOINT);  group.add(m.jRHip);
    m.jLKn   = makeSph(sph, COL_JOINT);  group.add(m.jLKn);
    m.jRKn   = makeSph(sph, COL_JOINT);  group.add(m.jRKn);
    m.jLAn   = makeSph(sph, COL_JOINT);  group.add(m.jLAn);
    m.jRAn   = makeSph(sph, COL_JOINT);  group.add(m.jRAn);
    // Feet
    m.lFoot  = makeCyl(cyl, COL_DISTAL); group.add(m.lFoot);
    m.rFoot  = makeCyl(cyl, COL_DISTAL); group.add(m.rFoot);
    m.jLToe  = makeSph(sph, COL_JOINT);  group.add(m.jLToe);
    m.jRToe  = makeSph(sph, COL_JOINT);  group.add(m.jRToe);

    return () => { cyl.dispose(); sph.dispose(); group.clear(); };
  }, []);

  const lastFrame = useRef(-1);

  useFrame(() => {
    if (lastFrame.current === currentFrame) return;
    lastFrame.current = currentFrame;

    const raw = getKeypoints3D(currentFrame);
    const pts = raw.length ? normalize(raw) : null;
    const m   = r.current;

    if (!pts) {
      Object.values(m).forEach((mesh) => { if (mesh) mesh.visible = false; });
      return;
    }

    const lSh  = pts[5],  rSh  = pts[6];
    const lEl  = pts[7],  rEl  = pts[8];
    const lWr  = pts[9],  rWr  = pts[10];
    const lHip = pts[11], rHip = pts[12];
    const lKn  = pts[13], rKn  = pts[14];
    const lAn  = pts[15], rAn  = pts[16];
    const lToe = pts[19], rToe = pts[20];
    const nose = pts[0];

    const shMid  = lSh  && rSh  ? midpoint(lSh,  rSh)  : null;
    const hipMid = lHip && rHip ? midpoint(lHip, rHip) : null;

    // Spine: hip midpoint → shoulder midpoint
    if (m.spine && shMid && hipMid)
      orientCylinder(m.spine, hipMid, shMid, 0.085);
    else if (m.spine) m.spine.visible = false;

    // Clavicles: shoulder midpoint → each shoulder joint
    if (m.lClav && shMid && lSh) orientCylinder(m.lClav, shMid, lSh, 0.040);
    else if (m.lClav) m.lClav.visible = false;
    if (m.rClav && shMid && rSh) orientCylinder(m.rClav, shMid, rSh, 0.040);
    else if (m.rClav) m.rClav.visible = false;

    // Pelvis stubs: hip midpoint → each hip joint
    if (m.lPelv && hipMid && lHip) orientCylinder(m.lPelv, hipMid, lHip, 0.050);
    else if (m.lPelv) m.lPelv.visible = false;
    if (m.rPelv && hipMid && rHip) orientCylinder(m.rPelv, hipMid, rHip, 0.050);
    else if (m.rPelv) m.rPelv.visible = false;

    // Arms
    if (m.lUArm && lSh && lEl) orientCylinder(m.lUArm, lSh, lEl, 0.042);
    else if (m.lUArm) m.lUArm.visible = false;
    if (m.lFArm && lEl && lWr) orientCylinder(m.lFArm, lEl, lWr, 0.030);
    else if (m.lFArm) m.lFArm.visible = false;
    if (m.rUArm && rSh && rEl) orientCylinder(m.rUArm, rSh, rEl, 0.042);
    else if (m.rUArm) m.rUArm.visible = false;
    if (m.rFArm && rEl && rWr) orientCylinder(m.rFArm, rEl, rWr, 0.030);
    else if (m.rFArm) m.rFArm.visible = false;

    // Legs
    if (m.lThigh && lHip && lKn) orientCylinder(m.lThigh, lHip, lKn, 0.058);
    else if (m.lThigh) m.lThigh.visible = false;
    if (m.lShin  && lKn  && lAn) orientCylinder(m.lShin,  lKn,  lAn, 0.044);
    else if (m.lShin)  m.lShin.visible  = false;
    if (m.rThigh && rHip && rKn) orientCylinder(m.rThigh, rHip, rKn, 0.058);
    else if (m.rThigh) m.rThigh.visible = false;
    if (m.rShin  && rKn  && rAn) orientCylinder(m.rShin,  rKn,  rAn, 0.044);
    else if (m.rShin)  m.rShin.visible  = false;

    // Neck + head
    if (m.neck && m.head && shMid && nose) {
      orientCylinder(m.neck, shMid, nose, 0.028);
      // Oval head: taller than wide
      const hc: Vec3 = [nose[0], nose[1] + 0.09, nose[2]];
      m.head.position.set(...hc);
      m.head.scale.set(0.11, 0.14, 0.11);
      m.head.visible = true;
    } else {
      if (m.neck) m.neck.visible = false;
      if (m.head) m.head.visible = false;
    }

    // Joint spheres — radius matches the wider of the two adjacent segments
    if (lSh  && m.jLSh)  placeSphere(m.jLSh,  lSh,  0.042); // = uArm r
    if (rSh  && m.jRSh)  placeSphere(m.jRSh,  rSh,  0.042);
    if (lEl  && m.jLEl)  placeSphere(m.jLEl,  lEl,  0.042); // = uArm r (wider side)
    if (rEl  && m.jREl)  placeSphere(m.jREl,  rEl,  0.042);
    if (lWr  && m.jLWr)  placeSphere(m.jLWr,  lWr,  0.030); // = fArm r
    if (rWr  && m.jRWr)  placeSphere(m.jRWr,  rWr,  0.030);
    if (lHip && m.jLHip) placeSphere(m.jLHip, lHip, 0.058); // = thigh r
    if (rHip && m.jRHip) placeSphere(m.jRHip, rHip, 0.058);
    if (lKn  && m.jLKn)  placeSphere(m.jLKn,  lKn,  0.058); // = thigh r (wider)
    if (rKn  && m.jRKn)  placeSphere(m.jRKn,  rKn,  0.058);
    if (lAn  && m.jLAn)  placeSphere(m.jLAn,  lAn,  0.044); // = shin r
    if (rAn  && m.jRAn)  placeSphere(m.jRAn,  rAn,  0.044);
    // Feet
    if (m.lFoot && lAn && lToe) orientCylinder(m.lFoot, lAn, lToe, 0.028);
    else if (m.lFoot) m.lFoot.visible = false;
    if (m.rFoot && rAn && rToe) orientCylinder(m.rFoot, rAn, rToe, 0.028);
    else if (m.rFoot) m.rFoot.visible = false;
    if (lToe && m.jLToe) placeSphere(m.jLToe, lToe, 0.022);
    if (rToe && m.jRToe) placeSphere(m.jRToe, rToe, 0.022);
  });

  return <group ref={groupRef} />;
}

// ── Ground ────────────────────────────────────────────────────────────────────
const FOOT_IDX = [15, 16, 17, 19, 20, 22];
function groundY(pts: Vec3[]): number {
  const ys = FOOT_IDX.map((i) => pts[i]?.[1] ?? Infinity).filter(isFinite);
  return ys.length ? Math.min(...ys) : -0.8;
}

// Fixed orthographic camera — 45° between front and side, eye-level with model
const ISO_POS: [number, number, number] = [1.8, 0.25, 1.8];
const ISO_TARGET: [number, number, number] = [0, 0.05, 0];
const ISO_ZOOM = 200;

// ── Export ────────────────────────────────────────────────────────────────────
export function Renderer3D({ getKeypoints3D, currentFrame }: Props) {
  const [resetKey, setResetKey] = useState(0);

  const raw = getKeypoints3D(currentFrame);
  const pts = raw.length ? normalize(raw) : null;

  if (!pts) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
        <span className="text-zinc-500 text-xs font-mono uppercase tracking-widest">
          No 3D pose data for this frame
        </span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <Canvas
        key={resetKey}
        orthographic
        camera={{ position: ISO_POS, zoom: ISO_ZOOM, up: [0, 1, 0] }}
        gl={{ antialias: true }}
        style={{ background: '#09090b' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 6, 4]} intensity={1.1} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.3} />
        <directionalLight position={[0, -2, -4]} intensity={0.5} color="#8fbcd4" />{/* rim */}

        <ProceduralBody getKeypoints3D={getKeypoints3D} currentFrame={currentFrame} />

        <Grid
          position={[0, groundY(pts) - 0.02, 0]}
          args={[12, 12]}
          cellSize={0.25}
          cellThickness={0.4}
          cellColor="#27272a"
          sectionSize={1}
          sectionThickness={0.8}
          sectionColor="#3f3f46"
          fadeDistance={14}
          fadeStrength={2}
          infiniteGrid
        />

        <OrbitControls makeDefault target={ISO_TARGET} minDistance={0.5} maxDistance={12} enablePan />

        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport axisColors={['#f87171', '#4ade80', '#60a5fa']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      {/* Hint */}
      <div className="absolute top-2 left-2 pointer-events-none">
        <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">
          3D · Drag to orbit · Scroll to zoom
        </span>
      </div>

      {/* Reset view button */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <button
          onClick={() => setResetKey((k) => k + 1)}
          className="px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded border transition-colors text-zinc-500 border-zinc-700/40 bg-zinc-900/60 hover:text-zinc-300 hover:border-zinc-500/50"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
