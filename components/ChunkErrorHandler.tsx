'use client';

import { useEffect } from 'react';

export default function ChunkErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (
        event.message?.includes('Failed to load chunk') ||
        event.message?.includes('Loading chunk') ||
        event.message?.includes('ChunkLoadError')
      ) {
        console.warn('Stale chunk detected — reloading...');
        window.location.reload();
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return null;
}
