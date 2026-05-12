'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if the user has already consented
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm bg-gray-900 text-white p-6 rounded-xl shadow-2xl z-[100] border border-gray-800">
      <p className="text-xs text-gray-300 font-medium leading-relaxed mb-4">
        Nous utilisons des cookies pour analyser le trafic et sécuriser les
        paiements. / We use cookies to analyze traffic and secure payments.
        <br />
        <Link
          href="/privacy"
          className="text-blue-400 hover:text-blue-300 underline mt-1 inline-block"
        >
          Privacy Policy
        </Link>
      </p>
      <button
        onClick={handleAccept}
        className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-colors"
      >
        Accepter / Accept
      </button>
    </div>
  );
}
