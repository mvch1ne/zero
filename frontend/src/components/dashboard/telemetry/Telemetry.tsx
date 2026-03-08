// ─── Telemetry Panel ──────────────────────────────────────────────────────────
// Reads all state from VideoContext and PoseContext — no props needed.
import { useState } from 'react';
import { useVideoContext } from '../VideoContext';
import { usePose } from '../PoseContext';
import type { JointTimeSeries, GroundContactEvent, CoMSeries } from '../useSprintMetrics';

// ── Sparkline ──────────────────────────────────────────────────────────────────
function Sparkline({
  data,
  color = '#38bdf8',
  height = 24,
  playheadPct,
}: {
  data: number[];
  color?: string;
  height?: number;
  playheadPct?: number;
}) {
  if (data.length < 2) return <div style={{ height }} className="w-full" />;
  const min = Math.min(...data),
    max = Math.max(...data);
  const range = max - min || 1;
  const W = 100,
    H = height;
  const pts = data
    .map(
      (v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`,
    )
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full overflow-visible"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
      {playheadPct != null && (
        <line
          x1={playheadPct}
          y1={0}
          x2={playheadPct}
          y2={H}
          stroke={color}
          strokeWidth="0.8"
          opacity="0.7"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHead({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

// ── Summary stat ───────────────────────────────────────────────────────────────
function Stat({
  label,
  value,
  unit,
  dim,
}: {
  label: string;
  value: string;
  unit?: string;
  dim?: string;
}) {
  return (
    <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-base font-mono text-sky-500 dark:text-sky-400 tabular-nums leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono text-zinc-500">{unit}</span>
        )}
      </div>
      {dim && <span className="text-xs font-mono text-zinc-500">{dim}</span>}
    </div>
  );
}

// ── Joint row ──────────────────────────────────────────────────────────────────
function JointRow({
  label,
  series,
  frame,
  color,
}: {
  label: string;
  series: JointTimeSeries;
  frame: number;
  color: string;
}) {
  const n = series.angle.length;
  const f = Math.min(frame, n - 1);
  const step = Math.max(1, Math.floor(n / 100));
  const spark = series.angle.filter((_, i) => i % step === 0);
  const pct = n > 1 ? (f / (n - 1)) * 100 : 0;

  return (
    <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-zinc-500">{label}</span>
        <div className="flex gap-2 items-baseline">
          <span
            className="text-xs font-mono tabular-nums font-medium"
            style={{ color }}
          >
            {series.angle[f]?.toFixed(1) ?? '—'}°
          </span>
          <span className="text-xs font-mono tabular-nums text-zinc-500">
            {series.velocity[f]?.toFixed(0) ?? '—'}°/s
          </span>
          <span className="text-xs font-mono tabular-nums text-zinc-400">
            {series.accel[f]?.toFixed(0) ?? '—'}°/s²
          </span>
        </div>
      </div>
      <Sparkline data={spark} color={color} height={18} playheadPct={pct} />
    </div>
  );
}

// ── Ground contact table ───────────────────────────────────────────────────────
function ContactsTab({
  contacts,
  fps,
  calibrated,
  onDelete,
  onEdit,
}: {
  contacts: GroundContactEvent[];
  fps: number;
  calibrated: boolean;
  onDelete?: ((id: string) => void) | null;
  onEdit?: ((id: string, contactFrame: number, liftFrame: number) => void) | null;
}) {
  const [editing, setEditing] = useState<{ id: string; field: 'start' | 'end'; value: string } | null>(null);

  if (!contacts.length)
    return (
      <p className="px-3 py-4 text-xs font-mono text-zinc-500 italic">
        No contacts detected.
      </p>
    );

  const unit = calibrated ? 'm' : 'px';
  const L = '#4ade80',
    R = '#fb923c';

  // Symmetry summary
  const lContacts = contacts.filter((c) => c.foot === 'left');
  const rContacts = contacts.filter((c) => c.foot === 'right');
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;
  const lGCT = avg(lContacts.map((c) => c.contactTime)) * 1000;
  const rGCT = avg(rContacts.map((c) => c.contactTime)) * 1000;
  const lFT =
    avg(lContacts.map((c) => c.flightTimeBefore).filter((t) => t > 0)) * 1000;
  const rFT =
    avg(rContacts.map((c) => c.flightTimeBefore).filter((t) => t > 0)) * 1000;

  return (
    <div>
      {/* Symmetry summary */}
      <SectionHead label="Symmetry" color="#38bdf8" />
      <div className="grid grid-cols-3 text-xs font-mono">
        <div className="px-3 py-1.5 border-b border-r border-zinc-100 dark:border-zinc-800/60 text-zinc-500 uppercase tracking-wide" />
        <div
          className="px-3 py-1.5 border-b border-r border-zinc-100 dark:border-zinc-800/60 font-bold"
          style={{ color: L }}
        >
          Left
        </div>
        <div
          className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 font-bold"
          style={{ color: R }}
        >
          Right
        </div>
        {[
          ['GCT avg', `${lGCT.toFixed(0)}ms`, `${rGCT.toFixed(0)}ms`],
          ['Flight avg', `${lFT.toFixed(0)}ms`, `${rFT.toFixed(0)}ms`],
          ['Steps', String(lContacts.length), String(rContacts.length)],
        ].map(([k, l, r]) => (
          <>
            <div
              key={k + '-k'}
              className="px-3 py-1 border-b border-r border-zinc-100 dark:border-zinc-800/60 text-zinc-500"
            >
              {k}
            </div>
            <div
              key={k + '-l'}
              className="px-3 py-1 border-b border-r border-zinc-100 dark:border-zinc-800/60 tabular-nums"
            >
              {l}
            </div>
            <div
              key={k + '-r'}
              className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-800/60 tabular-nums"
            >
              {r}
            </div>
          </>
        ))}
      </div>

      {/* Step-by-step table */}
      <SectionHead label="Per-step detail" color="#38bdf8" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              {[
                '#',
                'Ft',
                'In',
                'Out',
                'GCT',
                'Flight',
                'Stride',
                'Freq',
                'CoM↔gnd',
              ].map((h) => (
                <th
                  key={h}
                  className="px-1.5 py-1 text-left text-zinc-400 uppercase tracking-wide font-normal whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
              {onDelete && <th className="px-1 py-1" />}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, i) => {
              const color = c.foot === 'left' ? L : R;
              return (
                <tr
                  key={i}
                  className="border-b border-zinc-100 dark:border-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-1.5 py-0.5 text-zinc-400 tabular-nums">
                    {i + 1}
                  </td>
                  <td
                    className="px-1.5 py-0.5 font-bold tabular-nums"
                    style={{ color }}
                  >
                    {c.foot === 'left' ? 'L' : 'R'}
                  </td>
                  {/* Inline-editable contact frame (In) */}
                  <td className="px-1 py-0.5 tabular-nums text-zinc-500">
                    {onEdit && c.id && editing?.id === c.id && editing.field === 'start' ? (
                      <input
                        autoFocus
                        type="number"
                        className="w-12 bg-zinc-800 text-zinc-200 text-xs font-mono px-1 rounded outline-none border border-violet-500/60"
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        onBlur={() => {
                          const n = parseInt(editing.value, 10);
                          if (!isNaN(n) && n >= 0) onEdit(c.id!, n, c.liftFrame);
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      <span
                        className={onEdit && c.id ? 'cursor-pointer hover:text-violet-400 transition-colors' : ''}
                        onClick={() => onEdit && c.id && setEditing({ id: c.id, field: 'start', value: String(c.contactFrame) })}
                        title={onEdit ? 'Click to edit contact frame' : undefined}
                      >
                        {c.contactFrame}
                      </span>
                    )}
                  </td>
                  {/* Inline-editable lift frame (Out) */}
                  <td className="px-1 py-0.5 tabular-nums text-zinc-500">
                    {onEdit && c.id && editing?.id === c.id && editing.field === 'end' ? (
                      <input
                        autoFocus
                        type="number"
                        className="w-12 bg-zinc-800 text-zinc-200 text-xs font-mono px-1 rounded outline-none border border-violet-500/60"
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        onBlur={() => {
                          const n = parseInt(editing.value, 10);
                          if (!isNaN(n) && n > c.contactFrame) onEdit(c.id!, c.contactFrame, n);
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      <span
                        className={onEdit && c.id ? 'cursor-pointer hover:text-violet-400 transition-colors' : ''}
                        onClick={() => onEdit && c.id && setEditing({ id: c.id, field: 'end', value: String(c.liftFrame) })}
                        title={onEdit ? 'Click to edit lift frame' : undefined}
                      >
                        {c.liftFrame}
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-sky-500">
                    {(c.contactTime * 1000).toFixed(0)}ms
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.flightTimeBefore > 0.01
                      ? `${(c.flightTimeBefore * 1000).toFixed(0)}ms`
                      : '—'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.strideLength !== null
                      ? `${c.strideLength.toFixed(calibrated ? 2 : 0)}${unit}`
                      : '—'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.strideFrequency !== null
                      ? `${c.strideFrequency.toFixed(2)}Hz`
                      : '—'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.comDistance > 0
                      ? `${c.comDistance.toFixed(calibrated ? 2 : 0)}${unit}`
                      : '—'}
                  </td>
                  {onDelete && (
                    <td className="px-1 py-0.5">
                      {c.id && (
                        <button
                          onClick={() => onDelete(c.id!)}
                          className="text-xs text-red-500/60 hover:text-red-400 transition-colors cursor-pointer leading-none"
                          title="Delete contact"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CoM tab ────────────────────────────────────────────────────────────────────
function CoMTab({
  comSeries,
  com,
  frame,
  fps,
  comEvents,
  sprintStart,
  sprintFinish,
  sprintMode,
  confirmedSprintStart,
  reactionTime,
  reactionTimeEnabled,
  setReactionTime,
  setReactionTimeEnabled,
}: {
  comSeries: CoMSeries;
  com: { frame: number; x: number; y: number }[];
  frame: number;
  fps: number;
  comEvents: { frame: number; comSite: { x: number; y: number } }[];
  sprintStart: { frame: number; site: { x: number; y: number } } | null;
  sprintFinish: { frame: number; site: { x: number; y: number } } | null;
  sprintMode: 'static' | 'flying';
  confirmedSprintStart: number | null;
  reactionTime: number;
  reactionTimeEnabled: boolean;
  setReactionTime: (t: number) => void;
  setReactionTimeEnabled: (v: boolean) => void;
}) {
  const n = comSeries.x.length;
  const f = Math.min(frame, n - 1);
  const step = Math.max(1, Math.floor(n / 100));
  const spark = (arr: number[]) => arr.filter((_, i) => i % step === 0);
  const pct = n > 1 ? (f / (n - 1)) * 100 : 0;
  const color = '#a78bfa';

  // Manual overrides for crossing frames (null = use auto-detected value).
  const [staticCrossingOverride, setStaticCrossingOverride] = useState<number | null>(null);
  const [flyEntryOverride, setFlyEntryOverride] = useState<number | null>(null);
  const [flyExitOverride, setFlyExitOverride] = useState<number | null>(null);

  // Detect direction of motion from raw com.x (pose-frame pixels).
  // movingPositive = true → athlete runs left-to-right (x increases).
  const movingPositive = com.length > 1 && com[com.length - 1].x > com[0].x;

  /**
   * Find the fractional frame at which com.x (raw pose pixels — the same
   * coordinates used to draw the marker on screen) crosses markerX.
   * Handles both rightward (increasing x) and leftward (decreasing x) motion.
   * Uses linear interpolation for sub-frame precision.
   */
  const findCrossing = (markerX: number, startFrom = 0): number | null => {
    for (let fi = Math.max(1, startFrom); fi < com.length; fi++) {
      const prev = com[fi - 1].x;
      const curr = com[fi].x;
      const crosses = movingPositive
        ? (prev < markerX && curr >= markerX)
        : (prev > markerX && curr <= markerX);
      if (crosses) {
        const frac = Math.abs((markerX - prev) / (curr - prev));
        return (fi - 1) + frac;
      }
      if (curr === markerX) return fi;
    }
    return null;
  };

  /** Interpolate comSeries.x at a fractional frame index. */
  const interpComX = (frac: number): number => {
    const lo = Math.floor(frac);
    const hi = Math.min(lo + 1, n - 1);
    const t  = frac - lo;
    return (comSeries.x[lo] ?? 0) * (1 - t) + (comSeries.x[hi] ?? 0) * t;
  };

  // Shared sparklines + events table.
  const renderSpeedAccel = (
    gateSpeed: number[],
    gateAccel: number[],
    relDisp: (fi: number) => number,
    speedSubLabel: string,
  ) => (
    <>
      <SectionHead label="Displacement (m)" color={color} />
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-mono text-zinc-500">From start line</span>
          <span className="text-xs font-mono tabular-nums" style={{ color }}>
            {relDisp(f).toFixed(2)} m
          </span>
        </div>
        <Sparkline data={spark(comSeries.x.map((_, i) => relDisp(i)))} color={color} height={18} playheadPct={pct} />
      </div>

      <SectionHead label="Speed (m/s)" color={color} />
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-mono text-zinc-500">{speedSubLabel}</span>
          <span className="text-xs font-mono tabular-nums" style={{ color }}>{(gateSpeed[f] ?? 0).toFixed(2)} m/s</span>
        </div>
        <Sparkline data={spark(gateSpeed)} color={color} height={22} playheadPct={pct} />
      </div>

      <SectionHead label="Acceleration (m/s²)" color={color} />
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-mono text-zinc-500">Δv/Δt</span>
          <span className="text-xs font-mono tabular-nums" style={{ color }}>{(gateAccel[f] ?? 0).toFixed(2)} m/s²</span>
        </div>
        <Sparkline data={spark(gateAccel)} color={color} height={18} playheadPct={pct} />
      </div>

      {comEvents.length > 0 && (
        <>
          <SectionHead label="Recorded Events" color={color} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  {['#', 'Frame', 'Speed (m/s)', 'Accel (m/s²)', 'Disp (m)'].map((h) => (
                    <th key={h} className="px-1.5 py-1 text-left text-zinc-400 uppercase tracking-wide font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comEvents.map((evt, i) => {
                  const ef = Math.min(evt.frame, n - 1);
                  return (
                    <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/40">
                      <td className="px-1.5 py-0.5 text-zinc-400">E{i + 1}</td>
                      <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">{evt.frame}</td>
                      <td className="px-1.5 py-0.5 tabular-nums" style={{ color }}>{(gateSpeed[ef] ?? 0).toFixed(2)}</td>
                      <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">{(gateAccel[ef] ?? 0).toFixed(2)}</td>
                      <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">{relDisp(ef).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );

  // ── STATIC MODE ───────────────────────────────────────────────────────────────
  if (sprintMode === 'static') {
    if (confirmedSprintStart === null) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs uppercase tracking-widest text-amber-500">First movement required</span>
          <span className="text-xs text-zinc-500 font-mono">Seek to the first movement frame and click the Flag button (or confirm the proposed frame)</span>
        </div>
      );
    }
    if (!sprintStart) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-xs uppercase tracking-widest text-cyan-500">Start line required</span>
          <span className="text-xs text-zinc-500 font-mono">Use Annotate → Start to place the start line post</span>
        </div>
      );
    }

    const startIdx = Math.min(confirmedSprintStart, n - 1);
    const RT = reactionTimeEnabled ? reactionTime : 0;

    // Auto-detect the fractional frame where CoM (raw pixels) crosses the start marker.
    const autoCrossingFrac = findCrossing(sprintStart.site.x);
    const autoCrossingFrame = autoCrossingFrac !== null ? Math.round(autoCrossingFrac) : null;

    // Apply manual override if set; clamp to valid range.
    const effectiveCrossingFrac = staticCrossingOverride !== null
      ? Math.max(0, Math.min(n - 1, staticCrossingOverride))
      : autoCrossingFrac;
    const effectiveCrossingFrame = staticCrossingOverride !== null
      ? Math.max(0, Math.min(n - 1, staticCrossingOverride))
      : autoCrossingFrame;

    // xAtCrossing in comSeries.x metre space — interpolated at the effective crossing frame.
    // Fallback: anchor at first-movement frame if CoM never reaches the start line.
    const xAtCrossing = effectiveCrossingFrac !== null
      ? interpComX(effectiveCrossingFrac)
      : (comSeries.x[startIdx] ?? 0);

    // sign: +1 for rightward, -1 for leftward — so relDisp is always ≥ 0 past start.
    const dir = movingPositive ? 1 : -1;

    const gateSpeed = (() => {
      const result = new Array(n).fill(0) as number[];
      for (let fi = startIdx + 1; fi < n; fi++) {
        const d = ((comSeries.x[fi] ?? 0) - xAtCrossing) * dir;
        if (d < 0) continue; // no metric before start line
        const elapsed = (fi - startIdx) / fps + RT;
        result[fi] = elapsed > 0 ? d / elapsed : 0;
      }
      return result;
    })();

    const gateAccel = (() => {
      const result = new Array(n).fill(0) as number[];
      for (let fi = 1; fi < n - 1; fi++) result[fi] = (gateSpeed[fi + 1] - gateSpeed[fi - 1]) * fps / 2;
      if (n > 1) { result[0] = (gateSpeed[1] - gateSpeed[0]) * fps; result[n - 1] = (gateSpeed[n - 1] - gateSpeed[n - 2]) * fps; }
      return result;
    })();

    const relDisp = (fi: number) => Math.max(0, ((comSeries.x[Math.min(fi, n - 1)] ?? 0) - xAtCrossing) * dir);

    return (
      <div>
        {/* RT controls */}
        <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest text-zinc-500 shrink-0">Reaction time</span>
          <button
            onClick={() => setReactionTimeEnabled(!reactionTimeEnabled)}
            className={`text-xs font-mono px-1.5 py-0.5 rounded-sm border transition-colors cursor-pointer
              ${reactionTimeEnabled ? 'border-violet-500/50 text-violet-400 bg-violet-500/10' : 'border-zinc-600 text-zinc-500'}`}
          >
            {reactionTimeEnabled ? 'ON' : 'OFF'}
          </button>
          {reactionTimeEnabled && (
            <>
              <input
                type="number"
                value={Math.round(reactionTime * 1000)}
                onChange={(e) => setReactionTime(Math.max(0, Math.min(500, Number(e.target.value))) / 1000)}
                className="w-12 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-sm px-1 py-0.5 text-violet-300 tabular-nums text-center"
                min={0} max={500} step={10}
              />
              <span className="text-xs text-zinc-500 font-mono">ms</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs font-mono text-zinc-500">Crossed fr</span>
            <input
              type="number"
              min={0}
              max={n - 1}
              value={effectiveCrossingFrame ?? ''}
              placeholder={autoCrossingFrame !== null ? String(autoCrossingFrame) : '—'}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setStaticCrossingOverride(!isNaN(v) && v >= 0 ? v : null);
              }}
              className={`w-14 text-xs font-mono rounded-sm px-1 py-0.5 tabular-nums text-center outline-none
                ${staticCrossingOverride !== null
                  ? 'bg-violet-950/60 border border-violet-500/60 text-violet-300'
                  : 'bg-zinc-900 border border-zinc-700 text-cyan-400'}`}
            />
            {staticCrossingOverride !== null && (
              <button
                onClick={() => setStaticCrossingOverride(null)}
                title="Reset to auto-detected"
                className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors cursor-pointer leading-none"
              >↺</button>
            )}
          </div>
        </div>
        {renderSpeedAccel(gateSpeed, gateAccel, relDisp,
          `Disp / (elapsed${reactionTimeEnabled ? ` + ${Math.round(reactionTime * 1000)}ms RT` : ''})`)}
      </div>
    );
  }

  // ── FLYING MODE ───────────────────────────────────────────────────────────────
  if (sprintMode === 'flying') {
    if (!sprintStart) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-xs uppercase tracking-widest text-cyan-500">Fly zone entry required</span>
          <span className="text-xs text-zinc-500 font-mono">Use Annotate → Start to mark the entry line</span>
        </div>
      );
    }
    if (!sprintFinish) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-xs uppercase tracking-widest text-orange-500">Fly zone exit required</span>
          <span className="text-xs text-zinc-500 font-mono">Use Annotate → Finish to mark the exit line</span>
        </div>
      );
    }

    // Auto-detect fractional frames where CoM (raw pixels) crosses entry/exit markers.
    const autoEntryFrac = findCrossing(sprintStart.site.x);
    const autoExitFrac  = autoEntryFrac !== null
      ? findCrossing(sprintFinish.site.x, Math.floor(autoEntryFrac))
      : null;

    // Apply manual overrides if set; clamp to valid range.
    const entryFrac: number | null = flyEntryOverride !== null
      ? Math.max(0, Math.min(n - 1, flyEntryOverride))
      : autoEntryFrac;
    const exitFrac: number | null = flyExitOverride !== null
      ? Math.max(0, Math.min(n - 1, flyExitOverride))
      : autoExitFrac;

    if (entryFrac === null || exitFrac === null || exitFrac <= entryFrac) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
          <span className="text-xs uppercase tracking-widest text-zinc-500">
            {entryFrac === null ? 'CoM never reaches entry marker' : 'CoM never reaches exit marker (or exit before entry)'}
          </span>
          <span className="text-xs text-zinc-600 font-mono">Check that Start comes before Finish and markers are within the athlete's path — or enter frames manually below</span>
          {/* Manual override inputs even when auto fails */}
          <div className="mt-2 flex flex-col gap-2 w-full max-w-50">
            {(['entry', 'exit'] as const).map((side) => {
              const isEntry = side === 'entry';
              const override = isEntry ? flyEntryOverride : flyExitOverride;
              const setOverride = isEntry ? setFlyEntryOverride : setFlyExitOverride;
              const autoVal = isEntry ? autoEntryFrac : autoExitFrac;
              return (
                <div key={side} className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-zinc-500 w-12 text-right capitalize">{side} fr</span>
                  <input
                    type="number" min={0} max={n - 1}
                    value={override ?? ''}
                    placeholder={autoVal !== null ? autoVal.toFixed(1) : '—'}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setOverride(!isNaN(v) && v >= 0 ? v : null);
                    }}
                    className={`w-16 text-xs font-mono rounded-sm px-1 py-0.5 tabular-nums text-center outline-none
                      ${override !== null
                        ? 'bg-violet-950/60 border border-violet-500/60 text-violet-300'
                        : 'bg-zinc-900 border border-zinc-700 text-orange-400'}`}
                  />
                  {override !== null && (
                    <button onClick={() => setOverride(null)} title="Reset to auto" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors cursor-pointer">↺</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const flyTime = (exitFrac - entryFrac) / fps;

    // Fly distance = CoM horizontal travel between entry and exit (metres, already calibrated).
    const interpX = (frac: number) => {
      const lo = Math.floor(frac);
      const hi = Math.min(lo + 1, n - 1);
      const t = frac - lo;
      return (comSeries.x[lo] ?? 0) * (1 - t) + (comSeries.x[hi] ?? 0) * t;
    };
    const flyDistance = Math.abs(interpX(exitFrac) - interpX(entryFrac));
    const flyVelocity = flyTime > 0 ? flyDistance / flyTime : 0;

    const entryFrameDisplay = entryFrac.toFixed(1);
    const exitFrameDisplay = exitFrac.toFixed(1);

    return (
      <div>
        <SectionHead label="Fly zone result" color="#f97316" />
        <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800/60 border-b border-zinc-100 dark:border-zinc-800/60">
          {[
            { label: 'Fly time', value: flyTime.toFixed(3), unit: 's' },
            { label: 'Distance', value: flyDistance.toFixed(2), unit: 'm' },
            { label: 'Velocity', value: flyVelocity.toFixed(2), unit: 'm/s' },
          ].map(({ label, value, unit }) => (
            <div key={label} className="px-2 py-2 flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-widest text-zinc-500">{label}</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-mono tabular-nums" style={{ color: '#f97316' }}>{value}</span>
                <span className="text-xs font-mono text-zinc-500">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-1.5">
          {/* Entry frame — editable */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-zinc-500 shrink-0">Entry (Annotate → Start)</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={n - 1}
                value={flyEntryOverride ?? Math.round(entryFrac)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setFlyEntryOverride(!isNaN(v) && v >= 0 ? v : null);
                }}
                className={`w-14 text-xs font-mono rounded-sm px-1 py-0.5 tabular-nums text-center outline-none
                  ${flyEntryOverride !== null
                    ? 'bg-violet-950/60 border border-violet-500/60 text-violet-300'
                    : 'bg-zinc-900 border border-zinc-700 text-cyan-400'}`}
              />
              <span className="text-xs font-mono text-zinc-500">· {(entryFrac / fps).toFixed(3)}s</span>
              {flyEntryOverride !== null && (
                <button onClick={() => setFlyEntryOverride(null)} title="Reset to auto" className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors cursor-pointer">↺</button>
              )}
            </div>
          </div>
          {/* Exit frame — editable */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-zinc-500 shrink-0">Exit (Annotate → Finish)</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={n - 1}
                value={flyExitOverride ?? Math.round(exitFrac)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setFlyExitOverride(!isNaN(v) && v >= 0 ? v : null);
                }}
                className={`w-14 text-xs font-mono rounded-sm px-1 py-0.5 tabular-nums text-center outline-none
                  ${flyExitOverride !== null
                    ? 'bg-violet-950/60 border border-violet-500/60 text-violet-300'
                    : 'bg-zinc-900 border border-zinc-700 text-orange-400'}`}
              />
              <span className="text-xs font-mono text-zinc-500">· {(exitFrac / fps).toFixed(3)}s</span>
              {flyExitOverride !== null && (
                <button onClick={() => setFlyExitOverride(null)} title="Reset to auto" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors cursor-pointer">↺</button>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-mono text-zinc-500">Distance from calibrated CoM</span>
            <span className="text-xs font-mono text-zinc-300">{flyDistance.toFixed(2)} m</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
type Tab = 'summary' | 'steps' | 'lower' | 'upper' | 'com';

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'steps', label: 'Steps' },
  { key: 'lower', label: 'Lower' },
  { key: 'upper', label: 'Upper' },
  { key: 'com', label: 'CoM' },
];

// ── Main component ─────────────────────────────────────────────────────────────
export const Telemetry = () => {
  const {
    currentFrame, fps, calibration, metrics, deleteContact, editContact,
    comEvents, showCoMEvents, sprintStart, sprintFinish,
    sprintMode, confirmedSprintStart,
    reactionTime, reactionTimeEnabled,
    setReactionTime, setReactionTimeEnabled,
  } = useVideoContext();
  const { status } = usePose();
  const [tab, setTab] = useState<Tab>('summary');

  // Empty / loading state
  if (status !== 'ready' || !metrics) {
    const isUncalibrated = status === 'ready' && !calibration;
    const msg = isUncalibrated
      ? 'Calibrate to unlock telemetry'
      : status === 'idle'
        ? 'Enable pose analysis to compute metrics'
        : status === 'loading'
          ? 'Analysing video…'
          : status === 'error'
            ? 'Pose error — check backend'
            : 'Waiting for metrics…';
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 px-4 text-center">
        {status === 'loading' && (
          <div className="w-4 h-4 border border-zinc-600 border-t-sky-400 rounded-full animate-spin" />
        )}
        <span
          className={`text-xs uppercase tracking-widest font-mono ${isUncalibrated ? 'text-amber-500' : 'text-zinc-500'}`}
        >
          {msg}
        </span>
        {isUncalibrated && (
          <span className="text-xs text-zinc-600 font-mono">
            Use the calibration tool in the control panel
          </span>
        )}
      </div>
    );
  }

  const cal = calibration !== null;
  const unit = cal ? 'm' : 'px';
  const f = currentFrame;

  const calLineDir = (() => {
    if (!calibration) return null;
    const a = calibration.lineAngleDeg;
    if (a < 20) return 'Horizontal';
    if (a > 70) return 'Vertical';
    return `Diagonal (${a.toFixed(0)}°)`;
  })();

  // Left = green, Right = amber — consistent throughout
  const LC = '#4ade80',
    RC = '#fb923c';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-xs uppercase tracking-widest transition-colors cursor-pointer
              border-r border-zinc-200 dark:border-zinc-800 last:border-r-0
              ${
                tab === t.key
                  ? 'text-sky-500 bg-zinc-50 dark:bg-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
        {/* ── Summary ─────────────────────────────────────────────────── */}
        {tab === 'summary' && (
          <>
            <SectionHead label="Calibration" color="#f97316" />
            {cal ? (
              <>
                <Stat
                  label="Reference distance"
                  value={calibration!.realMeters.toFixed(2)}
                  unit="m"
                  dim={`Line direction: ${calLineDir}`}
                />
                <Stat
                  label="Scale"
                  value={calibration!.pixelsPerMeter.toFixed(4)}
                  unit="norm-units/m"
                  dim="Stride lengths and CoM distances in metres"
                />
              </>
            ) : (
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-xs uppercase tracking-widest text-amber-500">
                  No calibration — distances shown in pixels
                </span>
              </div>
            )}

            <SectionHead label="Temporal" color="#38bdf8" />
            <Stat
              label="Ground contact time (avg)"
              value={(metrics.avgContactTime * 1000).toFixed(0)}
              unit="ms"
              dim={`${metrics.groundContacts.length} contacts detected`}
            />
            <Stat
              label="Flight time (avg)"
              value={(metrics.avgFlightTime * 1000).toFixed(0)}
              unit="ms"
            />
            {metrics.avgStrideLength !== null && (
              <Stat
                label={`Stride length (avg)`}
                value={metrics.avgStrideLength.toFixed(cal ? 2 : 0)}
                unit={unit}
              />
            )}
            {metrics.avgStrideFreq !== null && (
              <Stat
                label="Stride frequency (avg)"
                value={metrics.avgStrideFreq.toFixed(2)}
                unit="Hz"
                dim={`${(metrics.avgStrideFreq * 60).toFixed(1)} strides / min`}
              />
            )}

            <SectionHead label="Trunk" color="#fb923c" />
            <JointRow
              label="Torso lean (from vertical)"
              series={metrics.torso}
              frame={f}
              color="#fb923c"
            />

          </>
        )}

        {/* ── Steps ───────────────────────────────────────────────────── */}
        {tab === 'steps' && (
          <ContactsTab
            contacts={metrics.groundContacts}
            fps={fps}
            calibrated={cal}
            onDelete={deleteContact}
            onEdit={editContact}
          />
        )}

        {/* ── CoM ─────────────────────────────────────────────────────── */}
        {tab === 'com' && (
          <CoMTab
            comSeries={metrics.comSeries}
            com={metrics.com}
            frame={f}
            fps={fps}
            comEvents={showCoMEvents ? comEvents : []}
            sprintStart={sprintStart}
            sprintFinish={sprintFinish}
            sprintMode={sprintMode}
            confirmedSprintStart={confirmedSprintStart}
            reactionTime={reactionTime}
            reactionTimeEnabled={reactionTimeEnabled}
            setReactionTime={setReactionTime}
            setReactionTimeEnabled={setReactionTimeEnabled}
          />
        )}

        {/* ── Lower body ──────────────────────────────────────────────── */}
        {tab === 'lower' && (
          <>
            <SectionHead label="Hip" color={LC} />
            <JointRow
              label="Left hip"
              series={metrics.leftHip}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right hip"
              series={metrics.rightHip}
              frame={f}
              color={RC}
            />

            <SectionHead label="Knee" color={LC} />
            <JointRow
              label="Left knee"
              series={metrics.leftKnee}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right knee"
              series={metrics.rightKnee}
              frame={f}
              color={RC}
            />

            <SectionHead label="Ankle" color={LC} />
            <JointRow
              label="Left ankle"
              series={metrics.leftAnkle}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right ankle"
              series={metrics.rightAnkle}
              frame={f}
              color={RC}
            />

            <SectionHead label="Segment angles (from vertical)" color={LC} />
            <JointRow
              label="Left thigh"
              series={metrics.leftThigh}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right thigh"
              series={metrics.rightThigh}
              frame={f}
              color={RC}
            />
            <JointRow
              label="Left shin"
              series={metrics.leftShin}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right shin"
              series={metrics.rightShin}
              frame={f}
              color={RC}
            />
          </>
        )}

        {/* ── Upper body ──────────────────────────────────────────────── */}
        {tab === 'upper' && (
          <>
            <SectionHead label="Shoulder" color="#38bdf8" />
            <JointRow
              label="Left shoulder"
              series={metrics.leftShoulder}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right shoulder"
              series={metrics.rightShoulder}
              frame={f}
              color={RC}
            />

            <SectionHead label="Elbow" color="#38bdf8" />
            <JointRow
              label="Left elbow"
              series={metrics.leftElbow}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right elbow"
              series={metrics.rightElbow}
              frame={f}
              color={RC}
            />

            <SectionHead label="Wrist" color="#38bdf8" />
            <JointRow
              label="Left wrist"
              series={metrics.leftWrist}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right wrist"
              series={metrics.rightWrist}
              frame={f}
              color={RC}
            />

            <SectionHead label="Trunk" color="#fb923c" />
            <JointRow
              label="Torso lean"
              series={metrics.torso}
              frame={f}
              color="#fb923c"
            />
          </>
        )}
      </div>
    </div>
  );
};
