'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const LoadingDots = () => (
  <div className="flex items-center justify-center space-x-2 p-12 mt-20">
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
  </div>
);

export default function EstimateView() {
  const { id } = useParams();
  const router = useRouter();
  const [estimate, setEstimate] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [isOwner, setIsOwner] = useState(false);

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      const { data: est } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', id)
        .single();

      if (!est) {
        setLoading(false);
        return;
      }

      setIsOwner(user?.id === est.user_id);

      const [prof, mats] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', est.user_id).single(),
        supabase.from('materials').select('*').eq('user_id', est.user_id)
      ]);

      import('@/lib/translations').then(({ translations }) => {
        const country = est.country_snapshot || prof.data?.country || 'US';
        setLang(country === 'FR' ? translations.FR : translations.US);
      });

      const displayBusinessName =
        est.business_name_snapshot || prof.data?.business_name;
      const displayCountry = est.country_snapshot || prof.data?.country;
      const displayCurrency = est.currency_snapshot || prof.data?.currency;
      const displayTaxRate =
        est.tax_rate_snapshot !== null
          ? est.tax_rate_snapshot
          : prof.data?.default_tax_rate || 0;

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
      const snapshottedCost = item.cost_per_unit_cents;
      const liveCost =
        materials.find((m) => m.id === item.materialId)?.cost_per_unit_cents ||
        0;
      const finalCost =
        snapshottedCost !== undefined ? snapshottedCost : liveCost;
      return acc + finalCost * item.qty;
    }, 0);
    const labor = Math.round(sec.laborHours * sec.hourlyRate * 100);
    return (mats + labor) / 100;
  };

  const getTaxSummary = () => {
    let subtotal = 0;
    const groups: Record<number, number> = {};

    (estimate.sections || []).forEach((sec: any) => {
      const laborCents = Math.round(sec.laborHours * sec.hourlyRate * 100);
      if (laborCents > 0) {
        subtotal += laborCents;
        const r =
          sec.laborTaxRate !== undefined ? sec.laborTaxRate : profile.tax_rate;
        groups[r] = (groups[r] || 0) + Math.round(laborCents * (r / 100));
      }

      (sec.items || []).forEach((item: any) => {
        const snapshottedCost = item.cost_per_unit_cents;
        const liveCost =
          materials.find((mat) => mat.id === item.materialId)
            ?.cost_per_unit_cents || 0;
        const finalCost =
          snapshottedCost !== undefined ? snapshottedCost : liveCost;
        const matCents = finalCost * item.qty;

        if (matCents > 0) {
          subtotal += matCents;
          const r =
            item.taxRate !== undefined ? item.taxRate : profile.tax_rate;
          groups[r] = (groups[r] || 0) + Math.round(matCents * (r / 100));
        }
      });
    });

    return { subtotal, groups };
  };

  const generateDynamicDescription = (sec: any) => {
    const isFr = profile.country === 'FR';
    let baseText = isFr
      ? "Prestation complète incluant la main-d'œuvre professionnelle, la logistique et les matériaux nécessaires à cette phase du projet."
      : 'Comprehensive delivery including all necessary professional labor, logistics, and materials required for this project phase.';

    const zeroCostMats = sec.items
      .map((item: any) => {
        if (item.name && item.cost_per_unit_cents !== undefined) {
          return item.cost_per_unit_cents === 0 ? item.name : null;
        }
        const m = materials.find((m) => m.id === item.materialId);
        return m && m.cost_per_unit_cents === 0 ? m.name : null;
      })
      .filter(Boolean);

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
      setDialog({
        type: 'alert',
        message: 'Could not identify your sender email. Please log in.'
      });
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
        setDialog({
          type: 'alert',
          message: `${method === 'email' ? 'Email' : 'SMS'} sent successfully to ${method === 'email' ? estimate.client_email : estimate.client_phone}`
        });
      } else {
        const errData = await res.json();
        setDialog({
          type: 'alert',
          message: `Error: ${errData.error?.message || 'Failed to send'}`
        });
      }
    } catch (err) {
      setDialog({
        type: 'alert',
        message: 'Connection error. Check your internet or API settings.'
      });
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
      setDialog({
        type: 'alert',
        message:
          profile.country === 'FR'
            ? "Le partage natif n'est pas supporté sur ce navigateur."
            : 'Native sharing is not supported on this browser.'
      });
    }
  };

  const handleFinalize = () => {
    setDialog({
      type: 'confirm',
      title: profile.country === 'FR' ? 'Finaliser' : 'Finalize',
      message:
        profile.country === 'FR'
          ? 'Ceci verrouillera le devis. Vous ne pourrez plus le modifier. Continuer ?'
          : 'This will lock the estimate for compliance. You cannot edit it again. Proceed?',
      onConfirm: async () => {
        setDialog(null);
        await supabase
          .from('estimates')
          .update({
            is_locked: true,
            show_details_snapshot: showDetails
          })
          .eq('id', id);
        location.reload();
      }
    });
  };

  const handleCancelDraft = () => {
    setDialog({
      type: 'confirm',
      title: profile.country === 'FR' ? 'Annuler' : 'Cancel',
      message:
        profile.country === 'FR'
          ? 'Êtes-vous sûr de vouloir annuler ce brouillon ?'
          : 'Are you sure you want to cancel this draft?',
      onConfirm: async () => {
        setDialog(null);
        await supabase.from('estimates').delete().eq('id', id);
        router.push('/dashboard');
      }
    });
  };

  if (loading) return <LoadingDots />;

  if (!estimate) {
    return (
      <div className="p-10 text-center font-sans text-xl font-black uppercase text-gray-400">
        Estimate Not Found
      </div>
    );
  }

  const { subtotal, groups } = getTaxSummary();
  const isShowingDetails = estimate.is_locked
    ? estimate.show_details_snapshot === true
    : showDetails;

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-8 text-black font-sans relative">
      <div className="max-w-4xl mx-auto">
        <div
          className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8 print:hidden ${isOwner ? 'justify-between' : 'justify-end'}`}
        >
          {isOwner && (
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center w-full sm:w-auto">
              <Link
                href="/dashboard"
                className="text-center bg-white border border-gray-200 px-4 py-2 rounded font-bold text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Dashboard
              </Link>

              {!estimate.is_locked && (
                <div className="flex justify-between sm:justify-start items-center gap-2 bg-white px-3 py-2 rounded border border-gray-200">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    {profile.country === 'FR'
                      ? 'Détails internes'
                      : 'Internal Details'}
                  </span>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showDetails ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showDetails ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
            {estimate.is_locked ? (
              <>
                {isOwner && (
                  <button
                    onClick={handleNativeShare}
                    className="flex-1 sm:hidden bg-gray-100 text-gray-700 px-4 py-3 rounded font-bold text-sm border border-gray-200"
                  >
                    {profile.country === 'FR' ? 'Partager' : 'Share'}
                  </button>
                )}
                {isOwner && estimate.client_email && (
                  <button
                    disabled={sending}
                    onClick={() => handleSend('email')}
                    className="flex-1 bg-gray-800 text-white px-4 py-3 rounded font-bold text-sm disabled:opacity-50"
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
                <button
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-3 rounded font-bold text-sm shadow-md"
                >
                  {profile.country === 'FR' ? 'Imprimer / PDF' : 'Save / Print'}
                </button>
              </>
            ) : (
              isOwner && (
                <div className="flex w-full gap-2">
                  <Link
                    href={`/new-estimate?edit=${id}`}
                    className="flex-1 text-center bg-blue-50 text-blue-600 px-4 py-3 rounded font-bold text-sm"
                  >
                    {profile.country === 'FR' ? 'Modifier' : 'Edit'}
                  </Link>
                  <button
                    onClick={handleCancelDraft}
                    className="flex-1 bg-red-50 text-red-600 font-bold text-sm px-4 py-3 rounded"
                  >
                    {profile.country === 'FR' ? 'Annuler' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleFinalize}
                    className="flex-1 bg-green-600 text-white px-4 py-3 rounded font-bold text-sm shadow-md"
                  >
                    {profile.country === 'FR' ? 'Finaliser' : 'Finalize'}
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        <div className="bg-white p-6 sm:p-12 shadow-2xl border border-gray-200 rounded-sm print:shadow-none print:border-none min-h-[1056px]">
          <div className="flex flex-col-reverse sm:flex-row justify-between mb-16 gap-8">
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
            <div className="text-left sm:text-right flex flex-col sm:items-end">
              {profile.subscription_tier === 'pro' && profile.logo_url && (
                <img
                  src={profile.logo_url}
                  alt="Business Logo"
                  className="h-16 w-auto object-contain mb-4"
                />
              )}

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
                    : 'Service Component'}
                </th>
                <th className="py-4 text-right">
                  {profile.country === 'FR' ? 'Montant' : 'Amount'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {estimate.sections.map((sec: any, idx: number) => (
                <tr key={idx}>
                  <td className="py-8 pr-4 sm:pr-12">
                    <p className="font-bold text-xl text-gray-800 mb-1">
                      {sec.title ||
                        (profile.country === 'FR'
                          ? 'Services Professionnels'
                          : 'Professional Services')}
                    </p>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed mb-3">
                      {generateDynamicDescription(sec)}
                    </p>

                    {isShowingDetails ? (
                      <div className="text-[10px] text-gray-500 font-mono space-y-1 bg-gray-50 p-3 rounded border border-gray-100">
                        {sec.laborHours > 0 && (
                          <p>
                            ↳{' '}
                            {profile.country === 'FR'
                              ? "Main-d'œuvre"
                              : 'Labor'}
                            : {sec.laborHours}h @ {sec.hourlyRate}
                            {profile.currency === 'EUR' ? '€' : '$'}/h (Tax:{' '}
                            {sec.laborTaxRate !== undefined
                              ? sec.laborTaxRate
                              : profile.tax_rate}
                            %)
                          </p>
                        )}
                        {sec.items.map((item: any, i: number) => {
                          const m = materials.find(
                            (mat) => mat.id === item.materialId
                          );
                          const displayName =
                            item.name || m?.name || 'Unknown Material';
                          const displayCost =
                            item.cost_per_unit_cents !== undefined
                              ? item.cost_per_unit_cents
                              : m?.cost_per_unit_cents || 0;
                          const rawUnit = item.unit || m?.unit || '';
                          const displayUnit = lang?.units?.[rawUnit] || rawUnit;

                          return (
                            <p key={i}>
                              ↳ {displayName}: {item.qty}
                              {displayUnit ? ` ${displayUnit}` : ''} @{' '}
                              {(displayCost / 100)
                                .toFixed(2)
                                .replace(
                                  '.',
                                  profile.currency === 'EUR' ? ',' : '.'
                                )}
                              {profile.currency === 'EUR' ? '€' : '$'} (Tax:{' '}
                              {item.taxRate !== undefined
                                ? item.taxRate
                                : profile.tax_rate}
                              %)
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      sec.items.length > 0 && (
                        <div className="text-[10px] text-gray-400 font-mono space-y-1 mt-2">
                          {sec.items.map((item: any, i: number) => {
                            const m = materials.find(
                              (mat) => mat.id === item.materialId
                            );
                            const displayName =
                              item.name || m?.name || 'Unknown Material';
                            const rawUnit = item.unit || m?.unit || '';
                            const displayUnit =
                              lang?.units?.[rawUnit] || rawUnit;

                            return (
                              <p key={i}>
                                • {displayName} ({item.qty}
                                {displayUnit ? ` ${displayUnit}` : ''})
                              </p>
                            );
                          })}
                        </div>
                      )
                    )}
                  </td>
                  <td className="py-8 text-right font-mono font-black text-xl text-gray-700 align-top">
                    {profile.currency === 'EUR' ? '€' : '$'}
                    {getSectionTotal(sec)
                      .toFixed(2)
                      .replace('.', profile.currency === 'EUR' ? ',' : '.')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end pt-10 border-t-2 border-gray-100">
            <div className="w-full sm:w-72 space-y-4">
              <div className="flex justify-between text-[10px] font-black text-gray-300 uppercase tracking-widest">
                <span>
                  {profile.country === 'FR' ? 'Sous-total HT' : 'Subtotal'}
                </span>
                <span className="text-gray-600 font-mono">
                  {profile.currency === 'EUR' ? '€' : '$'}
                  {(subtotal / 100)
                    .toFixed(2)
                    .replace('.', profile.currency === 'EUR' ? ',' : '.')}
                </span>
              </div>
              {Object.entries(groups)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([rate, amt]) => (
                  <div
                    key={rate}
                    className="flex justify-between text-[10px] font-black text-gray-300 uppercase tracking-widest"
                  >
                    <span>
                      {profile.country === 'FR' ? 'TVA' : 'Tax'} ({rate}%)
                    </span>
                    <span className="text-gray-600 font-mono">
                      {profile.currency === 'EUR' ? '€' : '$'}
                      {(amt / 100)
                        .toFixed(2)
                        .replace('.', profile.currency === 'EUR' ? ',' : '.')}
                    </span>
                  </div>
                ))}
              <div className="flex justify-between border-t-4 border-black pt-6">
                <span className="text-2xl font-black uppercase tracking-tighter">
                  {profile.country === 'FR' ? 'Total TTC' : 'Grand Total'}
                </span>
                <span className="text-3xl font-black font-mono text-blue-600">
                  {profile.currency === 'EUR' ? '€' : '$'}
                  {(estimate.total_amount_cents / 100)
                    .toFixed(2)
                    .replace('.', profile.currency === 'EUR' ? ',' : '.')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-40 pt-12 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
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
              <div className="text-left sm:text-right">
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

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-3 text-gray-900">
              {dialog.title ||
                (profile?.country === 'FR' ? 'Notification' : 'Notice')}
            </h3>
            <p className="text-sm text-gray-500 font-medium mb-8">
              {dialog.message}
            </p>
            <div className="flex gap-3 justify-end">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {profile?.country === 'FR' ? 'Annuler' : 'Cancel'}
                </button>
              )}
              <button
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  else setDialog(null);
                }}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors"
              >
                {profile?.country === 'FR' ? 'Confirmer' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
