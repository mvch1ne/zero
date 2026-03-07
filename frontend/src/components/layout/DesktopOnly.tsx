// components/layout/DesktopOnly.tsx
import { useState, useEffect } from 'react';
import { MonitorX } from 'lucide-react';

const MIN_WIDTH = 750;

export function DesktopOnly({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (width < MIN_WIDTH) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-zinc-950 text-center px-8">
        {/* Top bar — mirrors app header */}
        <div className="fixed top-0 left-0 right-0 h-5 border-b border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 flex items-center px-3 gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[0.8rem] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 font-mono">
            SprintLab
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

        {/* Main card */}
        <div className="border border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 w-full max-w-sm">
          {/* Card header */}
          <div className="h-5 border-b border-zinc-400 dark:border-zinc-600 flex items-center px-3 gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span className="text-[0.8rem] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 font-mono">
              Display Warning
            </span>
          </div>

          {/* Card body */}
          <div className="px-6 py-8 flex flex-col items-center gap-5">
            <div className="w-12 h-12 border border-zinc-400 dark:border-zinc-600 flex items-center justify-center">
              <MonitorX className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-[0.8rem] uppercase tracking-[0.2em] text-zinc-800 dark:text-zinc-200 font-mono">
                Desktop Only
              </span>
              <div className="w-8 h-px bg-zinc-400 dark:bg-zinc-600" />
              <p className="text-[0.8rem] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed text-center max-w-55">
                SprintLab requires a desktop environment. Please reopen on a
                larger screen to begin analysis.
              </p>
            </div>

            {/* Width readout */}
            <div className="w-full border-t border-zinc-300 dark:border-zinc-700 pt-4 flex justify-between items-center">
              <span className="text-[0.8rem] uppercase tracking-widest text-zinc-700 font-mono">
                Detected
              </span>
              <span className="text-xs text-sky-500 dark:text-sky-400 tabular-nums font-mono">
                {width}px
              </span>
              <span className="text-[0.8rem] uppercase tracking-widest text-zinc-700 font-mono">
                Min {MIN_WIDTH}px
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
