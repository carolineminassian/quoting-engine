'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { translations } from '@/lib/translations';

export default function Footer() {
  const [lang, setLang] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    const syncLanguage = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('default_lang, country')
          .eq('id', session.user.id)
          .single();

        if (prof) {
          const resolvedLang =
            prof.default_lang || (prof.country === 'FR' ? 'FR' : 'EN');
          setLang(resolvedLang === 'FR' ? translations.FR : translations.US);
          localStorage.setItem('public_lang', resolvedLang);
          return;
        }
      }

      // Fallback for logged-out users — read stored language preference
      const storedLang = localStorage.getItem('public_lang');
      const resolvedLang = storedLang === 'FR' ? 'FR' : 'EN';
      setLang(resolvedLang === 'FR' ? translations.FR : translations.US);
    };

    syncLanguage();

    // Listen for profile updates from anywhere in the app (e.g. profile page save)
    const handleProfileUpdate = () => syncLanguage();
    window.addEventListener('profileUpdated', handleProfileUpdate);

    // Legacy event name still supported for logged-out language switches
    const handleLangChange = () => {
      const storedLang = localStorage.getItem('public_lang');
      const country = storedLang === 'FR' ? 'FR' : 'US';
      setLang(country === 'FR' ? translations.FR : translations.US);
    };
    window.addEventListener('langChange', handleLangChange);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('langChange', handleLangChange);
    };
  }, [pathname]);

  // Hide footer on the estimate view so it doesn't print on client PDFs
  if (pathname?.startsWith('/estimates/')) return null;
  // Landing page has its own footer
  if (pathname === '/') return null;

  // Don't render until language is loaded (prevents English flash for FR users)
  if (!lang) return null;

  return (
    <footer className="w-full py-6 px-6 flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-gray-200 bg-white z-10 mt-auto">
      <div className="flex items-center gap-6">
        <Link
          href="/privacy"
          className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-800 transition-colors"
        >
          {lang.privacyPolicy}
        </Link>
        <Link
          href="/terms"
          className="text-[10px] font-black uppercase tracking-widests text-gray-400 hover:text-gray-800 transition-colors"
        >
          {lang.termsOfService}
        </Link>
      </div>
      <span className="hidden sm:block text-gray-300 text-xs">·</span>
      <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
        © {new Date().getFullYear()} PactEstim
      </p>
    </footer>
  );
}
