import { useState, useRef, useCallback } from 'react';
import { FilePlayIcon, Clock, Upload } from 'lucide-react';
import { IconDimensions } from '@tabler/icons-react';
import { VideoLayer } from './VideoLayer';
import { ControlPanel } from './ControlPanel';

interface VideoMeta {
  src: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  duration: number;
}

export const Viewport = () => {
  const sectionHeights = {
    header: '1.25rem',
    controlSection: '10rem',
  };

  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Imperative handles exposed by VideoLayer
  const seekVideo = useRef<(time: number) => void>(() => {});
  const getVideoTime = useRef<() => number>(() => 0);

  const fps = videoMeta?.fps ?? 30;
  const totalFrames = videoMeta?.totalFrames ?? 0;
  const currentFrame = Math.floor(currentTime * fps);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (videoMeta?.src) URL.revokeObjectURL(videoMeta.src);

      const src = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.src = src;
      tempVideo.onloadedmetadata = () => {
        const duration = tempVideo.duration;
        const fps = 30;
        const totalFrames = Math.floor(duration * fps);
        setVideoMeta({
          src,
          title: file.name.replace(/\.[^/.]+$/, ''),
          width: tempVideo.videoWidth,
          height: tempVideo.videoHeight,
          fps,
          totalFrames,
          duration,
        });
        setCurrentTime(0);
        setIsPlaying(false);
      };
    },
    [videoMeta],
  );

  // Called by ControlPanel — seeks video and syncs React time state
  const handleSeekToFrame = useCallback(
    (frame: number) => {
      const time = frame / fps;
      seekVideo.current(time);
      setCurrentTime(time);
    },
    [fps],
  );

  const handleVideoReady = useCallback(
    (seek: (time: number) => void, getTime: () => number) => {
      seekVideo.current = seek;
      getVideoTime.current = getTime;
    },
    [],
  );

  const handleUploadClick = () => fileInputRef.current?.click();

  return (
    <div className="viewport-container flex flex-col h-full">
      {/* Viewport Header */}
      <header
        style={{ height: sectionHeights.header }}
        className="flex items-center shrink-0 border border-t-0 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 gap-3"
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 font-sans">
            Viewport
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-400 dark:bg-zinc-600" />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <FilePlayIcon className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 font-sans">
              {videoMeta ? videoMeta.title : 'No Video'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconDimensions className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 font-sans">
              {videoMeta ? `${videoMeta.width}×${videoMeta.height}` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 font-sans">
              {videoMeta ? `${videoMeta.fps} fps` : '—'}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {videoMeta && (
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <Upload className="h-3 w-3" />
              <span className="font-sans">Replace</span>
            </button>
          )}
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600"
              />
            ))}
          </div>
        </div>
      </header>

      {/* Video area */}
      <main className="flex-1 border border-zinc-400 dark:border-zinc-600 overflow-hidden relative bg-black">
        {videoMeta ? (
          <>
            {/* Layer 0: Video */}
            <VideoLayer
              src={videoMeta.src}
              playbackRate={playbackRate}
              isPlaying={isPlaying}
              volume={volume}
              isMuted={isMuted}
              onTimeUpdate={setCurrentTime}
              onVideoReady={handleVideoReady}
            />
            {/* Layer 1: Pose overlay canvas — future */}
            {/* Layer 2: 3D sync overlay — future */}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-sm border border-zinc-700 flex items-center justify-center">
                <Upload className="h-5 w-5 text-zinc-500" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-sans">
                  No video loaded
                </span>
                <span className="text-[9px] text-zinc-600 font-sans">
                  Upload a video to begin analysis
                </span>
              </div>
              <button
                onClick={handleUploadClick}
                className="mt-1 px-3 py-1.5 rounded-sm border border-zinc-700 text-[9px] uppercase tracking-widest text-zinc-400 hover:border-sky-500 hover:text-sky-400 transition-all duration-150 cursor-pointer font-sans"
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

      {/* Control Panel */}
      <div
        style={{ height: sectionHeights.controlSection }}
        className="border shrink-0"
      >
        <ControlPanel
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          fps={fps}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          playbackRate={playbackRate}
          setPlaybackRate={setPlaybackRate}
          volume={volume}
          setVolume={setVolume}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          onSeekToFrame={handleSeekToFrame}
          disabled={!videoMeta}
        />
      </div>
    </div>
  );
};
