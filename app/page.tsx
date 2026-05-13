'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const dict = {
  EN: {
    badge: 'Professional Estimate Software',
    title1: 'Win More ',
    title2: 'Projects.',
    subtitle:
      'Create, manage, and finalize professional estimates in seconds. Build your custom material price lists, calculate internal margins, and lock in clients faster.',
    btnStart: 'Get Started Free',
    btnSign: 'Sign In',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service'
  },
  FR: {
    badge: 'Logiciel de Devis Professionnel',
    title1: 'Gagnez Plus de ',
    title2: 'Projets.',
    subtitle:
      'Créez, gérez et finalisez des devis professionnels en quelques secondes. Créez vos listes de prix de matériaux, calculez vos marges et signez vos clients plus rapidement.',
    btnStart: 'Commencer Gratuitement',
    btnSign: 'Se Connecter',
    privacy: 'Politique de Confidentialité',
    terms: 'Conditions Générales'
  }
};

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    });

    // Load language preference
    const storedLang = localStorage.getItem('public_lang');
    if (storedLang === 'FR') {
      setTimeout(() => setLang('FR'), 0);
    }
  }, [router]);

  const toggleLang = (newLang: 'EN' | 'FR') => {
    setLang(newLang);
    localStorage.setItem('public_lang', newLang);
    window.dispatchEvent(new Event('langChange'));
  };

  if (loading) return null;

  const t = dict[lang];

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-8 font-sans text-black relative overflow-hidden">
      {/* LANGUAGE TOGGLE */}
      <div className="absolute top-6 right-8 z-50 flex gap-2">
        <button
          onClick={() => toggleLang('EN')}
          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded transition-colors ${lang === 'EN' ? 'bg-gray-800 text-white' : 'bg-white text-gray-400 hover:text-gray-800'}`}
        >
          EN
        </button>
        <button
          onClick={() => toggleLang('FR')}
          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded transition-colors ${lang === 'FR' ? 'bg-gray-800 text-white' : 'bg-white text-gray-400 hover:text-gray-800'}`}
        >
          FR
        </button>
      </div>

      {/* BACKGROUND GLOWS */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-green-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"></div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="inline-block mb-6 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-500 font-black text-[10px] uppercase tracking-[0.2em] shadow-sm">
          {t.badge}
        </div>

        <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tighter mb-8 text-gray-900 leading-none">
          {t.title1} <span className="text-blue-600 italic">{t.title2}</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-500 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
          {t.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/login?view=signup"
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
      </div>
    </main>
  );
}
