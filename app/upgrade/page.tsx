'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';

export default function UpgradePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return router.push('/');
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (prof) {
        setProfile(prof);
        setLang(prof.country === 'FR' ? translations.FR : translations.US);
      }
    }
    fetchData();
  }, [router]);

  const handleCheckout = async (type: 'pro' | 'credits') => {
    setProcessing(true);

    // REPLACE THESE WITH YOUR EXACT STRIPE PRICE IDs
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
        alert(data.error || 'Error creating checkout session');
        setProcessing(false);
      }
    } catch (err) {
      alert('Connection error');
      setProcessing(false);
    }
  };

  if (!lang)
    return (
      <div className="p-10 text-center font-sans text-black italic">
        Loading...
      </div>
    );

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans flex items-center justify-center">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">
            {lang.upgradeTitle}
          </h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
            {lang.upgradeSubtitle}
          </p>
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
              {profile.currency === 'EUR' ? '7€' : '$10'}
              <span className="text-sm text-gray-400">{lang.perMonth}</span>
            </p>

            <ul className="space-y-4 mb-10 text-sm font-bold text-gray-600">
              {lang.proFeatures.map((feature: string, i: number) => (
                <li
                  key={i}
                  className={feature.startsWith('✗') ? 'text-gray-300' : ''}
                >
                  {feature}
                </li>
              ))}
            </ul>

            <button
              disabled={processing}
              onClick={() => handleCheckout('pro')}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-colors"
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
              {lang.payGoFeatures.map((feature: string, i: number) => (
                <li
                  key={i}
                  className={feature.startsWith('✗') ? 'text-gray-300' : ''}
                >
                  {feature}
                </li>
              ))}
            </ul>

            <button
              disabled={processing}
              onClick={() => handleCheckout('credits')}
              className="w-full bg-gray-100 text-gray-800 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-colors"
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
    </main>
  );
}
