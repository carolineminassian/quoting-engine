'use client';

import React, { Fragment, useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';
import Button from '@/components/Button';
import LinkButton from '@/components/LinkButton';
import { translations, t } from '@/lib/translations';
import {
  Menu,
  MenuButton,
  MenuItems,
  MenuItem,
  Transition
} from '@headlessui/react';
import {
  getEffectiveLaborRateCents,
  getEffectiveItemCostCents,
  getSectionTotal,
  getTaxSummary,
  generateDescription,
  buildMaterialsMap,
  getAdditionalChargeAmountCents,
  type AdditionalCharge
} from '@/lib/estimateCalculations';
import { formatMoney } from '@/lib/formatMoney';

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

  // Cancellation flow — separate state because we need a reason textarea
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

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

      const country = est.country_snapshot || prof.data?.country || 'US';
      setLang(country === 'FR' ? translations.FR : translations.US);

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

      // Auto-mark this estimate as "seen" by clearing any pending notifications.
      // Only the OWNER's notifications get cleared — guests don't have any.
      if (user && user.id === est.user_id) {
        const { error: clearError } = await supabase
          .from('estimate_notifications')
          .delete()
          .eq('estimate_id', id)
          .eq('user_id', user.id);

        if (!clearError) {
          // Notify navbar to refresh count
          window.dispatchEvent(new CustomEvent('notificationsCleared'));
        }
      }
    }
    fetchData();
  }, [id]);
  // --- REALTIME SUBSCRIPTION FOR COMMENTS ---
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`realtime-comments-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'estimate_comments',
          filter: `estimate_id=eq.${id}`
        },
        (payload) => {
          // Évite les doublons visuels si l'auteur a déjà ajouté son message localement
          setComments((prev) => {
            if (prev.some((c) => c.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // --- MARGIN ENGINE & MATH HELPERS ---

  const materialsById = useMemo(
    () => buildMaterialsMap(materials),
    [materials]
  );

  // Translation bundle for auto-generated descriptions
  const descTranslations = useMemo(
    () => ({
      descBase: lang?.descBase || '',
      descZeroCostMats: lang?.descZeroCostMats || '',
      descZeroCostLabor: lang?.descZeroCostLabor || ''
    }),
    [lang]
  );

  // Convenience wrapper: bind the helper to the current profile for cleaner call-sites
  const fmt = (cents: number) =>
    formatMoney(cents, profile?.currency, profile?.country);

  // Determines whether the estimate is eligible for a follow-up email.
  // Returns: { mode: 'send' | 'cooldown' | 'hidden', cooldownUntil?: Date }
  const getFollowUpState = () => {
    // Hidden: estimate not finalized, or already decided/cancelled/superseded
    if (
      !estimate?.is_locked ||
      estimate?.cancelled_at ||
      estimate?.superseded_at ||
      (estimate?.client_status && estimate.client_status !== 'pending')
    ) {
      return { mode: 'hidden' as const };
    }

    // No prior email — show plain "Email" button (handled separately)
    if (!estimate?.last_email_sent_at) {
      return { mode: 'hidden' as const };
    }

    // Cooldown check (7 days since last follow-up)
    if (estimate?.last_followup_sent_at) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const lastSent = new Date(estimate.last_followup_sent_at).getTime();
      const cooldownEnds = new Date(lastSent + sevenDaysMs);
      if (cooldownEnds.getTime() > Date.now()) {
        return { mode: 'cooldown' as const, cooldownUntil: cooldownEnds };
      }
    }

    return { mode: 'send' as const };
  };

  // Send a follow-up email for the current estimate
  const handleSendFollowUp = async () => {
    if (!estimate?.client_email) return;
    setSending(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    const ownerEmail = user?.email;

    if (!ownerEmail) {
      setDialog({ type: 'alert', message: lang.senderEmailError });
      setSending(false);
      return;
    }

    try {
      const res = await fetch('/api/send-followup-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateId: estimate.id,
          customId: estimate.custom_id || estimate.id.slice(0, 8),
          clientName: estimate.client_name,
          clientEmail: estimate.client_email,
          estimateUrl: window.location.href,
          businessName: profile.business_name,
          ownerEmail,
          logoUrl: profile.logo_url,
          country: profile.country
        })
      });

      const data = await res.json();

      if (res.ok) {
        const nowIso = new Date().toISOString();
        setEstimate((prev: any) =>
          prev ? { ...prev, last_followup_sent_at: nowIso } : prev
        );
        setDialog({
          type: 'alert',
          message: t(lang.followUpSentSuccess, {
            target: estimate.client_email
          })
        });
      } else {
        setDialog({
          type: 'alert',
          message: t(lang.sendError, {
            msg: data.error?.message || data.error || lang.failedToSend
          })
        });
      }
    } catch (err) {
      setDialog({ type: 'alert', message: lang.connectionError });
    } finally {
      setSending(false);
    }
  };

  // Resolve a percentage charge's basis into human-readable text.
  // Falls back to "project" if a referenced section/item no longer exists.
  const getChargeBasisLabel = (charge: AdditionalCharge): string => {
    if (!charge.isPercentage) return '';

    const sectionIdx = charge.basisSectionIdx;
    const itemIdx = charge.basisItemIdx;
    const sections = estimate?.sections || [];

    if (
      charge.basisType === 'item' &&
      typeof sectionIdx === 'number' &&
      typeof itemIdx === 'number' &&
      sections[sectionIdx]?.items?.[itemIdx]
    ) {
      const item = sections[sectionIdx].items[itemIdx];
      const m = materialsById.get(item.materialId);
      const name = item.name || m?.name;
      if (name) return name;
    }

    if (
      charge.basisType === 'section' &&
      typeof sectionIdx === 'number' &&
      sections[sectionIdx]?.title
    ) {
      return sections[sectionIdx].title;
    }

    return lang?.basisProject || 'Project';
  };

  // --- ACTIONS ---

  const handleStatusChange = async (newStatus: 'approved' | 'rejected') => {
    setDialog({
      type: 'confirm',
      title: lang.confirm,
      message:
        newStatus === 'approved'
          ? lang.statusChangeApproveConfirm
          : lang.statusChangeRejectConfirm,
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
          setEstimate((prev: any) =>
            prev ? { ...prev, client_status: newStatus } : prev
          );
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
      payment_terms_snapshot: estimate.payment_terms_snapshot,
      deposit_enabled: estimate.deposit_enabled,
      deposit_percentage: estimate.deposit_percentage,
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
        message: lang.revisionError
      });
      setLoading(false);
    } else if (data) {
      // Mark the ORIGINAL estimate as superseded by this new revision
      const { error: supersededError } = await supabase
        .from('estimates')
        .update({
          superseded_at: new Date().toISOString(),
          superseded_by_estimate_id: data.id
        })
        .eq('id', estimate.id);

      if (supersededError) {
        console.error(
          'Failed to mark original as superseded:',
          supersededError
        );
        // Non-blocking — the revision was created, the supersession is just a state flag
      }

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
        : estimate?.client_name || lang.clientLabel,
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
        message: lang.failedToPostMessage
      });
    } else if (data) {
      setComments((prev) => {
        // Avoid double-add if realtime subscription already inserted it
        if (prev.some((c) => c.id === data.id)) return prev;
        return [...prev, data];
      });
      setCommentInput('');

      if (!currentIsOwner && estimate?.is_locked) {
        // CLIENT posted → notify the OWNER
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
      } else if (
        currentIsOwner &&
        estimate?.is_locked &&
        estimate?.client_email
      ) {
        // OWNER posted → notify the CLIENT (only if client_email exists)
        try {
          await fetch('/api/send-owner-comment-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customId: estimate.custom_id || estimate.id.slice(0, 8),
              ownerName: payload.author_name,
              commentContent: cleanCommentText,
              ownerId: estimate.user_id,
              clientEmail: estimate.client_email,
              estimateUrl: window.location.href,
              country: profile?.country
            })
          });
        } catch (notificationError) {
          console.error(
            'Owner→Client notification email failed to dispatch:',
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
        message: lang.senderEmailError
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
            userEmail: currentUserEmail,
            logoUrl: profile.logo_url,
            country: profile.country
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
        const target =
          method === 'email' ? estimate.client_email : estimate.client_phone;

        // Track that this estimate has been emailed so the button transforms to "Follow Up"
        if (method === 'email') {
          const nowIso = new Date().toISOString();
          await supabase
            .from('estimates')
            .update({ last_email_sent_at: nowIso })
            .eq('id', id);
          setEstimate((prev: any) =>
            prev ? { ...prev, last_email_sent_at: nowIso } : prev
          );
        }

        setDialog({
          type: 'alert',
          message: t(
            method === 'email' ? lang.emailSentSuccess : lang.smsSentSuccess,
            { target }
          )
        });
      } else {
        const errData = await res.json();
        setDialog({
          type: 'alert',
          message: t(lang.sendError, {
            msg: errData.error?.message || lang.failedToSend
          })
        });
      }
    } catch (err) {
      setDialog({
        type: 'alert',
        message: lang.connectionError
      });
    } finally {
      setSending(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${lang.estimateLabel} - ${profile.business_name}`,
          text: t(lang.shareText, { business: profile.business_name }),
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      setDialog({
        type: 'alert',
        message: lang.nativeShareNotSupported
      });
    }
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const EstimatePDF = (await import('./EstimatePDF')).default;

      const { subtotalCents: pdfSubtotalCents, taxGroups: pdfTaxGroups } =
        getTaxSummary(
          estimate,
          estimate.sections || [],
          profile.tax_rate,
          materialsById,
          estimate.additional_charges || []
        );

      const isShowingDetails = estimate.is_locked
        ? estimate.show_details_snapshot === true
        : showDetails;

      const preparedSections = estimate.sections.map((sec: any) => ({
        title: sec.title || lang.professionalServices,
        description: generateDescription(
          estimate,
          sec,
          descTranslations,
          materialsById
        ),
        total: getSectionTotal(estimate, sec, materialsById),
        hasDetails: isShowingDetails,
        laborHours: sec.laborHours || 0,
        laborType: sec.laborType,
        laborRate: getEffectiveLaborRateCents(estimate, sec) / 100,
        laborTaxRate:
          sec.laborTaxRate !== undefined ? sec.laborTaxRate : profile.tax_rate,
        items: (sec.items || []).map((item: any) => {
          const m = materialsById.get(item.materialId);
          return {
            name: item.name || m?.name || 'Material Item',
            qty: item.qty || 0,
            unit:
              lang?.units?.[item.unit || m?.unit || ''] ||
              item.unit ||
              m?.unit ||
              '',
            cost:
              getEffectiveItemCostCents(estimate, sec, item, materialsById) /
              100,
            taxRate:
              item.taxRate !== undefined ? item.taxRate : profile.tax_rate
          };
        })
      }));

      // Pre-compute charges with their resolved amounts + basis labels.
      // The PDF receives them ready-to-render so it doesn't need access to the calc lib.
      const preparedCharges = (
        (estimate.additional_charges || []) as AdditionalCharge[]
      ).map((charge) => ({
        name: charge.name || '',
        isPercentage: !!charge.isPercentage,
        percentageRate: charge.percentageRate || 0,
        qty: charge.qty || 1,
        unit:
          (charge.unit && lang?.units?.[charge.unit]) || charge.unit || 'ea',
        costPerUnitCents: charge.costPerUnitCents || 0,
        taxRate:
          charge.taxRate !== undefined ? charge.taxRate : profile.tax_rate,
        amountCents: getAdditionalChargeAmountCents(
          estimate,
          charge,
          estimate.sections || [],
          materialsById
        ),
        basisLabel: getChargeBasisLabel(charge)
      }));

      const blob = await pdf(
        <EstimatePDF
          estimate={estimate}
          profile={profile}
          lang={lang}
          subtotal={pdfSubtotalCents / 100}
          taxGroups={Object.entries(pdfTaxGroups) as any}
          grandTotal={estimate.total_amount_cents / 100}
          sections={preparedSections}
          additionalCharges={preparedCharges}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${lang.estimateLabel}-${estimate.custom_id || estimate.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (pdfError) {
      console.error('Failed to compile native vector PDF layout:', pdfError);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = () => {
    setDialog({
      type: 'confirm',
      title: lang.finalize,
      message: lang.finalizeConfirm,
      onConfirm: async () => {
        setDialog(null);
        const { error } = await supabase
          .from('estimates')
          .update({
            is_locked: true,
            show_details_snapshot: showDetails
          })
          .eq('id', id);

        if (error) {
          setDialog({
            type: 'alert',
            message: lang.finalizeError
          });
          return;
        }

        // Update local state instead of full page reload
        setEstimate((prev: any) =>
          prev
            ? {
                ...prev,
                is_locked: true,
                show_details_snapshot: showDetails
              }
            : prev
        );
      }
    });
  };

  // Cancel a finalized estimate (pending OR approved) — sets cancelled_at + cancelled_reason
  const handleCancelLockedEstimate = async () => {
    setCancelling(true);
    const { error } = await supabase
      .from('estimates')
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_reason: cancelReason.trim() || null
      })
      .eq('id', id);

    setCancelling(false);

    if (error) {
      setDialog({ type: 'alert', message: lang.cancelEstimateError });
      return;
    }

    setEstimate((prev: any) =>
      prev
        ? {
            ...prev,
            cancelled_at: new Date().toISOString(),
            cancelled_reason: cancelReason.trim() || null
          }
        : prev
    );
    setCancelModalOpen(false);
    setCancelReason('');
  };

  const handleCancelDraft = () => {
    setDialog({
      type: 'confirm',
      title: lang.cancel,
      message: lang.cancelDraftConfirm,
      onConfirm: async () => {
        setDialog(null);
        const { error } = await supabase
          .from('estimates')
          .delete()
          .eq('id', id);

        if (error) {
          setDialog({ type: 'alert', message: error.message });
          return;
        }

        router.push('/dashboard');
      }
    });
  };
  if (loading) return <LoadingDots />;

  if (!estimate) {
    return (
      <div className="p-10 text-center font-sans text-xl font-black uppercase text-gray-400">
        {lang?.notFound || 'Estimate Not Found'}
      </div>
    );
  }

  const { subtotalCents, taxGroups } = getTaxSummary(
    estimate,
    estimate.sections || [],
    profile.tax_rate,
    materialsById,
    estimate.additional_charges || []
  );
  const isShowingDetails = estimate.is_locked
    ? estimate.show_details_snapshot === true
    : showDetails;

  const rawTerms = estimate.payment_terms_snapshot || '30_days';
  const isUponReceipt = rawTerms === 'upon_receipt';
  const displayPaymentDays = isUponReceipt
    ? 30
    : parseInt(rawTerms.replace('_days', '')) || 30;

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans print:bg-white flex flex-col">
      {/* --- GUEST NAVBAR --- */}
      {!isOwner && (
        <nav className="w-full bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center print:hidden shadow-sm sticky top-0 z-50">
          <Link href="/" className="flex items-center outline-none">
            <BrandLogo country={profile?.country === 'FR' ? 'FR' : 'US'} />
          </Link>
        </nav>
      )}

      <main className="flex-1 p-4 sm:p-8 relative print:p-0">
        <div className="max-w-4xl mx-auto print:max-w-none print:w-full">
          {/* === ACTION TOOLBAR (owner controls + buttons) === */}
          <div
            className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 print:hidden ${isOwner ? 'justify-between' : 'justify-end'}`}
          >
            {isOwner && (
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
                <LinkButton href="/dashboard" variant="secondary" size="sm">
                  ← {lang.dashboard}
                </LinkButton>

                {!estimate.is_locked && (
                  <div className="flex justify-between sm:justify-start items-center gap-2.5 bg-white px-3.5 py-2 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      {lang.internalDetails}
                    </span>
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        showDetails ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                      aria-label={lang.internalDetails}
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
                  {/* PRIMARY ACTIONS (always visible) */}

                  {/* Email / Follow-Up — primary communication action.
                    The button transforms based on follow-up state:
                    - No prior email → "Email" button calls handleSend
                    - Already emailed, cooldown ok → "Follow Up" button calls handleSendFollowUp
                    - Already emailed, in cooldown → "Follow Up" disabled with date in title */}
                  {isOwner &&
                    estimate.client_email &&
                    !estimate.cancelled_at &&
                    !estimate.superseded_at && (
                      <>
                        {(() => {
                          const followUpState = getFollowUpState();

                          // No prior email → standard Email button
                          if (followUpState.mode === 'hidden') {
                            return (
                              <Button
                                variant="dark"
                                size="md"
                                loading={sending}
                                loadingText={lang.sending}
                                onClick={() => handleSend('email')}
                                className="flex-1"
                              >
                                {lang.emailBtn}
                              </Button>
                            );
                          }

                          // Cooldown active → disabled button with tooltip
                          if (followUpState.mode === 'cooldown') {
                            const dateStr =
                              followUpState.cooldownUntil!.toLocaleDateString(
                                profile.country === 'FR' ? 'fr-FR' : 'en-US',
                                {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                }
                              );
                            return (
                              <Button
                                variant="dark"
                                size="md"
                                disabled
                                title={t(lang.followUpCooldown, {
                                  date: dateStr
                                })}
                                className="flex-1"
                              >
                                {lang.followUpBtn}
                              </Button>
                            );
                          }

                          // Cooldown clear → active Follow Up button
                          return (
                            <Button
                              variant="dark"
                              size="md"
                              loading={sending}
                              loadingText={lang.followUpSending}
                              onClick={handleSendFollowUp}
                              className="flex-1"
                            >
                              {lang.followUpBtn}
                            </Button>
                          );
                        })()}
                      </>
                    )}

                  {/* Download PDF — always available (even for cancelled — record keeping) */}
                  <Button
                    variant="primary"
                    size="md"
                    loading={loading}
                    loadingText={lang.generating}
                    onClick={handleDownloadPDF}
                    className="flex-1 sm:flex-none px-6"
                  >
                    {lang.downloadPdf}
                  </Button>

                  {/* SECONDARY ACTIONS MENU — kebab dropdown for owner-only actions
                    Hidden when the estimate is cancelled (no actions remain).
                    Contains: Create Revision · Share · Cancel Estimate */}
                  {isOwner && !estimate.cancelled_at && (
                    <Menu as="div" className="relative shrink-0">
                      <MenuButton
                        className="inline-flex items-center justify-center font-black uppercase tracking-widest transition-all duration-200 cursor-pointer select-none whitespace-nowrap text-[10px] rounded-xl bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] data-[open]:bg-gray-50 data-[open]:border-gray-300 px-3.5 h-[38px]"
                        aria-label="More actions"
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </MenuButton>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                      >
                        <MenuItems className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden focus:outline-none">
                          {/* Create Revision — hidden if estimate already superseded */}
                          {!estimate.superseded_at && (
                            <MenuItem>
                              {({ active }) => (
                                <button
                                  onClick={handleCreateRevision}
                                  className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2.5 ${
                                    active
                                      ? 'bg-gray-50 text-gray-900'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  <svg
                                    className="w-3.5 h-3.5 shrink-0"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="23 4 23 10 17 10" />
                                    <polyline points="1 20 1 14 7 14" />
                                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                  </svg>
                                  {lang.createRevision}
                                </button>
                              )}
                            </MenuItem>
                          )}

                          {/* Native share — keep available; mobile uses native sheet,
                            desktop falls back to a friendly dialog if unsupported */}
                          <MenuItem>
                            {({ active }) => (
                              <button
                                onClick={handleNativeShare}
                                className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2.5 ${
                                  active
                                    ? 'bg-gray-50 text-gray-900'
                                    : 'text-gray-700'
                                }`}
                              >
                                <svg
                                  className="w-3.5 h-3.5 shrink-0"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="18" cy="5" r="3" />
                                  <circle cx="6" cy="12" r="3" />
                                  <circle cx="18" cy="19" r="3" />
                                  <line
                                    x1="8.59"
                                    y1="13.51"
                                    x2="15.42"
                                    y2="17.49"
                                  />
                                  <line
                                    x1="15.41"
                                    y1="6.51"
                                    x2="8.59"
                                    y2="10.49"
                                  />
                                </svg>
                                {lang.share}
                              </button>
                            )}
                          </MenuItem>

                          {/* Cancel Estimate — destructive, separated by a divider */}
                          <MenuItem>
                            {({ active }) => (
                              <button
                                onClick={() => setCancelModalOpen(true)}
                                className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2.5 border-t border-gray-100 ${
                                  active
                                    ? 'bg-red-50 text-red-700'
                                    : 'text-red-600'
                                }`}
                              >
                                <svg
                                  className="w-3.5 h-3.5 shrink-0"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line
                                    x1="4.93"
                                    y1="4.93"
                                    x2="19.07"
                                    y2="19.07"
                                  />
                                </svg>
                                {lang.cancelEstimateBtn}
                              </button>
                            )}
                          </MenuItem>
                        </MenuItems>
                      </Transition>
                    </Menu>
                  )}
                </>
              ) : (
                isOwner && (
                  <div className="flex w-full gap-2">
                    <LinkButton
                      href={`/new-estimate?edit=${id}`}
                      variant="soft-primary"
                      size="md"
                      className="flex-1"
                    >
                      {lang.edit}
                    </LinkButton>
                    <Button
                      variant="soft-danger"
                      size="md"
                      onClick={handleCancelDraft}
                      className="flex-1"
                    >
                      {lang.cancel}
                    </Button>
                    <Button
                      variant="success"
                      size="md"
                      onClick={handleFinalize}
                      className="flex-1"
                    >
                      {lang.finalize}
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>

          {/* === STATUS BANNER (refined, with cancelled + superseded states) === */}
          {estimate.is_locked && (
            <div
              className={`mb-6 px-5 py-3.5 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden ${
                estimate.cancelled_at
                  ? 'bg-gray-100 border-gray-300'
                  : estimate.superseded_at
                    ? 'bg-amber-50/60 border-amber-200'
                    : estimate.client_status === 'approved'
                      ? 'bg-green-50/60 border-green-200'
                      : estimate.client_status === 'rejected'
                        ? 'bg-red-50/60 border-red-200'
                        : 'bg-blue-50/60 border-blue-200'
              }`}
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                {/* CANCELLED takes precedence over all other statuses */}
                {estimate.cancelled_at ? (
                  <>
                    <span className="text-gray-500 text-base leading-none mt-0.5">
                      ⊘
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-gray-700 font-bold text-sm">
                        {lang.estimateCancelled}
                      </span>
                      {estimate.cancelled_reason && (
                        <span className="text-gray-500 text-xs italic mt-0.5 break-words">
                          “{estimate.cancelled_reason}”
                        </span>
                      )}
                      <span className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mt-1">
                        {t(lang.cancelledOn, {
                          date: new Date(
                            estimate.cancelled_at
                          ).toLocaleDateString(
                            profile.country === 'FR' ? 'fr-FR' : 'en-US',
                            { year: 'numeric', month: 'short', day: 'numeric' }
                          )
                        })}
                      </span>
                    </div>
                  </>
                ) : estimate.superseded_at ? (
                  <>
                    <span className="text-amber-600 text-base leading-none mt-0.5">
                      ↻
                    </span>
                    <div className="flex flex-col">
                      <span className="text-amber-700 font-bold text-sm">
                        {lang.supersededBadge}
                      </span>
                      <span className="text-amber-600 text-xs mt-0.5">
                        {lang.supersededLabel}
                      </span>
                    </div>
                  </>
                ) : estimate.client_status === 'approved' ? (
                  <>
                    <span className="text-green-600 text-base leading-none">
                      ✓
                    </span>
                    <span className="text-green-700 font-bold text-sm">
                      {lang.estimateApproved}
                    </span>
                  </>
                ) : estimate.client_status === 'rejected' ? (
                  <>
                    <span className="text-red-600 text-base leading-none">
                      ✕
                    </span>
                    <span className="text-red-700 font-bold text-sm">
                      {lang.estimateRejected}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-blue-600 text-base leading-none">
                      ⏳
                    </span>
                    <span className="text-blue-700 font-bold text-sm">
                      {lang.pendingApproval}
                    </span>
                  </>
                )}
              </div>

              {/* Approve/Reject buttons — only for non-cancelled, non-superseded, pending estimates by clients */}
              {!isOwner &&
                !estimate.cancelled_at &&
                !estimate.superseded_at &&
                (estimate.client_status === 'pending' ||
                  !estimate.client_status) && (
                  <div className="flex w-full sm:w-auto gap-2.5">
                    <Button
                      variant="soft-danger"
                      size="md"
                      onClick={() => handleStatusChange('rejected')}
                      className="flex-1 sm:flex-none px-5"
                    >
                      {lang.reject}
                    </Button>
                    <Button
                      variant="success"
                      size="md"
                      onClick={() => handleStatusChange('approved')}
                      className="flex-1 sm:flex-none px-5"
                    >
                      {lang.approveEstimate}
                    </Button>
                  </div>
                )}
            </div>
          )}

          {/* === MAIN ESTIMATE DOCUMENT === */}
          <article className="bg-white shadow-xl border border-gray-200 rounded-xl overflow-hidden print:shadow-none print:border-none print:rounded-none">
            <div className="p-8 sm:p-14 print:p-12">
              {/* === LETTERHEAD — stays horizontal at all viewports === */}
              <header className="flex items-start justify-between gap-4 sm:gap-6 pb-8 mb-12 border-b border-gray-200">
                {/* Left: business identity */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {profile.subscription_tier === 'pro' && profile.logo_url && (
                    <img
                      src={profile.logo_url}
                      alt=""
                      className="h-10 sm:h-14 w-auto object-contain shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-2xl font-black text-gray-900 tracking-tight break-words leading-tight">
                      {profile.business_name}
                    </h2>
                  </div>
                </div>

                {/* Right: document metadata — always right-aligned */}
                <div className="text-right shrink-0">
                  <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.25em] sm:tracking-[0.3em] font-bold text-gray-400 mb-1.5 sm:mb-2">
                    {lang.estimateLabel}
                  </p>
                  <p className="font-mono text-xs sm:text-sm font-bold text-gray-900 break-all">
                    #{estimate.custom_id || estimate.id.slice(0, 8)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 font-medium whitespace-nowrap">
                    {new Date(estimate.created_at).toLocaleDateString(
                      profile.country === 'FR' ? 'fr-FR' : 'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric' }
                    )}
                  </p>
                </div>
              </header>

              {/* === BILL TO === */}
              <section className="mb-12">
                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-400 mb-3">
                  {lang.clientLabel}
                </p>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-gray-900 break-words">
                    {estimate.client_name}
                  </p>
                  {estimate.client_address && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
                      {estimate.client_address}
                    </p>
                  )}
                  {estimate.client_phone && (
                    <p className="text-sm text-gray-500 break-words">
                      {estimate.client_phone}
                    </p>
                  )}
                  {estimate.client_email && (
                    <p className="text-sm text-gray-500 break-words">
                      {estimate.client_email}
                    </p>
                  )}
                </div>
              </section>

              {/* === SERVICES === */}
              <section className="mb-10">
                <div className="flex items-baseline justify-between pb-3 mb-2 border-b-4 border-black">
                  <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-700">
                    {lang.serviceCategoryHeader}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-400">
                    {lang.amountHeader}
                  </p>
                </div>

                <div>
                  {estimate.sections.map((sec: any, idx: number) => (
                    <div
                      key={idx}
                      className="py-6 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex justify-between items-baseline gap-4 mb-2">
                        <h3 className="text-lg font-bold text-gray-900 break-words">
                          {sec.title || lang.professionalServices}
                        </h3>
                        <span className="font-mono font-bold text-lg text-gray-900 whitespace-nowrap shrink-0">
                          {fmt(
                            getSectionTotal(estimate, sec, materialsById) * 100
                          )}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words max-w-3xl">
                        {generateDescription(
                          estimate,
                          sec,
                          descTranslations,
                          materialsById
                        )}
                      </p>

                      {/* Items — subtle inline list, or detailed breakdown when toggled */}
                      {isShowingDetails ? (
                        <div className="mt-4 pl-4 border-l-2 border-gray-100 space-y-1.5 max-w-3xl">
                          {sec.laborHours > 0 && (
                            <p className="text-xs text-gray-500 leading-relaxed break-words">
                              <span className="text-gray-400">
                                {lang.laborLabel}:
                              </span>{' '}
                              {sec.laborHours}
                              {sec.laborType === 'daily'
                                ? lang.laborDayUnit
                                : 'h'}{' '}
                              × {fmt(getEffectiveLaborRateCents(estimate, sec))}
                              {sec.laborType === 'daily'
                                ? lang.laborDayPerUnit
                                : '/h'}{' '}
                              <span className="text-gray-400">
                                ({lang.tax}{' '}
                                {sec.laborTaxRate !== undefined
                                  ? sec.laborTaxRate
                                  : profile.tax_rate}
                                %)
                              </span>
                            </p>
                          )}
                          {sec.items.map((item: any, i: number) => {
                            const m = materialsById.get(item.materialId);
                            const displayName =
                              item.name || m?.name || 'Material Item';
                            const displayCostCents = getEffectiveItemCostCents(
                              estimate,
                              sec,
                              item,
                              materialsById
                            );
                            const rawUnit = item.unit || m?.unit || '';
                            const displayUnit =
                              lang?.units?.[rawUnit] || rawUnit;
                            return (
                              <p
                                key={i}
                                className="text-xs text-gray-500 leading-relaxed break-words"
                              >
                                <span className="text-gray-700 font-medium">
                                  {displayName}:
                                </span>{' '}
                                {item.qty}
                                {displayUnit ? ` ${displayUnit}` : ''} ×{' '}
                                {fmt(displayCostCents)}{' '}
                                <span className="text-gray-400">
                                  ({lang.tax}{' '}
                                  {item.taxRate !== undefined
                                    ? item.taxRate
                                    : profile.tax_rate}
                                  %)
                                </span>
                              </p>
                            );
                          })}
                        </div>
                      ) : (
                        sec.items.length > 0 && (
                          <ul className="mt-3 space-y-1 max-w-3xl">
                            {sec.items.map((item: any, i: number) => {
                              const m = materialsById.get(item.materialId);
                              const displayName =
                                item.name || m?.name || 'Material Item';
                              const rawUnit = item.unit || m?.unit || '';
                              const displayUnit =
                                lang?.units?.[rawUnit] || rawUnit;

                              return (
                                <li
                                  key={i}
                                  className="text-xs text-gray-500 flex items-baseline gap-2 break-words"
                                >
                                  <span className="text-gray-300 shrink-0">
                                    ·
                                  </span>
                                  <span>
                                    {displayName}
                                    {item.qty || displayUnit ? (
                                      <span className="text-gray-400">
                                        {' '}
                                        ({item.qty}
                                        {displayUnit ? ` ${displayUnit}` : ''})
                                      </span>
                                    ) : null}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* === ADDITIONAL CHARGES === */}
              {Array.isArray(estimate.additional_charges) &&
                estimate.additional_charges.length > 0 && (
                  <section className="mb-10">
                    <div className="flex items-baseline justify-between pb-3 mb-2 border-b-2 border-gray-300">
                      <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-700">
                        {lang.additionalCharges}
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-400">
                        {lang.amountHeader}
                      </p>
                    </div>

                    <div>
                      {estimate.additional_charges.map(
                        (charge: AdditionalCharge, idx: number) => {
                          const amountCents = getAdditionalChargeAmountCents(
                            estimate,
                            charge,
                            estimate.sections || [],
                            materialsById
                          );

                          // Subtitle: percentage charges show "X% · basis"; flat charges
                          // show "qty unit × post-margin unit price" (matching items style).
                          let subtitle = '';
                          if (charge.isPercentage) {
                            subtitle = `${charge.percentageRate || 0}% · ${getChargeBasisLabel(charge)}`;
                          } else {
                            const unitLabel =
                              lang.units?.[charge.unit || 'ea'] ||
                              charge.unit ||
                              '';
                            const qty = charge.qty || 1;
                            const effectivePerUnitCents =
                              qty > 0 ? amountCents / qty : 0;
                            subtitle = `${qty} ${unitLabel} × ${fmt(effectivePerUnitCents)}`;
                          }

                          return (
                            <div
                              key={idx}
                              className="py-4 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex justify-between items-baseline gap-4">
                                <div className="min-w-0">
                                  <h4 className="text-base font-bold text-gray-900 break-words">
                                    {charge.name || lang.additionalCharges}
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {subtitle}
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-base text-gray-900 whitespace-nowrap shrink-0">
                                  {fmt(amountCents)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </section>
                )}

              {/* === TOTALS === */}
              <section className="flex justify-end pt-10 mb-12 border-t-4 border-gray-200">
                <div className="w-full sm:w-80 space-y-3">
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-gray-500 font-medium">
                      {lang.subtotalHT}
                    </span>
                    <span className="font-mono font-bold text-gray-900 whitespace-nowrap">
                      {fmt(subtotalCents)}
                    </span>
                  </div>

                  {Object.entries(taxGroups)
                    .sort((a, b) => Number(b[0]) - Number(a[0]))
                    .map(([rate, amt]) => (
                      <div
                        key={rate}
                        className="flex justify-between items-baseline text-sm"
                      >
                        <span className="text-gray-500 font-medium">
                          {lang.tax} ({rate}%)
                        </span>
                        <span className="font-mono font-bold text-gray-900 whitespace-nowrap">
                          {fmt(amt)}
                        </span>
                      </div>
                    ))}

                  <div className="flex justify-between items-baseline pt-6 border-t-4 border-black">
                    <span className="text-base font-bold text-gray-900 uppercase tracking-wide">
                      {lang.grandTotalLabel}
                    </span>
                    <span className="text-2xl font-black font-mono text-blue-600 whitespace-nowrap">
                      {fmt(estimate.total_amount_cents)}
                    </span>
                  </div>

                  {/* Conditional Deposit Breakdown */}
                  {estimate.deposit_enabled && (
                    <div className="pt-4 border-t border-dashed border-gray-200 space-y-2">
                      <div className="flex justify-between items-baseline text-sm bg-blue-50/50 px-3 py-2 rounded">
                        <span className="text-blue-600 font-medium">
                          {lang.depositLabel} ({estimate.deposit_percentage}%)
                        </span>
                        <span className="font-mono font-bold text-blue-600 whitespace-nowrap">
                          {fmt(
                            (estimate.total_amount_cents *
                              (estimate.deposit_percentage || 20)) /
                              100
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-sm px-3">
                        <span className="text-gray-500 font-medium">
                          {lang.balanceDue}
                        </span>
                        <span className="font-mono font-bold text-gray-700 whitespace-nowrap">
                          {fmt(
                            (estimate.total_amount_cents *
                              (100 - (estimate.deposit_percentage || 20))) /
                              100
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* === COMPLIANCE / TERMS FOOTER (left untouched per user request) === */}
              <div className="mt-16 pt-8 border-t border-gray-100 print:mt-16 print:break-inside-avoid">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">
                      {lang.complianceLegal}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-relaxed italic break-words">
                      {lang.complianceText}
                    </p>
                  </div>
                  <div className="text-left sm:text-right min-w-0 sm:pl-16">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">
                      {lang.termsHeader}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-relaxed font-bold break-words sm:pl-16">
                      {(() => {
                        const balanceText = isUponReceipt
                          ? lang.termsBalanceUponReceipt
                          : t(lang.termsBalanceWithinDays, {
                              days: displayPaymentDays
                            });
                        return estimate.deposit_enabled
                          ? t(lang.termsWithDeposit, {
                              pct: estimate.deposit_percentage || 0,
                              balance: balanceText
                            })
                          : t(lang.termsNoDeposit, { balance: balanceText });
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* === COMMENTS THREAD (refined, separate block) === */}
          {estimate.is_locked && (
            <div className="mt-6 bg-white shadow-xl border border-gray-200 rounded-xl overflow-hidden print:hidden">
              <div className="p-8 sm:p-12">
                <div className="mb-8 pb-4 border-b border-gray-200">
                  <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-400 mb-1">
                    {lang.discussionMods}
                  </p>
                </div>

                {/* Messages */}
                <div className="space-y-3 max-h-96 overflow-y-auto mb-6 pr-2">
                  {comments.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">
                      {lang.noMessagesYet}
                    </p>
                  ) : (
                    comments.map((comm) => (
                      <div
                        key={comm.id}
                        className={`flex flex-col max-w-[85%] rounded-lg p-4 ${
                          comm.is_owner
                            ? 'ml-auto bg-blue-50/70 border border-blue-100 items-end'
                            : 'mr-auto bg-gray-50 border border-gray-100 items-start'
                        }`}
                      >
                        <div className="flex items-baseline gap-2 mb-1.5">
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

                {/* Submission Input */}
                <form
                  onSubmit={handlePostComment}
                  className="mt-4 pt-4 border-t border-gray-200"
                >
                  <label className="block text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-2">
                    {lang.addMessage}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                    <textarea
                      rows={2}
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder={lang.requestRevisions}
                      className="flex-1 p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-600 resize-none text-gray-900 placeholder-gray-400 bg-white transition-colors"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      loading={submittingComment}
                      loadingText={lang.sending}
                      disabled={!commentInput.trim()}
                      className="self-end sm:self-stretch w-full sm:w-auto min-w-[120px] px-6"
                    >
                      {lang.send}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* --- POPUP DIALOGS --- */}
        <ConfirmDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          labels={{
            notice: lang.notice,
            cancel: lang.cancel,
            confirmOk: lang.confirmOk
          }}
        />

        {/* --- CANCEL ESTIMATE MODAL (with optional reason input) --- */}
        {cancelModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-100 animate-scale-up">
              <h3 className="text-sm font-black uppercase tracking-widest mb-3 text-gray-900">
                {lang.cancelEstimate}
              </h3>
              <p className="text-xs text-gray-500 font-bold mb-5 leading-relaxed">
                {lang.cancelEstimateConfirm}
              </p>

              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                {lang.cancelEstimateReasonLabel}
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={lang.cancelEstimateReasonPlaceholder}
                maxLength={300}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-600 resize-none text-gray-900 placeholder-gray-400 bg-white transition-colors mb-5"
              />

              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setCancelModalOpen(false);
                    setCancelReason('');
                  }}
                  disabled={cancelling}
                >
                  {lang.cancel}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  loading={cancelling}
                  loadingText={lang.cancel}
                  onClick={handleCancelLockedEstimate}
                >
                  {lang.cancelEstimateConfirmBtn}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
