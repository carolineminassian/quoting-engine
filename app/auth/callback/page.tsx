'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LoadingDots from '@/components/LoadingDots';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Auth callback error:', error);
          router.push('/login?error=confirmation_failed');
          return;
        }
      }
      router.push('/profile');
    };
    handleCallback();
  }, []);

  return <LoadingDots />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingDots />}>
      <CallbackHandler />
    </Suspense>
  );
}
