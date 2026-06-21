'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { landingTranslations } from '@/lib/landingTranslations';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// ─── Icons ───────────────────────────────────────────────────────────────────

const FeatureIcons = [
  // Document
  () => (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  // Check circle
  () => (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  // Receipt
  () => (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5 7 5 20 12 17 19 20 19 7" />
      <rect x="5" y="3" width="14" height="5" />
    </svg>
  ),
  // Bar chart
  () => (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  // Copy
  () => (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  // Globe
  () => (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
];

const BrandLogo = () => (
  <div className="flex items-center gap-2.5 select-none">
    <svg
      className="w-8 h-8 text-gray-900"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 20L14 14L19 18L25 10M25 10H20M25 10V15"
        stroke="#2563eb"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span className="text-xl tracking-tighter font-sans antialiased">
      <span className="font-black text-gray-900">Pact</span>
      <span className="font-light text-blue-600">Estim</span>
    </span>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');
  const [lifetimeSpotsUsed, setLifetimeSpotsUsed] = useState(0);
  const MAX_LIFETIME_SPOTS = 100;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    });
    const stored = localStorage.getItem('public_lang');
    if (stored === 'FR') setLang('FR');

    // Fetch lifetime spots so the tier hides when sold out
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('lifetime_access', true)
      .then(({ count }) => setLifetimeSpotsUsed(count || 0));
  }, [router]);

  const toggleLang = (l: 'EN' | 'FR') => {
    setLang(l);
    localStorage.setItem('public_lang', l);
  };

  if (loading) return null;

  const t = landingTranslations[lang];

  return (
    <div className="min-h-screen bg-white font-sans text-black">
      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['EN', 'FR'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => toggleLang(l)}
                  className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    lang === l
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Link
              href="/login"
              className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 px-3 py-2 transition-colors"
            >
              {t.btnSign}
            </Link>
            <Link
              href="/new-estimate"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors"
            >
              {t.btnStart}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gray-50 pt-20 pb-24 px-6">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-green-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block mb-6 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-500 font-black text-[10px] uppercase tracking-[0.2em] shadow-sm">
            {t.badge}
          </div>
          <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tighter mb-6 text-gray-900 leading-none">
            {t.title1}
            <span className="text-blue-600 italic">{t.title2}</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
            {t.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
            <Link
              href="/new-estimate"
              className="w-full sm:w-auto bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-transform hover:scale-105 active:scale-95"
            >
              {t.btnStart}
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto bg-white text-gray-800 border border-gray-200 px-10 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm hover:border-gray-300 transition-colors"
            >
              {t.btnSign}
            </Link>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {t.noCard}
          </p>
        </div>
      </section>

      {/* ── HOOK / STATS ── */}
      <section className="py-20 px-6 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4 text-gray-900">
            {t.hookTitle}
          </h2>
          <p className="text-gray-500 font-medium mb-14 max-w-2xl mx-auto leading-relaxed">
            {t.hookSubtitle}
          </p>
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { val: t.hookStat1, label: t.hookStat1Label },
              { val: t.hookStat2, label: t.hookStat2Label },
              { val: t.hookStat3, label: t.hookStat3Label }
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
              >
                <p className="text-3xl sm:text-4xl font-black font-mono text-blue-600 mb-1">
                  {stat.val}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-3">
              {t.howTitle}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-gray-900">
              {t.howSubtitle}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { num: '01', title: t.step1Title, desc: t.step1Desc },
              { num: '02', title: t.step2Title, desc: t.step2Desc },
              { num: '03', title: t.step3Title, desc: t.step3Desc }
            ].map((step, i) => (
              <div key={i} className="relative">
                {i < 2 && (
                  <div className="hidden sm:block absolute top-8 left-full w-full h-px bg-gray-200 -translate-x-4 z-0" />
                )}
                <div className="relative z-10 bg-white rounded-2xl p-8 border border-gray-200 shadow-sm h-full">
                  <span className="text-5xl font-black font-mono text-gray-100 block mb-4 leading-none">
                    {step.num}
                  </span>
                  <h3 className="font-black uppercase tracking-tight text-gray-900 mb-2 text-base">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-3">
              {t.featuresTitle}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-gray-900">
              {t.featuresSubtitle}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.features.map((f, i) => {
              const Icon = FeatureIcons[i];
              return (
                <div
                  key={i}
                  className="bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all duration-200"
                >
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                    <Icon />
                  </div>
                  <h3 className="font-black uppercase tracking-tight text-gray-900 mb-2 text-sm">
                    {f.title}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section className="py-16 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-8">
            {t.forTitle}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {t.trades.map((trade, i) => (
              <span
                key={i}
                className="bg-gray-800 text-gray-300 px-4 py-2 rounded-full text-sm font-bold border border-gray-700"
              >
                {trade}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-20 px-6 bg-white" id="pricing">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-3">
              {t.pricingTitle}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-gray-900">
              {t.pricingSubtitle}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200 flex flex-col">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
                {t.planFree}
              </p>
              <p className="text-4xl font-black font-mono text-gray-900 mb-1">
                {t.planFreePrice}
              </p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">
                &nbsp;
              </p>
              <ul className="space-y-2 mb-8 flex-1">
                {t.planFreeFeatures.map((f, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-600 font-medium flex items-center gap-2"
                  >
                    <span className="text-green-500 font-black">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/new-estimate"
                className="w-full text-center bg-gray-900 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-700 transition-colors"
              >
                {t.planFreeCta}
              </Link>
            </div>
            {/* Pro */}
            <div className="bg-white rounded-2xl p-8 border-2 border-blue-600 flex flex-col relative shadow-xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                Popular
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4">
                {t.planPro}
              </p>
              <p className="text-4xl font-black font-mono text-gray-900 mb-1">
                {t.planProPrice}
                <span className="text-sm text-gray-400 font-medium">
                  {t.planProPer}
                </span>
              </p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">
                {t.planProAlt}
              </p>
              <ul className="space-y-2 mb-8 flex-1">
                {t.planProFeatures.map((f, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-600 font-medium flex items-center gap-2"
                  >
                    <span className="text-blue-600 font-black">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login?redirect=/upgrade"
                className="w-full text-center bg-blue-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-colors"
              >
                {t.planProCta}
              </Link>
            </div>
            {/* Lifetime — hidden when sold out */}
            {lifetimeSpotsUsed < MAX_LIFETIME_SPOTS && (
              <div className="bg-gray-900 rounded-2xl p-8 border-2 border-gray-700 flex flex-col relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-gray-900 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap">
                  {t.planLifetimeBadge}
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-4">
                  {t.planLifetime}
                </p>
                <p className="text-4xl font-black font-mono text-white mb-1">
                  {t.planLifetimePrice}
                </p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-6">
                  {t.planLifetimeAlt}
                </p>
                <ul className="space-y-2 mb-8 flex-1">
                  {t.planLifetimeFeatures.map((f, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-400 font-medium flex items-center gap-2"
                    >
                      <span className="text-amber-400 font-black">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login?redirect=/upgrade"
                  className="w-full text-center bg-amber-400 text-gray-900 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-300 transition-colors"
                >
                  {t.planLifetimeCta}
                </Link>
              </div>
            )}
          </div>
          <p className="text-center mt-6">
            <a
              href="#pricing"
              className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
            >
              {t.viewAllPlans}
            </a>
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black uppercase tracking-tighter text-gray-900">
              {t.faqTitle}
            </h2>
          </div>
          <div className="space-y-4">
            {t.faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-7 border border-gray-200"
              >
                <h3 className="font-black text-gray-900 mb-2 text-sm uppercase tracking-tight">
                  {faq.q}
                </h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 px-6 bg-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-white mb-8">
            {t.finalTitle}
          </h2>
          <Link
            href="/new-estimate"
            className="inline-block bg-white text-blue-600 px-12 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 active:scale-95 transition-transform"
          >
            {t.finalBtn}
          </Link>
        </div>
      </section>
    </div>
  );
}
