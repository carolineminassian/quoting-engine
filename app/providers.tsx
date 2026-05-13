'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
        capture_pageview: false,
        capture_pageleave: true,
        opt_out_capturing_by_default: true // Enforces GDPR compliance
      });

      // Check if user previously granted consent
      if (localStorage.getItem('cookie_consent') === 'granted') {
        posthog.opt_in_capturing();
      }
    }
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
