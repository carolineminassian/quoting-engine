'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  const [lang, setLang] = useState<'EN' | 'FR'>('EN');

  useEffect(() => {
    const storedLang = localStorage.getItem('public_lang');
    if (storedLang === 'FR') {
      setTimeout(() => setLang('FR'), 0);
    }

    // Listen for cross-component language toggles
    const handleLangChange = () => {
      const newLang = localStorage.getItem('public_lang');
      if (newLang) setLang(newLang as 'EN' | 'FR');
    };
    window.addEventListener('langChange', handleLangChange);

    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setTimeout(() => setShow(true), 0);
    }
    return () => window.removeEventListener('langChange', handleLangChange);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'granted');
    posthog.opt_in_capturing();
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie_consent', 'denied');
    posthog.opt_out_capturing();
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm bg-gray-900 text-white p-6 rounded-xl shadow-2xl z-[100] border border-gray-800">
      <h3 className="text-sm font-black uppercase tracking-widest mb-2">
        Cookies & Privacy
      </h3>
      <p className="text-xs text-gray-400 font-medium leading-relaxed mb-6">
        {lang === 'FR'
          ? "Nous utilisons des cookies analytiques pour améliorer l'application. Les cookies de session essentiels sont toujours actifs pour la sécurité."
          : 'We use analytic cookies to improve the app. Essential session cookies are always active for security.'}
        <br />
        <Link
          href="/privacy"
          className="text-blue-400 hover:text-blue-300 underline mt-2 inline-block"
        >
          {lang === 'FR' ? 'Politique de Confidentialité' : 'Privacy Policy'}
        </Link>
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleDecline}
          className="flex-1 bg-gray-800 text-gray-300 border border-gray-700 px-4 py-3 rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-gray-700 transition-colors"
        >
          {lang === 'FR' ? 'Refuser' : 'Decline'}
        </button>
        <button
          onClick={handleAccept}
          className="flex-1 bg-white text-gray-900 px-4 py-3 rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-gray-100 transition-colors"
        >
          {lang === 'FR' ? 'Accepter' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
