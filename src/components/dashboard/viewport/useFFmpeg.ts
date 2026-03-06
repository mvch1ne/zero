// Singleton ffmpeg instance shared across the app.
// Loads core from CDN on first use so the 64MB wasm isn't bundled.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

const BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    instance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}
