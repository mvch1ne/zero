import { VideoLayer } from './VideoLayer';
import { FilePlayIcon } from 'lucide-react';
import { Clock } from 'lucide-react';
import { IconDimensions } from '@tabler/icons-react';

export const Viewport = () => {
  const sectionHeights = {
    header: '1.25rem',
    controlSection: '7.25rem',
  };

  return (
    <div className="viewport-container flex flex-col h-full">
      <header
        style={{ height: sectionHeights.header }}
        className="text-xs flex items-center justify-start gap-4 border border-t-0 shrink-0"
      >
        <span className="h-full flex justify-center items-center bg-ring py-0.5 px-1">
          VIEWPORT
        </span>
        <div className="flex items-center">
          <FilePlayIcon className="h-4" />
          <span> Title </span>
        </div>
        <div className="flex items-center">
          <IconDimensions className="h-4" />
          <span> Dimensions </span>
        </div>
        <div className="flex items-center">
          <Clock className="h-4" />
          <span>Framerate</span>
        </div>
      </header>

      <main className="flex-1 border overflow-hidden flex justify-center items-center bg-black">
        <VideoLayer />
      </main>

      <section
        style={{ height: sectionHeights.controlSection }}
        className="border shrink-0"
      >
        <>
          <></>
        </>
      </section>
    </div>
  );
};
