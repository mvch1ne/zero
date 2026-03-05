import { useEffect, useRef } from 'react';

interface VideoLayerProps {
  src: string;
  playbackRate: number;
  isPlaying: boolean;
  volume: number; // 0–1
  isMuted: boolean;
  onTimeUpdate: (currentTime: number) => void;
  onVideoReady: (
    seek: (time: number) => void,
    getCurrentTime: () => number,
  ) => void;
}

export const VideoLayer = ({
  src,
  playbackRate,
  isPlaying,
  volume,
  isMuted,
  onTimeUpdate,
  onVideoReady,
}: VideoLayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);

  // Expose imperative API to parent once mounted
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    onVideoReady(
      (time: number) => {
        video.currentTime = time;
      },
      () => video.currentTime,
    );
  }, [onVideoReady]);

  // rAF loop drives onTimeUpdate during playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      onTimeUpdate(video.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      video.play().catch(() => {});
      rafRef.current = requestAnimationFrame(tick);
    } else {
      video.pause();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      onTimeUpdate(video.currentTime);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, onTimeUpdate]);

  // Sync playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  // Sync volume and mute
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  return (
    <video
      ref={videoRef}
      src={src}
      className="absolute inset-0 w-full h-full object-contain"
      playsInline
    />
  );
};
