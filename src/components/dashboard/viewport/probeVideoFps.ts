// Read avg_frame_rate directly from the file via ffprobe (ffmpeg.wasm).
// avg_frame_rate is the actual playback rate (e.g. "30000/1001" = 29.97).
// r_frame_rate is the LCM of all stream rates — often doubled for interlaced
// content, which is why rVFC-based counting was giving 2x values.

import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './useFFmpeg';

function parseRatio(s: string): number {
  const [num, den] = s.trim().split('/').map(Number);
  if (!den || den === 0) return num ?? 30;
  return num / den;
}

export async function probeVideoFps(src: string): Promise<number> {
  try {
    const ffmpeg = await getFFmpeg();

    await ffmpeg.writeFile('probe.mp4', await fetchFile(src));

    const logs: string[] = [];
    const onLog = ({ message }: { message: string }) => logs.push(message);
    ffmpeg.on('log', onLog);

    // -i with no output prints stream info to stderr then exits with code 1
    // ffmpeg.wasm captures the log output regardless of exit code
    try {
      await ffmpeg.exec([
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=avg_frame_rate',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        '-i',
        'probe.mp4',
      ]);
    } catch {
      // ffprobe-style invocation exits non-zero — that's expected
    }

    ffmpeg.off('log', onLog);
    await ffmpeg.deleteFile('probe.mp4');

    // Find the line that looks like "30/1" or "30000/1001"
    const ratioLine = logs
      .map((l) => l.trim())
      .find((l) => /^\d+\/\d+$/.test(l));

    if (ratioLine) return parseRatio(ratioLine);

    // Fallback: parse from the stream info line ffmpeg prints on -i
    const streamLine = logs.find((l) => l.includes('fps') || l.includes('tbr'));
    if (streamLine) {
      const match = streamLine.match(/(\d+(?:\.\d+)?)\s*fps/);
      if (match) return parseFloat(match[1]);
    }

    return 30;
  } catch (err) {
    console.warn('probeVideoFps failed, defaulting to 30', err);
    return 30;
  }
}
