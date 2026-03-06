import { X, Eye, EyeOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LANDMARKS, REGION_COLORS } from './poseConfig';
import type { LandmarkDef } from './poseConfig';

interface Props {
  visibilityMap: Record<number, boolean>;
  showLabels: boolean;
  onToggleLandmark: (index: number) => void;
  onToggleRegion: (region: LandmarkDef['region']) => void;
  onToggleLabels: () => void;
  onClose: () => void;
}

const REGIONS: { key: LandmarkDef['region']; label: string }[] = [
  { key: 'face', label: 'Face' },
  { key: 'upper', label: 'Upper' },
  { key: 'core', label: 'Core' },
  { key: 'lower', label: 'Lower' },
];

export const PosePanel = ({
  visibilityMap,
  showLabels,
  onToggleLandmark,
  onToggleRegion,
  onToggleLabels,
  onClose,
}: Props) => {
  return (
    <TooltipProvider delayDuration={400}>
      <div
        className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 select-none"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-5 shrink-0 border-b border-zinc-400 dark:border-zinc-600 flex items-center px-3 gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span className="text-[9px] uppercase tracking-[0.2em] whitespace-nowrap">
            Pose Landmarks
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleLabels}
                  className={`transition-colors cursor-pointer ${showLabels ? 'text-sky-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {showLabels ? <Eye size={10} /> : <EyeOff size={10} />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {showLabels ? 'Hide hover labels' : 'Show hover labels'}
              </TooltipContent>
            </Tooltip>
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

        {/* Landmark list grouped by region */}
        <div className="flex-1 overflow-y-auto">
          {REGIONS.map(({ key, label }) => {
            const regionLandmarks = LANDMARKS.filter((l) => l.region === key);
            const allOn = regionLandmarks.every((l) => visibilityMap[l.index]);
            const color = REGION_COLORS[key];
            return (
              <div key={key}>
                {/* Region header */}
                <div className="flex items-center gap-2 px-3 py-1 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 sticky top-0">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className="text-[9px] uppercase tracking-widest flex-1"
                    style={{ color }}
                  >
                    {label}
                  </span>
                  <button
                    onClick={() => onToggleRegion(key)}
                    className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    {allOn ? <Eye size={9} /> : <EyeOff size={9} />}
                  </button>
                </div>

                {/* Individual landmarks */}
                {regionLandmarks.map((lm) => {
                  const visible = visibilityMap[lm.index];
                  return (
                    <button
                      key={lm.index}
                      onClick={() => onToggleLandmark(lm.index)}
                      className={`w-full flex items-center gap-2 px-4 py-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer ${visible ? '' : 'opacity-40'}`}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: visible ? color : undefined }}
                      />
                      <span className="text-[9px] flex-1 font-mono">
                        {lm.name}
                      </span>
                      <span className="text-[8px] tabular-nums text-zinc-500">
                        {String(lm.index).padStart(2, '0')}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};
