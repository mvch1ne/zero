// components/layout/DesktopOnly.tsx
import { useState, useEffect } from 'react';
import { MonitorX } from 'lucide-react';

const MIN_WIDTH = 800;

export function DesktopOnly({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (width < MIN_WIDTH) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-8">
        <MonitorX className="w-12 h-12 mb-4 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Desktop Only</h1>
        <p className="text-muted-foreground mt-2">
          This web app is not available on mobile devices or small screens.
          Please open it on a desktop.
        </p>
      </div>
    );
  }

  return children;
}
