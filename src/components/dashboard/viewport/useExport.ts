import { useRef, useState, useCallback } from 'react';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './useFFmpeg';
import type { CropRect, TrimPoints } from './TrimCropPanel';

export type ExportStatus = 'idle' | 'loading' | 'running' | 'done' | 'error';

interface UseExportOptions {
  videoElRef: React.RefObject<HTMLVideoElement | null>;
  exportingRef: React.RefObject<boolean>;
  videoWidth: number;
  videoHeight: number;
  fps: number;
  trimPoints: TrimPoints;
  cropRect: CropRect | null;
  title: string;
}

interface UseExportReturn {
  exportStatus: ExportStatus;
  exportProgress: number;
  lastExportUrl: string | null;
  lastExportTitle: string | null;
  startExport: (
    mode: 'replace' | 'download',
    onReplace: (url: string, w: number, h: number) => void,
  ) => void;
}

// Format seconds as HH:MM:SS.mmm for ffmpeg -ss / -to
function toTimecode(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

export function useExport({
  videoElRef,
  exportingRef,
  videoWidth,
  videoHeight,
  fps,
  trimPoints,
  cropRect,
  title,
}: UseExportOptions): UseExportReturn {
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [lastExportUrl, setLastExportUrl] = useState<string | null>(null);
  const [lastExportTitle, setLastExportTitle] = useState<string | null>(null);

  const optsRef = useRef({
    videoWidth,
    videoHeight,
    fps,
    trimPoints,
    cropRect,
    title,
  });
  optsRef.current = {
    videoWidth,
    videoHeight,
    fps,
    trimPoints,
    cropRect,
    title,
  };

  const startExport = useCallback(
    async (
      mode: 'replace' | 'download',
      onReplace: (url: string, w: number, h: number) => void,
    ) => {
      const videoEl = videoElRef.current;
      const { videoWidth, videoHeight, cropRect, trimPoints, title } =
        optsRef.current;
      if (!videoEl || videoWidth === 0 || videoHeight === 0) return;

      const trimDuration = trimPoints.outPoint - trimPoints.inPoint;
      if (trimDuration <= 0) return;

      exportingRef.current = true;
      setExportStatus('loading');
      setExportProgress(0);

      try {
        // Load ffmpeg (cached after first call)
        const ffmpeg = await getFFmpeg();

        setExportStatus('running');

        // Wire up progress — ffmpeg emits 0-1 ratio
        ffmpeg.on('progress', ({ progress }) => {
          setExportProgress(Math.min(0.98, progress));
        });

        // Write the source video into ffmpeg's virtual FS
        await ffmpeg.writeFile('input.mp4', await fetchFile(videoEl.src));

        // Build filter: crop is in pixel coords
        const cropX = cropRect ? Math.round(cropRect.x * videoWidth) : 0;
        const cropY = cropRect ? Math.round(cropRect.y * videoHeight) : 0;
        const cropW = cropRect
          ? Math.round(cropRect.w * videoWidth)
          : videoWidth;
        const cropH = cropRect
          ? Math.round(cropRect.h * videoHeight)
          : videoHeight;

        // Ensure even dimensions (required by libx264)
        const outW = cropW % 2 === 0 ? cropW : cropW - 1;
        const outH = cropH % 2 === 0 ? cropH : cropH - 1;

        const vf = cropRect
          ? `crop=${outW}:${outH}:${cropX}:${cropY}`
          : undefined;

        const args = [
          '-ss',
          toTimecode(trimPoints.inPoint),
          '-to',
          toTimecode(trimPoints.outPoint),
          '-i',
          'input.mp4',
          ...(vf ? ['-vf', vf] : []),
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '18',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-movflags',
          '+faststart',
          'output.mp4',
        ];

        await ffmpeg.exec(args);

        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        // Clean up virtual FS
        await ffmpeg.deleteFile('input.mp4');
        await ffmpeg.deleteFile('output.mp4');

        setLastExportUrl(url);
        setLastExportTitle(title);

        if (mode === 'download') {
          const a = document.createElement('a');
          a.href = url;
          a.download = `${title}_clip.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          onReplace(url, outW, outH);
        }

        setExportStatus('done');
        setExportProgress(1);
      } catch (err) {
        console.error('Export error', err);
        setExportStatus('error');
      } finally {
        exportingRef.current = false;
      }
    },
    [videoElRef, exportingRef],
  );

  return {
    exportStatus,
    exportProgress,
    lastExportUrl,
    lastExportTitle,
    startExport,
  };
}
