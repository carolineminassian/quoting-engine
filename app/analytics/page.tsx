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

export default function AnalyticsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalRev: 0, count: 0, avg: 0 });
  const [chartData, setChartData] = useState<{ label: string; val: number }[]>(
    []
  );
  const [currency, setCurrency] = useState('$');
  const [isPro, setIsPro] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) return router.push('/');

      const { data: prof } = await supabase
        .from('profiles')
        .select('country, currency, subscription_tier')
        .eq('id', session.user.id)
        .single();

      if (prof?.country === 'FR') setLang('FR');
      if (prof?.currency === 'EUR') setCurrency('€');

      if (prof?.subscription_tier !== 'pro') {
        setIsPro(false);
        setLoading(false);
        return;
      }

      // Fetch only finalized estimates
      const { data: ests } = await supabase
        .from('estimates')
        .select('total_amount_cents, created_at')
        .eq('user_id', session.user.id)
        .eq('is_locked', true);

      if (ests) {
        const totalCents = ests.reduce(
          (acc, curr) => acc + curr.total_amount_cents,
          0
        );
        const count = ests.length;

        setMetrics({
          totalRev: totalCents / 100,
          count: count,
          avg: count > 0 ? totalCents / 100 / count : 0
        });

        // Group by last 6 months
        const months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          return {
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: d.toLocaleDateString(
              prof?.country === 'FR' ? 'fr-FR' : 'en-US',
              { month: 'short' }
            ),
            val: 0
          };
        }).reverse();

        ests.forEach((e) => {
          const d = new Date(e.created_at);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          const targetMonth = months.find((m) => m.key === key);
          if (targetMonth) {
            targetMonth.val += e.total_amount_cents / 100;
          }
        });

        setChartData(months);
      }
      setLoading(false);
    }
    loadAnalytics();
  }, [router]);

  const t = dict[lang];

  if (loading) return null;

  if (!isPro) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-200 max-w-md">
          <p className="text-3xl mb-4">📈</p>
          <h2 className="text-xl font-black uppercase tracking-tighter mb-4">
            {t.lockedOnly}
          </h2>
          <p className="text-sm text-gray-500 font-medium mb-8">
            {t.upgradeAlert}
          </p>
          <Link
            href="/profile"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-sm"
          >
            Upgrade
          </Link>
        </div>
      </main>
    );
  }

  // Add 15% headroom above the highest value so bars don't touch the ceiling
  const maxVal = Math.max(...chartData.map((d) => d.val), 10) * 1.15;

  // Enforce strict 2-decimal formatting based on locale
  const formatMoney = (val: number) => {
    return val.toLocaleString(lang === 'FR' ? 'fr-FR' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            {t.title}
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              {t.totalRev}
            </p>
            <p className="text-3xl font-black text-blue-600 font-mono">
              {currency}
              {formatMoney(metrics.totalRev)}
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              {t.avgValue}
            </p>
            <p className="text-3xl font-black text-gray-800 font-mono">
              {currency}
              {formatMoney(metrics.avg)}
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              {t.totalProj}
            </p>
            <p className="text-3xl font-black text-gray-800 font-mono">
              {metrics.count}
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
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 shrink-0">
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
