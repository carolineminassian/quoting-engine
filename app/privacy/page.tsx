'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
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
          {lang === 'FR' ? 'Politique de Confidentialité' : 'Privacy Policy'}
        </h1>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          {/* REPLACE WITH YOUR ACTUAL LEGAL TEXT */}
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
                manière sécurisée (via Supabase) exclusivement pour vous fournir
                le service de devis. Nous utilisons PostHog pour l'analyse
                d'audience (uniquement si vous acceptez les cookies) afin
                d'améliorer la plateforme.
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
                <strong>2. Usage:</strong> Your data is securely hosted (via
                Supabase) strictly to provide you with the estimating service.
                We use PostHog for product analytics (only if you opt-in via
                cookies) to help us improve the platform.
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
          <p>
            {lang === 'FR'
              ? '[Insérez votre texte juridique ici. Expliquez quelles données vous collectez via Supabase, comment Stripe gère les paiements, et votre conformité au RGPD.]'
              : '[Insert your legal text here. Explain what data you collect via Supabase, how Stripe handles payments securely, and your compliance with data protection laws.]'}
          </p>
        </div>
      </div>
    </main>
  );
}
