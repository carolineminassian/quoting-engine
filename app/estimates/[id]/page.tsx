'use client';

import React, { Fragment, useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { saveAs } from 'file-saver';
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

// ─────────────────────────────────────────────────────────────
// Brand Logo Component
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Icon Components (cleaner than inline SVGs)
// ─────────────────────────────────────────────────────────────
const Icons = {
  ArrowLeft: () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  Download: () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  Send: () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
  MoreVertical: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  ),
  Template: () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
  Refresh: () => (
    <svg
      className="w-3.5 h-3.5"
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
  ),
  Share: () => (
    <svg
      className="w-3.5 h-3.5"
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
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Cancel: () => (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  Plus: () => (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  ),
  Check: () => <span className="text-green-600 text-base leading-none">✓</span>,
  Cross: () => <span className="text-red-600 text-base leading-none">✕</span>,
  Clock: () => <span className="text-blue-600 text-base leading-none">⏳</span>,
  Cancelled: () => (
    <span className="text-gray-500 text-base leading-none mt-0.5">⊘</span>
  ),
  Superseded: () => (
    <span className="text-amber-600 text-base leading-none mt-0.5">↻</span>
  )
};

// ─────────────────────────────────────────────────────────────
// Tab Button Component (Accessible)
// ─────────────────────────────────────────────────────────────
interface TabButtonProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  controls: string;
}

const TabButton = ({
  id,
  label,
  isActive,
  onClick,
  badge,
  controls
}: TabButtonProps) => (
  <button
    id={id}
    role="tab"
    aria-selected={isActive}
    aria-controls={controls}
    tabIndex={isActive ? 0 : -1}
    onClick={onClick}
    className={`
    pb-4 text-sm font-semibold tracking-wide transition-all duration-200
    border-b-2 cursor-pointer whitespace-nowrap flex items-center gap-2
    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
    ${
      isActive
        ? 'border-gray-900 text-gray-900'
        : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
    }
  `}
  >
    {label}
    {typeof badge === 'number' && badge > 0 && (
      <span
        className={`
        text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums transition-colors
        ${isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}
      `}
      >
        {badge}
      </span>
    )}
  </button>
);

// ─────────────────────────────────────────────────────────────
// Status Badge Component
// ─────────────────────────────────────────────────────────────
interface StatusBadgeProps {
  status:
    | 'draft'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'superseded'
    | 'paid'
    | 'unpaid'
    | 'overdue'
    | 'credit';
  label: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<StatusBadgeProps['status'], string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  superseded: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  unpaid: 'bg-blue-50 text-blue-700 border-blue-200',
  overdue: 'bg-red-50 text-red-600 border-red-200',
  credit: 'bg-purple-50 text-purple-700 border-purple-200'
};

const StatusBadge = ({ status, label, size = 'sm' }: StatusBadgeProps) => (
  <span
    className={`
    inline-flex items-center font-bold uppercase tracking-widest border rounded-md
    ${statusStyles[status]}
    ${size === 'sm' ? 'text-[9px] px-2 py-1' : 'text-[10px] px-2.5 py-1.5'}
  `}
  >
    {label}
  </span>
);

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function EstimateView() {
  const { id } = useParams();
  const router = useRouter();
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // ─── State ───────────────────────────────────────────────
  const [estimate, setEstimate] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'estimate' | 'billing' | 'discussion'
  >('estimate');

  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm' | 'danger';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  // ─── Installment plan ─────────────────────────────────────────────────────
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [installmentMode, setInstallmentMode] = useState<'equal' | 'custom'>(
    'equal'
  );
  const [installmentCount, setInstallmentCount] = useState(3);
  const [installmentFrequency, setInstallmentFrequency] = useState<
    'monthly' | 'biweekly' | 'weekly' | 'custom'
  >('monthly');
  const [installmentCustomDays, setInstallmentCustomDays] = useState(30);
  const [installmentStartDate, setInstallmentStartDate] = useState('');
  const [customInstallments, setCustomInstallments] = useState([
    { amountCents: 0, dueDate: '', rawAmount: '' },
    { amountCents: 0, dueDate: '', rawAmount: '' }
  ]);
  const [creatingPlan, setCreatingPlan] = useState(false);

  // ─── Recurring schedule ───────────────────────────────────────────────────
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<
    'monthly' | 'biweekly' | 'weekly' | 'custom'
  >('monthly');
  const [scheduleCustomDays, setScheduleCustomDays] = useState(30);
  const [scheduleAmountDollars, setScheduleAmountDollars] = useState('');
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'draft' | 'auto'>('draft');
  const [scheduleIsFinite, setScheduleIsFinite] = useState(true);
  const [scheduleTotalInvoices, setScheduleTotalInvoices] = useState(6);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [paymentSchedules, setPaymentSchedules] = useState<any[]>([]);
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(
    null
  );
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(
    null
  );

  const refetchBillingDocs = async () => {
    if (!estimate?.id) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const [invsRes, cnRes] = await Promise.all([
      supabase
        .from('invoices')
        .select(
          'id, invoice_number, invoice_type, invoice_description, total_amount_cents, subtotal_cents, tax_amount_cents, credited_amount_cents, payment_status, is_locked, is_cancelled, paid_at, due_date, currency_snapshot, country_snapshot, created_at, installment_number, installment_total, payment_schedule_id'
        )
        .eq('estimate_id', estimate.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('credit_notes')
        .select(
          'id, credit_note_number, reason, total_amount_cents, is_locked, is_cancelled, currency_snapshot, country_snapshot, created_at'
        )
        .eq('estimate_id', estimate.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
    ]);

    if (invsRes.data) setInvoices(invsRes.data);
    if (cnRes.data) setCreditNotes(cnRes.data);
  };

  // ─── Data Fetching ───────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (tab === 'billing' || tab === 'discussion') {
        setActiveTab(tab);
      }
    }

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

      const docLang =
        est.lang_snapshot || (est.country_snapshot === 'FR' ? 'FR' : 'EN');
      setLang(docLang === 'FR' ? translations.FR : translations.US);

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

      // Fetch billing docs if owner and approved
      if (user && user.id === est.user_id && est.client_status === 'approved') {
        const [invsRes, cnRes] = await Promise.all([
          supabase
            .from('invoices')
            .select(
              'id, invoice_number, invoice_type, invoice_description, total_amount_cents, subtotal_cents, tax_amount_cents, credited_amount_cents, payment_status, is_locked, is_cancelled, paid_at, due_date, currency_snapshot, country_snapshot, created_at, installment_number, installment_total, payment_schedule_id'
            )
            .eq('estimate_id', est.id)
            .eq('user_id', user.id),
          supabase
            .from('credit_notes')
            .select(
              'id, credit_note_number, reason, total_amount_cents, is_locked, is_cancelled, currency_snapshot, country_snapshot, created_at'
            )
            .eq('estimate_id', est.id)
            .eq('user_id', user.id)
        ]);

        if (invsRes.data) setInvoices(invsRes.data);
        if (cnRes.data) setCreditNotes(cnRes.data);
      }

      setLoading(false);

      // Clear notifications for owner
      if (user && user.id === est.user_id) {
        const { error: clearError } = await supabase
          .from('estimate_notifications')
          .delete()
          .eq('estimate_id', id)
          .eq('user_id', user.id);

        if (!clearError) {
          window.dispatchEvent(new CustomEvent('notificationsCleared'));
        }
      }
    }
    fetchData();
  }, [id]);

  // ─── Realtime Comments ───────────────────────────────────
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

  // Only auto-scroll when a NEW comment is added while viewing Discussion tab
  const prevCommentsLength = useRef(comments.length);

  useEffect(() => {
    // Only scroll if we're on discussion tab AND a new comment was added
    if (
      activeTab === 'discussion' &&
      comments.length > prevCommentsLength.current &&
      commentsEndRef.current
    ) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    prevCommentsLength.current = comments.length;
  }, [comments.length, activeTab]);

  // ─── Memoized Values ─────────────────────────────────────
  const materialsById = useMemo(
    () => buildMaterialsMap(materials),
    [materials]
  );

  const descTranslations = useMemo(
    () => ({
      descBase: lang?.descBase || '',
      descZeroCostMats: lang?.descZeroCostMats || '',
      descZeroCostLabor: lang?.descZeroCostLabor || ''
    }),
    [lang]
  );

  const fmt = (cents: number) =>
    formatMoney(cents, profile?.currency, profile?.country);

  // ─── Computed Values ─────────────────────────────────────
  const showDiscussionTab = estimate?.is_locked;
  const showBillingTab =
    isOwner &&
    estimate?.client_status === 'approved' &&
    !estimate?.cancelled_at;

  const finalizedInvoices = invoices.filter(
    (inv) => inv.is_locked && !inv.is_cancelled
  );
  const finalizedCreditNotes = creditNotes.filter(
    (cn) => cn.is_locked && !cn.is_cancelled
  );

  const totalBilledCents = finalizedInvoices.reduce(
    (acc, inv) => acc + (inv.total_amount_cents || 0),
    0
  );
  const totalCreditedCents = finalizedCreditNotes.reduce(
    (acc, cn) => acc + (cn.total_amount_cents || 0),
    0
  );
  const netBilledCents = Math.max(0, totalBilledCents - totalCreditedCents);

  const estTotalCents = estimate?.total_amount_cents || 0;
  const canCreateInvoice = netBilledCents < estTotalCents;

  const allBillingDocs = [
    ...invoices.map((i) => ({ ...i, docType: 'invoice' as const })),
    ...creditNotes.map((c) => ({ ...c, docType: 'credit_note' as const }))
  ].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const remainingForInstallments = Math.max(
    0,
    (estimate?.total_amount_cents || 0) -
      allBillingDocs
        .filter(
          (d) => d.docType === 'invoice' && !d.is_cancelled && d.is_locked
        )
        .reduce(
          (sum: number, d) =>
            sum +
            Math.max(
              0,
              (d.total_amount_cents || 0) - (d.credited_amount_cents || 0)
            ),
          0
        )
  );

  const hasInstallmentPlan = allBillingDocs.some(
    (d) =>
      d.docType === 'invoice' &&
      d.invoice_type === 'installment' &&
      !d.is_cancelled
  );

  const draftInvoiceCount = allBillingDocs.filter(
    (d) => d.docType === 'invoice' && !d.is_locked && !d.is_cancelled
  ).length;

  // ─── Helper Functions ────────────────────────────────────
  const getFollowUpState = () => {
    if (
      !estimate?.is_locked ||
      estimate?.cancelled_at ||
      estimate?.superseded_at ||
      (estimate?.client_status && estimate.client_status !== 'pending')
    ) {
      return { mode: 'hidden' as const };
    }
    if (!estimate?.last_email_sent_at) {
      return { mode: 'hidden' as const };
    }
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

  // ─── Event Handlers ──────────────────────────────────────
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
          customId:
            estimate.estimate_number ||
            estimate.custom_id ||
            estimate.id.slice(0, 8),
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
              estimateUrl: window.location.href
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

    const baseNumber = (
      estimate.estimate_number ||
      estimate.custom_id ||
      estimate.id.slice(0, 8)
    ).split('-V')[0];
    const nextVersion = (estimate.version || 1) + 1;
    const revisionId = `${baseNumber}-V${nextVersion}`;

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
      custom_id: revisionId
    };

    const { data, error } = await supabase
      .from('estimates')
      .insert([
        {
          ...newEstimatePayload,
          estimate_number: revisionId
        }
      ])
      .select()
      .single();

    if (error) {
      setDialog({ type: 'alert', message: lang.revisionError });
      setLoading(false);
    } else if (data) {
      await supabase
        .from('estimates')
        .update({
          superseded_at: new Date().toISOString(),
          superseded_by_estimate_id: data.id
        })
        .eq('id', estimate.id);
      router.push(`/new-estimate?edit=${data.id}`);
    }
  };
  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const { error } = await supabase.from('estimate_templates').insert([
        {
          user_id: profile.id,
          name: templateName.trim(),
          sections: estimate.sections || [],
          additional_charges: estimate.additional_charges || [],
          margin_mode: estimate.margin_mode_snapshot || 'none',
          global_margin: estimate.global_margin_snapshot || 0,
          deposit_enabled: estimate.deposit_enabled ?? false,
          deposit_percentage: estimate.deposit_percentage ?? 20,
          payment_terms: estimate.payment_terms_snapshot || '30_days'
        }
      ]);

      if (error) throw error;

      setTemplateModalOpen(false);
      setTemplateName('');
      setDialog({
        type: 'alert',
        message: lang.templateSaved
      });
    } catch (err: any) {
      setDialog({ type: 'alert', message: err.message });
    } finally {
      setSavingTemplate(false);
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
      setDialog({ type: 'alert', message: lang.failedToPostMessage });
    } else if (data) {
      setComments((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev;
        return [...prev, data];
      });
      setCommentInput('');

      // Notification logic
      if (!currentIsOwner && estimate?.is_locked) {
        try {
          await fetch('/api/send-comment-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estimateId: estimate.id,
              customId:
                estimate.estimate_number ||
                estimate.custom_id ||
                estimate.id.slice(0, 8),
              clientName: payload.author_name,
              commentContent: cleanCommentText,
              ownerId: estimate.user_id,
              estimateUrl: window.location.href,
              country: profile?.country
            })
          });
        } catch (err) {}
      } else if (
        currentIsOwner &&
        estimate?.is_locked &&
        estimate?.client_email
      ) {
        try {
          await fetch('/api/send-owner-comment-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customId:
                estimate.estimate_number ||
                estimate.custom_id ||
                estimate.id.slice(0, 8),
              ownerName: payload.author_name,
              commentContent: cleanCommentText,
              ownerId: estimate.user_id,
              clientEmail: estimate.client_email,
              estimateUrl: window.location.href,
              country: profile?.country
            })
          });
        } catch (err) {}
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
      setDialog({ type: 'alert', message: lang.senderEmailError });
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
      setDialog({ type: 'alert', message: lang.connectionError });
    } finally {
      setSending(false);
    }
  };

  const handleBulkFollowUp = async () => {
    const eligibleIds = invoices
      .filter(
        (i) => i.is_locked && !i.is_cancelled && i.payment_status !== 'paid'
      )
      .map((i) => i.id);
    if (eligibleIds.length === 0) return;
    setBulkSending(true);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const res = await fetch('/api/send-bulk-invoice-followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          invoiceIds: eligibleIds,
          baseUrl: window.location.origin
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      const parts: string[] = [
        t(lang.bulkFollowUpResult, { sent: result.sent })
      ];
      if (result.skippedNoEmail > 0)
        parts.push(
          t(lang.bulkFollowUpSkippedNoEmail, { count: result.skippedNoEmail })
        );
      if (result.skippedNeverSent > 0)
        parts.push(
          t(lang.bulkFollowUpSkippedNeverSent, {
            count: result.skippedNeverSent
          })
        );
      if (result.skippedCooldown > 0)
        parts.push(
          t(lang.bulkFollowUpSkippedCooldown, { count: result.skippedCooldown })
        );
      if (result.skippedPaid > 0)
        parts.push(
          t(lang.bulkFollowUpSkippedPaid, { count: result.skippedPaid })
        );
      if (result.skippedCancelled > 0)
        parts.push(
          t(lang.bulkFollowUpSkippedCancelled, {
            count: result.skippedCancelled
          })
        );
      setDialog({ type: 'alert', message: parts.join('\n') });
    } catch (err: any) {
      setDialog({ type: 'alert', message: err.message || lang.errorGeneric });
    } finally {
      setBulkSending(false);
    }
  };

  const handleDownloadZIP = async () => {
    const exportableInvoices = invoices.filter((inv) => inv.is_locked);
    if (exportableInvoices.length === 0) return;
    setArchiving(true);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data: fullInvoices, error: fetchErr } = await supabase
        .from('invoices')
        .select(
          'id, invoice_number, invoice_type, invoice_description, total_amount_cents, subtotal_cents, tax_amount_cents, payment_status, is_locked, is_cancelled, due_date, currency_snapshot, country_snapshot, created_at, client_name, client_email, client_address, business_name_snapshot, sections, line_items, additional_charges, margin_mode_snapshot, global_margin_snapshot, tax_rate_snapshot, show_details_snapshot'
        )
        .in(
          'id',
          exportableInvoices.map((i) => i.id)
        )
        .eq('user_id', session.user.id);
      if (fetchErr || !fullInvoices)
        throw new Error('Failed to fetch invoice data');
      const JSZip = (await import('jszip')).default;
      const { pdf } = await import('@react-pdf/renderer');
      const InvoicePDF = (await import('../../invoices/[id]/InvoicePDF'))
        .default;
      const zip = new JSZip();
      for (const inv of fullInvoices) {
        const country = inv.country_snapshot || profile?.country || 'US';
        const currentLang =
          country === 'FR' ? translations.FR : translations.US;
        const taxRate = inv.tax_rate_snapshot ?? profile?.default_tax_rate ?? 0;

        let blob: Blob | null = null;

        // ─── Factur-X Fallback Loader ───
        // If the invoice has already been compiled with Factur-X XML,
        // we pull the certified PDF directly from storage instead of rebuilding it
        if ((inv as any).factur_x_compiled) {
          const { data: fileBlob, error: downloadError } =
            await supabase.storage
              .from('invoices')
              .download(`${session.user.id}/${inv.id}.pdf`);

          if (!downloadError && fileBlob) {
            blob = fileBlob;
          } else {
            console.error(
              `Failed to download Factur-X PDF for invoice ${inv.invoice_number}, falling back to local render`
            );
          }
        }

        // Fallback: render client-side if not compiled or storage download failed
        if (!blob) {
          const invProfile = {
            ...profile,
            business_name: inv.business_name_snapshot || profile?.business_name,
            country: inv.country_snapshot || profile?.country,
            currency: inv.currency_snapshot || profile?.currency,
            tax_rate: taxRate
          };
          const invContext = {
            margin_mode_snapshot: inv.margin_mode_snapshot,
            global_margin_snapshot: inv.global_margin_snapshot,
            tax_rate_snapshot: inv.tax_rate_snapshot
          };
          const hasSections =
            Array.isArray(inv.sections) && inv.sections.length > 0;
          const isLineItemInvoice = !hasSections;
          const preparedSections = hasSections
            ? inv.sections.map((sec: any) => ({
                title: sec.title || currentLang.professionalServices,
                description: sec.description || '',
                total: (() => {
                  let total = 0;
                  if (sec.laborHours > 0)
                    total += Math.round(
                      sec.laborHours *
                        getEffectiveLaborRateCents(invContext, sec)
                    );
                  (sec.items || []).forEach((it: any) => {
                    total += Math.round(
                      (it.qty || 0) *
                        getEffectiveItemCostCents(
                          invContext,
                          sec,
                          it,
                          materialsById
                        )
                    );
                  });
                  return total / 100;
                })(),
                hasDetails: inv.show_details_snapshot === true,
                laborHours: sec.laborHours || 0,
                laborType: sec.laborType,
                laborRate: getEffectiveLaborRateCents(invContext, sec) / 100,
                laborTaxRate: sec.laborTaxRate ?? taxRate,
                items: (sec.items || []).map((item: any) => {
                  const m = materialsById.get(item.materialId);
                  return {
                    name: item.name || m?.name || currentLang.itemLabel,
                    qty: item.qty || 0,
                    unit:
                      (currentLang?.units as Record<string, string>)?.[
                        item.unit || m?.unit || ''
                      ] ||
                      item.unit ||
                      m?.unit ||
                      '',
                    cost:
                      getEffectiveItemCostCents(
                        invContext,
                        sec,
                        item,
                        materialsById
                      ) / 100,
                    taxRate: item.taxRate ?? taxRate
                  };
                })
              }))
            : [];
          const preparedAdditionalCharges = (inv.additional_charges || []).map(
            (charge: any) => ({
              name: charge.name || '',
              isPercentage: !!charge.isPercentage,
              percentageRate: charge.percentageRate || 0,
              qty: charge.qty || 1,
              unit:
                (currentLang?.units as Record<string, string>)?.[charge.unit] ||
                charge.unit ||
                'ea',
              costPerUnitCents: charge.costPerUnitCents || 0,
              taxRate: charge.taxRate ?? taxRate,
              amountCents: getAdditionalChargeAmountCents(
                invContext,
                charge,
                inv.sections || [],
                materialsById
              ),
              basisLabel: currentLang.basisProject
            })
          );
          const storedSubtotal = inv.subtotal_cents || 0;
          const storedTax = inv.tax_amount_cents || 0;
          const storedTotal = inv.total_amount_cents || 0;
          const taxGroups: [number, number][] =
            storedTax > 0 ? [[taxRate, storedTax / 100]] : [];
          blob = await pdf(
            <InvoicePDF
              invoice={inv}
              profile={invProfile}
              lang={currentLang}
              subtotal={storedSubtotal / 100}
              taxGroups={taxGroups as any}
              grandTotal={storedTotal / 100}
              sections={preparedSections}
              lineItems={isLineItemInvoice ? inv.line_items || [] : undefined}
              additionalCharges={preparedAdditionalCharges}
              isDraft={false}
            />
          ).toBlob();
        }

        zip.file(`${currentLang.invoiceLabel}-${inv.invoice_number}.pdf`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(
        zipBlob,
        `Invoices_${estimate.id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.zip`
      );
    } catch (err) {
      console.error(err);
      setDialog({ type: 'alert', message: lang.pdfError });
    } finally {
      setArchiving(false);
    }
  };

  const [deletingAllDrafts, setDeletingAllDrafts] = useState(false);

  const handleDeleteAllDrafts = async () => {
    setDialog(null);
    const draftIds = allBillingDocs
      .filter((d) => d.docType === 'invoice' && !d.is_locked && !d.is_cancelled)
      .map((d) => d.id);
    if (draftIds.length === 0) return;
    setDeletingAllDrafts(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', draftIds)
        .eq('is_locked', false);
      if (!error) {
        setInvoices((prev) => prev.filter((inv) => !draftIds.includes(inv.id)));
      }
    } catch (err) {
      console.error('Failed to delete all drafts:', err);
    } finally {
      setDeletingAllDrafts(false);
    }
  };

  const fetchPaymentSchedules = async () => {
    if (!estimate?.id || !isOwner) return;
    const { data } = await supabase
      .from('payment_schedules')
      .select('*')
      .eq('estimate_id', estimate.id)
      .order('created_at', { ascending: false });
    if (data) setPaymentSchedules(data);
  };

  useEffect(() => {
    if (activeTab === 'billing' && estimate?.id && isOwner) {
      fetchPaymentSchedules();
    }
  }, [activeTab, estimate?.id, isOwner]);

  const handleCreateInstallmentPlan = async (
    installments: { amountCents: number; dueDate: string }[]
  ) => {
    setCreatingPlan(true);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const res = await fetch('/api/create-installment-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ estimateId: estimate.id, installments })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowInstallmentModal(false);
      setInvoices((prev) => [...prev, ...data.invoices]);
    } catch (err: any) {
      setDialog({ type: 'alert', message: err.message });
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleCreateSchedule = async () => {
    const amountCents = Math.round(
      (parseFloat(scheduleAmountDollars) || 0) * 100
    );
    if (!amountCents || amountCents <= 0) {
      setDialog({ type: 'alert', message: lang.enterValidAmount });
      return;
    }
    if (amountCents > remainingForInstallments) {
      setDialog({
        type: 'alert',
        message: t(lang.amountExceedsRemaining, {
          max: fmt(remainingForInstallments)
        })
      });
      return;
    }
    const totalScheduledCents = amountCents * scheduleTotalInvoices;
    if (totalScheduledCents > remainingForInstallments) {
      setDialog({
        type: 'alert',
        message: t(lang.scheduleExceedsRemaining, {
          total: fmt(totalScheduledCents),
          max: fmt(remainingForInstallments)
        })
      });
      return;
    }
    if (!scheduleStartDate) {
      setDialog({
        type: 'alert',
        message: lang?.selectStartDate || 'Please select a start date.'
      });
      return;
    }
    setCreatingSchedule(true);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const res = await fetch('/api/payment-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          estimateId: estimate.id,
          frequency: scheduleFrequency,
          customIntervalDays: scheduleCustomDays,
          amountCents,
          startDate: scheduleStartDate,
          mode: scheduleMode,
          totalInvoices: scheduleIsFinite ? scheduleTotalInvoices : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowScheduleModal(false);
      await fetchPaymentSchedules();
    } catch (err: any) {
      setDialog({ type: 'alert', message: err.message });
    } finally {
      setCreatingSchedule(false);
    }
  };

  const handleToggleSchedule = async (
    scheduleId: string,
    currentActive: boolean
  ) => {
    setTogglingScheduleId(scheduleId);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      await fetch(`/api/payment-schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ is_active: !currentActive })
      });
      await fetchPaymentSchedules();
    } finally {
      setTogglingScheduleId(null);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    setDialog(null);
    setDeletingScheduleId(scheduleId);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      await fetch(`/api/payment-schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      await fetchPaymentSchedules();
    } finally {
      setDeletingScheduleId(null);
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
      } catch (err) {}
    } else {
      setDialog({ type: 'alert', message: lang.nativeShareNotSupported });
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
      link.download = `${lang.estimateLabel}-${estimate.estimate_number || estimate.custom_id || estimate.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (pdfError) {
      console.error(pdfError);
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
          setDialog({ type: 'alert', message: lang.finalizeError });
          return;
        }

        setEstimate((prev: any) =>
          prev
            ? { ...prev, is_locked: true, show_details_snapshot: showDetails }
            : prev
        );
      }
    });
  };

  const handleDeleteDraftDoc = async (
    docId: string,
    type: 'invoice' | 'credit_note'
  ) => {
    setDialog({
      type: 'confirm',
      message:
        type === 'invoice'
          ? lang.deleteInvoiceDraftConfirm
          : lang.deleteCreditNoteDraftConfirm || 'Confirm deletion',
      onConfirm: async () => {
        setDialog(null);
        setDeletingDocId(docId);

        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();
          if (!session) return;

          const endpoint =
            type === 'invoice'
              ? '/api/delete-invoice'
              : '/api/delete-credit-note';
          const payloadKey = type === 'invoice' ? 'invoiceId' : 'creditNoteId';

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ [payloadKey]: docId })
          });

          if (res.ok) {
            if (type === 'invoice') {
              setInvoices((prev) => prev.filter((inv) => inv.id !== docId));
            } else {
              setCreditNotes((prev) => prev.filter((cn) => cn.id !== docId));
            }
          } else {
            const data = await res.json();
            setDialog({
              type: 'alert',
              message: data.error || lang.connectionError
            });
          }
        } catch {
          setDialog({ type: 'alert', message: lang.connectionError });
        } finally {
          setDeletingDocId(null);
        }
      }
    });
  };

  const handleCreateInvoice = async () => {
    if (profile?.subscription_tier !== 'pro') {
      setDialog({
        type: 'alert',
        message:
          lang?.createInvoiceProOnly ||
          'Pro subscription required to create invoices.'
      });
      return;
    }

    setCreatingInvoice(true);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setDialog({
          type: 'alert',
          message:
            lang?.sessionExpired || 'Session expired. Please log in again.'
        });
        return;
      }

      const res = await fetch('/api/create-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ estimateId: estimate.id })
      });

      const data = await res.json();

      if (!res.ok) {
        setDialog({
          type: 'alert',
          message:
            data.error ||
            lang?.cancelEstimateError ||
            'Failed to create invoice. Please try again.'
        });
        return;
      }

      // If API returns redirect, navigate to the new invoice
      if (data.redirectTo) {
        router.push(data.redirectTo);
      } else {
        // Otherwise, refetch billing docs to show the new invoice immediately
        await refetchBillingDocs();

        // Show success feedback
        setDialog({
          type: 'alert',
          message:
            lang?.invoiceCreatedSuccess || 'Invoice created successfully!'
        });
      }
    } catch (err: any) {
      setDialog({
        type: 'alert',
        message:
          lang?.connectionError ||
          'Connection error. Please check your network.'
      });
    } finally {
      setCreatingInvoice(false);
    }
  };

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

  // ─── Loading State ───────────────────────────────────────
  if (loading) return <LoadingDots />;

  if (!estimate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-400 uppercase tracking-widest">
            {lang?.notFound || 'Estimate Not Found'}
          </p>
          <LinkButton
            href="/dashboard"
            variant="secondary"
            size="md"
            className="mt-4"
          >
            {lang?.dashboard || 'Dashboard'}
          </LinkButton>
        </div>
      </div>
    );
  }

  // ─── Computed Render Values ──────────────────────────────
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

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans print:bg-white flex flex-col">
      {/* Client-facing navbar (only for non-owners) */}
      {!isOwner && (
        <nav className="w-full bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center print:hidden shadow-sm sticky top-0 z-50">
          <Link href="/" className="flex items-center outline-none">
            <BrandLogo country={profile?.country === 'FR' ? 'FR' : 'US'} />
          </Link>
        </nav>
      )}

      <main className="flex-1 p-4 sm:p-8 print:p-0">
        <div className="max-w-4xl mx-auto print:max-w-none print:w-full">
          {/* ════════════════════════════════════════════════════════
  BACK BUTTON ROW
════════════════════════════════════════════════════════ */}
          <div className="flex items-center gap-3 mb-4 print:hidden">
            {isOwner && (
              <LinkButton href="/dashboard" variant="secondary" size="sm">
                ← {lang.dashboard}
              </LinkButton>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════
  TAB NAVIGATION - Now stays stationary
════════════════════════════════════════════════════════ */}
          <div
            role="tablist"
            aria-label={lang?.tabsLabel || 'Document sections'}
            className="flex gap-6 sm:gap-8 border-b border-gray-200 mb-3 print:hidden overflow-x-auto scrollbar-hide"
          >
            <TabButton
              id="tab-estimate"
              label={lang?.estimateTab || 'Estimate'}
              isActive={activeTab === 'estimate'}
              onClick={() => setActiveTab('estimate')}
              controls="panel-estimate"
            />

            {showBillingTab && (
              <TabButton
                id="tab-billing"
                label={lang?.billingTab || 'Billing'}
                isActive={activeTab === 'billing'}
                onClick={() => setActiveTab('billing')}
                controls="panel-billing"
              />
            )}

            {showDiscussionTab && (
              <TabButton
                id="tab-discussion"
                label={lang?.discussionTab || 'Discussion'}
                isActive={activeTab === 'discussion'}
                onClick={() => setActiveTab('discussion')}
                badge={comments.length}
                controls="panel-discussion"
              />
            )}
          </div>

          {/* ════════════════════════════════════════════════════════
  PER-TAB ACTIONS ROW
════════════════════════════════════════════════════════ */}
          {(activeTab === 'estimate' ||
            (activeTab === 'billing' && isOwner)) && (
            <div className="flex flex-wrap gap-2 items-center justify-end mb-6 print:hidden">
              {/* ─── ESTIMATE TAB — locked ─── */}
              {activeTab === 'estimate' && estimate.is_locked && (
                <>
                  {isOwner &&
                    !estimate.cancelled_at &&
                    !estimate.superseded_at &&
                    (estimate.client_email ? (
                      (() => {
                        const followUpState = getFollowUpState();
                        if (followUpState.mode === 'hidden') {
                          return (
                            <Button
                              variant="dark"
                              size="md"
                              loading={sending}
                              loadingText={lang.sending}
                              onClick={() => handleSend('email')}
                              className="flex-1 sm:flex-none"
                              icon={<Icons.Send />}
                            >
                              {lang.emailBtn}
                            </Button>
                          );
                        }
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
                              variant="secondary"
                              size="md"
                              disabled
                              title={t(lang.followUpCooldown, {
                                date: dateStr
                              })}
                              className="flex-1 sm:flex-none opacity-60"
                            >
                              {lang.followUpBtn} · {dateStr}
                            </Button>
                          );
                        }
                        return (
                          <Button
                            variant="dark"
                            size="md"
                            loading={sending}
                            loadingText={lang.followUpSending}
                            onClick={handleSendFollowUp}
                            className="flex-1 sm:flex-none"
                            icon={<Icons.Send />}
                          >
                            {lang.followUpBtn}
                          </Button>
                        );
                      })()
                    ) : (
                      <Button
                        variant="dark"
                        size="md"
                        onClick={handleNativeShare}
                        className="flex-1 sm:flex-none"
                        icon={<Icons.Share />}
                      >
                        {lang.share}
                      </Button>
                    ))}
                  <Button
                    variant="primary"
                    size="md"
                    loading={loading}
                    loadingText={lang.generating}
                    onClick={handleDownloadPDF}
                    className="flex-1 sm:flex-none"
                    icon={<Icons.Download />}
                  >
                    <span className="hidden sm:inline">{lang.downloadPdf}</span>
                    <span className="sm:hidden">PDF</span>
                  </Button>
                  {isOwner && !estimate.cancelled_at && (
                    <Menu as="div" className="relative">
                      <MenuButton className="inline-flex items-center justify-center h-[38px] w-[38px] rounded-xl bg-white text-gray-600 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <Icons.MoreVertical />
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
                        <MenuItems className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden focus:outline-none divide-y divide-gray-100">
                          {profile?.subscription_tier === 'pro' && (
                            <div className="py-1">
                              <MenuItem>
                                {({ active }) => (
                                  <button
                                    onClick={() => {
                                      setTemplateName(
                                        estimate.client_name || ''
                                      );
                                      setTemplateModalOpen(true);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-3 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}`}
                                  >
                                    <Icons.Template />
                                    {lang.saveAsTemplate}
                                  </button>
                                )}
                              </MenuItem>
                            </div>
                          )}
                          <div className="py-1">
                            {!estimate.superseded_at && (
                              <MenuItem>
                                {({ active }) => (
                                  <button
                                    onClick={handleCreateRevision}
                                    className={`w-full text-left px-4 py-3 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-3 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}`}
                                  >
                                    <Icons.Refresh />
                                    {lang.createRevision}
                                  </button>
                                )}
                              </MenuItem>
                            )}
                            {estimate.client_email && (
                              <MenuItem>
                                {({ active }) => (
                                  <button
                                    onClick={handleNativeShare}
                                    className={`w-full text-left px-4 py-3 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-3 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}`}
                                  >
                                    <Icons.Share />
                                    {lang.share}
                                  </button>
                                )}
                              </MenuItem>
                            )}
                          </div>
                          <div className="py-1">
                            <MenuItem>
                              {({ active }) => (
                                <button
                                  onClick={() => setCancelModalOpen(true)}
                                  className={`w-full text-left px-4 py-3 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-3 ${active ? 'bg-red-50 text-red-700' : 'text-red-600'}`}
                                >
                                  <Icons.Cancel />
                                  {lang.cancelEstimateBtn}
                                </button>
                              )}
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </Transition>
                    </Menu>
                  )}
                </>
              )}

              {/* ─── ESTIMATE TAB — draft ─── */}
              {activeTab === 'estimate' && !estimate.is_locked && isOwner && (
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm shrink-0">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      {lang.internalDetails}
                    </span>
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      role="switch"
                      aria-checked={showDetails}
                      aria-label={lang.internalDetails}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${showDetails ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${showDetails ? 'translate-x-5' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                    <LinkButton
                      href={`/new-estimate?edit=${id}`}
                      variant="soft-primary"
                      size="md"
                      className="flex-1 sm:flex-none justify-center"
                    >
                      {lang.edit}
                    </LinkButton>
                    <Button
                      variant="soft-danger"
                      size="md"
                      onClick={handleCancelDraft}
                      className="flex-1 sm:flex-none justify-center"
                    >
                      {lang.cancel}
                    </Button>
                    <Button
                      variant="success"
                      size="md"
                      onClick={handleFinalize}
                      className="flex-1 sm:flex-none justify-center min-w-[90px]"
                    >
                      {lang.finalize}
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── BILLING TAB ACTIONS ─── */}
              {activeTab === 'billing' && isOwner && (
                <>
                  {/* Create Invoice — primary */}
                  {canCreateInvoice &&
                    (profile?.subscription_tier === 'pro' ||
                    profile?.lifetime_access ? (
                      <Button
                        variant="primary"
                        size="md"
                        loading={creatingInvoice}
                        loadingText={lang?.creating || 'Creating...'}
                        onClick={handleCreateInvoice}
                        icon={<Icons.Plus />}
                        className="flex-1 sm:flex-none"
                      >
                        {lang?.createInvoice || 'Create Invoice'}
                      </Button>
                    ) : (
                      <LinkButton
                        href="/upgrade"
                        variant="primary"
                        size="md"
                        className="flex-1 sm:flex-none"
                      >
                        {lang?.upgradeToPro || 'Upgrade to Pro'}
                      </LinkButton>
                    ))}

                  {/* Bulk Follow-up — primary */}
                  {(profile?.subscription_tier === 'pro' ||
                    profile?.lifetime_access) && (
                    <Button
                      variant="dark"
                      size="md"
                      loading={bulkSending}
                      loadingText={lang?.sending || 'Sending...'}
                      onClick={handleBulkFollowUp}
                      disabled={
                        bulkSending ||
                        invoices.filter(
                          (i) =>
                            i.is_locked &&
                            !i.is_cancelled &&
                            i.payment_status !== 'paid'
                        ).length === 0
                      }
                      icon={<Icons.Send />}
                      className="flex-1 sm:flex-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {lang?.bulkFollowUp || 'Bulk Follow-up'}
                    </Button>
                  )}

                  {/* Three-dots: ZIP + Installments + Automated Recurring */}
                  {(profile?.subscription_tier === 'pro' ||
                    profile?.lifetime_access) && (
                    <Menu as="div" className="relative shrink-0">
                      <MenuButton className="inline-flex items-center justify-center h-[38px] w-[38px] rounded-xl bg-white text-gray-600 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <Icons.MoreVertical />
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
                        <MenuItems className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden focus:outline-none divide-y divide-gray-100">
                          {remainingForInstallments > 0 &&
                            estimate?.client_status === 'approved' &&
                            !estimate?.cancelled_at && (
                              <div className="py-1">
                                <MenuItem>
                                  {({ active }) => (
                                    <button
                                      onClick={() => {
                                        setInstallmentMode('equal');
                                        setInstallmentCount(
                                          estimate.deposit_enabled ? 3 : 3
                                        ); // minimum 3 for deposit (1 deposit + 1 intermediate + 1 balance)
                                        setInstallmentFrequency('monthly');
                                        setInstallmentCustomDays(30);
                                        setInstallmentStartDate(
                                          new Date().toISOString().split('T')[0]
                                        );

                                        // Pre-populate custom installments based on deposit rules
                                        if (estimate.deposit_enabled) {
                                          const depositAmt = Math.round(
                                            (remainingForInstallments *
                                              (estimate.deposit_percentage ||
                                                20)) /
                                              100
                                          );
                                          const rem =
                                            remainingForInstallments -
                                            depositAmt;
                                          setCustomInstallments([
                                            {
                                              amountCents: depositAmt,
                                              dueDate: '',
                                              rawAmount: (
                                                depositAmt / 100
                                              ).toFixed(2)
                                            },
                                            {
                                              amountCents: rem,
                                              dueDate: '',
                                              rawAmount: (rem / 100).toFixed(2)
                                            }
                                          ]);
                                        } else {
                                          setCustomInstallments([
                                            {
                                              amountCents: 0,
                                              dueDate: '',
                                              rawAmount: ''
                                            },
                                            {
                                              amountCents: 0,
                                              dueDate: '',
                                              rawAmount: ''
                                            }
                                          ]);
                                        }
                                        setShowInstallmentModal(true);
                                      }}
                                      className={`w-full text-left px-4 py-3 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-3 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}`}
                                    >
                                      <svg
                                        className="w-4 h-4 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M3 6h18M3 12h18M3 18h18"
                                        />
                                      </svg>
                                      {lang?.splitIntoInstallments ||
                                        'Split into Installments'}
                                    </button>
                                  )}
                                </MenuItem>
                              </div>
                            )}
                          {remainingForInstallments > 0 &&
                            estimate?.client_status === 'approved' &&
                            !estimate?.cancelled_at && (
                              <div className="py-1">
                                <MenuItem>
                                  {({ active }) => (
                                    <button
                                      onClick={() => {
                                        setScheduleAmountDollars('');
                                        setScheduleStartDate(
                                          new Date().toISOString().split('T')[0]
                                        );
                                        setScheduleFrequency('monthly');
                                        setScheduleCustomDays(30);
                                        setScheduleMode('draft');
                                        setScheduleIsFinite(false);
                                        setScheduleTotalInvoices(6);
                                        setShowScheduleModal(true);
                                      }}
                                      className={`w-full text-left px-4 py-3 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-3 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}`}
                                    >
                                      <svg
                                        className="w-4 h-4 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        viewBox="0 0 24 24"
                                      >
                                        <rect
                                          x="3"
                                          y="4"
                                          width="18"
                                          height="18"
                                          rx="2"
                                          ry="2"
                                        />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                      </svg>
                                      {lang?.automatedRecurringBilling ||
                                        'Automated Recurring Billing'}
                                    </button>
                                  )}
                                </MenuItem>
                              </div>
                            )}
                          <div className="py-1">
                            <MenuItem>
                              {({ active }) => (
                                <button
                                  onClick={() => handleDownloadZIP()}
                                  disabled={
                                    archiving ||
                                    invoices.filter((i) => i.is_locked)
                                      .length === 0
                                  }
                                  className={`w-full text-left px-4 py-3 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}`}
                                >
                                  <svg
                                    className="w-4 h-4 shrink-0 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                                    />
                                  </svg>
                                  {archiving
                                    ? lang?.archiving || 'Archiving...'
                                    : t(
                                        lang?.downloadPdfsZip ||
                                          'ZIP ({count})',
                                        {
                                          count: invoices.filter(
                                            (i) => i.is_locked
                                          ).length
                                        }
                                      )}
                                </button>
                              )}
                            </MenuItem>
                          </div>
                          {draftInvoiceCount > 0 && (
                            <div className="py-1">
                              <MenuItem>
                                {({ active }) => (
                                  <button
                                    onClick={() =>
                                      setDialog({
                                        type: 'danger',
                                        title: lang.deleteAllDraftsTitle,
                                        message: t(
                                          lang.deleteAllDraftsMessage,
                                          { count: draftInvoiceCount }
                                        ),
                                        onConfirm: handleDeleteAllDrafts
                                      })
                                    }
                                    disabled={deletingAllDrafts}
                                    className={`w-full text-left px-4 py-3 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-3 disabled:opacity-40 ${active ? 'bg-red-50 text-red-700' : 'text-red-600'}`}
                                  >
                                    <svg
                                      className="w-4 h-4 shrink-0"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      viewBox="0 0 24 24"
                                    >
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                      <path d="M10 11v6M14 11v6" />
                                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                    </svg>
                                    {deletingAllDrafts
                                      ? '...'
                                      : lang.deleteAllDrafts}
                                  </button>
                                )}
                              </MenuItem>
                            </div>
                          )}
                        </MenuItems>
                      </Transition>
                    </Menu>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
            TAB PANEL: ESTIMATE DOCUMENT
        ════════════════════════════════════════════════════════ */}
          <div
            id="panel-estimate"
            role="tabpanel"
            aria-labelledby="tab-estimate"
            className={
              activeTab === 'estimate' ? 'block' : 'hidden print:block'
            }
          >
            {estimate.is_locked && (
              <div
                className={`mb-6 px-5 py-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden transition-colors ${
                  estimate.cancelled_at
                    ? 'bg-gray-50 border-gray-200'
                    : estimate.superseded_at
                      ? 'bg-amber-50/50 border-amber-200'
                      : estimate.client_status === 'approved'
                        ? 'bg-green-50/50 border-green-200'
                        : estimate.client_status === 'rejected'
                          ? 'bg-red-50/50 border-red-200'
                          : 'bg-blue-50/50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {estimate.cancelled_at ? (
                    <>
                      <span className="text-gray-500 text-base leading-none mt-0.5">
                        ⊘
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-gray-700 font-semibold text-sm">
                          {lang.estimateCancelled}
                        </span>
                        {estimate.cancelled_reason && (
                          <span className="text-gray-500 text-xs italic mt-0.5 break-words">
                            "{estimate.cancelled_reason}"
                          </span>
                        )}
                        <span className="text-gray-400 text-[10px] uppercase tracking-wider font-medium mt-1.5">
                          {t(lang.cancelledOn, {
                            date: new Date(
                              estimate.cancelled_at
                            ).toLocaleDateString(
                              profile.country === 'FR' ? 'fr-FR' : 'en-US',
                              {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              }
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
                        <span className="text-amber-700 font-semibold text-sm">
                          {lang.supersededBadge}
                        </span>
                        <span className="text-amber-600/80 text-xs mt-0.5">
                          {lang.supersededLabel}
                        </span>
                      </div>
                    </>
                  ) : estimate.client_status === 'approved' ? (
                    <>
                      <span className="text-green-600 text-base leading-none">
                        ✓
                      </span>
                      <span className="text-green-700 font-semibold text-sm">
                        {lang.estimateApproved}
                      </span>
                    </>
                  ) : estimate.client_status === 'rejected' ? (
                    <>
                      <span className="text-red-600 text-base leading-none">
                        ✕
                      </span>
                      <span className="text-red-700 font-semibold text-sm">
                        {lang.estimateRejected}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-blue-600 text-base leading-none">
                        ⏳
                      </span>
                      <span className="text-blue-700 font-semibold text-sm">
                        {lang.pendingApproval}
                      </span>
                    </>
                  )}
                </div>
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
                        className="flex-1 sm:flex-none px-6"
                      >
                        {lang.reject}
                      </Button>
                      <Button
                        variant="success"
                        size="md"
                        onClick={() => handleStatusChange('approved')}
                        className="flex-1 sm:flex-none px-6"
                      >
                        {lang.approveEstimate}
                      </Button>
                    </div>
                  )}
              </div>
            )}
            <article className="bg-white shadow-xl border border-gray-200 rounded-2xl overflow-hidden print:shadow-none print:border-none print:rounded-none">
              <div className="p-8 sm:p-12 lg:p-14 print:p-12">
                {/* Document Header */}
                <header className="flex items-start justify-between gap-6 pb-8 mb-10 border-b border-gray-100">
                  <div className="flex items-center gap-4 min-w-0">
                    {profile.subscription_tier === 'pro' &&
                      profile.logo_url && (
                        <img
                          src={profile.logo_url}
                          alt=""
                          className="h-12 sm:h-14 w-auto object-contain shrink-0"
                        />
                      )}
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight break-words leading-tight">
                        {profile.business_name}
                      </h1>
                      {(profile.business_address || profile.business_city) && (
                        <div className="mt-1 text-xs text-gray-500 font-medium leading-relaxed">
                          {profile.business_address && (
                            <p>{profile.business_address}</p>
                          )}
                          {(profile.business_city ||
                            profile.business_state ||
                            profile.business_zip) && (
                            <p>
                              {estimate.country_snapshot === 'US'
                                ? `${profile.business_city || ''}${profile.business_state ? `, ${profile.business_state}` : ''} ${profile.business_zip || ''}`.trim()
                                : `${[profile.business_zip, profile.business_city].filter(Boolean).join(' ')}`}
                            </p>
                          )}
                          {profile.vat_number && (
                            <p>
                              {profile.country === 'FR'
                                ? `N° TVA : ${profile.vat_number}`
                                : `VAT: ${profile.vat_number}`}
                            </p>
                          )}
                          {profile.company_reg_number && (
                            <p>
                              {profile.country === 'FR'
                                ? `SIRET : ${profile.company_reg_number}`
                                : `Reg: ${profile.company_reg_number}`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-gray-400 mb-2">
                      {lang.estimateLabel}
                    </p>
                    <p className="font-mono text-sm sm:text-base font-bold text-gray-900">
                      #
                      {estimate.estimate_number ||
                        estimate.custom_id ||
                        estimate.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">
                      {new Date(estimate.created_at).toLocaleDateString(
                        profile.country === 'FR' ? 'fr-FR' : 'en-US',
                        { year: 'numeric', month: 'short', day: 'numeric' }
                      )}
                    </p>
                  </div>
                </header>

                {/* Client Info */}
                <section className="mb-12">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-400 mb-3">
                    {lang.clientLabel}
                  </p>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-gray-900 break-words">
                      {estimate.client_name}
                    </p>
                    {estimate.client_address && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
                        {estimate.client_address}
                      </p>
                    )}
                    {(estimate.client_city ||
                      estimate.client_state ||
                      estimate.client_zip ||
                      estimate.client_country) && (
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {estimate.client_country === 'FR' ||
                        estimate.client_country === 'France'
                          ? // French format: ZIP City, France (strictly excludes state field)
                            `${[estimate.client_zip, estimate.client_city].filter(Boolean).join(' ')}, FR`
                          : // US/Default format: City, State ZIP, Country
                            `${[
                              estimate.client_city,
                              estimate.client_state,
                              estimate.client_zip
                            ]
                              .filter(Boolean)
                              .join(', ')}, US`}
                      </p>
                    )}
                    {estimate.client_siret && (
                      <p className="text-sm text-gray-500 font-mono mt-1">
                        SIRET: {estimate.client_siret}
                      </p>
                    )}
                    {(estimate.client_phone || estimate.client_email) && (
                      <div className="flex flex-col gap-1 pt-2">
                        {estimate.client_phone && (
                          <p className="text-sm text-gray-500">
                            {estimate.client_phone}
                          </p>
                        )}
                        {estimate.client_email && (
                          <p className="text-sm text-gray-500">
                            {estimate.client_email}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* Services Table */}
                <section className="mb-10">
                  <div className="flex items-baseline justify-between pb-3 mb-4 border-b-2 border-gray-900">
                    <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-700">
                      {lang.serviceCategoryHeader}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-700">
                      {lang.amountHeader}
                    </p>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {estimate.sections.map((sec: any, idx: number) => (
                      <div key={idx} className="py-6 first:pt-2">
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <h3 className="text-base font-semibold text-gray-900 break-words flex-1 min-w-0">
                            {sec.title || lang.professionalServices}
                          </h3>
                          <span className="font-mono font-bold text-lg text-gray-900 whitespace-nowrap shrink-0 tabular-nums">
                            {fmt(
                              getSectionTotal(estimate, sec, materialsById) *
                                100
                            )}
                          </span>
                        </div>

                        <div className="pr-20 sm:pr-28">
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
                            {generateDescription(
                              estimate,
                              sec,
                              descTranslations,
                              materialsById
                            )}
                          </p>
                        </div>

                        {/* Detailed breakdown */}
                        {isShowingDetails ? (
                          <div className="mt-4 pl-4 border-l-2 border-gray-100 space-y-1.5">
                            {sec.laborHours > 0 && (
                              <p className="text-xs text-gray-500">
                                <span className="text-gray-400">
                                  {lang.laborLabel}:
                                </span>{' '}
                                {sec.laborHours}
                                {sec.laborType === 'daily'
                                  ? lang.laborDayUnit
                                  : 'h'}{' '}
                                ×{' '}
                                {fmt(getEffectiveLaborRateCents(estimate, sec))}
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
                              const displayCostCents =
                                getEffectiveItemCostCents(
                                  estimate,
                                  sec,
                                  item,
                                  materialsById
                                );
                              const rawUnit = item.unit || m?.unit || '';
                              const displayUnit =
                                lang?.units?.[rawUnit] || rawUnit;
                              return (
                                <p key={i} className="text-xs text-gray-500">
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
                            <div className="mt-3 space-y-1">
                              {sec.items.map((item: any, i: number) => {
                                const m = materialsById.get(item.materialId);
                                const displayName =
                                  item.name || m?.name || 'Material Item';
                                const rawUnit = item.unit || m?.unit || '';
                                const displayUnit =
                                  lang?.units?.[rawUnit] || rawUnit;
                                return (
                                  <p key={i} className="text-xs text-gray-500">
                                    <span className="text-gray-700 font-medium">
                                      {displayName}
                                    </span>
                                    {(item.qty > 0 || displayUnit) && (
                                      <span className="text-gray-400">
                                        {' '}
                                        · {item.qty}
                                        {displayUnit ? ` ${displayUnit}` : ''}
                                      </span>
                                    )}
                                  </p>
                                );
                              })}
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Additional Charges */}
                {Array.isArray(estimate.additional_charges) &&
                  estimate.additional_charges.length > 0 && (
                    <section className="mb-10">
                      <div className="flex items-baseline justify-between pb-3 mb-4 border-b border-gray-200">
                        <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-500">
                          {lang.additionalCharges}
                        </p>
                        <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-500">
                          {lang.amountHeader}
                        </p>
                      </div>

                      <div className="divide-y divide-gray-100">
                        {estimate.additional_charges.map(
                          (charge: AdditionalCharge, idx: number) => {
                            const amountCents = getAdditionalChargeAmountCents(
                              estimate,
                              charge,
                              estimate.sections || [],
                              materialsById
                            );
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
                              <div key={idx} className="py-4 first:pt-2">
                                <div className="flex justify-between items-start gap-4">
                                  <div className="min-w-0">
                                    <h4 className="text-sm font-semibold text-gray-900 break-words">
                                      {charge.name || lang.additionalCharges}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {subtitle}
                                    </p>
                                  </div>
                                  <span className="font-mono font-bold text-base text-gray-900 whitespace-nowrap shrink-0 tabular-nums">
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

                {/* Totals */}
                <section className="flex justify-end pt-8 mb-10 border-t-2 border-gray-200">
                  <div className="w-full sm:w-80 space-y-3">
                    <div className="flex justify-between items-baseline text-sm">
                      <span className="text-gray-500">{lang.subtotalHT}</span>
                      <span className="font-mono font-semibold text-gray-900 tabular-nums">
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
                          <span className="text-gray-500">
                            {lang.tax} ({rate}%)
                          </span>
                          <span className="font-mono font-semibold text-gray-900 tabular-nums">
                            {fmt(amt as number)}
                          </span>
                        </div>
                      ))}

                    <div className="flex justify-between items-baseline pt-5 border-t-2 border-gray-900">
                      <span className="text-base font-bold text-gray-900 uppercase tracking-wide">
                        {lang.grandTotalLabel}
                      </span>
                      <span className="text-2xl font-black font-mono text-blue-600 tabular-nums">
                        {fmt(estimate.total_amount_cents)}
                      </span>
                    </div>

                    {/* Deposit info */}
                    {estimate.deposit_enabled && (
                      <div className="pt-4 border-t border-dashed border-gray-200 space-y-2">
                        <div className="flex justify-between items-baseline text-sm bg-blue-50/60 px-3 py-2 rounded-lg">
                          <span className="text-blue-700 font-medium">
                            {lang.depositLabel} ({estimate.deposit_percentage}%)
                          </span>
                          <span className="font-mono font-bold text-blue-700 tabular-nums">
                            {fmt(
                              (estimate.total_amount_cents *
                                (estimate.deposit_percentage || 20)) /
                                100
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-sm px-3">
                          <span className="text-gray-500">
                            {lang.balanceDue}
                          </span>
                          <span className="font-mono font-semibold text-gray-700 tabular-nums">
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

                {/* Footer */}
                <footer className="mt-12 pt-8 border-t border-gray-100 print:mt-12">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 mb-3">
                        {lang.complianceLegal}
                      </p>
                      <p className="text-[10px] text-gray-400 leading-relaxed italic">
                        {lang.complianceText}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 mb-3">
                        {lang.termsHeader}
                      </p>
                      <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
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
                </footer>
              </div>
            </article>
          </div>

          {/* ════════════════════════════════════════════════════════
            TAB PANEL: DISCUSSION / MESSAGES
        ════════════════════════════════════════════════════════ */}
          {/* ════════════════════════════════════════════════════════
  TAB PANEL: DISCUSSION
════════════════════════════════════════════════════════ */}
          {showDiscussionTab && (
            <div
              id="panel-discussion"
              role="tabpanel"
              aria-labelledby="tab-discussion"
              className={
                activeTab === 'discussion'
                  ? 'block print:hidden'
                  : 'hidden print:hidden'
              }
            >
              <div className="bg-white shadow-xl border border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-6 sm:p-8">
                  {/* Messages List - No header needed */}
                  <div className="space-y-3 max-h-[450px] overflow-y-auto mb-6 pr-1 scroll-smooth">
                    {comments.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-gray-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-500">
                          {lang?.noMessagesYet || 'No messages yet'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {lang?.startConversation ||
                            'Start the conversation below'}
                        </p>
                      </div>
                    ) : (
                      comments.map((comm) => (
                        <div
                          key={comm.id}
                          className={`flex flex-col max-w-[85%] rounded-2xl p-4 ${
                            comm.is_owner
                              ? 'ml-auto bg-blue-50 border border-blue-100'
                              : 'mr-auto bg-gray-50 border border-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${comm.is_owner ? 'text-blue-600' : 'text-gray-500'}`}
                            >
                              {comm.author_name}
                            </span>
                            <span className="text-[9px] text-gray-400 font-mono">
                              {new Date(comm.created_at).toLocaleString(
                                profile?.country === 'FR' ? 'fr-FR' : 'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 break-words whitespace-pre-wrap leading-relaxed">
                            {comm.content}
                          </p>
                        </div>
                      ))
                    )}
                    <div ref={commentsEndRef} />
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={handlePostComment}
                    className="pt-4 border-t border-gray-100"
                  >
                    <div className="flex flex-col sm:flex-row gap-3">
                      <textarea
                        rows={2}
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder={
                          lang?.messagePlaceholder || 'Write a message...'
                        }
                        className="flex-1 p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-400 bg-white transition-shadow"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        loading={submittingComment}
                        loadingText={lang?.sending || 'Sending...'}
                        disabled={!commentInput.trim()}
                        className="self-end sm:self-stretch w-full sm:w-auto min-w-[100px]"
                      >
                        {lang?.send || 'Send'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          {/* ════════════════════════════════════════════════════════
            TAB PANEL: BILLING HUB
        ════════════════════════════════════════════════════════ */}
          {showBillingTab && (
            <div
              id="panel-billing"
              role="tabpanel"
              aria-labelledby="tab-billing"
              className={
                activeTab === 'billing'
                  ? 'block print:hidden'
                  : 'hidden print:hidden'
              }
            >
              <div className="bg-white shadow-lg border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  {(() => {
                    const billedPct =
                      estTotalCents > 0
                        ? Math.min(
                            100,
                            Math.round((netBilledCents / estTotalCents) * 100)
                          )
                        : 0;
                    const remainingCents = Math.max(
                      0,
                      estTotalCents - netBilledCents
                    );

                    return (
                      <div>
                        <div className="flex justify-between items-baseline mb-3">
                          <span className="text-sm font-medium text-gray-600">
                            {lang.finalizedBillingTracking ||
                              'Billing Progress'}
                          </span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-gray-900 tabular-nums">
                              {fmt(netBilledCents)}
                            </span>
                            <span className="text-sm text-gray-400">
                              {' '}
                              / {fmt(estTotalCents)}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${billedPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-400">
                            {billedPct}% {lang?.billed || 'billed'}
                          </span>
                          {remainingCents > 0 && (
                            <span className="text-xs text-gray-500 font-medium">
                              {fmt(remainingCents)}{' '}
                              {lang?.remaining || 'remaining'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Documents List */}
                <div className="p-4 sm:p-6 bg-gray-50/50">
                  {allBillingDocs.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-gray-400"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">
                        {lang.noInvoicesYet || 'No billing documents yet'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {lang?.createFirstInvoice ||
                          'Create your first invoice to get started'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allBillingDocs.map((doc) => {
                        const isInv = doc.docType === 'invoice';
                        const isPaid = isInv
                          ? doc.payment_status === 'paid'
                          : false;
                        const isOverdueInv =
                          isInv &&
                          doc.is_locked &&
                          !doc.is_cancelled &&
                          doc.payment_status === 'unpaid' &&
                          doc.due_date &&
                          new Date(doc.due_date) < new Date();

                        // Determine status
                        let docStatus: StatusBadgeProps['status'];
                        let statusLabel: string;

                        if (doc.is_cancelled) {
                          docStatus = 'cancelled';
                          statusLabel = isInv
                            ? lang.invoiceCancelled || 'Cancelled'
                            : lang.creditNoteCancelled || 'Cancelled';
                        } else if (!doc.is_locked) {
                          docStatus = 'draft';
                          statusLabel = isInv
                            ? lang.invoiceDraft || 'Draft'
                            : lang.creditNoteDraft || 'Draft';
                        } else if (!isInv) {
                          docStatus = 'credit';
                          statusLabel = lang.creditNoteLabel || 'Credit Note';
                        } else if (isPaid) {
                          docStatus = 'paid';
                          statusLabel = lang.invoicePaid || 'Paid';
                        } else if (isOverdueInv) {
                          docStatus = 'overdue';
                          statusLabel = lang.invoiceOverdue || 'Overdue';
                        } else {
                          docStatus = 'unpaid';
                          statusLabel = lang.invoiceUnpaid || 'Unpaid';
                        }

                        return (
                          <div
                            key={`${doc.docType}-${doc.id}`}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-white transition-all ${
                              doc.is_cancelled
                                ? 'border-gray-100 opacity-50'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-4 mb-3 sm:mb-0">
                              <StatusBadge
                                status={docStatus}
                                label={statusLabel}
                              />
                              <div>
                                <p
                                  className={`font-mono text-sm font-bold ${
                                    !isInv ? 'text-purple-600' : 'text-gray-900'
                                  }`}
                                >
                                  {isInv
                                    ? doc.invoice_number
                                    : doc.credit_note_number}
                                </p>
                                {doc.is_locked && (
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {new Date(
                                      doc.created_at
                                    ).toLocaleDateString(
                                      profile.country === 'FR'
                                        ? 'fr-FR'
                                        : 'en-US',
                                      {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      }
                                    )}
                                  </p>
                                )}
                                {isInv &&
                                  doc.installment_number &&
                                  doc.installment_total &&
                                  doc.invoice_type !== 'balance' && (
                                    <p className="text-[10px] text-indigo-600 font-bold mt-0.5 uppercase tracking-wider">
                                      {doc.invoice_type === 'deposit'
                                        ? profile.country === 'FR'
                                          ? `Acompte ${doc.installment_number}/${doc.installment_total - 1}`
                                          : `Deposit ${doc.installment_number} of ${doc.installment_total - 1}`
                                        : profile.country === 'FR'
                                          ? `Versement ${doc.installment_number} sur ${doc.installment_total}`
                                          : `Installment ${doc.installment_number} of ${doc.installment_total}`}
                                    </p>
                                  )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4">
                              <span
                                className={`font-mono text-base font-bold tabular-nums ${
                                  !isInv ? 'text-purple-600' : 'text-gray-800'
                                }`}
                              >
                                {!isInv && '−'}
                                {formatMoney(
                                  doc.total_amount_cents,
                                  doc.currency_snapshot,
                                  doc.country_snapshot === 'FR' ? 'FR' : 'US'
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                <LinkButton
                                  href={`/${isInv ? 'invoices' : 'credit-notes'}/${doc.id}`}
                                  variant="ghost"
                                  size="sm"
                                >
                                  {doc.is_locked
                                    ? isInv
                                      ? lang.viewInvoice || 'View'
                                      : lang.viewCreditNote || 'View'
                                    : isInv
                                      ? lang.reviseInvoice || 'Edit'
                                      : lang.editCreditNote || 'Edit'}
                                </LinkButton>
                                {!doc.is_locked && (
                                  <button
                                    onClick={() =>
                                      handleDeleteDraftDoc(doc.id, doc.docType)
                                    }
                                    disabled={deletingDocId === doc.id}
                                    className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-2 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                                  >
                                    {deletingDocId === doc.id
                                      ? '...'
                                      : lang.delete || 'Delete'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Recurring Schedules ──────────────────────────── */}
                {isOwner &&
                  (profile?.subscription_tier === 'pro' ||
                    profile?.lifetime_access) &&
                  paymentSchedules.length > 0 && (
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 pt-4 border-t border-gray-100">
                        {lang?.recurringSchedules || 'Recurring Schedules'}
                      </p>
                      <div className="space-y-2">
                        {paymentSchedules.map((schedule) => {
                          const freqLabel =
                            schedule.frequency === 'monthly'
                              ? lang?.monthly || 'Monthly'
                              : schedule.frequency === 'biweekly'
                                ? lang?.biweekly || 'Bi-weekly'
                                : schedule.frequency === 'weekly'
                                  ? lang?.weekly || 'Weekly'
                                  : `${lang?.every || 'Every'} ${schedule.interval_days} ${lang?.days || 'days'}`;
                          const modeLabel =
                            schedule.mode === 'auto'
                              ? lang?.autoMode || 'Auto'
                              : lang?.draftMode || 'Draft';
                          const symbol =
                            estimate?.currency_snapshot === 'EUR' ? '€' : '$';
                          return (
                            <div
                              key={schedule.id}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-white gap-3 transition-all ${!schedule.is_active ? 'opacity-50 border-gray-100' : 'border-gray-200'}`}
                            >
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${schedule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                                  >
                                    {schedule.is_active
                                      ? lang?.active || 'Active'
                                      : lang?.paused || 'Paused'}
                                  </span>
                                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    {freqLabel} · {modeLabel}
                                  </span>
                                </div>
                                <p className="font-mono text-sm font-bold text-gray-900">
                                  {symbol}
                                  {(schedule.amount_cents / 100).toFixed(2)}
                                  {schedule.total_invoices
                                    ? ` · ${schedule.invoices_created}/${schedule.total_invoices} ${lang?.invoices || 'invoices'}`
                                    : ` · ${lang?.indefinite || 'Indefinite'}`}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {lang?.nextRun || 'Next'}:{' '}
                                  {new Date(
                                    schedule.next_run_date
                                  ).toLocaleDateString(
                                    profile.country === 'FR'
                                      ? 'fr-FR'
                                      : 'en-US',
                                    {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    }
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  loading={togglingScheduleId === schedule.id}
                                  onClick={() =>
                                    handleToggleSchedule(
                                      schedule.id,
                                      schedule.is_active
                                    )
                                  }
                                >
                                  {schedule.is_active
                                    ? lang?.pause || 'Pause'
                                    : lang?.resume || 'Resume'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  loading={deletingScheduleId === schedule.id}
                                  onClick={() =>
                                    setDialog({
                                      type: 'danger',
                                      title:
                                        lang?.deleteScheduleTitle ||
                                        'Delete schedule?',
                                      message:
                                        lang?.deleteScheduleMessage ||
                                        'This will permanently delete the recurring billing schedule. Invoices already created will not be affected.',
                                      onConfirm: () =>
                                        handleDeleteSchedule(schedule.id)
                                    })
                                  }
                                  className="!text-red-500 hover:!bg-red-50 hover:!text-red-700"
                                >
                                  {lang?.delete || 'Delete'}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
            DIALOGS
        ════════════════════════════════════════════════════════ */}
          <ConfirmDialog
            dialog={dialog}
            onClose={() => setDialog(null)}
            labels={{
              notice: lang?.notice,
              cancel: lang?.cancel,
              confirmOk: lang?.confirmOk
            }}
          />

          {/* Cancel Estimate Modal */}
          {/* Save as Template Modal */}
          {templateModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-100">
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  {lang.saveAsTemplate}
                </h3>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                  {lang.saveAsTemplateDesc}
                </p>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  {lang.templateName}
                </label>
                <input
                  type="text"
                  value={templateName}
                  maxLength={80}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    templateName.trim() &&
                    handleSaveAsTemplate()
                  }
                  placeholder={lang.templateNamePlaceholder}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-5 text-gray-900 placeholder-gray-400 shadow-sm"
                />
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setTemplateModalOpen(false);
                      setTemplateName('');
                    }}
                    disabled={savingTemplate}
                  >
                    {lang.cancel}
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    loading={savingTemplate}
                    loadingText="..."
                    onClick={handleSaveAsTemplate}
                    disabled={!templateName.trim()}
                  >
                    {lang.save}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {cancelModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                <h3 className="text-base font-bold text-gray-900 mb-2">
                  {lang.cancelEstimate}
                </h3>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                  {lang.cancelEstimateConfirm}
                </p>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  {lang.cancelEstimateReasonLabel}
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={lang.cancelEstimateReasonPlaceholder}
                  maxLength={300}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-400 bg-white transition-shadow mb-5"
                />
                <div className="flex gap-3 justify-end">
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
        </div>
        {/* ══════════════════════════════════════════════════════════════
        INSTALLMENT PLAN MODAL
      ══════════════════════════════════════════════════════════════ */}
        {showInstallmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-base font-black uppercase tracking-tighter">
                  {lang?.splitIntoInstallments || 'Split into Installments'}
                </h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {lang?.installmentModalSubtitle ||
                    'Split the remaining balance into a series of scheduled payments. Each installment becomes its own invoice.'}
                </p>
                <p className="text-xs text-gray-400 font-bold mt-2">
                  {profile.country === 'FR'
                    ? 'Solde restant'
                    : 'Remaining balance'}
                  :{' '}
                  <span className="text-gray-700">
                    {fmt(remainingForInstallments)}
                  </span>
                </p>
              </div>

              <div className="p-6 border-b border-gray-100">
                <div className="flex border border-gray-200 rounded-xl p-1 bg-gray-50/50 gap-1">
                  <button
                    type="button"
                    onClick={() => setInstallmentMode('equal')}
                    className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${installmentMode === 'equal' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {lang?.equalSplit || 'Equal Split'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallmentMode('custom')}
                    className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${installmentMode === 'custom' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {lang?.customAmounts || 'Custom Amounts'}
                  </button>
                </div>
              </div>

              <div className="p-6">
                {installmentMode === 'equal' ? (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                        {lang?.numberOfInstallments || 'Number of Installments'}
                        :{' '}
                        <span className="text-gray-900 text-sm">
                          {installmentCount}
                        </span>
                      </label>
                      <input
                        type="range"
                        min={2}
                        max={12}
                        value={installmentCount}
                        onChange={(e) =>
                          setInstallmentCount(parseInt(e.target.value))
                        }
                        className="w-full accent-blue-600"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>2</span>
                        <span>12</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                        {lang?.frequency || 'Frequency'}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(
                          ['monthly', 'biweekly', 'weekly', 'custom'] as const
                        ).map((freq) => (
                          <button
                            key={freq}
                            type="button"
                            onClick={() => setInstallmentFrequency(freq)}
                            className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${installmentFrequency === freq ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                          >
                            {freq === 'monthly'
                              ? lang?.monthly || 'Monthly'
                              : freq === 'biweekly'
                                ? lang?.biweekly || 'Bi-weekly'
                                : freq === 'weekly'
                                  ? lang?.weekly || 'Weekly'
                                  : lang?.custom || 'Custom'}
                          </button>
                        ))}
                      </div>
                      {installmentFrequency === 'custom' && (
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={installmentCustomDays}
                            onChange={(e) =>
                              setInstallmentCustomDays(
                                parseInt(e.target.value) || 30
                              )
                            }
                            className="w-20 p-2 border border-gray-200 rounded-lg text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-xs text-gray-500">
                            {lang?.days || 'days'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                        {lang?.startDate || 'Start Date'}
                      </label>
                      <input
                        type="date"
                        value={installmentStartDate}
                        onChange={(e) =>
                          setInstallmentStartDate(e.target.value)
                        }
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {installmentStartDate && remainingForInstallments > 0 && (
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                          {lang?.preview || 'Preview'}
                        </p>
                        <div className="space-y-2">
                          {Array.from({ length: installmentCount }, (_, i) => {
                            const intervalDays =
                              installmentFrequency === 'monthly'
                                ? 30
                                : installmentFrequency === 'biweekly'
                                  ? 14
                                  : installmentFrequency === 'weekly'
                                    ? 7
                                    : installmentCustomDays;
                            const dueDate = new Date(installmentStartDate);
                            dueDate.setDate(
                              dueDate.getDate() + i * intervalDays
                            );

                            let amount = 0;
                            if (estimate.deposit_enabled) {
                              const depositAmt = Math.round(
                                (remainingForInstallments *
                                  (estimate.deposit_percentage || 20)) /
                                  100
                              );
                              if (i === 0) {
                                amount = depositAmt;
                              } else {
                                const remainingAfterDeposit =
                                  remainingForInstallments - depositAmt;
                                const remInstallmentsCount =
                                  installmentCount - 1;
                                const base = Math.floor(
                                  remainingAfterDeposit / remInstallmentsCount
                                );
                                amount =
                                  i === installmentCount - 1
                                    ? remainingAfterDeposit -
                                      base * (remInstallmentsCount - 1)
                                    : base;
                              }
                            } else {
                              const base = Math.floor(
                                remainingForInstallments / installmentCount
                              );
                              amount =
                                i === installmentCount - 1
                                  ? remainingForInstallments -
                                    base * (installmentCount - 1)
                                  : base;
                            }

                            return (
                              <div
                                key={i}
                                className="flex justify-between items-center text-xs"
                              >
                                <span className="text-gray-500">
                                  {estimate.deposit_enabled && i === 0
                                    ? profile.country === 'FR'
                                      ? 'Acompte'
                                      : 'Deposit'
                                    : profile.country === 'FR'
                                      ? `Versement ${i + 1}`
                                      : `Installment ${i + 1}`}{' '}
                                  ·{' '}
                                  {dueDate.toLocaleDateString(
                                    profile.country === 'FR'
                                      ? 'fr-FR'
                                      : 'en-US',
                                    {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    }
                                  )}
                                </span>
                                <span className="font-mono font-bold text-gray-900">
                                  {fmt(amount)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customInstallments.map((inst, i) => {
                      const isLockedDepositInput =
                        estimate.deposit_enabled && i === 0;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-400 w-6 shrink-0">
                            {isLockedDepositInput ? 'DEP' : i + 1}
                          </span>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold pointer-events-none">
                              {estimate?.currency_snapshot === 'EUR'
                                ? '€'
                                : '$'}
                            </span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="0.00"
                              disabled={isLockedDepositInput}
                              value={inst.rawAmount}
                              onChange={(e) => {
                                const updated = [...customInstallments];
                                updated[i] = {
                                  ...updated[i],
                                  rawAmount: e.target.value,
                                  amountCents: Math.round(
                                    (parseFloat(e.target.value) || 0) * 100
                                  )
                                };
                                setCustomInstallments(updated);
                              }}
                              className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:opacity-60"
                            />
                          </div>
                          <input
                            type="date"
                            value={inst.dueDate}
                            onChange={(e) => {
                              const updated = [...customInstallments];
                              updated[i] = {
                                ...updated[i],
                                dueDate: e.target.value
                              };
                              setCustomInstallments(updated);
                            }}
                            className="flex-1 p-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500"
                          />
                          {customInstallments.length > 2 &&
                            !isLockedDepositInput && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCustomInstallments((prev) =>
                                    prev.filter((_, idx) => idx !== i)
                                  )
                                }
                                className="text-red-400 hover:text-red-600 text-xl font-bold leading-none cursor-pointer shrink-0"
                              >
                                ×
                              </button>
                            )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        setCustomInstallments((prev) => [
                          ...prev,
                          { amountCents: 0, dueDate: '', rawAmount: '' }
                        ])
                      }
                      className="text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      + {lang?.addInstallment || 'Add Installment'}
                    </button>
                    {(() => {
                      const total = customInstallments.reduce(
                        (s, inst) => s + (inst.amountCents || 0),
                        0
                      );
                      const diff = total - remainingForInstallments;
                      const ok = Math.abs(diff) <= 2;
                      return (
                        <div
                          className={`p-3 rounded-xl border text-xs font-bold ${ok ? 'bg-green-50 border-green-200 text-green-700' : diff > 0 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-amber-50 border-amber-200 text-amber-700'}`}
                        >
                          {ok
                            ? '✓ '
                            : diff > 0
                              ? `⚠ ${profile.country === 'FR' ? 'Dépassement de' : 'Over by'} ${fmt(diff)} — `
                              : `⚠ ${fmt(-diff)} ${profile.country === 'FR' ? 'restant — ' : 'remaining — '}`}
                          {profile.country === 'FR'
                            ? `Total : ${fmt(total)} / ${fmt(remainingForInstallments)}`
                            : `Total: ${fmt(total)} / ${fmt(remainingForInstallments)}`}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3 justify-end">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setShowInstallmentModal(false)}
                  className="sm:w-32 justify-center"
                >
                  {lang?.cancel || 'Cancel'}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  loading={creatingPlan}
                  loadingText="..."
                  onClick={() => {
                    if (installmentMode === 'equal') {
                      if (!installmentStartDate) {
                        setDialog({
                          type: 'alert',
                          message:
                            lang?.selectStartDate ||
                            'Please select a start date.'
                        });
                        return;
                      }
                      const intervalDays =
                        installmentFrequency === 'monthly'
                          ? 30
                          : installmentFrequency === 'biweekly'
                            ? 14
                            : installmentFrequency === 'weekly'
                              ? 7
                              : installmentCustomDays;

                      const installments = Array.from(
                        { length: installmentCount },
                        (_, i) => {
                          const d = new Date(installmentStartDate);
                          d.setDate(d.getDate() + i * intervalDays);

                          let amount = 0;
                          if (estimate.deposit_enabled) {
                            const depositAmt = Math.round(
                              (remainingForInstallments *
                                (estimate.deposit_percentage || 20)) /
                                100
                            );
                            if (i === 0) {
                              amount = depositAmt;
                            } else {
                              const remainingAfterDeposit =
                                remainingForInstallments - depositAmt;
                              const remInstallmentsCount = installmentCount - 1;
                              const base = Math.floor(
                                remainingAfterDeposit / remInstallmentsCount
                              );
                              amount =
                                i === installmentCount - 1
                                  ? remainingAfterDeposit -
                                    base * (remInstallmentsCount - 1)
                                  : base;
                            }
                          } else {
                            const base = Math.floor(
                              remainingForInstallments / installmentCount
                            );
                            amount =
                              i === installmentCount - 1
                                ? remainingForInstallments -
                                  base * (installmentCount - 1)
                                : base;
                          }

                          return {
                            amountCents: amount,
                            dueDate: d.toISOString().split('T')[0]
                          };
                        }
                      );
                      handleCreateInstallmentPlan(installments);
                    } else {
                      const allFilled = customInstallments.every(
                        (inst) => inst.amountCents > 0 && inst.dueDate
                      );
                      const total = customInstallments.reduce(
                        (s, inst) => s + inst.amountCents,
                        0
                      );
                      if (!allFilled) {
                        setDialog({
                          type: 'alert',
                          message:
                            lang?.fillAllInstallments ||
                            'Please fill in all amounts and dates.'
                        });
                        return;
                      }
                      if (Math.abs(total - remainingForInstallments) > 2) {
                        setDialog({
                          type: 'alert',
                          message:
                            lang?.installmentTotalMismatch ||
                            'Total must equal the remaining balance.'
                        });
                        return;
                      }
                      handleCreateInstallmentPlan(customInstallments);
                    }
                  }}
                  className="sm:w-40 justify-center"
                >
                  {lang?.createPlan || 'Create Plan'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
        RECURRING SCHEDULE MODAL
      ══════════════════════════════════════════════════════════════ */}
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-base font-black uppercase tracking-tighter">
                  {lang?.automatedRecurringBillingSetup ||
                    'Set Up Automated Recurring Billing'}
                </h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {lang?.automatedRecurringBillingSubtitle ||
                    'Unlike installments, recurring billing generates invoices automatically on an ongoing schedule — no manual setup needed each time.'}
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    {lang?.amountPerPeriod || 'Amount Per Period'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold pointer-events-none">
                      {estimate?.currency_snapshot === 'EUR' ? '€' : '$'}
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={scheduleAmountDollars}
                      onChange={(e) => setScheduleAmountDollars(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    {lang?.frequency || 'Frequency'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['monthly', 'biweekly', 'weekly', 'custom'] as const).map(
                      (freq) => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setScheduleFrequency(freq)}
                          className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${scheduleFrequency === freq ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                        >
                          {freq === 'monthly'
                            ? lang?.monthly || 'Monthly'
                            : freq === 'biweekly'
                              ? lang?.biweekly || 'Bi-weekly'
                              : freq === 'weekly'
                                ? lang?.weekly || 'Weekly'
                                : lang?.custom || 'Custom'}
                        </button>
                      )
                    )}
                  </div>
                  {scheduleFrequency === 'custom' && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={scheduleCustomDays}
                        onChange={(e) =>
                          setScheduleCustomDays(parseInt(e.target.value) || 30)
                        }
                        className="w-20 p-2 border border-gray-200 rounded-lg text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-xs text-gray-500">
                        {lang?.days || 'days'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    {lang?.startDate || 'Start Date'}
                  </label>
                  <input
                    type="date"
                    value={scheduleStartDate}
                    onChange={(e) => setScheduleStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    {lang?.invoiceMode || 'Invoice Mode'}
                  </label>
                  <div className="flex border border-gray-200 rounded-xl p-1 bg-gray-50/50 gap-1">
                    <button
                      type="button"
                      onClick={() => setScheduleMode('draft')}
                      className={`flex-1 py-2.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${scheduleMode === 'draft' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {lang?.draftMode || 'Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('auto')}
                      className={`flex-1 py-2.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${scheduleMode === 'auto' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {lang?.autoMode || 'Auto'}
                    </button>
                  </div>
                  {scheduleMode === 'draft' && (
                    <p className="text-[10px] text-gray-400 font-bold mt-2">
                      {lang?.draftModeHint ||
                        'A draft invoice will be created each period for you to review and send.'}
                    </p>
                  )}
                  {scheduleMode === 'auto' && (
                    <p className="text-[10px] text-amber-600 font-bold mt-2">
                      ⚠{' '}
                      {lang?.autoModeWarning ||
                        'Invoices will be automatically finalized and emailed to the client without review.'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    {lang?.numberOfInvoices || 'Number of Invoices'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={scheduleTotalInvoices}
                      onChange={(e) =>
                        setScheduleTotalInvoices(parseInt(e.target.value) || 1)
                      }
                      className="w-20 p-2 border border-gray-200 rounded-lg text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-500">
                      {lang?.invoices || 'invoices'}
                    </span>
                  </div>
                  {scheduleAmountDollars &&
                    scheduleTotalInvoices > 0 &&
                    (() => {
                      const totalCents =
                        Math.round(
                          (parseFloat(scheduleAmountDollars) || 0) * 100
                        ) * scheduleTotalInvoices;
                      const exceeds = totalCents > remainingForInstallments;
                      return (
                        <div
                          className={`mt-2 p-2 rounded-lg border text-xs font-bold ${exceeds ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                        >
                          {profile.country === 'FR'
                            ? `Total : ${fmt(totalCents)} / ${fmt(remainingForInstallments)}`
                            : `Total: ${fmt(totalCents)} / ${fmt(remainingForInstallments)}`}
                          {exceeds &&
                            ` ⚠ ${profile.country === 'FR' ? 'Dépasse le solde restant' : 'Exceeds remaining balance'}`}
                        </div>
                      );
                    })()}
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3 justify-end">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setShowScheduleModal(false)}
                  className="sm:w-32 justify-center"
                >
                  {lang?.cancel || 'Cancel'}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  loading={creatingSchedule}
                  loadingText="..."
                  onClick={handleCreateSchedule}
                  className="sm:w-48 justify-center"
                >
                  {lang?.activateSchedule || 'Activate Schedule'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
