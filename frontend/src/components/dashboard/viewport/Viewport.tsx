import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FilePlayIcon, Clock, Upload, Layers, Box, Pencil } from 'lucide-react';
import { IconDimensions } from '@tabler/icons-react';
import { VideoLayer } from './VideoLayer';
import { ControlPanel } from './ControlPanel';
import { CalibrationOverlay } from './CalibrationAndMeasurements/CalibrationOverlay';
import type { CalibrationData } from './CalibrationAndMeasurements/CalibrationOverlay';
import { MeasurementOverlay } from './CalibrationAndMeasurements/MeasurementOverlay';
import { MeasurementPanel } from './CalibrationAndMeasurements/MeasurementPanel';
import type { Measurement } from './CalibrationAndMeasurements/MeasurementOverlay';
import { PoseOverlay } from './PoseEngine/PoseOverlay';
import type { ViewMode, ManualContact, SprintMarker } from './PoseEngine/PoseOverlay';
import type { CoMEvent } from '../VideoContext';
import type { GroundContactEvent } from '../useSprintMetrics';
import { PosePanel } from './PoseEngine/PosePanel';
import { usePoseLandmarker } from './PoseEngine/usePoseLandmarker';
import type { Keypoint } from './PoseEngine/usePoseLandmarker';
import { LANDMARKS, buildDefaultVisibility } from './PoseEngine/poseConfig';
import type { LandmarkDef } from './PoseEngine/poseConfig';
import { TrimCropPanel } from './TrimAndCrop/TrimCropPanel';
import type { CropRect, TrimPoints } from './TrimAndCrop/TrimCropPanel';
import { CropOverlay } from './TrimAndCrop/CropOverlay';
import { useExport } from './videoUtilities/useExport';
import { probeVideoFps } from './videoUtilities/probeVideoFps';
import { useStatus } from './StatusBar/StatusContext';
import { useVideoContext } from '../VideoContext';
import { usePose } from '../PoseContext';
import { useSprintMetrics } from '../useSprintMetrics';

interface VideoMeta {
  src: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  duration: number;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_SPEED = 0.005;

export const Viewport = () => {
  const sectionHeights = { header: '1.25rem', controlSection: '12rem' };

  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [startFrame, setStartFrame] = useState<number | null>(null);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationKey, setCalibrationKey] = useState(0);
  const [measuringDistance, setMeasuringDistance] = useState(false);
  const [measuringAngle, setMeasuringAngle] = useState(false);
  const [measuringKey, setMeasuringKey] = useState(0);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showMeasurementPanel, setShowMeasurementPanel] = useState(false);
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    x: 0,
    y: 0,
  });
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoProbing, setVideoProbing] = useState(false);
  const exportingRef = useRef(false);

  // ── Pose ──────────────────────────────────────────────────────────────────
  const [poseEnabled, setPoseEnabled] = useState(false);
  const [showPosePanel, setShowPosePanel] = useState(false);
  const [showPoseLabels, setShowPoseLabels] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('video');
  const [mode3D, setMode3D] = useState(false);
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([]);
  const [deletedContactIds, setDeletedContactIds] = useState<Set<string>>(new Set());
  const [annotateMode, setAnnotateMode] = useState<'off' | 'left' | 'right' | 'start' | 'finish'>('off');
  const [sprintStart, setSprintStart] = useState<SprintMarker | null>(null);
  const [sprintFinish, setSprintFinish] = useState<SprintMarker | null>(null);
  const [showCoM, setShowCoM] = useState(true);
  const [comEvents, setComEvents] = useState<CoMEvent[]>([]);
  const [showCoMEvents, setShowCoMEvents] = useState(true);
  const manualContactsRef = useRef(manualContacts);
  const mergedContactsRef = useRef<GroundContactEvent[]>([]);
  const currentFrameRef = useRef(currentFrame);
  useEffect(() => { manualContactsRef.current = manualContacts; }, [manualContacts]);
  useEffect(() => { currentFrameRef.current = currentFrame; }, [currentFrame]);
  const [landmarkVisibility, setLandmarkVisibility] = useState<
    Record<number, boolean>
  >(buildDefaultVisibility);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const poseDrawRef = useRef<((kp: Keypoint[]) => void) | null>(null);
  const {
    status: poseStatus,
    progress: poseProgress,
    frameWidth: poseFrameW,
    frameHeight: poseFrameH,
    totalFrames: poseTotalFrames,
    poseFps,
    getKeypoints,
    getKeypoints3D,
    analyseVideo,
    reset: resetPose,
  } = usePoseLandmarker();

  // ── Trim & Crop ───────────────────────────────────────────────────────────
  const [showTrimCropPanel, setShowTrimCropPanel] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [drawingCrop, setDrawingCrop] = useState(false);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [trimPoints, setTrimPoints] = useState<TrimPoints>({
    inPoint: 0,
    outPoint: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // ── Single source of truth: frame counter ─────────────────────────────────
  // fps and totalFrames always come from pose backend once available —
  // exact match to the values OpenCV used. Never round the fps.
  const fps = poseFps > 0 ? poseFps : (videoMeta?.fps ?? 30);
  const totalFrames =
    poseTotalFrames > 0 ? poseTotalFrames : (videoMeta?.totalFrames ?? 0);
  const currentTime = totalFrames > 0 ? currentFrame / fps : 0;

  // ── Sprint metrics — computed once when pose data is ready ────────────────
  const metrics = useSprintMetrics(
    getKeypoints,
    poseStatus === 'ready' ? totalFrames : 0,
    fps,
    calibration,
    poseFrameW,
    poseFrameH,
  );

  // ── Merged contacts (auto-detected + manually placed) ─────────────────────
  const mergedContacts = useMemo<GroundContactEvent[]>(() => {
    const autoEvents = (metrics?.groundContacts ?? []).filter(
      (c) => !c.id || !deletedContactIds.has(c.id),
    );
    if (manualContacts.length === 0 && deletedContactIds.size === 0) return autoEvents;

    const contactDurationFrames = Math.max(1, Math.round(0.08 * fps));
    const manualEvents: GroundContactEvent[] = manualContacts.map((m) => {
      const lift = m.liftFrame ?? m.contactFrame + contactDurationFrames;
      return {
        id: m.id,
        isManual: true,
        foot: m.foot,
        contactFrame: m.contactFrame,
        liftFrame: lift,
        contactTime: (lift - m.contactFrame) / fps,
        flightTimeBefore: 0,
        contactSite: m.contactSite,
        comAtContact: { x: 0, y: 0 },
        comDistance: 0,
        strideLength: null,
        strideFrequency: null,
      };
    });

    const all = [...autoEvents, ...manualEvents].sort(
      (a, b) => a.contactFrame - b.contactFrame,
    );

    // Re-scale helper (horizontal step length only)
    const hScale =
      calibration && poseFrameW > 0
        ? (dx: number) =>
            (Math.abs(dx) / poseFrameW) *
            calibration.aspectRatio /
            calibration.pixelsPerMeter
        : null;

    return all.map((c, i) => {
      // Always recompute contactTime from the actual frame values so edits
      // to contactFrame or liftFrame are reflected consistently everywhere.
      const contactTime = (c.liftFrame - c.contactFrame) / fps;
      if (i === 0)
        return { ...c, contactTime, strideLength: null, strideFrequency: null, flightTimeBefore: 0 };
      const prev = all[i - 1];
      const dx = Math.abs(c.contactSite.x - prev.contactSite.x);
      return {
        ...c,
        contactTime,
        strideLength: hScale ? hScale(dx) : null,
        strideFrequency:
          c.contactFrame > prev.contactFrame
            ? 1 / ((c.contactFrame - prev.contactFrame) / fps)
            : null,
        flightTimeBefore: Math.max(0, (c.contactFrame - prev.liftFrame) / fps),
      };
    });
  }, [metrics, manualContacts, deletedContactIds, fps, calibration, poseFrameW]);

  useEffect(() => { mergedContactsRef.current = mergedContacts; }, [mergedContacts]);

  const metricsWithMerged = useMemo(() => {
    if (!metrics) return null;
    if (manualContacts.length === 0 && deletedContactIds.size === 0) return metrics;
    const gc = mergedContacts;
    const _avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      ...metrics,
      groundContacts: gc,
      avgContactTime: _avg(gc.map((c) => c.contactTime)),
      avgFlightTime: _avg(gc.map((c) => c.flightTimeBefore).filter((t) => t > 0)),
      avgStrideLength: (() => {
        const sl = gc.flatMap((c) => c.strideLength !== null ? [c.strideLength] : []);
        return sl.length ? _avg(sl) : null;
      })(),
      avgStrideFreq: (() => {
        const sf = gc.flatMap((c) => c.strideFrequency !== null ? [c.strideFrequency] : []);
        return sf.length ? _avg(sf) : null;
      })(),
    };
  }, [metrics, manualContacts.length, deletedContactIds.size, mergedContacts]);

  // ── Publish to VideoContext so Telemetry can read without prop-drilling ────
  const {
    setCurrentFrame: ctxSetFrame,
    setFps: ctxSetFps,
    setTotalFrames: ctxSetTotal,
    setCalibration: ctxSetCal,
    setMetrics: ctxSetMetrics,
    setDeleteContact: ctxSetDeleteContact,
    setEditContact: ctxSetEditContact,
    setComEvents: ctxSetComEvents,
    setShowCoMEvents: ctxSetShowCoMEvents,
    setSprintStart: ctxSetSprintStart,
    setSprintFinish: ctxSetSprintFinish,
    setSprintMode: ctxSetSprintMode,
    setConfirmedSprintStart: ctxSetConfirmedSprintStart,
    setProposedSprintStart: ctxSetProposedSprintStart,
    setReactionTime: ctxSetReactionTime,
    setReactionTimeEnabled: ctxSetReactionTimeEnabled,
    sprintMode,
  } = useVideoContext();

  // Stable delete handler — reads manualContactsRef to avoid stale closure
  const handleDeleteContact = useCallback((id: string) => {
    if (manualContactsRef.current.some((m) => m.id === id)) {
      setManualContacts((prev) => prev.filter((m) => m.id !== id));
    } else {
      setDeletedContactIds((prev) => new Set([...prev, id]));
    }
  }, []);

  // Stable edit handler — modifies a manual contact's frames, or converts auto→manual
  const handleEditContact = useCallback((id: string, contactFrame: number, liftFrame: number) => {
    if (manualContactsRef.current.some((m) => m.id === id)) {
      setManualContacts((prev) =>
        prev.map((m) => m.id === id ? { ...m, contactFrame, liftFrame } : m),
      );
    } else {
      const existing = mergedContactsRef.current.find((c) => c.id === id);
      if (!existing) return;
      setDeletedContactIds((prev) => new Set([...prev, id]));
      setManualContacts((prev) => [...prev, {
        id: crypto.randomUUID(),
        foot: existing.foot,
        contactFrame,
        liftFrame,
        contactSite: existing.contactSite,
      }]);
    }
  }, []);

  // Record current CoM position as a timed event
  const getKeypointsRef = useRef(getKeypoints);
  useEffect(() => { getKeypointsRef.current = getKeypoints; }, [getKeypoints]);

  const handleRecordCoMEvent = useCallback(() => {
    const frame = currentFrameRef.current;
    const kp = getKeypointsRef.current(frame);
    const lHip = kp[11];
    const rHip = kp[12];
    if (!lHip || !rHip || lHip.score < 0.35 || rHip.score < 0.35) return;
    const newEvent: CoMEvent = {
      frame,
      comSite: { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 },
    };
    setComEvents((prev) => [...prev, newEvent]);
  }, []);

  useEffect(() => {
    ctxSetDeleteContact(handleDeleteContact);
    return () => ctxSetDeleteContact(null);
  }, [handleDeleteContact, ctxSetDeleteContact]);

  useEffect(() => {
    ctxSetEditContact(handleEditContact);
    return () => ctxSetEditContact(null);
  }, [handleEditContact, ctxSetEditContact]);

  useEffect(() => {
    ctxSetFrame(currentFrame);
  }, [currentFrame, ctxSetFrame]);
  useEffect(() => {
    ctxSetFps(fps);
  }, [fps, ctxSetFps]);
  useEffect(() => {
    ctxSetTotal(totalFrames);
  }, [totalFrames, ctxSetTotal]);
  useEffect(() => {
    ctxSetCal(calibration);
  }, [calibration, ctxSetCal]);

  // When calibration changes, recompute metres for all existing distance measurements.
  useEffect(() => {
    if (!calibration) return;
    setMeasurements((prev) =>
      prev.map((m) => {
        if (m.type !== 'distance' || m.normDist == null) return m;
        const meters = m.normDist / calibration.pixelsPerMeter;
        return { ...m, meters, label: `${meters.toFixed(2)}m` };
      }),
    );
  }, [calibration]);
  useEffect(() => {
    ctxSetMetrics(metricsWithMerged);
  }, [metricsWithMerged, ctxSetMetrics]);

  useEffect(() => { ctxSetComEvents(comEvents); }, [comEvents, ctxSetComEvents]);
  useEffect(() => { ctxSetShowCoMEvents(showCoMEvents); }, [showCoMEvents, ctxSetShowCoMEvents]);
  useEffect(() => { ctxSetSprintStart(sprintStart); }, [sprintStart, ctxSetSprintStart]);
  useEffect(() => { ctxSetSprintFinish(sprintFinish); }, [sprintFinish, ctxSetSprintFinish]);
  // ── Suppress unused setter warnings (passed to Telemetry via context) ──────
  void ctxSetReactionTime;
  void ctxSetReactionTimeEnabled;

  // Auto-detect first significant movement from CoM data
  const proposedSprintStartFrame = useMemo(() => {
    const com = metricsWithMerged?.com;
    if (!com || com.length < 5) return null;
    const baselineX = com[0].x;
    const thresholdPx = poseFrameW > 0 ? poseFrameW * 0.01 : 5;
    for (let fi = 1; fi < com.length; fi++) {
      if (Math.abs(com[fi].x - baselineX) > thresholdPx) return fi;
    }
    return null;
  }, [metricsWithMerged, poseFrameW]);

  // Publish proposed sprint start to VideoContext
  useEffect(() => {
    ctxSetProposedSprintStart(proposedSprintStartFrame);
  }, [proposedSprintStartFrame, ctxSetProposedSprintStart]);

  // Publish pose status into PoseContext so Telemetry can show correct empty state
  const { setStatus: ctxSetPoseStatus } = usePose();
  useEffect(() => {
    ctxSetPoseStatus(poseEnabled ? poseStatus : 'idle');
  }, [poseEnabled, poseStatus, ctxSetPoseStatus]);

  const {
    exportStatus,
    exportProgress,
    lastExportUrl,
    lastExportTitle,
    startExport,
  } = useExport({
    videoElRef,
    exportingRef,
    videoWidth: videoMeta?.width ?? 0,
    videoHeight: videoMeta?.height ?? 0,
    fps,
    trimPoints,
    cropRect,
    title: videoMeta?.title ?? 'clip',
  });

  // ── Trigger pose analysis when enabled ───────────────────────────────────
  useEffect(() => {
    if (!poseEnabled || !videoMeta?.src) return;
    analyseVideo(videoMeta.src);
    return () => resetPose();
  }, [poseEnabled, videoMeta?.src, analyseVideo, resetPose]);

  // ── Status bar ────────────────────────────────────────────────────────────
  const { set: setStatus, clear: clearStatus } = useStatus();

  useEffect(() => {
    if (!videoMeta) {
      clearStatus('video');
      clearStatus('fps');
      clearStatus('frame');
      return;
    }
    setStatus('video', 'file', videoMeta.title, { accent: 'sky' });
    setStatus('fps', 'fps', `${fps % 1 === 0 ? fps : fps.toFixed(3)}`);
  }, [videoMeta, fps, setStatus, clearStatus]);

  useEffect(() => {
    if (!videoMeta) return;
    const secs = currentTime;
    const tc = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${(secs % 60).toFixed(2).padStart(5, '0')}`;
    setStatus('frame', 'frame', `${currentFrame} / ${totalFrames - 1}  ${tc}`);
  }, [currentFrame, currentTime, totalFrames, videoMeta, setStatus]);

  useEffect(() => {
    if (!videoMeta) {
      clearStatus('playback');
      return;
    }
    if (videoEnded)
      setStatus('playback', 'state', 'ended', { accent: 'amber' });
    else if (isPlaying)
      setStatus('playback', 'state', 'playing', {
        accent: 'emerald',
        pulse: true,
      });
    else setStatus('playback', 'state', 'paused', { accent: 'default' });
  }, [isPlaying, videoEnded, videoMeta, setStatus, clearStatus]);

  useEffect(() => {
    if (videoProbing)
      setStatus('probe', 'analysing', 'fps…', { accent: 'amber', pulse: true });
    else clearStatus('probe');
  }, [videoProbing, setStatus, clearStatus]);

  useEffect(() => {
    if (exportStatus === 'idle') clearStatus('export');
    else if (exportStatus === 'loading')
      setStatus('export', 'export', 'loading ffmpeg…', {
        accent: 'amber',
        pulse: true,
      });
    else if (exportStatus === 'running')
      setStatus(
        'export',
        'export',
        `encoding ${Math.round(exportProgress * 100)}%`,
        { accent: 'sky', pulse: true },
      );
    else if (exportStatus === 'done') {
      setStatus('export', 'export', 'complete', { accent: 'emerald' });
      const t = setTimeout(() => clearStatus('export'), 3000);
      return () => clearTimeout(t);
    } else if (exportStatus === 'error') {
      setStatus('export', 'export', 'error', { accent: 'red' });
      const t = setTimeout(() => clearStatus('export'), 5000);
      return () => clearTimeout(t);
    }
  }, [exportStatus, exportProgress, setStatus, clearStatus]);

  useEffect(() => {
    if (!poseEnabled) {
      clearStatus('pose');
      return;
    }
    if (poseStatus === 'ready') {
      setStatus('pose', 'pose', 'active', { accent: 'emerald' });
    } else if (poseStatus === 'error') {
      setStatus('pose', 'pose', 'error — is the server running?', {
        accent: 'red',
      });
    } else if (poseProgress) {
      const { frame, total, pct, fps: ifps, eta } = poseProgress;
      const etaStr =
        eta < 60
          ? `${Math.round(eta)}s`
          : `${Math.floor(eta / 60)}m ${Math.round(eta % 60)}s`;
      setStatus(
        'pose',
        'pose',
        `analysing  ${frame} / ${total}  (${pct}%)  ·  ${ifps} fps  ·  eta ${etaStr}`,
        { accent: 'amber', pulse: true },
      );
    } else {
      setStatus('pose', 'pose', 'uploading…', { accent: 'amber', pulse: true });
    }
  }, [poseEnabled, poseStatus, poseProgress, setStatus, clearStatus]);

  useEffect(() => {
    if (transform.scale > 1)
      setStatus('zoom', 'zoom', `${transform.scale.toFixed(1)}×`, {
        accent: 'sky',
      });
    else clearStatus('zoom');
  }, [transform.scale, setStatus, clearStatus]);

  // ── Pan & zoom ────────────────────────────────────────────────────────────
  const clampPan = useCallback(
    (x: number, y: number, scale: number, el: HTMLElement) => {
      const maxX = (el.clientWidth * (scale - 1)) / 2;
      const maxY = (el.clientHeight * (scale - 1)) / 2;
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [],
  );

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTransform((prev) => {
        const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, prev.scale * (1 + -e.deltaY * ZOOM_SPEED)),
        );
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;
        const sf = newScale / prev.scale;
        const { x, y } = clampPan(
          mx + (prev.x - mx) * sf,
          my + (prev.y - my) * sf,
          newScale,
          el,
        );
        return { scale: newScale, x, y };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const calibratingRef = useRef(calibrating);
  const measuringRef = useRef(false);
  const annotateActiveRef = useRef(false);
  useEffect(() => {
    measuringRef.current = measuringDistance || measuringAngle;
  }, [measuringDistance, measuringAngle]);
  useEffect(() => {
    calibratingRef.current = calibrating;
  }, [calibrating]);
  useEffect(() => {
    annotateActiveRef.current = annotateMode !== 'off';
  }, [annotateMode]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (
      calibratingRef.current ||
      measuringRef.current ||
      drawingCrop ||
      annotateActiveRef.current ||
      transform.scale <= 1
    )
      return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { x: transform.x, y: transform.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current || !mainRef.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const { x, y } = clampPan(
        panOrigin.current.x + dx,
        panOrigin.current.y + dy,
        transform.scale,
        mainRef.current,
      );
      setTransform((prev) => ({ ...prev, x, y }));
    },
    [clampPan, transform.scale],
  );

  const onPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);
  const resetTransform = useCallback(
    () => setTransform({ scale: 1, x: 0, y: 0 }),
    [],
  );

  // ── File load ─────────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (videoMeta?.src) URL.revokeObjectURL(videoMeta.src);
      const src = URL.createObjectURL(file);
      const tmp = document.createElement('video');
      tmp.src = src;
      tmp.muted = true;
      tmp.preload = 'auto';

      tmp.onloadedmetadata = async () => {
        setVideoProbing(true);
        const fps = await probeVideoFps(src);
        setVideoProbing(false);

        setVideoMeta({
          src,
          fps,
          title: file.name.replace(/\.[^/.]+$/, ''),
          width: tmp.videoWidth,
          height: tmp.videoHeight,
          totalFrames: Math.floor(tmp.duration * fps),
          duration: tmp.duration,
        });
        setCurrentFrame(0);
        setIsPlaying(false);
        setPlaybackRate(1);
        setStartFrame(null);
        setCalibration(null);
        setCalibrating(false);
        setMeasuringDistance(false);
        setMeasuringAngle(false);
        setMeasurements([]);
        setShowMeasurementPanel(false);
        setPoseEnabled(false);
        setShowPosePanel(false);
        setViewMode('video');
        setManualContacts([]);
        setDeletedContactIds(new Set());
        setAnnotateMode('off');
        setSprintStart(null);
        setSprintFinish(null);
        setComEvents([]);
        setShowCoMEvents(true);
        resetPose();
        setLandmarkVisibility(buildDefaultVisibility());
        setShowTrimCropPanel(false);
        setCropRect(null);
        setDrawingCrop(false);
        setShowCropOverlay(false);
        setTrimPoints({ inPoint: 0, outPoint: tmp.duration });
        resetTransform();
      };
    },
    [videoMeta, resetTransform, resetPose],
  );

  const handleSeekToFrame = useCallback(
    (frame: number) => {
      setCurrentFrame(Math.max(0, Math.min(frame, totalFrames - 1)));
      setVideoEnded(false);
    },
    [totalFrames],
  );

  const stopWheel = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.addEventListener('wheel', (e) => e.stopPropagation(), {
      passive: false,
    });
  }, []);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleToggleLandmark = useCallback((index: number) => {
    setLandmarkVisibility((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const handleToggleRegion = useCallback((region: LandmarkDef['region']) => {
    const regionLandmarks = LANDMARKS.filter((l) => l.region === region);
    setLandmarkVisibility((prev) => {
      const allOn = regionLandmarks.every((l) => prev[l.index]);
      const next = { ...prev };
      for (const l of regionLandmarks) next[l.index] = !allOn;
      return next;
    });
  }, []);

  // getKeypoints3D & mode3D are wired — used when 3D view is built
  void getKeypoints3D;
  const zoomLabel =
    transform.scale > 1 ? `${transform.scale.toFixed(1)}×` : null;

  return (
    <div className="viewport-container flex flex-col h-full">
      <header className="shrink-0 border border-t-0 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950">
        {/* Row 1 — video metadata */}
        <div className="flex items-center px-3 h-5 gap-3 border-b border-zinc-200 dark:border-zinc-800/60">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 font-sans">
              Viewport
            </span>
          </div>
          <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <FilePlayIcon className="h-2.5 w-2.5" />
              {videoMeta ? videoMeta.title : 'No Video'}
            </span>
            {videoMeta && (
              <>
                <span className="flex items-center gap-1">
                  <IconDimensions className="h-2.5 w-2.5" />
                  {videoMeta.width}×{videoMeta.height}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {fps % 1 === 0 ? fps : fps.toFixed(3)} fps
                </span>
                {zoomLabel && (
                  <button
                    onClick={resetTransform}
                    className="text-sky-500 hover:text-sky-400 border border-sky-600/40 px-1 py-px rounded-sm transition-colors cursor-pointer"
                  >
                    {zoomLabel} ✕
                  </button>
                )}
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {videoMeta && (
              <button
                onClick={handleUploadClick}
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <Upload className="h-2.5 w-2.5" />
                <span className="font-sans">Replace</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2 — pose controls (only when pose is active) */}
        {videoMeta && poseEnabled && poseStatus === 'ready' && (
          <div className="flex items-center px-3 h-5 gap-2">
            {/* View mode */}
            <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-sm overflow-hidden">
              {(['video', 'skeleton', 'body'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1 px-1.5 h-4.5 text-[9px] uppercase tracking-widest transition-colors cursor-pointer border-r border-zinc-300 dark:border-zinc-700 last:border-r-0
                    ${viewMode === mode
                      ? 'bg-zinc-800 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  {mode === 'video' ? <Layers className="w-2 h-2" /> : <Box className="w-2 h-2" />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>

            <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />

            {/* Annotate */}
            <button
              onClick={() => setAnnotateMode((m) => (m !== 'off' ? 'off' : 'left'))}
              className={`flex items-center gap-1 h-4.5 px-1.5 text-[9px] uppercase tracking-widest border rounded-sm transition-colors cursor-pointer
                ${annotateMode !== 'off'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <Pencil className="w-2 h-2" />
              <span>Annotate{(sprintStart || sprintFinish) ? ' ●' : ''}</span>
            </button>

            {/* 3D */}
            <button
              onClick={() => setMode3D((v) => !v)}
              className={`flex items-center gap-1 h-4.5 px-1.5 text-[9px] uppercase tracking-widest border rounded-sm transition-colors cursor-pointer
                ${mode3D
                  ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                  : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <Box className="w-2 h-2" />
              <span>3D</span>
            </button>

            <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />

            {/* Sprint mode */}
            <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-sm overflow-hidden">
              {(['static', 'flying'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => ctxSetSprintMode(mode)}
                  className={`px-1.5 h-4.5 text-[9px] uppercase tracking-widest transition-colors cursor-pointer border-r border-zinc-300 dark:border-zinc-700 last:border-r-0
                    ${sprintMode === mode
                      ? 'bg-zinc-800 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  {mode === 'static' ? 'Static' : 'Fly'}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main
        ref={mainRef}
        className="flex-1 border border-zinc-400 dark:border-zinc-600 overflow-hidden relative bg-black select-none"
        style={{
          cursor:
            calibrating || measuringDistance || measuringAngle || drawingCrop || annotateMode !== 'off'
              ? 'crosshair'
              : transform.scale > 1
                ? 'grab'
                : 'default',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {videoMeta ? (
          <>
            {viewMode !== 'video' && <div className="absolute inset-0 bg-zinc-950" />}
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
            >
              <VideoLayer
                src={videoMeta.src}
                fps={fps}
                totalFrames={totalFrames}
                currentFrame={currentFrame}
                playbackRate={playbackRate}
                isPlaying={isPlaying}
                skeletonOnly={viewMode !== 'video'}
                onFrameChange={setCurrentFrame}
                onEnded={() => {
                  setIsPlaying(false);
                  setVideoEnded(true);
                }}
                onReady={(el) => {
                  videoElRef.current = el;
                }}
                getKeypoints={
                  poseEnabled && poseStatus === 'ready'
                    ? getKeypoints
                    : undefined
                }
                onKeypoints={
                  poseEnabled && poseStatus === 'ready'
                    ? (kp) => {
                        poseDrawRef.current?.(kp);
                      }
                    : undefined
                }
              />
              {poseEnabled && poseStatus === 'ready' && (
                <PoseOverlay
                  keypoints={getKeypoints(currentFrame)}
                  frameWidth={poseFrameW}
                  frameHeight={poseFrameH}
                  videoNatWidth={videoMeta.width}
                  videoNatHeight={videoMeta.height}
                  visibilityMap={landmarkVisibility}
                  showLabels={showPoseLabels}
                  viewMode={viewMode}
                  drawRef={poseDrawRef}
                  groundContacts={mergedContacts}
                  annotateMode={annotateMode}
                  currentFrame={currentFrame}
                  onAddContact={(c) => setManualContacts((prev) => [...prev, c])}
                  onMoveContact={(id, site) =>
                    setManualContacts((prev) =>
                      prev.map((m) => (m.id === id ? { ...m, contactSite: site } : m)),
                    )
                  }
                  onDeleteContact={handleDeleteContact}
                  sprintStart={sprintStart}
                  sprintFinish={sprintFinish}
                  onSetMarker={(type, frame, site) => {
                    if (type === 'start') setSprintStart({ frame, site });
                    else setSprintFinish({ frame, site });
                  }}
                  onClearMarker={(type) => {
                    if (type === 'start') setSprintStart(null);
                    else setSprintFinish(null);
                  }}
                  showCoM={showCoM}
                  comEvents={comEvents}
                  showCoMEvents={showCoMEvents}
                />
              )}
            </div>

            {videoProbing && exportStatus === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-zinc-600 border-t-sky-400 rounded-full animate-spin" />
                  <span className="text-[8px] uppercase tracking-widest text-zinc-500">
                    Analysing…
                  </span>
                </div>
              </div>
            )}

            <CropOverlay
              active={drawingCrop || showCropOverlay}
              cropRect={cropRect}
              videoWidth={videoMeta.width}
              videoHeight={videoMeta.height}
              transform={transform}
              onCropChange={(rect) => setCropRect(rect)}
              onCropComplete={(rect) => {
                setCropRect(rect);
                setDrawingCrop(false);
                setShowCropOverlay(true);
              }}
            />

            <CalibrationOverlay
              key={calibrationKey}
              active={calibrating}
              transform={transform}
              videoWidth={videoMeta.width}
              videoHeight={videoMeta.height}
              existingCalibration={calibration}
              onCalibrationComplete={(data: CalibrationData) => {
                setCalibration(data);
                setCalibrating(false);
              }}
              onCancel={() => setCalibrating(false)}
            />

            {calibration && !calibrating && (
              <CalibrationOverlay
                active={false}
                transform={transform}
                videoWidth={videoMeta.width}
                videoHeight={videoMeta.height}
                existingCalibration={calibration}
                onCalibrationComplete={() => {}}
                onCancel={() => {}}
              />
            )}

            {calibration && (
              <MeasurementOverlay
                key={measuringKey}
                active={measuringDistance || measuringAngle}
                mode={measuringAngle ? 'angle' : 'distance'}
                transform={transform}
                calibration={calibration}
                measurements={measurements}
                onMeasurementAdded={(m) => {
                  setMeasurements((prev) => [...prev, m]);
                  setShowMeasurementPanel(true);
                }}
              />
            )}

            {(measuringDistance || measuringAngle) && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 border border-zinc-600 rounded-sm backdrop-blur-sm pointer-events-auto">
                  <div
                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${measuringAngle ? 'bg-violet-400' : 'bg-sky-400'}`}
                  />
                  <span
                    className={`text-[11px] uppercase tracking-widest ${measuringAngle ? 'text-violet-300' : 'text-zinc-300'}`}
                  >
                    {measuringAngle
                      ? 'Click: ray A → vertex → ray B'
                      : 'Click two points to measure'}
                  </span>
                  <button
                    onClick={() => {
                      setMeasuringDistance(false);
                      setMeasuringAngle(false);
                    }}
                    className="ml-2 text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {annotateMode !== 'off' && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 border border-amber-600/50 rounded-sm backdrop-blur-sm pointer-events-auto">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-amber-400" />
                  {/* Mode selector */}
                  <div className="flex items-center border border-zinc-600 rounded-sm overflow-hidden">
                    {(
                      [
                        { key: 'left', label: 'Left', color: 'text-emerald-400' },
                        { key: 'right', label: 'Right', color: 'text-cyan-400' },
                        { key: 'start', label: 'Start', color: 'text-sky-400' },
                        { key: 'finish', label: 'Finish', color: 'text-orange-400' },
                      ] as const
                    ).map(({ key, label, color }) => (
                      <button
                        key={key}
                        onClick={() => setAnnotateMode(key)}
                        className={`px-1.5 py-0.5 text-[10px] uppercase tracking-widest border-r border-zinc-600 last:border-r-0 transition-colors cursor-pointer
                          ${annotateMode === key ? `bg-zinc-700 ${color}` : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {manualContacts.length > 0 && (
                    <button
                      onClick={() => setManualContacts([])}
                      className="text-[11px] uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
                    >
                      Clear steps
                    </button>
                  )}
                  {(sprintStart || sprintFinish) && (
                    <button
                      onClick={() => { setSprintStart(null); setSprintFinish(null); }}
                      className="text-[11px] uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
                    >
                      Clear markers
                    </button>
                  )}
                  <button
                    onClick={() => setAnnotateMode('off')}
                    className="ml-1 text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {showTrimCropPanel && videoMeta && (
              <div
                className="absolute top-0 bottom-0 w-56 border-l border-zinc-400 dark:border-zinc-600 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                style={{
                  right:
                    (showPosePanel ? 224 : 0) +
                    (showMeasurementPanel ? 224 : 0),
                }}
                ref={stopWheel}
              >
                <TrimCropPanel
                  duration={videoMeta.duration}
                  fps={fps}
                  currentTime={currentTime}
                  cropRect={cropRect}
                  trimPoints={trimPoints}
                  videoMeta={{
                    width: videoMeta.width,
                    height: videoMeta.height,
                    title: videoMeta.title,
                  }}
                  onSetTrimIn={() =>
                    setTrimPoints((p) => ({
                      inPoint: currentTime,
                      outPoint: Math.max(p.outPoint, currentTime),
                    }))
                  }
                  onSetTrimOut={() =>
                    setTrimPoints((p) => ({
                      inPoint: Math.min(p.inPoint, currentTime),
                      outPoint: currentTime,
                    }))
                  }
                  onClearTrim={() =>
                    setTrimPoints({ inPoint: 0, outPoint: videoMeta.duration })
                  }
                  onSeekTo={(t) => handleSeekToFrame(Math.round(t * fps))}
                  onSetTrimInTo={(t) =>
                    setTrimPoints((p) => ({
                      inPoint: Math.max(0, Math.min(t, p.outPoint - 1 / fps)),
                      outPoint: p.outPoint,
                    }))
                  }
                  onSetTrimOutTo={(t) =>
                    setTrimPoints((p) => ({
                      inPoint: p.inPoint,
                      outPoint: Math.min(
                        videoMeta.duration,
                        Math.max(t, p.inPoint + 1 / fps),
                      ),
                    }))
                  }
                  onStartCropDraw={() => {
                    setIsPlaying(false);
                    setDrawingCrop(true);
                    setShowCropOverlay(true);
                  }}
                  onClearCrop={() => {
                    setCropRect(null);
                    setShowCropOverlay(false);
                    setDrawingCrop(false);
                  }}
                  onExport={(mode) =>
                    startExport(mode, (url, w, h) => {
                      setCropRect(null);
                      setShowCropOverlay(false);
                      setDrawingCrop(false);
                      if (videoMeta?.src) URL.revokeObjectURL(videoMeta.src);
                      const tmp = document.createElement('video');
                      tmp.src = url;
                      tmp.muted = true;
                      tmp.preload = 'auto';
                      tmp.onloadedmetadata = () => {
                        if (isFinite(tmp.duration) && tmp.duration > 0) {
                          applyReplace(url, w, h, tmp.duration);
                        } else {
                          tmp.currentTime = 1e10;
                          tmp.onseeked = () => {
                            tmp.onseeked = null;
                            applyReplace(url, w, h, tmp.duration);
                          };
                        }
                      };
                      const applyReplace = (
                        src: string,
                        w: number,
                        h: number,
                        dur: number,
                      ) => {
                        const safeDur = isFinite(dur)
                          ? dur
                          : trimPoints.outPoint - trimPoints.inPoint;
                        setVideoMeta({
                          src,
                          fps,
                          title: videoMeta.title + '_clip',
                          width: w,
                          height: h,
                          totalFrames: Math.floor(safeDur * fps),
                          duration: safeDur,
                        });
                        setCurrentFrame(0);
                        setIsPlaying(false);
                        setPlaybackRate(1);
                        setStartFrame(null);
                        setCalibration(null);
                        setCalibrating(false);
                        setMeasuringDistance(false);
                        setMeasuringAngle(false);
                        setMeasurements([]);
                        setShowMeasurementPanel(false);
                        setTrimPoints({ inPoint: 0, outPoint: safeDur });
                        resetTransform();
                      };
                    })
                  }
                  exportStatus={exportStatus}
                  exportProgress={exportProgress}
                  lastExportUrl={lastExportUrl}
                  lastExportTitle={lastExportTitle}
                  onClose={() => setShowTrimCropPanel(false)}
                />
              </div>
            )}

            {showPosePanel && (
              <div
                className="absolute top-0 right-0 bottom-0 w-56 border-l border-zinc-400 dark:border-zinc-600 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                style={{ right: showMeasurementPanel ? '224px' : '0' }}
                ref={stopWheel}
              >
                <PosePanel
                  visibilityMap={landmarkVisibility}
                  showLabels={showPoseLabels}
                  onToggleLandmark={handleToggleLandmark}
                  onToggleRegion={handleToggleRegion}
                  onToggleLabels={() => setShowPoseLabels((v) => !v)}
                  onClose={() => setShowPosePanel(false)}
                />
              </div>
            )}

            {showMeasurementPanel && (
              <div
                className="absolute top-0 right-0 bottom-0 w-56 border-l border-zinc-400 dark:border-zinc-600 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                ref={stopWheel}
              >
                <MeasurementPanel
                  measurements={measurements}
                  onDelete={(id) =>
                    setMeasurements((prev) => prev.filter((m) => m.id !== id))
                  }
                  onDeleteAll={() => setMeasurements([])}
                  onToggleVisible={(id) =>
                    setMeasurements((prev) =>
                      prev.map((m) =>
                        m.id === id ? { ...m, visible: !m.visible } : m,
                      ),
                    )
                  }
                  onToggleAllVisible={() => {
                    const allVisible = measurements.every((m) => m.visible);
                    setMeasurements((prev) =>
                      prev.map((m) => ({ ...m, visible: !allVisible })),
                    );
                  }}
                  onToggleSectionVisible={(type) =>
                    setMeasurements((prev) => {
                      const allVisible = prev
                        .filter((m) => m.type === type)
                        .every((m) => m.visible);
                      return prev.map((m) =>
                        m.type === type ? { ...m, visible: !allVisible } : m,
                      );
                    })
                  }
                  onDeleteSection={(type) =>
                    setMeasurements((prev) =>
                      prev.filter((m) => m.type !== type),
                    )
                  }
                  onClose={() => setShowMeasurementPanel(false)}
                />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-5">
              <div className="w-28 h-28 rounded-sm border border-zinc-500 flex items-center justify-center">
                <Upload className="h-14 w-14 text-zinc-200" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-base uppercase tracking-[0.2em] text-white font-sans">
                  No video loaded
                </span>
                <span className="text-sm text-zinc-300 font-sans">
                  Upload a video to begin analysis
                </span>
              </div>
              <button
                onClick={handleUploadClick}
                className="mt-1 px-5 py-2.5 rounded-sm border border-zinc-500 text-sm uppercase tracking-widest text-white hover:border-sky-400 hover:text-sky-400 transition-all duration-150 cursor-pointer font-sans"
              >
                Upload Video
              </button>
            </div>
          </div>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        style={{ height: sectionHeights.controlSection }}
        className="border shrink-0"
      >
        <ControlPanel
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          fps={fps}
          isPlaying={isPlaying}
          setIsPlaying={(v) => {
            setIsPlaying(v);
            setVideoEnded(false);
          }}
          videoEnded={videoEnded}
          playbackRate={playbackRate}
          setPlaybackRate={setPlaybackRate}
          onSeekToFrame={handleSeekToFrame}
          startFrame={startFrame}
          onSetStartFrame={() => {
            setStartFrame(currentFrame);
            ctxSetConfirmedSprintStart(currentFrame);
          }}
          onClearStartFrame={() => {
            setStartFrame(null);
            ctxSetConfirmedSprintStart(null);
          }}
          proposedStartFrame={proposedSprintStartFrame}
          calibration={calibration}
          onStartCalibration={() => {
            setIsPlaying(false);
            setCalibrationKey((k) => k + 1);
            setCalibrating(true);
          }}
          measuringDistance={measuringDistance}
          measuringAngle={measuringAngle}
          onToggleMeasuringDistance={() => {
            setIsPlaying(false);
            setMeasuringKey((k) => k + 1);
            setMeasuringDistance((m) => !m);
            setMeasuringAngle(false);
          }}
          onToggleMeasuringAngle={() => {
            setIsPlaying(false);
            setMeasuringKey((k) => k + 1);
            setMeasuringAngle((m) => !m);
            setMeasuringDistance(false);
          }}
          measurementCount={measurements.length}
          showMeasurementPanel={showMeasurementPanel}
          onToggleMeasurementPanel={() => setShowMeasurementPanel((v) => !v)}
          poseEnabled={poseEnabled}
          onTogglePose={() => setPoseEnabled((v) => !v)}
          poseStatus={poseStatus}
          showPosePanel={showPosePanel}
          onTogglePosePanel={() => setShowPosePanel((v) => !v)}
          showTrimCropPanel={showTrimCropPanel}
          onToggleTrimCropPanel={() => {
            setShowTrimCropPanel((v) => !v);
            resetTransform();
          }}
          poseReady={poseEnabled && poseStatus === 'ready'}
          showCoM={showCoM}
          onToggleCoM={() => setShowCoM((v) => !v)}
          comEventCount={comEvents.length}
          showCoMEvents={showCoMEvents}
          onToggleCoMEvents={() => setShowCoMEvents((v) => !v)}
          onRecordCoMEvent={handleRecordCoMEvent}
          onClearCoMEvents={() => setComEvents([])}
          disabled={!videoMeta}
        />
      </div>
    </div>
  );
};
