'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Footer() {
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');
  const pathname = usePathname();

  useEffect(() => {
    const syncLanguage = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('country')
          .eq('id', session.user.id)
          .single();

        if (prof?.country) {
          const dbLang = prof.country === 'FR' ? 'FR' : 'EN';
          setTimeout(() => setLang(dbLang), 0);
          localStorage.setItem('public_lang', dbLang);
          return;
        }
      }

      // Fallback for logged-out users
      const storedLang = localStorage.getItem('public_lang');
      if (storedLang === 'FR') {
        setTimeout(() => setLang('FR'), 0);
      }
    };

    syncLanguage();

    const handleLangChange = () => {
      const newLang = localStorage.getItem('public_lang');
      if (newLang) setLang(newLang as 'EN' | 'FR');
    };

    window.addEventListener('langChange', handleLangChange);
    return () => window.removeEventListener('langChange', handleLangChange);
  }, []);

  // Hide footer on the estimate view so it doesn't print on client PDFs
  if (pathname?.startsWith('/estimates/')) return null;

  return (
    <footer className="w-full py-6 flex justify-center gap-8 border-t border-gray-200 bg-white z-10 mt-auto">
      <Link
        href="/privacy"
        className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-800 transition-colors"
      >
        {lang === 'FR' ? 'Politique de Confidentialité' : 'Privacy Policy'}
      </Link>
      <Link
        href="/terms"
        className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-800 transition-colors"
      >
        {lang === 'FR' ? 'Conditions Générales' : 'Terms of Service'}
      </Link>
    </footer>
  );
}
