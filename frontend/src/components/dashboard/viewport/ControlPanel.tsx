import { useEffect, useCallback, useState, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronFirst,
  ChevronLast,
  Gauge,
  Flag,
  Ruler,
  Crosshair,
  Triangle,
  PanelRight,
  ScanLine,
  Settings2,
  Scissors,
  MapPin,
  Activity,
  EyeOff,
  Eye,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CalibrationData } from './CalibrationAndMeasurements/CalibrationOverlay';
import type { LandmarkerStatus } from './PoseEngine/usePoseLandmarker';

const SPEED_OPTIONS = [0.0625, 0.125, 0.25, 0.5, 1, 1.5, 2, 4];
const SPEED_LABELS: Record<number, string> = {
  0.0625: '1/16×',
  0.125: '1/8×',
  0.25: '1/4×',
  0.5: '1/2×',
};
const speedLabel = (s: number) => SPEED_LABELS[s] ?? `${s}×`;

interface ControlPanelProps {
  currentFrame: number;
  totalFrames: number;
  fps: number;
  isPlaying: boolean;
  setIsPlaying: (v: boolean | ((p: boolean) => boolean)) => void;
  videoEnded: boolean;
  playbackRate: number;
  setPlaybackRate: (v: number) => void;
  onSeekToFrame: (frame: number) => void;
  startFrame: number | null;
  onSetStartFrame: () => void;
  onClearStartFrame: () => void;
  calibration: CalibrationData | null;
  onStartCalibration: () => void;
  measuringDistance: boolean;
  measuringAngle: boolean;
  onToggleMeasuringDistance: () => void;
  onToggleMeasuringAngle: () => void;
  measurementCount: number;
  showMeasurementPanel: boolean;
  onToggleMeasurementPanel: () => void;
  poseEnabled: boolean;
  onTogglePose: () => void;
  poseStatus: LandmarkerStatus;
  showPosePanel: boolean;
  onTogglePosePanel: () => void;
  showTrimCropPanel: boolean;
  onToggleTrimCropPanel: () => void;
  // CoM controls
  poseReady?: boolean;
  showCoM?: boolean;
  onToggleCoM?: () => void;
  comEventCount?: number;
  showCoMEvents?: boolean;
  onToggleCoMEvents?: () => void;
  onRecordCoMEvent?: () => void;
  onClearCoMEvents?: () => void;
  /** Auto-detected proposed sprint start frame (green dashed marker on scrubber). */
  proposedStartFrame?: number | null;
  disabled?: boolean;
}

function IconBtn({
  onClick,
  tooltip,
  children,
  disabled = false,
  active = false,
}: {
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`
            flex items-center justify-center w-7 h-7 rounded-sm
            border transition-all duration-100 select-none
            ${
              disabled
                ? 'opacity-25 cursor-not-allowed border-transparent'
                : active
                  ? 'bg-sky-600/20 border-sky-500/60 text-sky-500 cursor-pointer'
                  : 'border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:border-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer'
            }
          `}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[11px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <span className="text-xs text-sky-600 dark:text-sky-300 tabular-nums leading-none font-mono">
        {value}
      </span>
    </div>
  );
}

function TimeRuler({
  totalFrames,
  fps,
  frameToTimecode,
  onSeekToFrame,
}: {
  totalFrames: number;
  fps: number;
  frameToTimecode: (f: number) => string;
  onSeekToFrame: (f: number) => void;
}) {
  const [markerA, setMarkerA] = useState<number | null>(null);
  const [markerB, setMarkerB] = useState<number | null>(null);
  const dragging = useRef<'a' | 'b' | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const posToFrame = useCallback(
    (clientX: number): number => {
      const rail = railRef.current;
      if (!rail || totalFrames < 2) return 0;
      const { left, width } = rail.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
      return Math.round(ratio * (totalFrames - 1));
    },
    [totalFrames],
  );

  const pct = useCallback(
    (frame: number) =>
      totalFrames > 1 ? (frame / (totalFrames - 1)) * 100 : 0,
    [totalFrames],
  );

  const handleRailClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging.current) return;
      const f = posToFrame(e.clientX);
      if (markerA === null) {
        setMarkerA(f);
        onSeekToFrame(f);
      } else if (markerB === null) {
        setMarkerB(f);
        onSeekToFrame(f);
      }
    },
    [markerA, markerB, posToFrame, onSeekToFrame],
  );

  const startDrag = useCallback((marker: 'a' | 'b', e: React.PointerEvent) => {
    e.stopPropagation();
    dragging.current = marker;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const f = posToFrame(e.clientX);
      if (dragging.current === 'a') {
        setMarkerA(f);
        onSeekToFrame(f);
      } else {
        setMarkerB(f);
        onSeekToFrame(f);
      }
    },
    [posToFrame, onSeekToFrame],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  const frameDelta =
    markerA !== null && markerB !== null ? Math.abs(markerB - markerA) : null;
  const timeDelta = frameDelta !== null ? frameDelta / fps : null;
  const lo =
    markerA !== null && markerB !== null
      ? Math.min(pct(markerA), pct(markerB))
      : null;
  const hi =
    markerA !== null && markerB !== null
      ? Math.max(pct(markerA), pct(markerB))
      : null;

  if (totalFrames < 2) return null;

  return (
    <div className="px-4 pb-1 pt-0.5 flex flex-col gap-1">
      <div
        ref={railRef}
        className="relative h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-crosshair select-none"
        onClick={handleRailClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {lo !== null && hi !== null && (
          <div
            className="absolute top-0 h-full bg-amber-400/30 rounded-full pointer-events-none"
            style={{ left: `${lo}%`, width: `${hi - lo}%` }}
          />
        )}
        {markerA !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-400 border-2 border-zinc-950 cursor-ew-resize z-10 touch-none"
            style={{ left: `${pct(markerA)}%` }}
            onPointerDown={(e) => startDrag('a', e)}
          >
            <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] text-amber-400 font-mono select-none pointer-events-none">
              A
            </span>
          </div>
        )}
        {markerB !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-sky-400 border-2 border-zinc-950 cursor-ew-resize z-10 touch-none"
            style={{ left: `${pct(markerB)}%` }}
            onPointerDown={(e) => startDrag('b', e)}
          >
            <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] text-sky-400 font-mono select-none pointer-events-none">
              B
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 h-4">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 shrink-0 font-mono">
          Δt
        </span>
        {timeDelta !== null ? (
          <>
            <span className="text-[11px] font-mono text-amber-400 tabular-nums">
              {frameToTimecode(frameDelta!)}
            </span>
            <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
              {timeDelta.toFixed(4)}s
            </span>
            <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
              {frameDelta} fr
            </span>
            <button
              onClick={() => {
                setMarkerA(null);
                setMarkerB(null);
              }}
              className="ml-auto text-[10px] uppercase tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </>
        ) : (
          <span className="text-[10px] text-zinc-600 italic font-mono">
            {markerA === null ? 'click to set A' : 'click to set B'}
          </span>
        )}
      </div>
    </div>
  );
}

export function ControlPanel({
  currentFrame,
  totalFrames,
  fps,
  isPlaying,
  setIsPlaying,
  videoEnded,
  playbackRate,
  setPlaybackRate,
  onSeekToFrame,
  startFrame,
  onSetStartFrame,
  onClearStartFrame,
  calibration,
  onStartCalibration,
  measuringDistance,
  measuringAngle,
  onToggleMeasuringDistance,
  onToggleMeasuringAngle,
  measurementCount,
  showMeasurementPanel,
  onToggleMeasurementPanel,
  poseEnabled,
  onTogglePose,
  poseStatus,
  showPosePanel,
  onTogglePosePanel,
  showTrimCropPanel,
  onToggleTrimCropPanel,
  poseReady = false,
  showCoM = true,
  onToggleCoM,
  comEventCount = 0,
  showCoMEvents = true,
  onToggleCoMEvents,
  onRecordCoMEvent,
  onClearCoMEvents,
  proposedStartFrame = null,
  disabled = false,
}: ControlPanelProps) {
  const effectiveFps = (fps || 30) * (playbackRate || 1);
  const frameDuration = 1 / (fps || 30);
  const fpsDisplay = disabled ? '—' : `${effectiveFps}`;
  const deltaDisplay = disabled ? '—' : `${frameDuration.toFixed(4)}s`;

  const frameToTimecode = (frame: number) => {
    const f = Math.max(0, frame);
    const totalSecs = f / (fps || 30);
    const mins = Math.floor(totalSecs / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSecs % 60).toFixed(4).padStart(7, '0');
    return `${mins}:${secs}`;
  };

  const relativeFrame = startFrame !== null ? currentFrame - startFrame : null;
  const absRelFrame = relativeFrame !== null ? Math.abs(relativeFrame) : null;
  const timePrefix = relativeFrame !== null && relativeFrame < 0 ? '−' : '';

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    onSeekToFrame(Math.min(currentFrame + 1, totalFrames - 1));
  }, [currentFrame, totalFrames, onSeekToFrame, setIsPlaying]);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    onSeekToFrame(Math.max(currentFrame - 1, 0));
  }, [currentFrame, onSeekToFrame, setIsPlaying]);

  const jumpToStart = () => {
    setIsPlaying(false);
    onSeekToFrame(0);
  };
  const jumpToEnd = () => {
    setIsPlaying(false);
    onSeekToFrame(totalFrames - 1);
  };

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowLeft', ' '].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowRight') stepForward();
      if (e.key === 'ArrowLeft') stepBack();
      if (e.key === ' ') {
        if (videoEnded) {
          onSeekToFrame(0);
          setIsPlaying(true);
        } else setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    stepForward,
    stepBack,
    setIsPlaying,
    disabled,
    videoEnded,
    onSeekToFrame,
  ]);

  const progress =
    totalFrames > 1 ? (currentFrame / (totalFrames - 1)) * 100 : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    onSeekToFrame(Math.round(ratio * (totalFrames - 1)));
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={`ControlPanelContainer h-full w-full flex flex-col bg-white dark:bg-zinc-950 dark:text-zinc-200 transition-opacity ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <div className="TopBar h-5 shrink-0 border border-b-0 border-zinc-400 dark:border-zinc-600 flex items-center px-3 gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
            Playback Control
          </span>
          <div className="ml-auto flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600"
              />
            ))}
          </div>
        </div>

        <div className="MainControls flex-1 border border-t-0 border-zinc-400 dark:border-zinc-600 flex flex-col overflow-hidden">
          {/* Scrubber */}
          <div className="ScrubberSection px-4 pt-2 pb-1">
            <div
              className="relative h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer group"
              onClick={handleScrub}
            >
              <div
                className="absolute left-0 top-0 h-full bg-sky-500 dark:bg-sky-600 rounded-full transition-none"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-sky-500 border-2 border-white dark:bg-sky-400 dark:border-zinc-950 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
              {Array.from({ length: 25 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-full mt-0.5 w-px h-1 bg-zinc-300 dark:bg-zinc-600"
                  style={{ left: `${(i / 24) * 100}%` }}
                />
              ))}
              {startFrame !== null && totalFrames > 1 && (
                <div
                  className="-top-1 -bottom-1 absolute w-px bg-orange-400"
                  style={{ left: `${(startFrame / (totalFrames - 1)) * 100}%` }}
                />
              )}
              {proposedStartFrame !== null && proposedStartFrame !== startFrame && totalFrames > 1 && (
                <div
                  className="-top-1 -bottom-1 absolute w-px border-l border-dashed border-emerald-500/60"
                  style={{ left: `${(proposedStartFrame / (totalFrames - 1)) * 100}%` }}
                />
              )}
            </div>
          </div>

          {/* Sprint start row — proposed + confirm */}
          {(startFrame !== null || proposedStartFrame != null) && (
            <div className="px-4 pb-0.5 flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 shrink-0">Sprint Start</span>
              {startFrame !== null ? (
                <>
                  <span className="text-[9px] font-mono text-emerald-400 tabular-nums">Frame {startFrame} confirmed</span>
                  <button onClick={onClearStartFrame} className="text-[9px] uppercase tracking-widest text-red-500/60 hover:text-red-400 cursor-pointer ml-1">Clear</button>
                </>
              ) : proposedStartFrame != null ? (
                <>
                  <span className="text-[9px] font-mono text-amber-400 tabular-nums">Frame {proposedStartFrame} proposed</span>
                  <button
                    onClick={onSetStartFrame}
                    className="text-[9px] uppercase tracking-widest text-emerald-400 hover:text-emerald-300 cursor-pointer border border-emerald-500/40 px-1 rounded-sm"
                  >
                    Confirm
                  </button>
                </>
              ) : null}
            </div>
          )}

          <TimeRuler
            totalFrames={totalFrames}
            fps={fps}
            frameToTimecode={frameToTimecode}
            onSeekToFrame={onSeekToFrame}
          />

          {/* Readouts */}
          <div className="ReadoutsRow flex justify-between items-center px-4 pt-1 pb-0.5">
            <Readout
              label={startFrame !== null ? 'Rel. Frame' : 'Frame'}
              value={`${relativeFrame !== null ? relativeFrame : currentFrame} / ${totalFrames > 0 ? totalFrames - 1 : 0}`}
            />
            <Readout
              label={startFrame !== null ? 'Rel. Time' : 'Timecode'}
              value={`${timePrefix}${frameToTimecode(absRelFrame !== null ? absRelFrame : currentFrame)}`}
            />
            <Readout
              label="Duration"
              value={totalFrames > 1 ? frameToTimecode(totalFrames - 1) : '—'}
            />
            <Readout label="FPS" value={fpsDisplay} />
            <Readout label="∆/frame" value={deltaDisplay} />
          </div>

          <div className="mx-4 border-t border-zinc-400 dark:border-zinc-600/60" />

          {/* Transport */}
          <div className="ControlInputSection flex flex-1 items-center px-4 gap-2 flex-wrap">
            <IconBtn onClick={jumpToStart} tooltip="Jump to start">
              <ChevronFirst size={14} />
            </IconBtn>
            <IconBtn
              onClick={stepBack}
              tooltip="Step back (←)"
              disabled={currentFrame === 0}
            >
              <SkipBack size={14} />
            </IconBtn>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (videoEnded) {
                      onSeekToFrame(0);
                      setIsPlaying(true);
                    } else setIsPlaying((p) => !p);
                  }}
                  className={`flex items-center justify-center w-9 h-9 rounded-sm border transition-all duration-150 cursor-pointer
                    ${
                      isPlaying
                        ? 'bg-sky-500 border-sky-400 text-white shadow-[0_0_12px_rgba(14,165,233,0.4)] dark:bg-sky-600 dark:border-sky-500'
                        : 'bg-zinc-100 border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 hover:border-zinc-500 dark:bg-zinc-950 dark:border-zinc-600 dark:hover:bg-zinc-800'
                    }`}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              </TooltipContent>
            </Tooltip>

            <IconBtn
              onClick={stepForward}
              tooltip="Step forward (→)"
              disabled={currentFrame === totalFrames - 1}
            >
              <SkipForward size={14} />
            </IconBtn>
            <IconBtn onClick={jumpToEnd} tooltip="Jump to end">
              <ChevronLast size={14} />
            </IconBtn>

            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />

            <Select
              value={String(playbackRate)}
              onValueChange={(v) => setPlaybackRate(Number(v))}
            >
              <SelectTrigger className="h-7 text-xs px-2 bg-zinc-50 border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 dark:bg-zinc-950 dark:border-zinc-600 dark:hover:border-zinc-500 cursor-pointer">
                <Gauge size={12} className="shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEED_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-xs">
                    {speedLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />

            <IconBtn
              onClick={
                startFrame !== null ? onClearStartFrame : onSetStartFrame
              }
              tooltip={
                startFrame !== null
                  ? `Sprint start: frame ${startFrame} — click to clear`
                  : proposedStartFrame != null
                    ? `Override sprint start (proposed: ${proposedStartFrame})`
                    : 'Set sprint start (current frame)'
              }
              active={startFrame !== null}
            >
              <Flag size={14} />
            </IconBtn>

            <IconBtn
              onClick={onStartCalibration}
              tooltip={
                calibration
                  ? `Calibrated: ${calibration.realMeters}m — click to redo`
                  : 'Calibrate distance'
              }
              active={!!calibration}
            >
              <Ruler size={14} />
            </IconBtn>

            <IconBtn
              onClick={onToggleMeasuringDistance}
              tooltip={
                !calibration
                  ? 'Calibrate first to measure'
                  : measuringDistance
                    ? 'Stop measuring distance'
                    : 'Measure distance'
              }
              active={measuringDistance}
              disabled={!calibration}
            >
              <Crosshair size={14} />
            </IconBtn>

            <IconBtn
              onClick={onToggleMeasuringAngle}
              tooltip={
                !calibration
                  ? 'Calibrate first to measure angles'
                  : measuringAngle
                    ? 'Stop measuring angle'
                    : 'Measure angle'
              }
              active={measuringAngle}
              disabled={!calibration}
            >
              <Triangle size={14} />
            </IconBtn>

            <IconBtn
              onClick={onToggleMeasurementPanel}
              tooltip={
                showMeasurementPanel
                  ? 'Hide measurements'
                  : `Show measurements${measurementCount > 0 ? ` (${measurementCount})` : ''}`
              }
              active={showMeasurementPanel}
              disabled={!calibration}
            >
              <PanelRight size={14} />
            </IconBtn>

            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />

            <IconBtn
              onClick={onTogglePose}
              tooltip={
                poseStatus === 'loading'
                  ? 'Loading pose model…'
                  : poseStatus === 'error'
                    ? 'Pose model failed to load'
                    : poseEnabled
                      ? 'Disable pose detection'
                      : 'Enable pose detection'
              }
              active={poseEnabled}
            >
              {poseStatus === 'loading' ? (
                <span className="text-[10px] animate-pulse">…</span>
              ) : (
                <ScanLine size={14} />
              )}
            </IconBtn>

            <IconBtn
              onClick={onTogglePosePanel}
              tooltip={
                showPosePanel ? 'Hide landmark config' : 'Configure landmarks'
              }
              active={showPosePanel}
              disabled={!poseEnabled}
            >
              <Settings2 size={14} />
            </IconBtn>

            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />

            <IconBtn
              onClick={onToggleTrimCropPanel}
              tooltip={showTrimCropPanel ? 'Hide trim & crop' : 'Trim & crop'}
              active={showTrimCropPanel}
            >
              <Scissors size={14} />
            </IconBtn>

            {poseReady && (
              <>
                <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />
                <IconBtn
                  onClick={() => onToggleCoM?.()}
                  tooltip={showCoM ? 'Hide CoM marker' : 'Show CoM marker'}
                  active={showCoM}
                >
                  <MapPin size={14} />
                </IconBtn>
                <IconBtn
                  onClick={() => onRecordCoMEvent?.()}
                  tooltip="Record CoM event at current frame"
                >
                  <Activity size={14} />
                </IconBtn>
                {comEventCount > 0 && (
                  <>
                    <IconBtn
                      onClick={() => onToggleCoMEvents?.()}
                      tooltip={showCoMEvents ? 'Hide CoM events' : 'Show CoM events'}
                      active={showCoMEvents}
                    >
                      {showCoMEvents ? <Eye size={14} /> : <EyeOff size={14} />}
                    </IconBtn>
                    <button
                      onClick={() => onClearCoMEvents?.()}
                      className="text-[9px] uppercase tracking-widest text-red-500/70 hover:text-red-400 transition-colors cursor-pointer px-1"
                      title="Clear all CoM events"
                    >
                      {comEventCount} evt
                    </button>
                  </>
                )}
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              {[
                ['←→', 'step'],
                ['Space', 'play'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="text-[11px] px-1 py-0.5 bg-zinc-100 border border-zinc-400 dark:bg-zinc-950 dark:border-zinc-600 rounded-sm text-zinc-700 dark:text-zinc-300 leading-none">
                    {key}
                  </span>
                  <span className="text-[11px] text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
