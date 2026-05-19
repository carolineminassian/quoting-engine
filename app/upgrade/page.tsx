'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';

function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [dialog, setDialog] = useState<{
    type: 'alert';
    title?: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    let pollIntervalId: NodeJS.Timeout | null = null;
    let redirectTimeoutId: NodeJS.Timeout | null = null;

    async function fetchProfile() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return null;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile(prof);
        setLang(prof.country === 'FR' ? translations.FR : translations.US);
      }
      return prof;
    }

    async function init() {
      const prof = await fetchProfile();

      // Successful Stripe checkout return path
      if (success && prof) {
        // Notify navbar/footer to refresh
        window.dispatchEvent(new CustomEvent('profileUpdated'));

        // If the webhook hasn't updated the profile yet, poll briefly
        const isProAlready = prof.subscription_tier === 'pro';
        const isCreditsBumped = (prof.estimate_credits || 0) > 0;

        if (!isProAlready && !isCreditsBumped) {
          // Poll every 1.5s for up to ~12s waiting for webhook to apply
          let pollCount = 0;
          pollIntervalId = setInterval(async () => {
            pollCount++;
            const updated = await fetchProfile();
            const ready =
              updated?.subscription_tier === 'pro' ||
              (updated?.estimate_credits || 0) > 0;

            if (ready || pollCount >= 8) {
              if (pollIntervalId) clearInterval(pollIntervalId);
              pollIntervalId = null;
              window.dispatchEvent(new CustomEvent('profileUpdated'));

              // Auto-redirect to dashboard 3s after we confirm ready
              redirectTimeoutId = setTimeout(() => {
                router.push('/dashboard');
              }, 3000);
            }
          }, 1500);
        } else {
          // Already updated — redirect to dashboard after 3s
          redirectTimeoutId = setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        }
      }
    }

    init();

    return () => {
      if (pollIntervalId) clearInterval(pollIntervalId);
      if (redirectTimeoutId) clearTimeout(redirectTimeoutId);
    };
  }, [router, success]);

  const handleCheckout = async (type: 'pro' | 'credits') => {
    setProcessing(true);
    const priceId =
      type === 'pro'
        ? 'price_1TW2dOQOMlHkT3tX4YL6Pn2C'
        : 'price_1TW2aHQOMlHkT3tXV1ITlTHt';

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: priceId,
          userId: profile.id,
          type: type,
          currency: profile.currency
        })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setDialog({
          type: 'alert',
          message: data.error || lang.errorOccurred
        });
        setProcessing(false);
      }
    } catch (err) {
      setDialog({
        type: 'alert',
        message: lang.connectionError
      });
      setProcessing(false);
    }
  };
  const handleManageBilling = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setProcessing(false);
    } catch (err) {
      setProcessing(false);
    }
  };

  if (!lang || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <LoadingDots />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans flex items-center justify-center">
      <div className="max-w-4xl w-full">
        {/* Feedback Banners */}
        {success && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-bold text-center">
            {lang.paymentSuccessful}
          </div>
        )}
        {canceled && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold text-center">
            {lang.paymentCanceled}
          </div>
        )}

        <div className="text-center mb-12">
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">
            {lang.upgradeTitle}
          </h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
            {lang.upgradeSubtitle}
          </p>
        </div>

        {/* Improved Status Box */}
        <div className="mb-12 bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 items-center gap-6">
            <div>
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">
                {lang.currentPlan}
              </p>
              <p className="text-sm font-black uppercase tracking-tight">
                {profile.subscription_tier === 'pro'
                  ? lang.proPlan
                  : lang.freePlan}
              </p>
            </div>
            <div className="text-right sm:text-center">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">
                {lang.creditsLabel}
              </p>
              <p className="text-sm font-black">
                {profile.estimate_credits || 0}
              </p>
            </div>
            {profile.subscription_tier === 'pro' && (
              <div className="col-span-2 sm:col-span-1 pt-4 sm:pt-0 border-t sm:border-none border-gray-50 flex justify-center sm:justify-end">
                <button
                  onClick={handleManageBilling}
                  disabled={processing}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {lang.manageBilling}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Pro Subscription Tier */}
          <div className="bg-white p-10 rounded-2xl shadow-xl border-2 border-blue-600 relative">
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-lg rounded-tr-xl">
              {lang.bestValue}
            </div>
            <h2 className="text-3xl font-black uppercase mb-2">
              {lang.proPlanName}
            </h2>
            <p className="text-4xl font-mono font-black mb-8">
              {profile.currency === 'EUR' ? '7€' : '$9'}
              <span className="text-sm text-gray-400">{lang.perMonth}</span>
            </p>

            <ul className="space-y-4 mb-10 text-sm font-bold text-gray-600">
              {lang.proFeatures.map((f: string, i: number) => (
                <li
                  key={i}
                  className={f.startsWith('✗') ? 'text-gray-300' : ''}
                >
                  {f}
                </li>
              ))}
            </ul>

            <button
              disabled={processing}
              onClick={() => handleCheckout('pro')}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-transform active:scale-95"
            >
              {processing ? '...' : lang.upgradeToPro}
            </button>
          </div>

          {/* Pay As You Go Tier */}
          <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-3xl font-black uppercase mb-2">
              {lang.payAsYouGoName}
            </h2>
            <p className="text-4xl font-mono font-black mb-8">
              {profile.currency === 'EUR' ? '4€' : '$5'}
            </p>
            <ul className="space-y-4 mb-10 text-sm font-bold text-gray-600">
              {lang.payGoFeatures.map((f: string, i: number) => (
                <li
                  key={i}
                  className={f.startsWith('✗') ? 'text-gray-300' : ''}
                >
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled={processing}
              onClick={() => handleCheckout('credits')}
              className="w-full bg-gray-100 text-gray-800 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-transform active:scale-95"
            >
              {processing ? '...' : lang.buyCredits}
            </button>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/dashboard"
            className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black"
          >
            ← {lang.cancel}
          </Link>
        </div>
      </div>

      <ConfirmDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        labels={{
          notice: lang.notice,
          cancel: lang.cancel,
          confirmOk: lang.confirmOk
        }}
      />
    </main>
  );
}

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 p-8">
          <LoadingDots />
        </div>
      }
    >
      <UpgradeContent />
    </Suspense>
  );
}
