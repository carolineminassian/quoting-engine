'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const dict = {
  EN: {
    title: 'Analytics',
    subtitle: 'Insights based on your finalized estimates.',
    lockedOnly: 'Pro Feature',
    totalRev: 'Projected Value',
    totalProj: 'Finalized Projects',
    avgValue: 'Avg Estimate Value',
    last6Months: 'Projected (Last 6 Months)',
    upgradeAlert: 'Analytics are exclusively available on the Pro Plan.'
  },
  FR: {
    title: 'Analytique',
    subtitle: 'Données basées sur vos devis finalisés.',
    lockedOnly: 'Fonctionnalité Pro',
    totalRev: 'Revenus Projetés',
    totalProj: 'Projets Finalisés',
    avgValue: 'Valeur Moyenne',
    last6Months: 'Projections (6 Derniers Mois)',
    upgradeAlert:
      'Les analyses sont exclusivement disponibles avec le Plan Pro.'
  }
};

const LoadingDots = () => (
  <div className="flex items-center justify-center space-x-2 p-12 mt-20">
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
  </div>
);

export default function AnalyticsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalRev: 0, count: 0, avg: 0 });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [isPro, setIsPro] = useState(true);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('country, subscription_tier, currency')
        .eq('id', user.id)
        .single();

      if (prof) {
        setLang(prof.country === 'FR' ? 'FR' : 'EN');
        setCurrency(prof.currency === 'EUR' ? '€' : '$');
        if (prof.subscription_tier !== 'pro') {
          setIsPro(false);
          setLoading(false);
          return;
        }
      }

      const { data: ests } = await supabase
        .from('estimates')
        .select('total_amount_cents, created_at')
        .eq('user_id', user.id)
        .eq('is_locked', true)
        .order('created_at', { ascending: false });

      if (ests) {
        const total = ests.reduce(
          (acc, e) => acc + (e.total_amount_cents || 0),
          0
        );
        setMetrics({
          totalRev: total,
          count: ests.length,
          avg: ests.length > 0 ? Math.round(total / ests.length) : 0
        });
        setMonthlyData(ests);
      }

      setLoading(false);
    }
    fetchData();
  }, [router]);

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const t = dict[lang];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <LoadingDots />
      </div>
    );
  }

  if (!isPro) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 font-sans text-black">
        <div className="max-w-4xl mx-auto text-center mt-20">
          <div className="text-6xl mb-6">📊</div>
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">
            {t.lockedOnly}
          </h1>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            {t.upgradeAlert}
          </p>
          <Link
            href="/upgrade"
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-transform active:scale-95"
          >
            Upgrade to Pro
          </Link>
        </div>
      </main>
    );
  }

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const month = d.getMonth();
    const year = d.getFullYear();
    const label = d.toLocaleString(lang === 'FR' ? 'fr-FR' : 'en-US', {
      month: 'short'
    });
    const val = monthlyData
      .filter((e) => {
        const ed = new Date(e.created_at);
        return ed.getMonth() === month && ed.getFullYear() === year;
      })
      .reduce((acc, e) => acc + (e.total_amount_cents || 0), 0);
    return { label, val };
  });

  const maxVal = Math.max(...chartData.map((d) => d.val), 10000) * 1.15;

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans pb-20">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-tight mb-2">
            {t.title}
          </h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
            {t.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">
              {t.totalRev}
            </p>
            <p className="text-2xl font-black text-blue-600">
              {currency}
              {formatMoney(metrics.totalRev)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">
              {t.totalProj}
            </p>
            <p className="text-2xl font-black">{metrics.count}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">
              {t.avgValue}
            </p>
            <p className="text-2xl font-black">
              {currency}
              {formatMoney(metrics.avg)}
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 border-b border-gray-100 pb-4">
            {t.last6Months}
          </p>

          <div className="h-64 flex items-end justify-between gap-2 sm:gap-4">
            {chartData.map((d, i) => (
              <div
                key={i}
                className="flex-1 h-full flex flex-col justify-end items-center gap-3 group"
              >
                <div
                  className="w-full bg-blue-100 rounded-t-sm border-t-4 border-blue-600 transition-all duration-500 hover:bg-blue-200 relative flex justify-center"
                  style={{
                    height: `${(d.val / maxVal) * 100}%`,
                    minHeight: '4px'
                  }}
                >
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded font-mono whitespace-nowrap z-10 pointer-events-none">
                    {currency}
                    {formatMoney(d.val)}
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400 group-hover:text-black transition-colors">
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
