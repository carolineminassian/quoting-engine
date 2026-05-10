'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EstimateView() {
  const { id } = useParams();
  const router = useRouter();
  const [estimate, setEstimate] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: est } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', id)
        .single();
      if (!est) return;

      const [prof, mats] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', est.user_id).single(),
        supabase.from('materials').select('*')
      ]);

      // Determine translations
      import('@/lib/translations').then(({ translations }) => {
        const country = est.country_snapshot || prof.data.country;
        setLang(country === 'FR' ? translations.FR : translations.US);
      });

      const displayBusinessName =
        est.business_name_snapshot || prof.data.business_name;
      const displayCountry = est.country_snapshot || prof.data.country;
      const displayCurrency = est.currency_snapshot || prof.data.currency;
      const displayTaxRate =
        est.tax_rate_snapshot !== null
          ? est.tax_rate_snapshot
          : prof.data.default_tax_rate || 0;

      setEstimate(est);
      setProfile({
        ...prof.data,
        business_name: displayBusinessName,
        country: displayCountry,
        currency: displayCurrency,
        tax_rate: displayTaxRate
      });

      setMaterials(mats.data || []);
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const getSectionTotal = (sec: any) => {
    const mats = sec.items.reduce((acc: number, item: any) => {
      const m = materials.find((m) => m.id === item.materialId);
      return acc + (m ? m.cost_per_unit_cents * item.qty : 0);
    }, 0);
    const labor = Math.round(sec.laborHours * sec.hourlyRate * 100);
    return (mats + labor) / 100;
  };

  const generateDynamicDescription = (sec: any) => {
    const isFr = profile.country === 'FR';
    let baseText = isFr
      ? "Prestation complète incluant la main-d'œuvre professionnelle, la logistique et les matériaux nécessaires à cette phase du projet."
      : 'Comprehensive delivery including all necessary professional labor, logistics, and materials required for this project phase.';

    const zeroCostMats = sec.items
      .map((item: any) => materials.find((m) => m.id === item.materialId))
      .filter((m: any) => m && m.cost_per_unit_cents === 0)
      .map((m: any) => m.name);

    if (zeroCostMats.length > 0) {
      const matString = zeroCostMats.join(', ');
      baseText += isFr
        ? ` Matériaux inclus sans frais supplémentaires ou fournis par le client : ${matString}.`
        : ` Materials included at no charge or client-provided: ${matString}.`;
    }

    if (sec.laborHours > 0 && sec.hourlyRate === 0) {
      baseText += isFr
        ? " Main-d'œuvre incluse sans frais supplémentaires."
        : ' Labor included at no charge for this phase.';
    }

    return baseText;
  };

  const handleSend = async (method: 'email' | 'phone') => {
    setSending(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    const currentUserEmail = user?.email;

    if (method === 'email' && !currentUserEmail) {
      alert(
        'Could not identify your sender email. Please try logging out and back in.'
      );
      setSending(false);
      return;
    }

    const estimateUrl = `${window.location.origin}/estimates/${id}`;
    const endpoint = method === 'email' ? '/api/send-email' : '/api/send-sms';

    const body =
      method === 'email'
        ? {
            email: estimate.client_email,
            clientName: estimate.client_name,
            estimateUrl,
            businessName: profile.business_name,
            userEmail: currentUserEmail
          }
        : {
            phone: estimate.client_phone,
            clientName: estimate.client_name,
            estimateUrl,
            businessName: profile.business_name
          };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        alert(
          `${method === 'email' ? 'Email' : 'SMS'} sent successfully to ${method === 'email' ? estimate.client_email : estimate.client_phone}`
        );
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error?.message || 'Failed to send'}`);
      }
    } catch (err) {
      alert('Connection error. Check your internet or API settings.');
    } finally {
      setSending(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.country === 'FR' ? 'Devis' : 'Estimate'} - ${profile.business_name}`,
          text:
            profile.country === 'FR'
              ? `Voici votre devis de ${profile.business_name}`
              : `Here is your estimate from ${profile.business_name}`,
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      alert(
        profile.country === 'FR'
          ? "Le partage natif n'est pas supporté sur ce navigateur."
          : 'Native sharing is not supported on this browser.'
      );
    }
  };

  const handleExcelExport = () => {
    alert('Excel Export module will be integrated here.');
    // Placeholder for future Excel library integration
  };

  const handleFinalize = async () => {
    if (
      !confirm(
        profile.country === 'FR'
          ? 'Ceci verrouillera le devis. Vous ne pourrez plus le modifier. Continuer ?'
          : 'This will lock the estimate for compliance. You cannot edit it again. Proceed?'
      )
    )
      return;
    await supabase.from('estimates').update({ is_locked: true }).eq('id', id);
    location.reload();
  };

  const handleCancelDraft = async () => {
    if (
      !confirm(
        profile.country === 'FR'
          ? 'Êtes-vous sûr de vouloir annuler ce brouillon ?'
          : 'Are you sure you want to cancel this draft?'
      )
    )
      return;
    await supabase.from('estimates').delete().eq('id', id);
    router.push('/dashboard');
  };

  if (loading || !lang)
    return (
      <div className="p-10 text-center font-sans">
        Generating Professional Document...
      </div>
    );

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-8 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 print:hidden">
          <div className="flex gap-4">
            <Link
              href="/dashboard"
              className="bg-white border px-4 py-2 rounded font-bold text-sm hover:bg-gray-50 transition-colors"
            >
              ← Dashboard
            </Link>
            {!estimate.is_locked && (
              <>
                <Link
                  href={`/new-estimate?edit=${id}`}
                  className="bg-blue-50 text-blue-600 px-4 py-2 rounded font-bold text-sm hover:bg-blue-100 transition-colors"
                >
                  {profile.country === 'FR'
                    ? 'Modifier le Brouillon'
                    : 'Edit Draft'}
                </Link>
                <button
                  onClick={handleCancelDraft}
                  className="text-red-500 font-bold text-sm px-4 hover:text-red-700 transition-colors"
                >
                  {profile.country === 'FR'
                    ? 'Annuler le Brouillon'
                    : 'Cancel Draft'}
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {estimate.is_locked ? (
              <>
                {/* Pro Feature: Excel Export UI */}
                {profile.subscription_tier === 'pro' && (
                  <button
                    onClick={handleExcelExport}
                    className="bg-green-600 text-white px-4 py-2 rounded font-bold text-xs shadow-lg flex-1 sm:flex-none hover:bg-green-700 transition-colors"
                  >
                    {lang.exportExcel}
                  </button>
                )}

                {/* Mobile Share Button */}
                <button
                  onClick={handleNativeShare}
                  className="sm:hidden flex-1 bg-gray-800 text-white px-4 py-2 rounded font-bold text-xs hover:bg-gray-900 transition-colors"
                >
                  {profile.country === 'FR' ? 'Partager' : 'Share'}
                </button>

                {estimate.client_email && (
                  <button
                    disabled={sending}
                    onClick={() => handleSend('email')}
                    className="flex-1 sm:flex-none bg-gray-800 text-white px-4 py-2 rounded font-bold text-xs disabled:opacity-50 hover:bg-gray-900 transition-colors"
                  >
                    {sending
                      ? profile.country === 'FR'
                        ? 'Envoi...'
                        : 'Sending...'
                      : profile.country === 'FR'
                        ? 'E-mail'
                        : 'Email'}
                  </button>
                )}

                {estimate.client_phone && (
                  <button
                    disabled={sending}
                    onClick={() => handleSend('phone')}
                    className="flex-1 sm:flex-none bg-gray-800 text-white px-4 py-2 rounded font-bold text-xs disabled:opacity-50 hover:bg-gray-900 transition-colors"
                  >
                    {sending
                      ? profile.country === 'FR'
                        ? 'Envoi...'
                        : 'Sending...'
                      : 'SMS'}
                  </button>
                )}

                <button
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-2 rounded font-bold text-xs shadow-lg w-full sm:w-auto hover:bg-blue-700 transition-colors"
                >
                  {profile.country === 'FR'
                    ? 'Enregistrer PDF / Imprimer'
                    : 'Save PDF / Print'}
                </button>
              </>
            ) : (
              <button
                onClick={handleFinalize}
                className="w-full sm:w-auto bg-red-600 text-white px-8 py-2 rounded font-bold shadow-lg hover:bg-red-700 transition-colors"
              >
                {profile.country === 'FR'
                  ? 'Finaliser et Verrouiller'
                  : 'Finalize & Lock'}
              </button>
            )}
          </div>
        </div>

        {/* Paper Document */}
        <div className="bg-white p-6 sm:p-12 shadow-2xl border border-gray-200 rounded-sm print:shadow-none print:border-none min-h-[1056px]">
          <div className="flex justify-between mb-20">
            <div>
              <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter mb-6">
                {profile.country === 'FR' ? 'Devis' : 'Estimate'}
              </h1>
              <div className="space-y-1">
                <p className="text-lg font-black text-gray-800">
                  {estimate.client_name}
                </p>
                {estimate.client_address && (
                  <p className="text-sm text-gray-400 whitespace-pre-wrap max-w-sm">
                    {estimate.client_address}
                  </p>
                )}
                {estimate.client_phone && (
                  <p className="text-xs text-gray-400 font-medium">
                    {estimate.client_phone}
                  </p>
                )}
                {estimate.client_email && (
                  <p className="text-xs text-gray-400 font-medium">
                    {estimate.client_email}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl sm:text-3xl font-black italic text-blue-600 uppercase tracking-tighter mb-2">
                {profile.business_name}
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                {profile.country === 'FR' ? 'Date :' : 'Date:'}{' '}
                {new Date(estimate.created_at).toLocaleDateString(
                  profile.country === 'FR' ? 'fr-FR' : 'en-US'
                )}
              </p>
              <p className="text-xs text-gray-300 font-mono mt-1">
                {profile.country === 'FR' ? 'Réf :' : 'Ref:'}{' '}
                {estimate.custom_id || estimate.id.slice(0, 8)}
              </p>
            </div>
          </div>

          <table className="w-full mb-20">
            <thead className="border-b-4 border-black text-[10px] uppercase font-black tracking-[0.3em] text-gray-300">
              <tr>
                <th className="py-4 text-left">
                  {profile.country === 'FR'
                    ? 'Etape du Service / Catégorie'
                    : 'Service Component / Category'}
                </th>
                <th className="py-4 text-right">
                  {profile.country === 'FR' ? 'Montant' : 'Amount'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {estimate.sections.map((sec: any, idx: number) => (
                <tr key={idx}>
                  <td className="py-8 pr-12">
                    <p className="font-bold text-xl text-gray-800 mb-1">
                      {sec.title ||
                        (profile.country === 'FR'
                          ? 'Services Professionnels'
                          : 'Professional Services')}
                    </p>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed">
                      {generateDynamicDescription(sec)}
                    </p>
                  </td>
                  <td className="py-8 text-right font-mono font-black text-xl text-gray-700">
                    {profile.currency === 'EUR' ? '€' : '$'}
                    {getSectionTotal(sec).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end pt-10 border-t-2 border-gray-100">
            <div className="w-72 space-y-4">
              <div className="flex justify-between text-[10px] font-black text-gray-300 uppercase tracking-widest">
                <span>
                  {profile.country === 'FR' ? 'Sous-total' : 'Subtotal'}
                </span>
                <span className="text-gray-600">
                  {profile.currency === 'EUR' ? '€' : '$'}
                  {(
                    (estimate.total_amount_cents - estimate.tax_amount_cents) /
                    100
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-black text-gray-300 uppercase tracking-widest">
                <span>
                  {lang.tax} ({profile.tax_rate}%)
                </span>
                <span className="text-gray-600">
                  {profile.currency === 'EUR' ? '€' : '$'}
                  {(estimate.tax_amount_cents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t-4 border-black pt-6">
                <span className="text-2xl font-black uppercase tracking-tighter">
                  {profile.country === 'FR' ? 'Montant Total' : 'Grand Total'}
                </span>
                <span className="text-3xl font-black font-mono">
                  {profile.currency === 'EUR' ? '€' : '$'}
                  {(estimate.total_amount_cents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-40 pt-12 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">
                  {profile.country === 'FR'
                    ? 'Conformité & Mentions Légales'
                    : 'Compliance & Legal'}
                </p>
                <p className="text-[10px] text-gray-400 leading-relaxed italic">
                  {profile.country === 'FR'
                    ? "Document généré conformément à l'article 286 du code général des impôts (Loi Anti-Fraude TVA). Ce document est inaltérable une fois finalisé."
                    : 'Standard business estimate. Certified digital record. Valid for 30 days from issuance.'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">
                  {profile.country === 'FR'
                    ? 'Conditions de Paiement'
                    : 'Terms'}
                </p>
                <p className="text-[10px] text-gray-400 leading-relaxed font-bold">
                  {profile.country === 'FR'
                    ? 'Règlement sous 30 jours.'
                    : 'Payment due upon receipt.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
