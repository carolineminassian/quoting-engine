'use client';

import { useEffect } from 'react';

export default function ChunkErrorHandler() {
  useEffect(() => {
    // Catch synchronous chunk load errors
    const handleError = (event: ErrorEvent) => {
      if (
        event.message?.includes('Failed to load chunk') ||
        event.message?.includes('Loading chunk') ||
        event.message?.includes('ChunkLoadError')
      ) {
        console.warn('Stale chunk detected (sync) — reloading...');
        window.location.reload();
      }
    };

    // Catch async/promise-based chunk load errors (Next.js 15/16 pattern)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || event.reason?.toString() || '';
      if (
        msg.includes('Failed to load chunk') ||
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to fetch')
      ) {
        console.warn('Stale chunk detected (async) — reloading...');
        event.preventDefault(); // Suppress the unhandledRejection console error
        window.location.reload();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );
    };
  }, []);

  return null;
}
