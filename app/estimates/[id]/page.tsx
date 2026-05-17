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

interface BrandLogoProps {
  country: 'US' | 'FR';
}

const BrandLogo = ({ country }: BrandLogoProps) => (
  <div className="flex items-center gap-2.5 select-none group">
    <svg
      className="w-7 h-7 transition-transform duration-300 group-hover:scale-105"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={country === 'FR' ? 'text-blue-600' : 'text-gray-900'}
      />
      <path
        d="M9 20L14 14L19 18L25 10M25 10H20M25 10V15"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={country === 'FR' ? 'text-gray-900' : 'text-blue-600'}
      />
    </svg>
    <span className="text-lg tracking-tighter font-sans antialiased">
      <span className="font-black text-gray-900">Pact</span>
      <span className="font-light text-blue-600">Estim</span>
    </span>
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

  // --- COMMENT THREAD STATE ---
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

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

      const [prof, mats, comms] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', est.user_id).single(),
        supabase.from('materials').select('*').eq('user_id', est.user_id),
        supabase
          .from('estimate_comments')
          .select('*')
          .eq('estimate_id', id)
          .order('created_at', { ascending: true })
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
      setComments(comms.data || []);
      setLoading(false);
    }
    fetchData();
  }, [id]);

  // --- MARGIN ENGINE & MATH HELPERS ---

  const getMultiplier = (
    sec: any,
    item: any = null,
    isLabor: boolean = false
  ) => {
    const mode = estimate?.margin_mode_snapshot || 'none';
    if (mode === 'global')
      return 1 + (estimate.global_margin_snapshot || 0) / 100;
    if (mode === 'service') return 1 + (sec.marginRate || 0) / 100;
    if (mode === 'granular') {
      if (isLabor) return 1 + (sec.laborMarginRate || 0) / 100;
      if (item) return 1 + (item.marginRate || 0) / 100;
    }
    return 1;
  };

  const getEffectiveLaborRateCents = (sec: any) => {
    const rawRateCents = (sec.hourlyRate || 0) * 100;
    return Math.round(rawRateCents * getMultiplier(sec, null, true));
  };

  const getEffectiveItemCostCents = (sec: any, item: any) => {
    const snapshottedCost = item.cost_per_unit_cents;
    const liveCost =
      materials.find((m) => m.id === item.materialId)?.cost_per_unit_cents || 0;
    const rawCost = snapshottedCost !== undefined ? snapshottedCost : liveCost;
    return Math.round(rawCost * getMultiplier(sec, item, false));
  };

  const getSectionTotal = (sec: any) => {
    const laborCents = getEffectiveLaborRateCents(sec) * (sec.laborHours || 0);
    const matsCents = sec.items.reduce((acc: number, item: any) => {
      return acc + getEffectiveItemCostCents(sec, item) * (item.qty || 0);
    }, 0);
    return (matsCents + laborCents) / 100;
  };

  const getTaxSummary = () => {
    let subtotal = 0;
    const groups: Record<number, number> = {};

    (estimate.sections || []).forEach((sec: any) => {
      const laborCents =
        getEffectiveLaborRateCents(sec) * (sec.laborHours || 0);

      if (laborCents > 0) {
        subtotal += laborCents;
        const r =
          sec.laborTaxRate !== undefined ? sec.laborTaxRate : profile.tax_rate;
        groups[r] = (groups[r] || 0) + Math.round(laborCents * (r / 100));
      }

      (sec.items || []).forEach((item: any) => {
        const matCents = getEffectiveItemCostCents(sec, item) * (item.qty || 0);

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

  const generateDescription = (sec: any) => {
    if (sec.description && sec.description.trim() !== '') {
      return sec.description;
    }

    const isFr = profile.country === 'FR';
    let baseText = isFr
      ? "Prestation complète incluant la main-d'œuvre professionnelle, la logistique et les matériaux nécessaires à cette phase du projet."
      : 'Comprehensive delivery including all necessary professional labor, logistics, and materials required for this project phase.';

    const zeroCostMats = sec.items
      .map((item: any) => {
        const effectiveCost = getEffectiveItemCostCents(sec, item);
        const m = materials.find((mat) => mat.id === item.materialId);
        const name = item.name || m?.name;
        return effectiveCost === 0 && name ? name : null;
      })
      .filter(Boolean);

    if (zeroCostMats.length > 0) {
      const matString = zeroCostMats.join(', ');
      baseText += isFr
        ? ` Matériaux inclus sans frais supplémentaires ou fournis par le client : ${matString}.`
        : ` Materials included at no charge or client-provided: ${matString}.`;
    }

    if (sec.laborHours > 0 && getEffectiveLaborRateCents(sec) === 0) {
      baseText += isFr
        ? " Main-d'œuvre incluse sans frais supplémentaires."
        : ' Labor included at no charge for this phase.';
    }

    return baseText;
  };

  // --- ACTIONS ---

  const handleStatusChange = async (newStatus: 'approved' | 'rejected') => {
    setDialog({
      type: 'confirm',
      title: profile.country === 'FR' ? 'Confirmer' : 'Confirm',
      message:
        profile.country === 'FR'
          ? `Êtes-vous sûr de vouloir ${newStatus === 'approved' ? 'accepter' : 'refuser'} ce devis ?`
          : `Are you sure you want to ${newStatus} this estimate?`,
      onConfirm: async () => {
        setDialog(null);
        setLoading(true);
        try {
          await fetch('/api/update-estimate-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estimateId: id,
              status: newStatus,
              estimateUrl: window.location.href // Added for the email links
            })
          });
          setEstimate({ ...estimate, client_status: newStatus });
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCreateRevision = async () => {
    setLoading(true);

    const baseCustomId = estimate.custom_id
      ? estimate.custom_id.split('-V')[0]
      : estimate.id.slice(0, 8);
    const nextVersion = (estimate.version || 1) + 1;
    const newCustomId = `${baseCustomId}-V${nextVersion}`;

    const newEstimatePayload = {
      user_id: estimate.user_id,
      client_name: estimate.client_name,
      client_email: estimate.client_email,
      client_phone: estimate.client_phone,
      client_address: estimate.client_address,
      sections: estimate.sections,
      total_amount_cents: estimate.total_amount_cents,
      margin_mode_snapshot: estimate.margin_mode_snapshot,
      global_margin_snapshot: estimate.global_margin_snapshot,
      currency_snapshot: estimate.currency_snapshot,
      country_snapshot: estimate.country_snapshot,
      tax_rate_snapshot: estimate.tax_rate_snapshot,
      business_name_snapshot: estimate.business_name_snapshot,
      is_locked: false,
      parent_estimate_id: estimate.parent_estimate_id || estimate.id,
      version: nextVersion,
      custom_id: newCustomId
    };

    const { data, error } = await supabase
      .from('estimates')
      .insert([newEstimatePayload])
      .select()
      .single();

    if (error) {
      setDialog({
        type: 'alert',
        message:
          profile.country === 'FR'
            ? 'Erreur lors de la création de la révision.'
            : 'Error creating estimate revision.'
      });
      setLoading(false);
    } else if (data) {
      router.push(`/new-estimate?edit=${data.id}`);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || submittingComment) return;

    setSubmittingComment(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const currentIsOwner = user?.id === estimate?.user_id;
    const cleanCommentText = commentInput.trim();

    const payload = {
      estimate_id: id,
      user_id: user?.id || null,
      author_name: currentIsOwner
        ? profile?.business_name || 'Business'
        : estimate?.client_name ||
          (profile?.country === 'FR' ? 'Client' : 'Client'),
      content: cleanCommentText,
      is_owner: currentIsOwner
    };

    const { data, error } = await supabase
      .from('estimate_comments')
      .insert([payload])
      .select()
      .single();

    if (error) {
      setDialog({
        type: 'alert',
        message:
          profile.country === 'FR'
            ? 'Impossible de publier le commentaire.'
            : 'Failed to post message.'
      });
    } else if (data) {
      setComments([...comments, data]);
      setCommentInput('');

      if (!currentIsOwner && estimate?.is_locked) {
        try {
          await fetch('/api/send-comment-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estimateId: estimate.id,
              customId: estimate.custom_id || estimate.id.slice(0, 8),
              clientName: payload.author_name,
              commentContent: cleanCommentText,
              ownerId: estimate.user_id, // Pass the ID instead of the email
              estimateUrl: window.location.href,
              country: profile?.country
            })
          });
        } catch (notificationError) {
          console.error(
            'Notification email failed to dispatch:',
            notificationError
          );
        }
      }
    }
    setSubmittingComment(false);
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
    <div className="min-h-screen bg-gray-100 text-black font-sans print:bg-white flex flex-col">
      {/* --- GUEST NAVBAR --- */}
      {!isOwner && (
        <nav className="w-full bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center print:hidden shadow-sm">
          <Link href="/" className="flex items-center outline-none">
            <BrandLogo country={profile?.country === 'FR' ? 'FR' : 'US'} />
          </Link>
          {/* <Link
            href="/"
            className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
          >
            {profile?.country === 'FR' ? 'Créer un compte' : 'Sign Up'}
          </Link> */}
        </nav>
      )}

      <main className="flex-1 p-4 sm:p-8 relative print:p-0">
        <div className="max-w-4xl mx-auto print:max-w-none print:w-full">
          <div
            className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8 print:hidden ${isOwner ? 'justify-between' : 'justify-end'}`}
          >
            {isOwner && (
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center w-full sm:w-auto">
                <Link
                  href="/dashboard"
                  className="text-center bg-white border border-gray-200 px-4 py-2 rounded font-bold text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  &larr; Dashboard
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
                      onClick={handleCreateRevision}
                      className="flex-1 bg-white text-gray-800 border border-gray-200 px-4 py-3 rounded font-bold text-sm hover:bg-gray-50 transition-colors"
                    >
                      {profile.country === 'FR'
                        ? 'Créer Révision'
                        : 'Create Revision'}
                    </button>
                  )}
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
                    {profile.country === 'FR'
                      ? 'Imprimer / PDF'
                      : 'Save / Print'}
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

          {/* --- CLIENT APPROVAL BANNER --- */}
          {estimate.is_locked && (
            <div
              className={`mb-8 p-4 sm:p-6 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden ${
                estimate.client_status === 'approved'
                  ? 'bg-green-50 border-green-200'
                  : estimate.client_status === 'rejected'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {estimate.client_status === 'approved' && (
                  <span className="text-green-700 font-black uppercase tracking-widest text-sm">
                    ✓{' '}
                    {profile.country === 'FR'
                      ? 'Devis Approuvé'
                      : 'Estimate Approved'}
                  </span>
                )}
                {estimate.client_status === 'rejected' && (
                  <span className="text-red-700 font-black uppercase tracking-widest text-sm">
                    ✕{' '}
                    {profile.country === 'FR'
                      ? 'Devis Refusé'
                      : 'Estimate Rejected'}
                  </span>
                )}
                {(estimate.client_status === 'pending' ||
                  !estimate.client_status) && (
                  <span className="text-blue-700 font-black uppercase tracking-widest text-sm">
                    ⏳{' '}
                    {profile.country === 'FR'
                      ? 'En attente de validation'
                      : 'Pending Client Approval'}
                  </span>
                )}
              </div>

              {!isOwner &&
                (estimate.client_status === 'pending' ||
                  !estimate.client_status) && (
                  <div className="flex w-full sm:w-auto gap-3">
                    <button
                      onClick={() => handleStatusChange('rejected')}
                      className="flex-1 sm:flex-none px-6 py-3 bg-white text-red-600 border border-red-200 hover:bg-red-50 font-bold rounded text-sm transition-colors"
                    >
                      {profile.country === 'FR' ? 'Refuser' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleStatusChange('approved')}
                      className="flex-1 sm:flex-none px-6 py-3 bg-green-600 text-white hover:bg-green-700 font-bold rounded shadow-md text-sm transition-colors"
                    >
                      {profile.country === 'FR'
                        ? 'Approuver le Devis'
                        : 'Approve Estimate'}
                    </button>
                  </div>
                )}
            </div>
          )}

          {/* --- MAIN ESTIMATE BOX --- */}
          <div className="bg-white p-6 sm:p-12 shadow-2xl border border-gray-200 rounded-sm print:shadow-none print:border-none print:p-12 min-h-[1056px] print:min-h-0 print:block flex flex-col">
            <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-16 items-start">
              <div className="min-w-0 space-y-6 sm:space-y-12 flex flex-col text-left">
                <div>
                  <h1 className="text-2xl sm:text-5xl font-black uppercase tracking-tighter break-words text-gray-900">
                    {profile.country === 'FR' ? 'Devis' : 'Estimate'}
                  </h1>
                </div>

                <div className="space-y-1">
                  <span className="block text-[9px] uppercase tracking-wider font-black text-gray-300">
                    {profile.country === 'FR' ? 'Client' : 'Client'}
                  </span>
                  <p className="text-sm sm:text-lg font-black text-gray-800 break-words">
                    {estimate.client_name}
                  </p>
                  {estimate.client_address && (
                    <p className="text-xs sm:text-sm text-gray-400 whitespace-pre-wrap break-words leading-relaxed">
                      {estimate.client_address}
                    </p>
                  )}
                  {estimate.client_phone && (
                    <p className="text-[10px] sm:text-xs text-gray-400 font-medium break-words">
                      {estimate.client_phone}
                    </p>
                  )}
                  {estimate.client_email && (
                    <p className="text-[10px] sm:text-xs text-gray-400 font-medium break-words">
                      {estimate.client_email}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right flex flex-col items-end min-w-0 shrink-0">
                {profile.subscription_tier === 'pro' && profile.logo_url && (
                  <img
                    src={profile.logo_url}
                    alt="Business Logo"
                    className="h-10 sm:h-16 w-auto object-contain mb-3 sm:mb-4"
                  />
                )}

                <h2 className="text-lg sm:text-3xl font-black italic text-blue-600 uppercase tracking-tighter mb-1 sm:mb-2 break-words max-w-full">
                  {profile.business_name}
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest">
                  {profile.country === 'FR' ? 'Date :' : 'Date:'}{' '}
                  {new Date(estimate.created_at).toLocaleDateString(
                    profile.country === 'FR' ? 'fr-FR' : 'en-US'
                  )}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-300 font-mono mt-0.5 sm:mt-1 break-all max-w-full">
                  {profile.country === 'FR' ? 'Réf :' : 'Ref:'}{' '}
                  {estimate.custom_id || estimate.id.slice(0, 8)}
                </p>
              </div>
            </div>

            <table className="w-full mb-20 table-fixed">
              <thead className="border-b-4 border-black text-[10px] uppercase font-black tracking-[0.3em] text-gray-300">
                <tr>
                  <th className="py-4 text-left w-3/4">
                    {profile.country === 'FR'
                      ? 'Etape du Service / Catégorie'
                      : 'Service Category / Step'}
                  </th>
                  <th className="py-4 text-right w-1/4">
                    {profile.country === 'FR' ? 'Montant' : 'Amount'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {estimate.sections.map((sec: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-8 pr-4 sm:pr-12 min-w-0 alignment-safe">
                      <p className="font-bold text-xl text-gray-800 mb-1 break-words">
                        {sec.title ||
                          (profile.country === 'FR'
                            ? 'Services Professionnels'
                            : 'Professional Services')}
                      </p>
                      <p className="text-xs text-gray-400 font-medium leading-relaxed mb-3 whitespace-pre-wrap break-words max-w-2xl">
                        {generateDescription(sec)}
                      </p>

                      {isShowingDetails ? (
                        <div className="text-[10px] text-gray-500 font-mono bg-gray-50 p-3 rounded border border-gray-100 space-y-1.5 max-w-2xl">
                          {sec.laborHours > 0 && (
                            <p className="break-words">
                              &rarr;{' '}
                              {profile.country === 'FR'
                                ? "Main-d'œuvre"
                                : 'Labor'}
                              : {sec.laborHours}
                              {sec.laborType === 'daily'
                                ? profile.country === 'FR'
                                  ? 'j'
                                  : 'd'
                                : 'h'}{' '}
                              @{' '}
                              {(getEffectiveLaborRateCents(sec) / 100)
                                .toFixed(2)
                                .replace(
                                  '.',
                                  profile.currency === 'EUR' ? ',' : '.'
                                )}
                              {profile.currency === 'EUR' ? '€' : '$'}
                              {sec.laborType === 'daily'
                                ? profile.country === 'FR'
                                  ? '/j'
                                  : '/d'
                                : '/h'}{' '}
                              (Tax:{' '}
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
                              item.name || m?.name || 'Material Item';
                            const displayCostCents = getEffectiveItemCostCents(
                              sec,
                              item
                            );
                            const rawUnit = item.unit || m?.unit || '';
                            const displayUnit =
                              lang?.units?.[rawUnit] || rawUnit;

                            return (
                              <div
                                key={i}
                                className="flex flex-wrap items-baseline gap-x-1 break-words"
                              >
                                <span>&rarr;</span>
                                <span className="font-semibold text-gray-700 truncate max-w-[200px] sm:max-w-sm">
                                  {displayName}
                                </span>
                                <span className="shrink-0">
                                  : {item.qty}
                                  {displayUnit ? ` ${displayUnit}` : ''} @
                                </span>
                                <span className="shrink-0">
                                  {(displayCostCents / 100)
                                    .toFixed(2)
                                    .replace(
                                      '.',
                                      profile.currency === 'EUR' ? ',' : '.'
                                    )}
                                  {profile.currency === 'EUR' ? '€' : '$'}
                                </span>
                                <span className="text-gray-400 shrink-0">
                                  (Tax:{' '}
                                  {item.taxRate !== undefined
                                    ? item.taxRate
                                    : profile.tax_rate}
                                  %)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        sec.items.length > 0 && (
                          <div className="text-[10px] text-gray-400 font-mono mt-2 space-y-1 max-w-2xl">
                            {sec.items.map((item: any, i: number) => {
                              const m = materials.find(
                                (mat) => mat.id === item.materialId
                              );
                              const displayName =
                                item.name || m?.name || 'Material Item';
                              const rawUnit = item.unit || m?.unit || '';
                              const displayUnit =
                                lang?.units?.[rawUnit] || rawUnit;

                              return (
                                <div
                                  key={i}
                                  className="flex items-baseline gap-1 break-words"
                                >
                                  <span>&bull;</span>
                                  <span className="truncate max-w-[220px] sm:max-w-md font-medium">
                                    {displayName}
                                  </span>
                                  <span className="shrink-0">
                                    ({item.qty}
                                    {displayUnit ? ` ${displayUnit}` : ''})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}
                    </td>
                    <td className="py-8 text-right font-mono font-black text-xl text-gray-700 align-top shrink-0 whitespace-nowrap">
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
                  <span className="text-gray-600 font-mono whitespace-nowrap">
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
                      <span className="text-gray-600 font-mono whitespace-nowrap">
                        {profile.currency === 'EUR' ? '€' : '$'}
                        {(amt / 100)
                          .toFixed(2)
                          .replace('.', profile.currency === 'EUR' ? ',' : '.')}
                      </span>
                    </div>
                  ))}
                <div className="flex justify-between border-t-4 border-black pt-6 items-baseline">
                  <span className="text-2xl font-black uppercase tracking-tighter">
                    {profile.country === 'FR' ? 'Total TTC' : 'Grand Total'}
                  </span>
                  <span className="text-3xl font-black font-mono text-blue-600 whitespace-nowrap">
                    {profile.currency === 'EUR' ? '€' : '$'}
                    {(estimate.total_amount_cents / 100)
                      .toFixed(2)
                      .replace('.', profile.currency === 'EUR' ? ',' : '.')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-gray-100 print:mt-16 print:break-inside-avoid">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">
                    {profile.country === 'FR'
                      ? 'Conformité & Mentions Légales'
                      : 'Compliance & Legal'}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-relaxed italic break-words">
                    {profile.country === 'FR'
                      ? "Document généré conformément à l'article 286 du code général des impôts (Loi Anti-Fraude TVA). Ce document est inaltérable une fois finalisé."
                      : 'Standard business estimate. Certified digital record. Valid for 30 days from issuance.'}
                  </p>
                </div>
                <div className="text-left sm:text-right min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">
                    {profile.country === 'FR'
                      ? 'Conditions de Paiement'
                      : 'Terms'}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-relaxed font-bold break-words">
                    {profile.country === 'FR'
                      ? 'Règlement sous 30 jours.'
                      : 'Payment due upon receipt.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* --- INTERACTIVE SECURE COMMENT THREAD --- */}
          <div className="mt-8 bg-white p-6 sm:p-12 shadow-2xl border border-gray-200 rounded-sm print:hidden">
            <h3 className="text-xl font-black uppercase tracking-tight mb-6 text-gray-900 border-b-2 border-black pb-2">
              {profile.country === 'FR'
                ? 'Discussions & Modifications'
                : 'Discussion & Modifications'}
            </h3>

            {/* Messages Wrapper */}
            <div className="space-y-4 max-h-96 overflow-y-auto mb-6 pr-2">
              {comments.length === 0 ? (
                <p className="text-xs text-gray-400 font-medium italic">
                  {profile.country === 'FR'
                    ? 'Aucun message pour le moment. Utilisez le formulaire ci-dessous pour demander des ajustements.'
                    : 'No messages yet. Use the field below to request adjustment notes.'}
                </p>
              ) : (
                comments.map((comm) => (
                  <div
                    key={comm.id}
                    className={`flex flex-col max-w-[85%] rounded p-4 border ${
                      comm.is_owner
                        ? 'ml-auto bg-blue-50/50 border-blue-100 items-end'
                        : 'mr-auto bg-gray-50 border-gray-100 items-start'
                    }`}
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider ${comm.is_owner ? 'text-blue-600' : 'text-gray-500'}`}
                      >
                        {comm.author_name}
                      </span>
                      <span className="text-[9px] text-gray-300 font-mono">
                        {new Date(comm.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 break-words whitespace-pre-wrap leading-relaxed">
                      {comm.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Submission Input Block */}
            <form
              onSubmit={handlePostComment}
              className="mt-4 border-t border-gray-100 pt-4"
            >
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                {profile.country === 'FR'
                  ? 'Ajouter un message'
                  : 'Add a message'}
              </label>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                <textarea
                  rows={2}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={
                    profile.country === 'FR'
                      ? "Demandez des modifications sur les quantités, la main-d'œuvre ou les matériaux..."
                      : 'Request revisions regarding service quantities, labor rates, or material phases...'
                  }
                  className="flex-1 p-3 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-600 resize-none text-black placeholder-gray-300 bg-white"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded tracking-wide transition-colors disabled:opacity-40 self-end sm:self-stretch flex items-center justify-center w-full sm:w-auto min-w-[120px]"
                >
                  {submittingComment
                    ? profile.country === 'FR'
                      ? 'Envoi...'
                      : 'Sending...'
                    : profile.country === 'FR'
                      ? 'Envoyer'
                      : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* --- POPUP DIALOGS --- */}
        {dialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
              <h3 className="text-lg font-black uppercase tracking-tighter mb-3 text-gray-900 break-words">
                {dialog.title ||
                  (profile?.country === 'FR' ? 'Notification' : 'Notice')}
              </h3>
              <p className="text-sm text-gray-500 font-medium mb-8 break-words">
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
    </div>
  );
}
