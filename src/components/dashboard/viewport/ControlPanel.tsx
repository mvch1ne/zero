import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronFirst,
  ChevronLast,
  Gauge,
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

const TOTAL_FRAMES = 240;
const FPS = 30;

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 4];

function IconBtn({
  onClick,
  tooltip,
  children,
  active = false,
  disabled = false,
}: {
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
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
                  ? 'bg-sky-600/20 border-sky-500/60 text-sky-400 cursor-pointer'
                  : 'border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:border-zinc-1000 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer'
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
      <span className="text-[9px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 dark:bg-zinc-950">
        {label}
      </span>
      <span className="text-xs text-sky-600 dark:text-sky-300 tabular-nums leading-none">
        {value}
      </span>
    </div>
  );
}

export function ControlPanel() {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const frameToTimecode = (frame: number) => {
    const totalSecs = frame / FPS;
    const mins = Math.floor(totalSecs / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(totalSecs % 60)
      .toString()
      .padStart(2, '0');
    const frames = (frame % FPS).toString().padStart(2, '0');
    return `${mins}:${secs}:${frames}`;
  };

  const stepForward = useCallback(() => {
    setCurrentFrame((f) => Math.min(f + 1, TOTAL_FRAMES - 1));
  }, []);

  const stepBack = useCallback(() => {
    setCurrentFrame((f) => Math.max(f - 1, 0));
  }, []);

  const jumpToStart = () => {
    setCurrentFrame(0);
    setIsPlaying(false);
  };
  const jumpToEnd = () => {
    setCurrentFrame(TOTAL_FRAMES - 1);
    setIsPlaying(false);
  };

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowLeft', ' '].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowRight') {
        setIsPlaying(false);
        stepForward();
      }
      if (e.key === 'ArrowLeft') {
        setIsPlaying(false);
        stepBack();
      }
      if (e.key === ' ') {
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepForward, stepBack]);

  // Playback loop
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying) {
      const ms = 1000 / FPS / speed;
      intervalRef.current = setInterval(() => {
        setCurrentFrame((f) => {
          if (f >= TOTAL_FRAMES - 1) {
            setIsPlaying(false);
            return f;
          }
          return f + 1;
        });
      }, ms);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed]);

  const progress = (currentFrame / (TOTAL_FRAMES - 1)) * 100;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    setCurrentFrame(Math.round(ratio * (TOTAL_FRAMES - 1)));
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="ControlPanelContainer h-full w-full flex flex-col bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        {/* Top label bar */}
        <div className="TopBar h-5 shrink-0 border border-b-0 border-zinc-400 dark:border-zinc-600 flex items-center px-3 gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 dark:bg-zinc-950">
            Playback Control
          </span>
          <div className="ml-auto flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-zinc-300 dark:text-zinc-300"
              />
            ))}
          </div>
        </div>

        {/* Main controls */}
        <div className="MainControls flex-1 border border-t-0 border-zinc-400 dark:border-zinc-600 flex flex-col overflow-hidden">
          {/* Scrubber */}
          <div className="ScrubberSection px-4 pt-3 pb-1">
            <div
              className="relative h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer group"
              onClick={handleScrub}
            >
              {/* Filled track */}
              <div
                className="absolute left-0 top-0 h-full bg-sky-500 dark:bg-sky-600 rounded-full transition-none"
                style={{ width: `${progress}%` }}
              />
              {/* Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-sky-500 border-2 border-white dark:bg-sky-400 dark:border-zinc-950 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
              {/* Frame tick marks */}
              {Array.from({ length: 25 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-full mt-0.5 w-px h-1 bg-zinc-300 dark:text-zinc-300"
                  style={{ left: `${(i / 24) * 100}%` }}
                />
              ))}
            </div>
          </div>

          {/* Timecode readouts */}
          <div className="ReadoutsRow flex justify-between items-center px-4 pt-2 pb-1">
            {/* Could add padding to the front of the current frame number */}
            {/* currentFrame.toString().padStart(4, '0') */}
            <Readout
              label="Frame"
              value={`${currentFrame.toString()} / ${(TOTAL_FRAMES - 1).toString()}`}
            />
            <Readout label="Timecode" value={frameToTimecode(currentFrame)} />
            <Readout
              label="Duration"
              value={frameToTimecode(TOTAL_FRAMES - 1)}
            />
            <Readout label="FPS" value={`${FPS * speed}`} />
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-zinc-400 dark:border-zinc-600/60" />

          {/* Transport controls */}
          <div className="ControlInputSection flex flex-1 items-center px-4 gap-2 flex-wrap">
            {/* Jump to start */}
            <IconBtn onClick={jumpToStart} tooltip="Jump to start">
              <ChevronFirst size={14} />
            </IconBtn>

            {/* Step back */}
            <IconBtn
              onClick={() => {
                setIsPlaying(false);
                stepBack();
              }}
              tooltip="Step back (←)"
              disabled={currentFrame === 0}
            >
              <SkipBack size={14} />
            </IconBtn>

            {/* Play / Pause */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className={`
                  flex items-center justify-center w-9 h-9 rounded-sm
                  border transition-all duration-150 cursor-pointer
                  ${
                    isPlaying
                      ? 'bg-sky-500 border-sky-400 text-white shadow-[0_0_12px_rgba(14,165,233,0.4)] dark:bg-sky-600 dark:border-sky-500 dark:shadow-[0_0_12px_rgba(14,165,233,0.4)]'
                      : 'bg-zinc-100 border-zinc-400 text-zinc-700 dark:text-zinc-300 dark:text-zinc hover:bg-zinc-200 hover:border-zinc-500 dark:bg-zinc-950 dark:border-zinc-600 dark:hover:bg-zinc-700 dark:hover:border-zinc-1000'
                  }
                `}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              </TooltipContent>
            </Tooltip>

            {/* Step forward */}
            <IconBtn
              onClick={() => {
                setIsPlaying(false);
                stepForward();
              }}
              tooltip="Step forward (→)"
              disabled={currentFrame === TOTAL_FRAMES - 1}
            >
              <SkipForward size={14} />
            </IconBtn>

            {/* Jump to end */}
            <IconBtn onClick={jumpToEnd} tooltip="Jump to end">
              <ChevronLast size={14} />
            </IconBtn>

            {/* Divider */}
            <div className="h-6 w-px bg-zinc-300 dark:text-zinc-300 mx-1" />

            {/* Speed selector */}
            <div>
              <Select
                value={String(speed)}
                onValueChange={(v) => setSpeed(Number(v))}
              >
                <SelectTrigger className="h-7 w-20 text-xs px-2 bg-zinc-50 border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 hover:text-zinc-700 dark:bg-zinc-950 dark:border-zinc-600 dark:hover:border-zinc-1000 dark:hover:text-zinc-200 cursor-pointer">
                  <Gauge size={12} className="shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEED_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)} className="text-xs">
                      {s}×
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Keyboard hint */}
            <div className="ml-auto flex items-center gap-2">
              {[
                ['←→', 'step'],
                ['Space', 'play'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="text-[9px] px-1 py-0.5 bg-zinc-100 border border-zinc-400 dark:bg-zinc-950 dark:border-zinc-600 rounded-sm text-zinc-700 dark:text-zinc-300 leading-none">
                    {key}
                  </span>
                  <span className="text-[9px] text-zinc-700 dark:text-zinc-300 dark:bg-zinc-950 uppercase tracking-wide">
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
