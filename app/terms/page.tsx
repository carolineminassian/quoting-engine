'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function TermsOfService() {
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-3xl mx-auto bg-white p-10 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-10 pb-6 border-b border-gray-100">
          <Link
            href="/"
            className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black"
          >
            ← {lang === 'FR' ? 'Retour' : 'Back'}
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => setLang('EN')}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded ${lang === 'EN' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('FR')}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded ${lang === 'FR' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}
            >
              FR
            </button>
          </div>
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tighter mb-8">
          {lang === 'FR' ? 'Conditions Générales' : 'Terms of Service'}
        </h1>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          {/* REPLACE WITH YOUR ACTUAL LEGAL TEXT */}
          <p>
            <strong>Last Updated:</strong> May 2026
          </p>
          <p>
            {lang === 'FR'
              ? "[Insérez vos conditions générales ici. Définissez l'utilisation acceptable du générateur de devis, la politique de remboursement des crédits, et les clauses de non-responsabilité concernant les données financières.]"
              : '[Insert your terms of service here. Define acceptable use of the estimate generator, the refund policy for credits, and disclaimers regarding financial data availability.]'}
          </p>
        </div>
      </div>
    </main>
  );
}
