'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';
import Button from '@/components/Button';
import LinkButton from '@/components/LinkButton';

function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>(
    'annual'
  );
  const [lifetimeSpotsUsed, setLifetimeSpotsUsed] = useState(0);
  const MAX_LIFETIME_SPOTS = 100;
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

      // Count lifetime users to show spots remaining
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('lifetime_access', true);
      setLifetimeSpotsUsed(count || 0);

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

  const handleCheckout = async (
    type: 'pro' | 'pro_annual' | 'credits' | 'lifetime'
  ) => {
    setProcessing(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          <h1 className="text-5xl tracking-tighter mb-4">
            {/* Match navbar branding: "Pact" in black, "Estim" in light blue.
        Note: parent h1 has NO `uppercase` class so PactEstim renders as-is. */}
            {(() => {
              const title = lang.upgradeTitle || 'Upgrade PactEstim';
              // Find the "PactEstim" word and split it for two-tone styling
              const parts = title.split(/(PactEstim)/i);
              return parts.map((part: string, i: number) => {
                if (part.toLowerCase() === 'pactestim') {
                  return (
                    <span key={i} className="font-sans antialiased">
                      <span className="font-black text-gray-900">Pact</span>
                      <span className="font-light text-blue-600">Estim</span>
                    </span>
                  );
                }
                // Surrounding text (e.g. "Upgrade ") gets uppercase treatment
                return (
                  <span key={i} className="font-black text-gray-900 uppercase">
                    {part}
                  </span>
                );
              });
            })()}
          </h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
            {lang.upgradeSubtitle}
          </p>
        </div>
        {/* Status box — authenticated users only */}

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
                <Button
                  onClick={handleManageBilling}
                  disabled={processing}
                  variant="ghost"
                  size="sm"
                  className="!text-blue-600 hover:!text-blue-800 hover:!bg-blue-50"
                >
                  {lang.manageBilling}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Pro Subscription Tier — with Monthly/Annual toggle */}
          <div className="bg-white p-10 rounded-2xl shadow-xl border-2 border-blue-600 relative">
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-lg rounded-tr-xl">
              {lang.bestValueBadge}
            </div>
            <h2 className="text-3xl font-black uppercase mb-4">
              {lang.proPlanName}
            </h2>

            {/* Monthly/Annual toggle pill */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl mb-6 relative">
              <button
                type="button"
                onClick={() => setBillingInterval('monthly')}
                className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  billingInterval === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {lang.monthlyLabel}
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval('annual')}
                className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer relative ${
                  billingInterval === 'annual'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {lang.annualLabel}
                {billingInterval !== 'annual' && (
                  <span className="absolute -top-2 -right-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                    -17%
                  </span>
                )}
              </button>
            </div>

            {/* Price display — switches based on interval */}
            <div className="mb-8">
              {billingInterval === 'annual' ? (
                <>
                  <p className="text-4xl font-mono font-black">
                    {profile?.currency === 'EUR' ? '70€' : '$90'}
                    <span className="text-sm text-gray-400">
                      {lang.perYearShort}
                    </span>
                  </p>
                  <p className="text-[11px] font-bold text-emerald-600 mt-1.5 uppercase tracking-widest">
                    ✓ {lang.save2Months}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">
                    {profile?.currency === 'EUR'
                      ? '5,83€/mois équivalent'
                      : '$7.50/mo equivalent'}{' '}
                    · {lang.billedAnnually}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-4xl font-mono font-black">
                    {profile?.currency === 'EUR' ? '7€' : '$9'}
                    <span className="text-sm text-gray-400">
                      {lang.perMonthShort}
                    </span>
                  </p>
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">
                    {lang.billedMonthly}
                  </p>
                </>
              )}
            </div>

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

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={processing}
              loadingText="..."
              onClick={() =>
                handleCheckout(
                  billingInterval === 'annual' ? 'pro_annual' : 'pro'
                )
              }
            >
              {lang.upgradeToPro}
            </Button>
          </div>

          {/* Pay As You Go Tier */}
          <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-3xl font-black uppercase mb-2">
              {lang.payAsYouGoName}
            </h2>
            <p className="text-4xl font-mono font-black mb-8">
              {profile?.currency === 'EUR' ? '4€' : '$5'}
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
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              loading={processing}
              loadingText="..."
              onClick={() => handleCheckout('credits')}
            >
              {lang.buyCredits}
            </Button>
          </div>
          {/* Lifetime Deal — Limited */}
          {(() => {
            const spotsLeft = Math.max(
              0,
              MAX_LIFETIME_SPOTS - lifetimeSpotsUsed
            );
            const soldOut = spotsLeft === 0;
            const isCurrentPlan = profile?.lifetime_access === true;

            return (
              <div className="bg-gray-900 p-10 rounded-2xl shadow-xl border-2 border-gray-800 relative flex flex-col">
                {/* Badge */}
                <div className="absolute top-0 right-0 bg-amber-400 text-gray-900 text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-lg rounded-tr-xl">
                  {soldOut ? lang.lifetimeSoldOut : lang.lifetimeLimitedBadge}
                </div>

                <h2 className="text-3xl font-black uppercase mb-2 text-white">
                  {lang.lifetimePlanName}
                </h2>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                  {lang.lifetimeTagline}
                </p>

                {/* Price */}
                <div className="mb-6">
                  <p className="text-4xl font-mono font-black text-white">
                    {profile?.currency === 'EUR' ? '139€' : '$179'}
                    <span className="text-sm text-gray-400 ml-1">
                      {lang.lifetimeOneTime}
                    </span>
                  </p>
                  {!soldOut && (
                    <p className="text-[11px] font-bold text-amber-400 mt-1.5 uppercase tracking-widest">
                      {spotsLeft} / {MAX_LIFETIME_SPOTS}{' '}
                      {lang.lifetimeSpotsLeft}
                    </p>
                  )}
                  {soldOut && (
                    <p className="text-[11px] font-bold text-gray-500 mt-1.5 uppercase tracking-widest">
                      {lang.lifetimeNoMoreSpots}
                    </p>
                  )}
                </div>

                {/* Progress bar */}
                {!soldOut && (
                  <div className="mb-6">
                    <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(lifetimeSpotsUsed / MAX_LIFETIME_SPOTS) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                <ul className="space-y-3 mb-8 text-sm font-bold text-gray-300 flex-1">
                  {lang.lifetimeFeatures.map((f: string, i: number) => (
                    <li
                      key={i}
                      className={f.startsWith('✗') ? 'text-gray-600' : ''}
                    >
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={processing}
                  loadingText="..."
                  disabled={soldOut || isCurrentPlan || processing}
                  onClick={() => handleCheckout('lifetime')}
                  className={
                    soldOut || isCurrentPlan
                      ? 'opacity-40 cursor-not-allowed'
                      : '!bg-amber-400 !text-gray-900 hover:!bg-amber-300'
                  }
                >
                  {isCurrentPlan
                    ? lang.currentPlan
                    : soldOut
                      ? lang.lifetimeSoldOut
                      : lang.getLifetime}
                </Button>
              </div>
            );
          })()}
        </div>
        <div className="text-center mt-12">
          <LinkButton href="/dashboard" variant="ghost" size="sm">
            ← {lang.cancel}
          </LinkButton>
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
