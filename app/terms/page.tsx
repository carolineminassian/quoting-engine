'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function TermsOfService() {
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const syncLanguage = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session) {
        setIsLoggedIn(true);
        const { data: prof } = await supabase
          .from('profiles')
          .select('country, default_lang') // Explicitly select default_lang to satisfy the type compiler
          .eq('id', session.user.id)
          .single();

        if (prof) {
          const dbLang =
            prof.default_lang || (prof.country === 'FR' ? 'FR' : 'EN');
          setTimeout(() => setLang(dbLang), 0);
          localStorage.setItem('public_lang', dbLang);
          setAuthLoading(false);
          return;
        }
      }

      const storedLang = localStorage.getItem('public_lang');
      if (storedLang === 'FR') {
        setTimeout(() => setLang('FR'), 0);
      }
      setAuthLoading(false);
    };

    syncLanguage();

    const handleLangChange = () => {
      const newLang = localStorage.getItem('public_lang');
      if (newLang) setLang(newLang as 'EN' | 'FR');
    };
    window.addEventListener('langChange', handleLangChange);
    return () => window.removeEventListener('langChange', handleLangChange);
  }, []);

  const toggleLang = (newLang: 'EN' | 'FR') => {
    setLang(newLang);
    localStorage.setItem('public_lang', newLang);
    window.dispatchEvent(new Event('langChange'));
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col p-8 font-sans text-black">
      <div className="max-w-3xl mx-auto w-full bg-white p-8 sm:p-12 rounded-xl shadow-sm border border-gray-200 mt-10 mb-20">
        <div className="flex justify-between items-center mb-10 border-b border-gray-100 pb-6">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-gray-900">
            {lang === 'FR' ? 'Conditions Générales' : 'Terms of Service'}
          </h1>

          {!authLoading && !isLoggedIn && (
            <div className="flex gap-2">
              <button
                onClick={() => toggleLang('EN')}
                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded transition-colors ${lang === 'EN' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                EN
              </button>
              <button
                onClick={() => toggleLang('FR')}
                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded transition-colors ${lang === 'FR' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                FR
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed font-medium">
          {lang === 'FR' ? (
            <>
              <p>
                <strong>1. Utilisation du service :</strong> Ce service est
                conçu pour la création et la gestion de devis commerciaux. Vous
                êtes seul responsable de l'exactitude des calculs, des marges et
                des informations fiscales (TVA) inscrits sur les documents
                générés.
              </p>
              <p>
                <strong>2. Limites de responsabilité :</strong> L'application
                génère des PDF basés sur vos saisies. Nous ne fournissons pas de
                conseils comptables ou fiscaux. Les devis finalisés sont
                verrouillés pour des raisons de traçabilité, mais vous êtes
                responsable de leur conformité légale dans votre juridiction.
              </p>
              <p>
                <strong>3. Abonnements et Crédits :</strong> L'abonnement "Pro"
                est facturé mensuellement via Stripe. Les crédits pour les
                utilisateurs gratuits sont valables pour le mois en cours. Les
                abonnements peuvent être annulés à tout moment depuis les
                paramètres du profil.
              </p>
              <p>
                <strong>4. Résiliation :</strong> Nous nous réservons le droit
                de suspendre ou de fermer tout compte utilisé pour la fraude,
                l'envoi de spam ou en violation de ces conditions.
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>1. Service Usage:</strong> This service provides
                software for generating commercial estimates. You are solely
                responsible for the accuracy of your internal margins, pricing,
                and tax rates applied to the documents you generate.
              </p>
              <p>
                <strong>2. Limitation of Liability:</strong> The platform
                generates PDFs strictly based on your inputs. We do not provide
                accounting or legal advice. Finalized estimates are locked for
                your auditing purposes, but you remain responsible for ensuring
                the document complies with your local business laws.
              </p>
              <p>
                <strong>3. Subscriptions & Credits:</strong> The "Pro" tier is
                billed monthly via Stripe. Credits for free users are refreshed
                monthly. Subscriptions may be canceled at any time via your
                profile settings. No partial refunds are provided for mid-cycle
                cancellations.
              </p>
              <p>
                <strong>4. Termination:</strong> We reserve the right to suspend
                or terminate any account found to be engaged in fraud, spam, or
                a violation of these terms.
              </p>
            </>
          )}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100">
          <Link
            href={isLoggedIn ? '/dashboard' : '/'}
            className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
          >
            ← {lang === 'FR' ? 'Retour' : 'Return'}
          </Link>
        </div>
      </div>
    </main>
  );
}
