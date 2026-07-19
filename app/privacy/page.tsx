'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function PrivacyPolicy() {
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
          .select('country, default_lang') // Explicitly select both columns to satisfy ORM typing
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
            {lang === 'FR' ? 'Politique de Confidentialité' : 'Privacy Policy'}
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
                <strong>1. Collecte des données :</strong> Nous collectons votre
                nom, e-mail, adresse IP et les données de vos clients que vous
                saisissez dans vos devis. Le traitement des paiements est
                entièrement sécurisé par Stripe ; nous ne stockons jamais vos
                coordonnées bancaires.
              </p>
              <p>
                <strong>2. Utilisation :</strong> Vos données sont stockées de
                manière sécurisée exclusivement pour vous fournir le service de
                devis. Nous utilisons des cookies d'analyse d'audience
                (uniquement si vous acceptez) afin d'améliorer la plateforme.
              </p>
              <p>
                <strong>3. Partage :</strong> Nous ne vendons ni ne louons
                jamais vos données. Elles sont partagées uniquement avec nos
                sous-traitants essentiels (Stripe pour la facturation, Supabase
                pour l'hébergement, Resend pour les e-mails) qui sont tous
                conformes au RGPD.
              </p>
              <p>
                <strong>4. Vos droits :</strong> Conformément au RGPD, vous
                disposez d'un droit d'accès, de modification et de suppression
                de vos données. Vous pouvez supprimer toutes vos données via
                votre tableau de bord ou nous contacter directement.
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>1. Data Collection:</strong> We collect your name,
                email, IP address, and the client data you input into your
                estimates. Payment processing is fully secured by Stripe; we
                never touch or store your credit card information.
              </p>
              <p>
                <strong>2. Usage:</strong> Your data is securely hosted strictly
                to provide you with the estimating service. We use product
                analytics (only if you opt-in via cookies) to help us improve
                the platform.
              </p>
              <p>
                <strong>3. Sharing:</strong> We never sell or rent your data. It
                is shared only with our essential infrastructure sub-processors
                (Stripe for billing, Supabase for hosting, Resend for
                transactional emails), all of which are GDPR compliant.
              </p>
              <p>
                <strong>4. Your Rights:</strong> You have the right to access,
                rectify, or erase your personal data at any time. You can delete
                your account and all associated data directly from your
                dashboard.
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
