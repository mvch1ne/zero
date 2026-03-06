import { useState, useRef, useCallback } from 'react';
import {
  X,
  Download,
  RefreshCw,
  Scissors,
  Crop,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TrimPoints {
  inPoint: number;
  outPoint: number;
}

type ExportMode = 'replace' | 'download';
export type ExportStatus = 'idle' | 'loading' | 'running' | 'done' | 'error';

interface Props {
  duration: number;
  fps: number;
  currentTime: number;
  cropRect: CropRect | null;
  trimPoints: TrimPoints;
  videoMeta: { width: number; height: number; title: string };
  onSetTrimIn: () => void;
  onSetTrimOut: () => void;
  onClearTrim: () => void;
  onSeekTo: (t: number) => void;
  onSetTrimInTo: (t: number) => void;
  onSetTrimOutTo: (t: number) => void;
  onStartCropDraw: () => void;
  onClearCrop: () => void;
  onExport: (mode: ExportMode) => void;
  exportStatus: ExportStatus;
  exportProgress: number;
  lastExportUrl: string | null;
  lastExportTitle: string | null;
  onClose: () => void;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${String(m).padStart(2, '0')}:${sec}`;
};

const HANDLE_HIT = 10; // px

export const TrimCropPanel = ({
  duration,
  fps,
  currentTime,
  cropRect,
  trimPoints,
  videoMeta,
  onSetTrimIn,
  onSetTrimOut,
  onClearTrim,
  onSeekTo,
  onSetTrimInTo,
  onSetTrimOutTo,
  onStartCropDraw,
  onClearCrop,
  onExport,
  exportStatus,
  exportProgress,
  lastExportUrl,
  lastExportTitle,
  onClose,
}: Props) => {
  const [exportMode, setExportMode] = useState<ExportMode>('replace');
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'in' | 'out' | 'seek' | null>(null);

  const trimDuration = trimPoints.outPoint - trimPoints.inPoint;
  const cropW = cropRect
    ? Math.round(cropRect.w * videoMeta.width)
    : videoMeta.width;
  const cropH = cropRect
    ? Math.round(cropRect.h * videoMeta.height)
    : videoMeta.height;
  const isExporting = exportStatus === 'loading' || exportStatus === 'running';
  const canExport = trimDuration > 0 && !isExporting;

  const xToTime = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el) return 0;
      const { left, width } = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
      return ratio * duration;
    },
    [duration],
  );

  const onTimelinePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const el = timelineRef.current;
      if (!el) return;
      const { left, width } = el.getBoundingClientRect();
      const inX = (trimPoints.inPoint / duration) * width + left;
      const outX = (trimPoints.outPoint / duration) * width + left;

      if (Math.abs(e.clientX - inX) < HANDLE_HIT) {
        dragging.current = 'in';
      } else if (Math.abs(e.clientX - outX) < HANDLE_HIT) {
        dragging.current = 'out';
      } else {
        dragging.current = 'seek';
        onSeekTo(xToTime(e.clientX));
      }
    },
    [trimPoints, duration, xToTime, onSeekTo],
  );

  const onTimelinePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const t = xToTime(e.clientX);
      if (dragging.current === 'in') onSetTrimInTo(t);
      if (dragging.current === 'out') onSetTrimOutTo(t);
      if (dragging.current === 'seek') onSeekTo(t);
    },
    [xToTime, onSetTrimInTo, onSetTrimOutTo, onSeekTo],
  );

  const onTimelinePointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 select-none"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-5 shrink-0 border-b border-zinc-400 dark:border-zinc-600 flex items-center px-3 gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[9px] uppercase tracking-[0.2em] whitespace-nowrap">
            Trim & Crop
          </span>
          <div className="ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onClose}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <X size={10} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Trim ─────────────────────────────────────────── */}
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 dark:bg-zinc-900">
              <Scissors size={9} className="text-emerald-400 shrink-0" />
              <span className="text-[9px] uppercase tracking-widest text-emerald-400 flex-1">
                Trim
              </span>
              {(trimPoints.inPoint > 0 || trimPoints.outPoint < duration) && (
                <button
                  onClick={onClearTrim}
                  className="text-[8px] uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="px-3 py-2 flex flex-col gap-2">
              {/* Timeline scrubber */}
              <div
                ref={timelineRef}
                className="relative h-5 bg-zinc-200 dark:bg-zinc-800 rounded-sm cursor-pointer touch-none"
                onPointerDown={onTimelinePointerDown}
                onPointerMove={onTimelinePointerMove}
                onPointerUp={onTimelinePointerUp}
              >
                {/* Dimmed outside trim */}
                <div
                  className="absolute inset-y-0 left-0 bg-zinc-900/40 rounded-l-sm"
                  style={{ width: `${(trimPoints.inPoint / duration) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-zinc-900/40 rounded-r-sm"
                  style={{
                    width: `${((duration - trimPoints.outPoint) / duration) * 100}%`,
                  }}
                />

                {/* Active trim region */}
                <div
                  className="absolute inset-y-0 bg-emerald-500/20"
                  style={{
                    left: `${(trimPoints.inPoint / duration) * 100}%`,
                    width: `${(trimDuration / duration) * 100}%`,
                  }}
                />

                {/* In handle */}
                <div
                  className="absolute inset-y-0 w-1 bg-emerald-500 cursor-ew-resize"
                  style={{ left: `${(trimPoints.inPoint / duration) * 100}%` }}
                />
                {/* Out handle */}
                <div
                  className="absolute inset-y-0 w-1 bg-emerald-500 cursor-ew-resize"
                  style={{ left: `${(trimPoints.outPoint / duration) * 100}%` }}
                />

                {/* Playhead */}
                <div
                  className="absolute inset-y-0 w-px bg-sky-400 pointer-events-none"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              </div>

              {/* In / Out rows */}
              {(
                [
                  { label: 'In', time: trimPoints.inPoint, onSet: onSetTrimIn },
                  {
                    label: 'Out',
                    time: trimPoints.outPoint,
                    onSet: onSetTrimOut,
                  },
                ] as const
              ).map(({ label, time, onSet }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 w-6">
                    {label}
                  </span>
                  <span className="text-xs tabular-nums font-mono flex-1 text-sky-500 dark:text-sky-300">
                    {fmt(time)}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onSet}
                        className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 border border-zinc-400 dark:border-zinc-600 text-zinc-500 hover:border-emerald-500 hover:text-emerald-400 transition-colors cursor-pointer rounded-sm"
                      >
                        Set
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Set {label} to current frame
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}

              {/* Duration */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 w-6">
                  Dur
                </span>
                <span className="text-xs tabular-nums font-mono text-zinc-500">
                  {fmt(trimDuration)}
                </span>
                <span className="text-[8px] text-zinc-500 ml-auto">
                  {Math.round(trimDuration * fps)} frames
                </span>
              </div>
            </div>
          </div>

          {/* ── Crop ─────────────────────────────────────────── */}
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 dark:bg-zinc-900">
              <Crop size={9} className="text-sky-400 shrink-0" />
              <span className="text-[9px] uppercase tracking-widest text-sky-400 flex-1">
                Crop
              </span>
              {cropRect && (
                <button
                  onClick={onClearCrop}
                  className="text-[8px] uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="px-3 py-2 flex flex-col gap-2">
              {cropRect ? (
                <>
                  {[
                    {
                      label: 'X',
                      val: `${Math.round(cropRect.x * videoMeta.width)}px`,
                    },
                    {
                      label: 'Y',
                      val: `${Math.round(cropRect.y * videoMeta.height)}px`,
                    },
                    { label: 'W', val: `${cropW}px` },
                    { label: 'H', val: `${cropH}px` },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-widest text-zinc-500 w-4">
                        {label}
                      </span>
                      <span className="text-xs tabular-nums font-mono text-sky-500 dark:text-sky-300">
                        {val}
                      </span>
                    </div>
                  ))}
                  <div className="text-[8px] text-zinc-500">
                    Output: {cropW} × {cropH}px
                  </div>
                  <button
                    onClick={onStartCropDraw}
                    className="text-[8px] uppercase tracking-widest px-2 py-1 border border-zinc-400 dark:border-zinc-600 text-zinc-500 hover:border-sky-500 hover:text-sky-400 transition-colors cursor-pointer rounded-sm text-center"
                  >
                    Redraw
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onStartCropDraw}
                    className="text-[8px] uppercase tracking-widest px-2 py-1.5 border border-zinc-400 dark:border-zinc-600 text-zinc-500 hover:border-sky-500 hover:text-sky-400 transition-colors cursor-pointer rounded-sm text-center"
                  >
                    Draw crop region
                  </button>
                  <p className="text-[8px] text-zinc-500 leading-relaxed">
                    No crop — full frame
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Export ───────────────────────────────────────── */}
          <div className="px-3 py-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-zinc-500">
                Output
              </span>
              <button
                onClick={() =>
                  setExportMode((m) =>
                    m === 'download' ? 'replace' : 'download',
                  )
                }
                className="ml-auto flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {exportMode === 'download' ? (
                  <>
                    <Download size={9} /> Download
                  </>
                ) : (
                  <>
                    <RefreshCw size={9} /> Replace
                  </>
                )}
                {exportMode === 'download' ? (
                  <ToggleLeft size={12} />
                ) : (
                  <ToggleRight size={12} className="text-sky-400" />
                )}
              </button>
            </div>

            {isExporting && (
              <div className="flex flex-col gap-1">
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{ width: `${exportProgress * 100}%` }}
                  />
                </div>
                <span className="text-[8px] text-zinc-500 tabular-nums">
                  {exportStatus === 'loading'
                    ? 'Loading ffmpeg…'
                    : `Encoding… ${Math.round(exportProgress * 100)}%`}
                </span>
              </div>
            )}

            {exportStatus === 'done' && (
              <div className="flex flex-col gap-2">
                <span className="text-[8px] text-emerald-400 uppercase tracking-widest">
                  Done
                </span>
                {lastExportUrl && exportMode === 'replace' && (
                  <a
                    href={lastExportUrl}
                    download={`${lastExportTitle ?? 'clip'}_clip.webm`}
                    className="w-full py-1.5 text-[9px] uppercase tracking-widest border border-zinc-600 text-zinc-400 hover:border-sky-500 hover:text-sky-400 transition-colors cursor-pointer rounded-sm text-center block"
                  >
                    Download copy
                  </a>
                )}
              </div>
            )}
            {exportStatus === 'error' && (
              <span className="text-[8px] text-red-400 uppercase tracking-widest">
                Export failed
              </span>
            )}

            <button
              onClick={() => onExport(exportMode)}
              disabled={!canExport}
              className="w-full py-1.5 text-[9px] uppercase tracking-widest border border-emerald-600 text-emerald-400 hover:bg-emerald-600/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer rounded-sm"
            >
              {isExporting ? 'Exporting…' : 'Export clip'}
            </button>

            {!canExport && !isExporting && (
              <p className="text-[8px] text-zinc-500 leading-relaxed">
                Set trim in and out points to export
              </p>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
