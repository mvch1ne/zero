import Video from '@/assets/Videos/test1.mp4';
// import Video from '@/assets/Videos/test2.mp4';

export const VideoLayer = () => {
  return <video className="h-full" src={Video}></video>;
};
