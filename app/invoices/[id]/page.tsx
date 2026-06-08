'use client';

import React, {
  Fragment,
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';
import Button from '@/components/Button';
import LinkButton from '@/components/LinkButton';
import MaterialCombobox from '@/components/MaterialCombobox';
import { translations, t } from '@/lib/translations';
import {
  Menu,
  MenuButton,
  MenuItems,
  MenuItem,
  Transition
} from '@headlessui/react';
import {
  getTaxSummary,
  generateDescription,
  buildMaterialsMap,
  getAdditionalChargeAmountCents,
  getEffectiveItemCostCents,
  getEffectiveLaborRateCents,
  type AdditionalCharge
} from '@/lib/estimateCalculations';
import { formatMoney } from '@/lib/formatMoney';

// ═══════════════════════════════════════════════════════════════════════════════
// ICON COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

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
  ExternalLink: () => (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
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
  MoreVertical: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  ),
  Check: () => (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  CreditNote: () => (
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
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  ),
  Trash: () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  Plus: () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
};

// ═══════════════════════════════════════════════════════════════════════════════
// EDITABLE LINE ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface EditableLineItemProps {
  item: {
    description: string;
    quantity: number;
    unit_price_cents: number;
    amount_cents: number;
    tax_rate: number;
  };
  index: number;
  isLocked: boolean;
  currency: string;
  country: string;
  lang: any;
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

const EditableLineItem = ({
  item,
  index,
  isLocked,
  currency,
  country,
  lang,
  onUpdate,
  onRemove,
  canRemove
}: EditableLineItemProps) => {
  const fmt = (cents: number) => formatMoney(cents, currency, country);

  if (isLocked) {
    return (
      <div className="flex justify-between items-start gap-4 py-3 border-b border-gray-100 last:border-b-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
            {item.description}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {item.quantity} × {fmt(item.unit_price_cents)}
            {item.tax_rate > 0 && (
              <span className="text-gray-400 ml-2">
                ({lang.tax} {item.tax_rate}%)
              </span>
            )}
          </p>
        </div>
        <span className="font-mono font-bold text-sm text-gray-900 whitespace-nowrap tabular-nums mt-0.5">
          {fmt(item.amount_cents)}
        </span>
      </div>
    );
  }

  return (
    <div className="py-5 border-b border-gray-100 last:border-b-0 space-y-4 relative">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            {lang.description}
          </label>
          <textarea
            value={item.description}
            onChange={(e) => onUpdate(index, 'description', e.target.value)}
            maxLength={5000}
            rows={2}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 resize-y whitespace-pre-wrap shadow-sm"
            placeholder={lang.descriptionPlaceholder}
          />
        </div>

        {canRemove && (
          <div className="pt-[22px]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onRemove(index)}
              title={lang.removeItem}
              className="!h-[46px] !w-[46px] !p-0 !text-gray-300 hover:!text-red-600 hover:!bg-red-50"
            >
              <Icons.Trash />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            {lang.quantity}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.quantity === 0 ? '' : item.quantity}
            placeholder="1"
            onChange={(e) =>
              onUpdate(
                index,
                'quantity',
                e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
              )
            }
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 tabular-nums shadow-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            {lang.unitPrice}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={
              item.unit_price_cents === 0 ? '' : item.unit_price_cents / 100
            }
            placeholder="0.00"
            onChange={(e) =>
              onUpdate(
                index,
                'unit_price_cents',
                e.target.value === ''
                  ? 0
                  : Math.round((parseFloat(e.target.value) || 0) * 100)
              )
            }
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 tabular-nums shadow-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            {lang.tax} %
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={item.tax_rate === 0 ? '' : item.tax_rate}
            placeholder="0"
            onChange={(e) =>
              onUpdate(
                index,
                'tax_rate',
                e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
              )
            }
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 tabular-nums shadow-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            {lang.amountHeader}
          </label>
          <div className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono font-bold text-gray-900 tabular-nums shadow-sm flex items-center h-[42px]">
            {fmt(item.amount_cents)}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function InvoiceView() {
  const { id } = useParams();
  const router = useRouter();

  // ─────────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────────

  const [invoice, setInvoice] = useState<any>();
  const [estimate, setEstimate] = useState<any>();
  const [profile, setProfile] = useState<any>();
  const [materials, setMaterials] = useState<any[]>([]);
  const [lang, setLang] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [finalizedNetOtherInvoicesCents, setFinalizedNetOtherInvoicesCents] =
    useState(0);

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm' | 'danger';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [markingPaid, setMarkingPaid] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);

  const [draftData, setDraftData] = useState({
    invoiceDate: '',
    dueDate: '',
    poNumber: '',
    notes: ''
  });

  const [sections, setSections] = useState<any[]>([]);
  const [additionalCharges, setAdditionalCharges] = useState<
    AdditionalCharge[]
  >([]);
  const [lineItems, setLineItems] = useState<any[]>([]);

  const [showDetails, setShowDetails] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchData() {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: inv } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', id)
          .single();

        if (!inv) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('country')
            .eq('id', user.id)
            .single();

          const fallbackLang =
            prof?.country === 'FR' ? translations.FR : translations.US;
          setLang(fallbackLang);
          setLoading(false);
          return;
        }

        const [profRes, matsRes, cnsRes, estimateRes, estimateInvoicesRes] =
          await Promise.all([
            supabase
              .from('profiles')
              .select('*')
              .eq('id', inv.user_id)
              .single(),
            supabase.from('materials').select('*').eq('user_id', inv.user_id),
            supabase.from('credit_notes').select('*').eq('invoice_id', id),

            inv.estimate_id
              ? supabase
                  .from('estimates')
                  .select('*')
                  .eq('id', inv.estimate_id)
                  .single()
              : Promise.resolve({ data: null, error: null }),

            inv.estimate_id
              ? supabase
                  .from('invoices')
                  .select(
                    'id, total_amount_cents, credited_amount_cents, is_locked, is_cancelled'
                  )
                  .eq('estimate_id', inv.estimate_id)
                  .eq('user_id', inv.user_id)
              : Promise.resolve({ data: [], error: null })
          ]);
        const profileData = profRes.data;
        const country = inv.country_snapshot || profileData?.country || 'US';
        const pageLang = country === 'FR' ? translations.FR : translations.US;

        setLang(pageLang);
        setInvoice(inv);
        setEstimate(estimateRes.data || null);

        setProfile({
          ...profileData,
          business_name:
            inv.business_name_snapshot || profileData?.business_name,
          country: inv.country_snapshot || profileData?.country,
          currency: inv.currency_snapshot || profileData?.currency,
          tax_rate: inv.tax_rate_snapshot ?? profileData?.default_tax_rate ?? 0
        });

        setMaterials(matsRes.data || []);
        setCreditNotes(cnsRes.data || []);

        const finalizedOtherInvoices = (estimateInvoicesRes.data || []).filter(
          (other: any) =>
            other.id !== inv.id && other.is_locked && !other.is_cancelled
        );

        // Credit notes are linked to invoices (not estimates) and are already
        // reflected in each invoice's credited_amount_cents, so net per-invoice.
        const otherNetBilledCents = finalizedOtherInvoices.reduce(
          (sum: number, other: any) =>
            sum +
            Math.max(
              0,
              (other.total_amount_cents || 0) -
                (other.credited_amount_cents || 0)
            ),
          0
        );

        setFinalizedNetOtherInvoicesCents(Math.max(0, otherNetBilledCents));

        setDraftData({
          invoiceDate: inv.invoice_date
            ? inv.invoice_date.slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          dueDate: inv.due_date ? inv.due_date.slice(0, 10) : '',
          poNumber: inv.po_number || '',
          notes: inv.notes || ''
        });

        setShowDetails(inv.show_details_snapshot === true);

        const sourceSections =
          inv.sections && inv.sections.length > 0
            ? inv.sections
            : estimateRes.data?.sections || [];

        const sourceAdditionalCharges =
          inv.additional_charges && inv.additional_charges.length > 0
            ? inv.additional_charges
            : estimateRes.data?.additional_charges || [];

        if (sourceSections.length > 0) {
          setSections(sourceSections);
          setAdditionalCharges(sourceAdditionalCharges);
          setLineItems([]);
        } else if (
          inv.line_items &&
          Array.isArray(inv.line_items) &&
          inv.line_items.length > 0
        ) {
          setLineItems(inv.line_items);
          setSections([]);
          setAdditionalCharges([]);
        } else {
          const taxRate =
            inv.tax_rate_snapshot ?? profileData?.default_tax_rate ?? 0;
          const subtotalCents = Math.round(
            inv.total_amount_cents / (1 + taxRate / 100)
          );

          setLineItems([
            {
              description:
                inv.invoice_description || pageLang.invoiceItemFallback,
              quantity: 1,
              unit_price_cents: subtotalCents,
              amount_cents: subtotalCents,
              tax_rate: taxRate
            }
          ]);
          setSections([]);
          setAdditionalCharges([]);
        }
      } catch (error) {
        console.error('Error fetching invoice data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, router]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MEMOIZED COMPUTATIONS
  // ─────────────────────────────────────────────────────────────────────────────

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

  const fmt = useCallback(
    (cents: number) => formatMoney(cents, profile?.currency, profile?.country),
    [profile?.currency, profile?.country]
  );

  const isShowingDetails = invoice?.is_locked
    ? invoice?.show_details_snapshot === true
    : showDetails;

  const isLineItemInvoice = sections.length === 0;

  const invoiceContext = useMemo(
    () => ({
      margin_mode_snapshot: invoice?.margin_mode_snapshot,
      global_margin_snapshot: invoice?.global_margin_snapshot,
      tax_rate_snapshot: invoice?.tax_rate_snapshot
    }),
    [
      invoice?.margin_mode_snapshot,
      invoice?.global_margin_snapshot,
      invoice?.tax_rate_snapshot
    ]
  );

  const getSectionDisplayDescription = useCallback(
    (sec: any) =>
      sec.description ||
      generateDescription(invoiceContext, sec, descTranslations, materialsById),
    [invoiceContext, descTranslations, materialsById]
  );

  // Always apply margins so amounts match the approved estimate.
  // The COST input shows the raw pre-margin cost; this returns the effective
  // (post-margin) price the client pays.
  const getInvoiceItemUnitCostCents = useCallback(
    (sec: any, item: any) =>
      getEffectiveItemCostCents(invoiceContext, sec, item, materialsById),
    [invoiceContext, materialsById]
  );

  const getInvoiceLaborRateCents = useCallback(
    (sec: any) => getEffectiveLaborRateCents(invoiceContext, sec),
    [invoiceContext]
  );

  const baseTotals = useMemo(() => {
    if (isLineItemInvoice) {
      if (!lineItems.length) {
        return { subtotalCents: 0, taxGroups: {}, totalCents: 0 };
      }

      let subtotalCents = 0;
      const taxGroups: Record<number, number> = {};

      lineItems.forEach((item) => {
        const itemSubtotal = Math.round(
          (item.quantity || 0) * (item.unit_price_cents || 0)
        );
        subtotalCents += itemSubtotal;

        const taxAmount = Math.round(
          itemSubtotal * ((item.tax_rate || 0) / 100)
        );

        if ((item.tax_rate || 0) > 0) {
          taxGroups[item.tax_rate] =
            (taxGroups[item.tax_rate] || 0) + taxAmount;
        }
      });

      const totalTax = Object.values(taxGroups).reduce(
        (sum, amt) => sum + amt,
        0
      );

      return {
        subtotalCents,
        taxGroups,
        totalCents: subtotalCents + totalTax
      };
    }

    if (!sections.length) {
      return { subtotalCents: 0, taxGroups: {}, totalCents: 0 };
    }

    const result = getTaxSummary(
      invoiceContext,
      sections,
      profile?.tax_rate || 0,
      materialsById,
      additionalCharges
    );

    const taxTotalCents = Object.values(result.taxGroups).reduce(
      (sum: number, amt: any) => sum + Number(amt || 0),
      0
    );

    return {
      subtotalCents: Math.round(result.subtotalCents),
      taxGroups: Object.fromEntries(
        Object.entries(result.taxGroups).map(([k, v]) => [
          k,
          Math.round(Number(v))
        ])
      ),
      totalCents: Math.round(result.subtotalCents + taxTotalCents)
    };
  }, [
    isLineItemInvoice,
    lineItems,
    sections,
    additionalCharges,
    invoiceContext,
    profile?.tax_rate,
    materialsById
  ]);

  const billedTotals = useMemo(() => {
    // Deposit/balance: always use stored amounts.
    // Recalculating from sections introduces rounding drift — e.g.
    // Math.round(14585 * 0.50) = 7293, but 14585 − 7293 = 7292 (off by 1).
    // The route sets these correctly at creation time, and amounts are
    // read-only on deposit/balance drafts, so stored values are always correct.
    if (
      invoice?.invoice_type === 'deposit' ||
      invoice?.invoice_type === 'balance'
    ) {
      const storedTotal = invoice.total_amount_cents || 0;
      const storedSubtotal =
        invoice.subtotal_cents || invoice.subtotal_amount_cents || 0;
      const storedTax = invoice.tax_amount_cents || 0;
      const taxRate = invoice.tax_rate_snapshot ?? profile?.tax_rate ?? 0;

      const taxGroups: Record<number, number> = {};
      if (storedTax > 0) {
        taxGroups[taxRate] = storedTax;
      }

      return {
        subtotalCents: storedSubtotal,
        taxGroups,
        totalCents: storedTotal
      };
    }

    // Full invoice draft: recalculate live from sections so edits reflect immediately.
    return {
      subtotalCents: baseTotals.subtotalCents,
      taxGroups: { ...baseTotals.taxGroups },
      totalCents: baseTotals.totalCents
    };
  }, [
    invoice?.invoice_type,
    invoice?.total_amount_cents,
    invoice?.subtotal_cents,
    invoice?.subtotal_amount_cents,
    invoice?.tax_amount_cents,
    invoice?.tax_rate_snapshot,
    profile?.tax_rate,
    baseTotals
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTO-SAVE EFFECT
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isDirty || !invoice || invoice.is_locked) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps

    const timer = setTimeout(async () => {
      setSavingEdit(true);

      const updatePayload: any = {
        invoice_date: draftData.invoiceDate || null,
        due_date: draftData.dueDate || null,
        po_number: draftData.poNumber.trim() || null,
        notes: draftData.notes.trim() || null,
        show_details_snapshot: showDetails,
        subtotal_cents: billedTotals.subtotalCents,
        // keep legacy column in parity so dashboard CSV / older reads stay correct
        subtotal_amount_cents: billedTotals.subtotalCents,
        tax_amount_cents: billedTotals.totalCents - billedTotals.subtotalCents,
        total_amount_cents: billedTotals.totalCents
      };

      if (isLineItemInvoice) {
        updatePayload.line_items = lineItems;
      } else {
        updatePayload.sections = sections;
        updatePayload.additional_charges = additionalCharges;
      }

      const { error } = await supabase
        .from('invoices')
        .update(updatePayload)
        .eq('id', id);

      setSavingEdit(false);

      if (!error) {
        setInvoice((prev: any) =>
          prev ? { ...prev, ...updatePayload } : prev
        );
        setIsDirty(false);
      } else {
        console.error('Auto-save error:', error);
        setDialog({
          type: 'alert',
          message: error.message
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    isDirty,
    draftData.invoiceDate,
    draftData.dueDate,
    draftData.poNumber,
    draftData.notes,
    showDetails,
    lineItems,
    sections,
    additionalCharges,
    isLineItemInvoice,
    billedTotals.subtotalCents,
    billedTotals.totalCents,
    id,
    invoice?.is_locked
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EDIT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDraftChange = (field: string, value: string) => {
    setDraftData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleToggleDetails = () => {
    setShowDetails((prev) => !prev);
    setIsDirty(true);
  };

  const handleLineItemUpdate = (index: number, field: string, value: any) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'quantity' || field === 'unit_price_cents') {
        const qty = field === 'quantity' ? value : updated[index].quantity;
        const price =
          field === 'unit_price_cents'
            ? value
            : updated[index].unit_price_cents;

        updated[index].amount_cents = Math.round(qty * price);
      }

      return updated;
    });

    setIsDirty(true);
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        description: '',
        quantity: 1,
        unit_price_cents: 0,
        amount_cents: 0,
        tax_rate: profile?.tax_rate || 0
      }
    ]);

    setIsDirty(true);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) return;

    setLineItems((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleUpdateSectionTitle = (secIdx: number, value: string) => {
    setSections((prev) => {
      const next = [...prev];
      next[secIdx] = {
        ...next[secIdx],
        title: value
      };
      return next;
    });

    setIsDirty(true);
  };

  const handleUpdateSectionDesc = (secIdx: number, value: string) => {
    setSections((prev) => {
      const next = [...prev];
      next[secIdx] = {
        ...next[secIdx],
        description: value
      };
      return next;
    });

    setIsDirty(true);
  };

  const handleUpdateSectionLabor = (
    secIdx: number,
    field: string,
    value: number
  ) => {
    setSections((prev) => {
      const next = [...prev];
      next[secIdx] = {
        ...next[secIdx],
        [field]: value
      };
      return next;
    });

    setIsDirty(true);
  };

  const handleUpdateSectionItem = (
    secIdx: number,
    itemIdx: number,
    field: string,
    value: any
  ) => {
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[secIdx] };
      const items = [...(section.items || [])];
      const item = { ...items[itemIdx] };

      if (field === 'materialId') item.materialId = value;
      if (field === 'description') item.name = value;
      if (field === 'quantity') item.qty = value;

      if (field === 'unit_price_cents') {
        item.cost_per_unit_cents = value;
        item.costPerUnitCents = value;
      }

      if (field === 'tax_rate') item.taxRate = value;

      items[itemIdx] = item;
      section.items = items;
      next[secIdx] = section;

      return next;
    });

    setIsDirty(true);
  };

  const handleAddSectionItem = (secIdx: number) => {
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[secIdx] };
      const items = [...(section.items || [])];

      items.push({
        name: '',
        qty: 1,
        cost_per_unit_cents: 0,
        costPerUnitCents: 0,
        taxRate: profile?.tax_rate || 0,
        materialId: null
      });

      section.items = items;
      next[secIdx] = section;

      return next;
    });

    setIsDirty(true);
  };

  const handleRemoveSectionItem = (secIdx: number, itemIdx: number) => {
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[secIdx] };
      const items = [...(section.items || [])];

      items.splice(itemIdx, 1);

      section.items = items;
      next[secIdx] = section;

      return next;
    });

    setIsDirty(true);
  };
  const handleScaleToRemaining = () => {
    const remaining = Math.max(
      0,
      (estimate?.total_amount_cents || 0) - finalizedNetOtherInvoicesCents
    );

    if (!remaining || !baseTotals.totalCents) return;

    // Use the stored estimate total (ground truth) not the recomputed
    // baseTotals which can drift by a few cents due to rounding across
    // multiple items and tax groups.
    const base = estimate?.total_amount_cents || baseTotals.totalCents;
    const multiplier = remaining / base;

    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        laborHours: sec.laborHours
          ? Math.round(sec.laborHours * multiplier * 100) / 100
          : 0,
        items: (sec.items || []).map((item: any) => ({
          ...item,
          qty: item.qty ? Math.round(item.qty * multiplier * 100) / 100 : 0
        }))
      }))
    );

    // Flat additional charges need explicit scaling.
    // Percentage charges auto-recalculate from the scaled section totals
    // so they don't need to be touched.
    setAdditionalCharges((prev) =>
      prev.map((charge) => {
        if (charge.isPercentage) return charge;
        return {
          ...charge,
          costPerUnitCents: Math.round(
            (charge.costPerUnitCents || 0) * multiplier
          )
        };
      })
    );

    setIsDirty(true);
  };
  const handleUpdateSectionItemMaterial = (
    secIdx: number,
    itemIdx: number,
    mat: any
  ) => {
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[secIdx] };
      const items = [...(section.items || [])];
      items[itemIdx] = {
        ...items[itemIdx],
        materialId: mat.id,
        name: mat.name,
        cost_per_unit_cents: mat.cost_per_unit_cents || 0,
        costPerUnitCents: mat.cost_per_unit_cents || 0,
        unit: mat.unit || 'ea'
      };
      section.items = items;
      next[secIdx] = section;
      return next;
    });
    setIsDirty(true);
  };

  const handleCreateMaterialOnTheFly = async (
    secIdx: number,
    itemIdx: number,
    name: string
  ) => {
    const { data: newMat } = await supabase
      .from('materials')
      .insert([
        {
          user_id: invoice.user_id,
          name,
          cost_per_unit_cents: 0,
          unit: 'ea'
        }
      ])
      .select()
      .single();

    if (newMat) {
      setMaterials((prev) => [...prev, newMat]);
      handleUpdateSectionItemMaterial(secIdx, itemIdx, newMat);
    }
  };
  const handleUpdateCharge = (idx: number, field: string, value: any) => {
    setAdditionalCharges((prev) => {
      const next = [...prev];
      const charge = { ...next[idx] };

      if (field === 'description') charge.name = value;
      if (field === 'quantity') charge.qty = value;

      if (field === 'unit_price_cents') {
        charge.costPerUnitCents = value;
      }

      if (field === 'tax_rate') charge.taxRate = value;

      next[idx] = charge;
      return next;
    });

    setIsDirty(true);
  };

  const handleRemoveCharge = (idx: number) => {
    setAdditionalCharges((prev) => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTION HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const getFollowUpState = useCallback(() => {
    if (
      !invoice?.is_locked ||
      invoice?.is_cancelled ||
      invoice?.payment_status === 'paid'
    ) {
      return { mode: 'hidden' as const };
    }

    if (!invoice?.last_email_sent_at) {
      return { mode: 'hidden' as const };
    }

    if (invoice?.last_followup_sent_at) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const lastSent = new Date(invoice.last_followup_sent_at).getTime();
      const cooldownEnds = new Date(lastSent + sevenDaysMs);

      if (cooldownEnds.getTime() > Date.now()) {
        return { mode: 'cooldown' as const, cooldownUntil: cooldownEnds };
      }
    }

    return { mode: 'send' as const };
  }, [invoice]);

  const handleSendInvoice = async () => {
    if (!invoice?.client_email) return;

    setSending(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    try {
      const dueFormatted = invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString(
            profile.country === 'FR' ? 'fr-FR' : 'en-US',
            { year: 'numeric', month: 'short', day: 'numeric' }
          )
        : null;

      const res = await fetch('/api/send-invoice-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          clientEmail: invoice.client_email,
          clientName: invoice.client_name,
          invoiceUrl: window.location.href,
          businessName: profile.business_name,
          ownerEmail: user?.email,
          logoUrl: profile.logo_url,
          country: profile.country,
          invoiceNumber: invoice.invoice_number,
          grandTotal: (billedTotals.totalCents / 100).toFixed(2),
          currency: invoice.currency_snapshot,
          dueDate: dueFormatted,
          bankWireInstructions: profile.bank_wire_instructions,
          paymentLinkUrl: profile.payment_link_url
        })
      });

      const data = await res.json();

      if (res.ok) {
        const nowIso = new Date().toISOString();

        setInvoice((prev: any) =>
          prev ? { ...prev, last_email_sent_at: nowIso } : prev
        );

        setDialog({
          type: 'alert',
          message: t(lang.invoiceSentSuccess, { target: invoice.client_email })
        });
      } else {
        setDialog({
          type: 'alert',
          message: data.error || lang.connectionError
        });
      }
    } catch {
      setDialog({ type: 'alert', message: lang.connectionError });
    } finally {
      setSending(false);
    }
  };

  const handleSendFollowUp = async () => {
    if (!invoice?.client_email) return;

    setSending(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    try {
      const dueFormatted = invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString(
            profile.country === 'FR' ? 'fr-FR' : 'en-US',
            { year: 'numeric', month: 'short', day: 'numeric' }
          )
        : null;

      const res = await fetch('/api/send-invoice-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          clientEmail: invoice.client_email,
          clientName: invoice.client_name,
          invoiceUrl: window.location.href,
          businessName: profile.business_name,
          ownerEmail: user?.email,
          logoUrl: profile.logo_url,
          country: profile.country,
          invoiceNumber: invoice.invoice_number,
          grandTotal: (billedTotals.totalCents / 100).toFixed(2),
          currency: invoice.currency_snapshot,
          dueDate: dueFormatted,
          bankWireInstructions: profile.bank_wire_instructions,
          paymentLinkUrl: profile.payment_link_url
        })
      });

      const data = await res.json();

      if (res.ok) {
        const nowIso = new Date().toISOString();

        setInvoice((prev: any) =>
          prev ? { ...prev, last_followup_sent_at: nowIso } : prev
        );

        setDialog({
          type: 'alert',
          message: t(lang.followUpSentSuccess, { target: invoice.client_email })
        });
      } else {
        setDialog({
          type: 'alert',
          message: data.error || lang.connectionError
        });
      }
    } catch {
      setDialog({ type: 'alert', message: lang.connectionError });
    } finally {
      setSending(false);
    }
  };

  const finalizeInvoiceNow = async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/finalize-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ invoiceId: id })
    });

    const data = await res.json();

    if (!res.ok) {
      setDialog({ type: 'alert', message: data.error || lang.connectionError });
      return;
    }

    // Replaces the DRAFT-xxxx placeholder with the real number in the UI.
    setInvoice((prev: any) => (prev ? { ...prev, ...data.invoice } : prev));
  };

  const handleFinalize = async () => {
    if (isDirty || savingEdit) {
      setDialog({
        type: 'alert',
        message: lang.savingPleaseWait
      });
      return;
    }

    const approvedEstimateTotalCents =
      estimate?.total_amount_cents || invoice.total_amount_cents || 0;

    const remainingAllowedCents = Math.max(
      0,
      approvedEstimateTotalCents - finalizedNetOtherInvoicesCents
    );

    const exceedsByCents = billedTotals.totalCents - remainingAllowedCents;

    if (estimate && exceedsByCents > 0) {
      setDialog({
        type: 'confirm',
        title: lang.approvedEstimateExceededTitle,
        message: t(lang.approvedEstimateExceededMessage, {
          amount: fmt(exceedsByCents)
        }),
        onConfirm: async () => {
          setDialog(null);
          await finalizeInvoiceNow();
        }
      });

      return;
    }

    setDialog({
      type: 'confirm',
      title: lang.finalizeInvoice,
      message: lang.finalizeInvoiceConfirm,
      onConfirm: async () => {
        setDialog(null);
        await finalizeInvoiceNow();
      }
    });
  };

  const handleMarkPaid = async () => {
    setMarkingPaid(true);

    const { error } = await supabase
      .from('invoices')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        paid_amount_cents: billedTotals.totalCents,
        payment_method: paymentMethod.trim() || null
      })
      .eq('id', id);

    setMarkingPaid(false);

    if (error) {
      setDialog({ type: 'alert', message: error.message });
      return;
    }

    setInvoice((prev: any) =>
      prev
        ? {
            ...prev,
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            paid_amount_cents: billedTotals.totalCents,
            payment_method: paymentMethod.trim() || null
          }
        : prev
    );

    setMarkPaidModalOpen(false);
    setPaymentMethod('');
  };

  const handleDeleteDraft = async () => {
    setDeletingDraft(true);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) return;

      const res = await fetch('/api/delete-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ invoiceId: invoice.id })
      });

      const data = await res.json();

      if (res.ok) {
        if (invoice.estimate_id) {
          router.push(`/estimates/${invoice.estimate_id}?tab=billing`);
        } else {
          router.push('/invoices');
        }
      } else {
        setDialog({
          type: 'alert',
          message: data.error || lang.connectionError
        });
      }
    } catch {
      setDialog({ type: 'alert', message: lang.connectionError });
    } finally {
      setDeletingDraft(false);
    }
  };

  const handleDownloadPDF = async () => {
    setLoading(true);

    try {
      const { pdf } = await import('@react-pdf/renderer');
      const InvoicePDF = (await import('./InvoicePDF')).default;

      const preparedSections = isLineItemInvoice
        ? []
        : sections.map((sec: any) => ({
            title: sec.title || lang.professionalServices,
            description: getSectionDisplayDescription(sec),
            total: (() => {
              let sectionSubtotalCents = 0;

              if ((sec.laborHours || 0) > 0) {
                sectionSubtotalCents += Math.round(
                  (sec.laborHours || 0) * getInvoiceLaborRateCents(sec)
                );
              }

              (sec.items || []).forEach((item: any) => {
                sectionSubtotalCents += Math.round(
                  (item.qty || 0) * getInvoiceItemUnitCostCents(sec, item)
                );
              });

              return sectionSubtotalCents / 100;
            })(),
            hasDetails: isShowingDetails,
            laborHours: sec.laborHours || 0,
            laborType: sec.laborType,
            laborRate: getInvoiceLaborRateCents(sec) / 100,
            laborTaxRate: sec.laborTaxRate ?? profile.tax_rate,
            items: (sec.items || []).map((item: any) => {
              const m = materialsById.get(item.materialId);
              return {
                name: item.name || m?.name || lang.itemLabel,
                qty: item.qty || 0,
                unit:
                  lang?.units?.[item.unit || m?.unit || ''] ||
                  item.unit ||
                  m?.unit ||
                  '',
                cost: getInvoiceItemUnitCostCents(sec, item) / 100,
                taxRate: item.taxRate ?? profile.tax_rate
              };
            })
          }));

      const preparedAdditionalCharges = additionalCharges.map(
        (charge: AdditionalCharge) => ({
          name: charge.name || lang.additionalCharges,
          isPercentage: !!charge.isPercentage,
          percentageRate: charge.percentageRate || 0,
          qty: charge.qty || 1,
          unit:
            (charge.unit && lang?.units?.[charge.unit]) || charge.unit || 'ea',
          costPerUnitCents: charge.costPerUnitCents || 0,
          taxRate: charge.taxRate ?? profile.tax_rate,
          amountCents: getAdditionalChargeAmountCents(
            invoiceContext,
            charge,
            sections || [],
            materialsById
          ),
          basisLabel: lang.basisProject
        })
      );

      const blob = await pdf(
        <InvoicePDF
          invoice={invoice}
          profile={profile}
          lang={lang}
          subtotal={billedTotals.subtotalCents / 100}
          taxGroups={Object.entries(billedTotals.taxGroups) as any}
          grandTotal={billedTotals.totalCents / 100}
          sections={preparedSections}
          lineItems={isLineItemInvoice ? lineItems : undefined}
          additionalCharges={preparedAdditionalCharges}
          isDraft={!invoice.is_locked}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `${lang.invoiceLabel}-${invoice.invoice_number}${
        !invoice.is_locked ? `-${lang.draft}` : ''
      }.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch {
      setDialog({
        type: 'alert',
        message: lang.pdfError
      });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER COMPUTATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading || !lang) {
    return <LoadingDots />;
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {lang.notFound}
          </h2>
          <LinkButton
            href="/invoices"
            variant="primary"
            size="md"
            className="mt-4"
          >
            {lang.invoices}
          </LinkButton>
        </div>
      </div>
    );
  }

  const isOverdue =
    invoice?.is_locked &&
    !invoice?.is_cancelled &&
    invoice?.payment_status === 'unpaid' &&
    invoice?.due_date &&
    new Date(invoice.due_date) < new Date();

  const isDepositInvoice = invoice?.invoice_type === 'deposit';
  const isBalanceInvoice = invoice?.invoice_type === 'balance';
  // Amounts/structure only editable on full invoice drafts.
  // Deposit/balance are locked to the approved estimate %. Only titles/descriptions stay editable.
  const isStructurallyEditable =
    !invoice.is_locked && invoice.invoice_type === 'full';

  const rawTerms = invoice.payment_terms_snapshot || '30_days';
  const isUponReceipt = rawTerms === 'upon_receipt';
  const displayPaymentDays = isUponReceipt
    ? 0
    : parseInt(rawTerms.replace('_days', '')) || 30;

  const approvedEstimateRef =
    estimate?.custom_id || estimate?.id?.slice(0, 8) || '';
  const docTitleLabel = isDepositInvoice
    ? lang.depositInvoiceTitle
    : isBalanceInvoice
      ? lang.balanceInvoiceTitle
      : lang.invoiceLabel;

  const followUpState = getFollowUpState();

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER UI
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900 font-sans print:bg-white flex flex-col">
      <main className="flex-1 p-4 sm:p-8 print:p-0">
        <div className="max-w-4xl mx-auto print:max-w-none print:w-full">
          {/* ACTION TOOLBAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 print:hidden">
            <div className="flex items-center gap-3">
              <LinkButton href="/invoices" variant="secondary" size="sm">
                <Icons.ArrowLeft />
                <span className="ml-1.5">{lang.invoices}</span>
              </LinkButton>

              {invoice.estimate_id && (
                <LinkButton
                  href={`/estimates/${invoice.estimate_id}?tab=billing`}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-700"
                >
                  <span>{lang.relatedEstimate}</span>
                  <Icons.ExternalLink />
                </LinkButton>
              )}

              {!invoice.is_locked && !isLineItemInvoice && (
                <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm ml-2">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    {lang.internalDetails}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleDetails}
                    className={`!p-0 !h-5 !w-9 !rounded-full ${
                      showDetails ? '!bg-blue-600' : '!bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                        showDetails ? 'translate-x-2.5' : '-translate-x-2.5'
                      }`}
                    />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              {!invoice.is_locked ? (
                <>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleDownloadPDF}
                    loading={loading}
                    icon={<Icons.Download />}
                  >
                    {lang.previewPdf}
                  </Button>

                  <Button
                    variant="success"
                    size="md"
                    onClick={handleFinalize}
                    disabled={isDirty || savingEdit}
                  >
                    {lang.finalizeInvoice}
                  </Button>

                  <Menu as="div" className="relative shrink-0">
                    <MenuButton className="inline-flex items-center justify-center h-[38px] w-[38px] rounded-xl bg-white text-gray-600 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer">
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
                      <MenuItems className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden focus:outline-none">
                        <MenuItem>
                          {() => (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              fullWidth
                              onClick={() =>
                                setDialog({
                                  type: 'danger',
                                  message: lang.deleteInvoiceDraftConfirm,
                                  onConfirm: handleDeleteDraft
                                })
                              }
                              disabled={deletingDraft}
                              className="!justify-start !text-red-600 hover:!bg-red-50 hover:!text-red-700"
                              icon={<Icons.Trash />}
                            >
                              {deletingDraft ? '...' : lang.deleteInvoiceDraft}
                            </Button>
                          )}
                        </MenuItem>
                      </MenuItems>
                    </Transition>
                  </Menu>
                </>
              ) : (
                <>
                  {invoice.client_email &&
                    !invoice.is_cancelled &&
                    invoice.payment_status !== 'paid' && (
                      <>
                        {followUpState.mode === 'hidden' && (
                          <Button
                            variant="dark"
                            size="md"
                            loading={sending}
                            loadingText={lang.sending}
                            onClick={handleSendInvoice}
                            icon={<Icons.Send />}
                          >
                            {lang.sendInvoice}
                          </Button>
                        )}

                        {followUpState.mode === 'send' && (
                          <Button
                            variant="dark"
                            size="md"
                            loading={sending}
                            loadingText={lang.followUpSending}
                            onClick={handleSendFollowUp}
                            icon={<Icons.Send />}
                          >
                            {lang.followUpBtn}
                          </Button>
                        )}

                        {followUpState.mode === 'cooldown' && (
                          <Button
                            variant="secondary"
                            size="md"
                            disabled
                            title={t(lang.followUpCooldown, {
                              date: followUpState.cooldownUntil!.toLocaleDateString(
                                profile.country === 'FR' ? 'fr-FR' : 'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                }
                              )
                            })}
                            className="opacity-60"
                          >
                            {lang.followUpBtn}
                          </Button>
                        )}
                      </>
                    )}

                  <Button
                    variant="primary"
                    size="md"
                    loading={loading}
                    onClick={handleDownloadPDF}
                    icon={<Icons.Download />}
                  >
                    {lang.downloadInvoice}
                  </Button>

                  {!invoice.is_cancelled && (
                    <Menu as="div" className="relative shrink-0">
                      <MenuButton className="inline-flex items-center justify-center h-[38px] w-[38px] rounded-xl bg-white text-gray-600 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer">
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
                          {invoice.payment_status !== 'paid' && (
                            <div className="py-1">
                              <MenuItem>
                                {() => (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    fullWidth
                                    onClick={() => setMarkPaidModalOpen(true)}
                                    className="!justify-start !text-green-600 hover:!bg-green-50 hover:!text-green-700"
                                    icon={<Icons.Check />}
                                  >
                                    {lang.markAsPaid}
                                  </Button>
                                )}
                              </MenuItem>
                            </div>
                          )}

                          <div className="py-1">
                            <MenuItem>
                              {() => (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  fullWidth
                                  onClick={() =>
                                    router.push(`/invoices/${id}/credit-note`)
                                  }
                                  className="!justify-start"
                                  icon={<Icons.CreditNote />}
                                >
                                  {lang.createCreditNote}
                                </Button>
                              )}
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </Transition>
                    </Menu>
                  )}
                </>
              )}
            </div>
          </div>

          {/* STATUS BANNER */}
          <div
            className={`mb-6 px-5 py-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden ${
              invoice.is_cancelled
                ? 'bg-gray-50 border-gray-200'
                : invoice.payment_status === 'paid'
                  ? 'bg-green-50/50 border-green-200'
                  : isOverdue
                    ? 'bg-red-50/50 border-red-200'
                    : !invoice.is_locked
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {!invoice.is_locked && (
                <>
                  <span className="text-amber-600 text-lg">✏</span>
                  <span className="text-amber-700 font-semibold text-sm">
                    {lang.invoiceDraft}
                  </span>
                  <span
                    className={`text-xs ml-2 font-medium transition-colors duration-300 ${
                      savingEdit
                        ? 'text-amber-500'
                        : isDirty
                          ? 'text-amber-400'
                          : 'text-emerald-500'
                    }`}
                  >
                    {savingEdit
                      ? lang.saving
                      : isDirty
                        ? lang.waitingToSave
                        : lang.saved}
                  </span>

                  {estimate &&
                    (() => {
                      const remaining = Math.max(
                        0,
                        (estimate.total_amount_cents || 0) -
                          finalizedNetOtherInvoicesCents
                      );
                      const current = billedTotals.totalCents;
                      const over = current - remaining;
                      const alreadyMatches = Math.abs(current - remaining) <= 1;
                      const showAdjustBtn =
                        isStructurallyEditable &&
                        !isLineItemInvoice &&
                        !alreadyMatches &&
                        remaining > 0 &&
                        baseTotals.totalCents > 0 &&
                        finalizedNetOtherInvoicesCents > 0;

                      return (
                        <span className="ml-3 pl-3 border-l border-amber-200 text-xs text-amber-600 font-medium flex items-center gap-2">
                          {over > 0 ? (
                            <span className="text-red-500 font-bold">
                              ⚠ {fmt(over)}{' '}
                              {lang.overBudget || 'over remaining'}
                            </span>
                          ) : (
                            <>
                              {lang.remainingOnEstimate ||
                                'Remaining on estimate'}
                              :{' '}
                              <span className="font-bold text-amber-800">
                                {fmt(remaining)}
                              </span>
                              {current > 0 && (
                                <span className="text-amber-500">
                                  ({lang.thisInvoice || 'this invoice'}:{' '}
                                  {fmt(current)})
                                </span>
                              )}
                            </>
                          )}
                          {showAdjustBtn && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleScaleToRemaining}
                              className="!text-amber-700 !border !border-amber-300 hover:!bg-amber-100 !py-0.5 !px-2 !text-[10px] !font-bold !uppercase !tracking-wider !h-auto"
                            >
                              {lang.adjustToRemaining || 'Adjust to remaining'}
                            </Button>
                          )}
                        </span>
                      );
                    })()}
                </>
              )}

              {invoice.is_locked && (
                <>
                  {invoice.is_cancelled && (
                    <span className="text-gray-500 text-lg">⊘</span>
                  )}
                  {invoice.payment_status === 'paid' && (
                    <span className="text-green-600 text-lg">✓</span>
                  )}
                  {isOverdue && <span className="text-red-600 text-lg">⚠</span>}
                  <span className="text-gray-700 font-semibold text-sm">
                    {invoice.is_cancelled
                      ? lang.invoiceCancelledLabel
                      : invoice.payment_status === 'paid'
                        ? lang.invoicePaid
                        : isOverdue
                          ? lang.invoiceOverdue
                          : invoice.last_email_sent_at
                            ? lang.invoiceSent
                            : lang.invoiceUnpaid}
                  </span>
                </>
              )}
            </div>

            {!invoice.is_cancelled &&
              invoice.payment_status !== 'paid' &&
              invoice.is_locked &&
              invoice.due_date && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {lang.dueDate}:{' '}
                  {new Date(invoice.due_date).toLocaleDateString(
                    profile.country === 'FR' ? 'fr-FR' : 'en-US',
                    {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }
                  )}
                </span>
              )}
          </div>

          {/* RELATED CREDIT NOTES */}
          {creditNotes.length > 0 && (
            <div className="mb-6 bg-purple-50/50 border border-purple-200 rounded-xl p-5 print:hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-800 mb-3">
                {lang.relatedCreditNotes}
              </p>
              <div className="flex flex-col gap-2">
                {creditNotes.map((cn) => (
                  <div
                    key={cn.id}
                    className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-purple-100 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-purple-700">
                        {cn.credit_note_number}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(cn.credit_note_date).toLocaleDateString(
                          profile?.country === 'FR' ? 'fr-FR' : 'en-US'
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-purple-700">
                        −
                        {formatMoney(
                          cn.amount_cents,
                          cn.currency_snapshot,
                          cn.country_snapshot
                        )}
                      </span>
                      <LinkButton
                        href={`/credit-notes/${cn.id}`}
                        variant="ghost"
                        size="sm"
                      >
                        {lang.viewCreditNote}
                      </LinkButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MAIN INVOICE DOCUMENT */}
          <article
            className={`bg-white shadow-xl border border-gray-200 rounded-2xl overflow-hidden print:shadow-none print:border-none print:rounded-none relative ${
              !invoice.is_locked ? 'ring-2 ring-amber-300/50' : ''
            }`}
          >
            {!invoice.is_locked && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] print:opacity-[0.08]">
                <span className="text-[120px] font-black text-gray-900 rotate-[-30deg] select-none uppercase tracking-widest">
                  {lang.draft}
                </span>
              </div>
            )}

            <div className="p-8 sm:p-12 print:p-12 relative z-10">
              <header className="flex items-start justify-between gap-6 pb-8 mb-10 border-b border-gray-200">
                <div className="flex items-center gap-4 min-w-0">
                  {profile.subscription_tier === 'pro' && profile.logo_url && (
                    <img
                      src={profile.logo_url}
                      alt=""
                      className="h-12 sm:h-14 w-auto object-contain shrink-0"
                    />
                  )}
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight break-words leading-tight">
                    {profile.business_name}
                  </h1>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-gray-400">
                    {docTitleLabel}
                  </p>
                  <p className="font-mono text-sm sm:text-base font-bold text-blue-600">
                    {invoice.invoice_number}
                  </p>

                  {!invoice.is_locked ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center text-right">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">
                          {lang.invoiceDate}
                        </label>
                        <input
                          type="date"
                          value={draftData.invoiceDate}
                          onChange={(e) =>
                            handleDraftChange('invoiceDate', e.target.value)
                          }
                          className="p-2 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 w-36 shadow-sm"
                        />

                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">
                          {lang.dueDate}
                        </label>
                        <input
                          type="date"
                          value={draftData.dueDate}
                          onChange={(e) =>
                            handleDraftChange('dueDate', e.target.value)
                          }
                          className="p-2 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 w-36 shadow-sm"
                        />

                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">
                          {lang.poNumber}
                        </label>
                        <input
                          type="text"
                          value={draftData.poNumber}
                          onChange={(e) =>
                            handleDraftChange('poNumber', e.target.value)
                          }
                          placeholder={lang.poPlaceholder}
                          className="p-2 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-300 w-36 shadow-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-0.5">
                      <p className="text-xs text-gray-500 font-medium">
                        {lang.invoiceDate}:{' '}
                        {new Date(invoice.invoice_date).toLocaleDateString(
                          profile.country === 'FR' ? 'fr-FR' : 'en-US',
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }
                        )}
                      </p>
                      {invoice.due_date && (
                        <p
                          className={`text-xs font-medium ${
                            isOverdue ? 'text-red-500' : 'text-gray-500'
                          }`}
                        >
                          {lang.dueDate}:{' '}
                          {new Date(invoice.due_date).toLocaleDateString(
                            profile.country === 'FR' ? 'fr-FR' : 'en-US',
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }
                          )}
                        </p>
                      )}
                      {invoice.po_number && (
                        <p className="text-xs text-gray-500 font-medium">
                          {lang.poNumber}: {invoice.po_number}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </header>

              <section className="mb-10">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-400 mb-3">
                  {lang.clientLabel}
                </p>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-gray-900">
                    {invoice.client_name}
                  </p>
                  {invoice.client_address && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {invoice.client_address}
                    </p>
                  )}
                  {(invoice.client_phone || invoice.client_email) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                      {invoice.client_phone && (
                        <p className="text-sm text-gray-500">
                          {invoice.client_phone}
                        </p>
                      )}
                      {invoice.client_email && (
                        <p className="text-sm text-gray-500">
                          {invoice.client_email}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION-BASED INVOICE */}
              {!isLineItemInvoice && sections.length > 0 && (
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
                    {sections.map((sec: any, secIdx: number) => {
                      let sectionSubtotalCents = 0;

                      if ((sec.laborHours || 0) > 0) {
                        sectionSubtotalCents += Math.round(
                          (sec.laborHours || 0) * getInvoiceLaborRateCents(sec)
                        );
                      }

                      (sec.items || []).forEach((item: any) => {
                        sectionSubtotalCents += Math.round(
                          (item.qty || 0) *
                            getInvoiceItemUnitCostCents(sec, item)
                        );
                      });

                      return (
                        <div key={secIdx} className="py-8 first:pt-2">
                          <div className="flex justify-between items-start gap-4 mb-4">
                            <div className="flex-1">
                              {!invoice.is_locked ? (
                                <input
                                  type="text"
                                  value={sec.title || ''}
                                  onChange={(e) =>
                                    handleUpdateSectionTitle(
                                      secIdx,
                                      e.target.value
                                    )
                                  }
                                  className="w-full p-2 border border-gray-200 rounded-lg text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                  placeholder={lang.professionalServices}
                                />
                              ) : (
                                <h3 className="text-lg font-bold text-gray-900 break-words">
                                  {sec.title || lang.professionalServices}
                                </h3>
                              )}
                            </div>
                            <span className="font-mono font-bold text-lg text-gray-900 whitespace-nowrap tabular-nums mt-1.5">
                              {fmt(sectionSubtotalCents)}
                            </span>
                          </div>

                          <div className="pl-0 sm:pl-4 mb-6">
                            {!invoice.is_locked ? (
                              <textarea
                                value={getSectionDisplayDescription(sec)}
                                onChange={(e) =>
                                  handleUpdateSectionDesc(
                                    secIdx,
                                    e.target.value
                                  )
                                }
                                maxLength={5000}
                                rows={2}
                                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y whitespace-pre-wrap text-gray-900 shadow-sm"
                                placeholder={lang.sectionDescPlaceholder}
                              />
                            ) : (
                              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
                                {getSectionDisplayDescription(sec)}
                              </p>
                            )}
                          </div>

                          {isShowingDetails ? (
                            <div className="pl-0 sm:pl-4 border-l-2 border-gray-100 space-y-4">
                              {(sec.laborHours > 0 ||
                                isStructurallyEditable) && (
                                <div className="bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-100 flex flex-wrap gap-4 items-end shadow-sm">
                                  <div className="flex-1 min-w-[120px]">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                                      {lang.laborLabel}
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={
                                        (sec.laborHours || 0) === 0
                                          ? ''
                                          : sec.laborHours
                                      }
                                      placeholder="0"
                                      onChange={(e) =>
                                        handleUpdateSectionLabor(
                                          secIdx,
                                          'laborHours',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm disabled:bg-gray-100"
                                      disabled={!isStructurallyEditable}
                                    />
                                  </div>

                                  <div className="flex-1 min-w-[120px]">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                                      {lang.hourlyRate}
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        (sec.hourlyRate || 0) === 0
                                          ? ''
                                          : sec.hourlyRate
                                      }
                                      placeholder="0.00"
                                      onChange={(e) =>
                                        handleUpdateSectionLabor(
                                          secIdx,
                                          'hourlyRate',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm disabled:bg-gray-100"
                                      disabled={!isStructurallyEditable}
                                    />
                                  </div>

                                  <div className="w-24">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                                      {lang.tax} %
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={
                                        (sec.laborTaxRate ??
                                          profile?.tax_rate ??
                                          0) === 0
                                          ? ''
                                          : (sec.laborTaxRate ??
                                            profile?.tax_rate ??
                                            0)
                                      }
                                      placeholder="0"
                                      onChange={(e) =>
                                        handleUpdateSectionLabor(
                                          secIdx,
                                          'laborTaxRate',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm disabled:bg-gray-100"
                                      disabled={!isStructurallyEditable}
                                    />
                                  </div>

                                  {(sec.laborHours || 0) > 0 && (
                                    <div className="flex flex-col items-end justify-center px-3 bg-gray-50 border border-gray-200 rounded-xl h-[46px] min-w-[80px]">
                                      <span className="text-sm font-mono font-bold text-gray-700 tabular-nums">
                                        {fmt(
                                          Math.round(
                                            (sec.laborHours || 0) *
                                              getInvoiceLaborRateCents(sec)
                                          )
                                        )}
                                      </span>
                                      {invoiceContext.margin_mode_snapshot &&
                                        invoiceContext.margin_mode_snapshot !==
                                          'none' &&
                                        (sec.hourlyRate || 0) > 0 &&
                                        getInvoiceLaborRateCents(sec) !==
                                          Math.round(
                                            (sec.hourlyRate || 0) * 100
                                          ) && (
                                          <span className="text-[9px] text-blue-400 font-bold whitespace-nowrap">
                                            +
                                            {Math.round(
                                              (getInvoiceLaborRateCents(sec) /
                                                ((sec.hourlyRate || 1) * 100) -
                                                1) *
                                                100
                                            )}
                                            % mgn
                                          </span>
                                        )}
                                    </div>
                                  )}
                                </div>
                              )}
                              {sec.items && sec.items.length > 0 && (
                                <div className="space-y-3">
                                  {sec.items.map(
                                    (item: any, itemIdx: number) => {
                                      const m = materialsById.get(
                                        item.materialId
                                      );
                                      const unitCostCents =
                                        getInvoiceItemUnitCostCents(sec, item);

                                      if (isStructurallyEditable) {
                                        return (
                                          <div
                                            key={itemIdx}
                                            className="flex flex-col lg:flex-row gap-3 items-stretch bg-gray-50/50 p-3 rounded-lg border border-gray-100/50"
                                          >
                                            {/* Material selector */}
                                            <div className="flex-1 min-w-[200px]">
                                              {item.materialId ? (
                                                <div className="flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm h-[42px]">
                                                  <span className="font-bold text-gray-900 truncate pr-4 text-xs">
                                                    {item.name || m?.name}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleUpdateSectionItem(
                                                        secIdx,
                                                        itemIdx,
                                                        'materialId',
                                                        ''
                                                      )
                                                    }
                                                    className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors shrink-0"
                                                  >
                                                    {lang.edit}
                                                  </button>
                                                </div>
                                              ) : (
                                                <MaterialCombobox
                                                  materials={materials}
                                                  selectedId={item.materialId}
                                                  onChange={(val: any) => {
                                                    if (!val) return;
                                                    handleUpdateSectionItemMaterial(
                                                      secIdx,
                                                      itemIdx,
                                                      val
                                                    );
                                                  }}
                                                  onCreateNew={(name: string) =>
                                                    handleCreateMaterialOnTheFly(
                                                      secIdx,
                                                      itemIdx,
                                                      name
                                                    )
                                                  }
                                                  placeholder={
                                                    lang.selectMaterial ||
                                                    'Select or create...'
                                                  }
                                                  createLabel={lang.create}
                                                  emptyStateLabel={
                                                    lang.noMaterialsFound
                                                  }
                                                  currencySymbol={
                                                    profile?.currency === 'EUR'
                                                      ? '€'
                                                      : '$'
                                                  }
                                                  unitLabels={lang?.units || {}}
                                                />
                                              )}
                                            </div>

                                            {/* Numeric fields */}
                                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                              {/* QTY */}
                                              <div className="relative group w-20">
                                                <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none">
                                                  {lang.qtyShort || 'QTY'}
                                                </span>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  placeholder="1"
                                                  className="w-full py-2 pl-9 pr-2 border border-gray-200 rounded-lg text-right text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                  value={
                                                    item.qty === 0
                                                      ? ''
                                                      : item.qty
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateSectionItem(
                                                      secIdx,
                                                      itemIdx,
                                                      'quantity',
                                                      parseFloat(
                                                        e.target.value
                                                      ) || 0
                                                    )
                                                  }
                                                />
                                              </div>

                                              {/* COST */}
                                              <div className="relative group w-28">
                                                <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none">
                                                  {lang.costShort || 'COST'}
                                                </span>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  placeholder="0.00"
                                                  className="w-full py-2 pl-10 pr-2 border border-gray-200 rounded-lg text-right text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                  value={
                                                    (item.cost_per_unit_cents ||
                                                      0) === 0
                                                      ? ''
                                                      : item.cost_per_unit_cents /
                                                        100
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateSectionItem(
                                                      secIdx,
                                                      itemIdx,
                                                      'unit_price_cents',
                                                      Math.round(
                                                        (parseFloat(
                                                          e.target.value
                                                        ) || 0) * 100
                                                      )
                                                    )
                                                  }
                                                />
                                              </div>

                                              {/* TAX */}
                                              <div className="relative group w-24">
                                                <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none">
                                                  {lang.taxShort || 'TAX'}
                                                </span>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  max="100"
                                                  placeholder="0"
                                                  className="w-full py-2 pl-10 pr-6 border border-gray-200 rounded-lg text-right text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                  value={
                                                    (item.taxRate ?? 0) === 0
                                                      ? ''
                                                      : (item.taxRate ?? 0)
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateSectionItem(
                                                      secIdx,
                                                      itemIdx,
                                                      'tax_rate',
                                                      parseFloat(
                                                        e.target.value
                                                      ) || 0
                                                    )
                                                  }
                                                />
                                                <span className="absolute right-2 top-2.5 text-[10px] font-black text-gray-400 pointer-events-none">
                                                  %
                                                </span>
                                              </div>

                                              {/* AMOUNT (read-only computed, post-margin) */}
                                              <div className="flex flex-col items-end justify-center w-24 h-[42px] px-3 bg-gray-50 border border-gray-100 rounded-lg">
                                                <span className="text-sm font-mono font-bold text-gray-700 tabular-nums">
                                                  {fmt(
                                                    Math.round(
                                                      (item.qty || 0) *
                                                        unitCostCents
                                                    )
                                                  )}
                                                </span>
                                                {invoiceContext.margin_mode_snapshot &&
                                                  invoiceContext.margin_mode_snapshot !==
                                                    'none' &&
                                                  item.cost_per_unit_cents >
                                                    0 &&
                                                  unitCostCents !==
                                                    item.cost_per_unit_cents && (
                                                    <span className="text-[9px] text-blue-400 font-bold whitespace-nowrap">
                                                      +
                                                      {Math.round(
                                                        (unitCostCents /
                                                          item.cost_per_unit_cents -
                                                          1) *
                                                          100
                                                      )}
                                                      % mgn
                                                    </span>
                                                  )}
                                              </div>

                                              {/* DELETE */}
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="md"
                                                onClick={() =>
                                                  handleRemoveSectionItem(
                                                    secIdx,
                                                    itemIdx
                                                  )
                                                }
                                                className="!h-[42px] !w-[42px] !p-0 !text-gray-300 hover:!text-red-600 hover:!bg-red-50"
                                              >
                                                <Icons.Trash />
                                              </Button>
                                            </div>
                                          </div>
                                        );
                                      }

                                      // Read-only path (deposit/balance drafts + locked)
                                      return (
                                        <div
                                          key={itemIdx}
                                          className="py-2 flex justify-between items-center gap-4 border-b border-gray-100 last:border-b-0"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900">
                                              {item.name ||
                                                m?.name ||
                                                lang.itemLabel}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                              {item.qty} × {fmt(unitCostCents)}
                                              {(item.taxRate ?? 0) > 0 && (
                                                <span className="text-gray-400 ml-2">
                                                  ({lang.tax} {item.taxRate}%)
                                                </span>
                                              )}
                                            </p>
                                          </div>
                                          <span className="font-mono font-bold text-sm text-gray-900 tabular-nums whitespace-nowrap">
                                            {fmt(
                                              Math.round(
                                                (item.qty || 0) * unitCostCents
                                              )
                                            )}
                                          </span>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              )}

                              {isStructurallyEditable && (
                                <div className="mt-4">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleAddSectionItem(secIdx)}
                                    icon={<Icons.Plus />}
                                  >
                                    {lang.addItem}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            sec.items &&
                            sec.items.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pl-0 sm:pl-4">
                                {sec.items.map((item: any, i: number) => {
                                  const m = materialsById.get(item.materialId);
                                  const displayName =
                                    item.name || m?.name || lang.itemLabel;
                                  const rawUnit = item.unit || m?.unit || '';
                                  const displayUnit =
                                    lang?.units?.[rawUnit] || rawUnit;

                                  return (
                                    <span
                                      key={i}
                                      className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100"
                                    >
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
                                    </span>
                                  );
                                })}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* FLAT LINE ITEMS ONLY */}
              {isLineItemInvoice && (
                <section className="mb-10">
                  <div className="flex items-baseline justify-between pb-3 mb-4 border-b-2 border-gray-900">
                    <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-700">
                      {lang.lineItems}
                    </p>
                  </div>
                  <div>
                    {lineItems.map((item, index) => (
                      <EditableLineItem
                        key={index}
                        item={item}
                        index={index}
                        isLocked={invoice.is_locked}
                        currency={profile?.currency}
                        country={profile?.country}
                        lang={lang}
                        onUpdate={handleLineItemUpdate}
                        onRemove={handleRemoveLineItem}
                        canRemove={lineItems.length > 1 && !invoice.is_locked}
                      />
                    ))}
                  </div>

                  {!invoice.is_locked && (
                    <div className="mt-4">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAddLineItem}
                        icon={<Icons.Plus />}
                      >
                        {lang.addLineItem}
                      </Button>
                    </div>
                  )}
                </section>
              )}

              {/* ADDITIONAL CHARGES */}
              {!isLineItemInvoice && additionalCharges.length > 0 && (
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
                    {additionalCharges.map(
                      (charge: AdditionalCharge, idx: number) => {
                        const amountCents = getAdditionalChargeAmountCents(
                          invoiceContext,
                          charge,
                          sections || [],
                          materialsById
                        );

                        const editableItem = {
                          description: charge.name || lang.additionalCharges,
                          quantity: charge.qty || 1,
                          unit_price_cents: charge.costPerUnitCents || 0,
                          amount_cents: amountCents,
                          tax_rate: charge.taxRate ?? profile?.tax_rate ?? 0
                        };

                        return (
                          <div key={idx} className="relative">
                            <EditableLineItem
                              item={editableItem}
                              index={idx}
                              isLocked={
                                !isStructurallyEditable || !!charge.isPercentage
                              }
                              currency={profile?.currency}
                              country={profile?.country}
                              lang={lang}
                              onUpdate={(i, field, val) =>
                                handleUpdateCharge(i, field, val)
                              }
                              onRemove={(i) => handleRemoveCharge(i)}
                              canRemove={!invoice.is_locked}
                            />
                          </div>
                        );
                      }
                    )}
                  </div>
                </section>
              )}

              {/* NOTES */}
              {(!invoice.is_locked || invoice.notes) && (
                <section className="mb-10">
                  <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-400 mb-3">
                    {lang.invoiceNotes}
                  </p>
                  {!invoice.is_locked ? (
                    <textarea
                      rows={3}
                      value={draftData.notes}
                      onChange={(e) =>
                        handleDraftChange('notes', e.target.value)
                      }
                      maxLength={5000}
                      className="w-full p-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y whitespace-pre-wrap text-gray-900 placeholder-gray-400 shadow-sm"
                      placeholder={lang.invoiceNotesPlaceholder}
                    />
                  ) : (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100">
                      {invoice.notes}
                    </p>
                  )}
                </section>
              )}

              {/* TOTALS */}
              <section className="flex justify-end pt-8 mb-10 border-t-2 border-gray-200">
                <div className="w-full sm:w-80 space-y-3">
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-gray-700 font-bold">
                      {isDepositInvoice
                        ? `${lang.depositSubtotal} (${invoice.deposit_percentage}%)`
                        : isBalanceInvoice
                          ? `${lang.balanceSubtotal} (${
                              100 - invoice.deposit_percentage
                            }%)`
                          : lang.invoiceSubtotal}
                    </span>
                    <span className="font-mono font-bold text-gray-900 tabular-nums">
                      {fmt(billedTotals.subtotalCents)}
                    </span>
                  </div>

                  {Object.entries(billedTotals.taxGroups)
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
                      {fmt(billedTotals.totalCents)}
                    </span>
                  </div>
                </div>
              </section>

              {/* PAYMENT INSTRUCTIONS */}
              {(profile.bank_wire_instructions || profile.payment_link_url) && (
                <section className="mb-10 pt-8 border-t border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-4">
                    {lang.paymentInstructions}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {profile.bank_wire_instructions && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                          {lang.bankWireInstructions}
                        </p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                          {profile.bank_wire_instructions}
                        </p>
                      </div>
                    )}
                    {profile.payment_link_url && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                          {lang.paymentLinkLabel}
                        </p>
                        <a
                          href={profile.payment_link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          {lang.payInvoiceOnline}
                        </a>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* COMPLIANCE & TERMS */}
              <footer className="mt-12 pt-8 border-t border-gray-100">
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
                      {isDepositInvoice
                        ? lang.depositDueUponReceipt
                        : isUponReceipt
                          ? lang.paymentDueUponReceipt
                          : t(lang.paymentDueWithinDays, {
                              days: displayPaymentDays
                            })}
                    </p>
                  </div>
                </div>

                {(profile?.company_reg_number || profile?.vat_number) && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="flex flex-wrap gap-4 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                      {profile?.company_reg_number && (
                        <span>
                          {lang.companyRegNumber}: {profile.company_reg_number}
                        </span>
                      )}
                      {profile?.vat_number && (
                        <span>
                          {lang.vatNumber}: {profile.vat_number}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </footer>
            </div>
          </article>
        </div>

        <ConfirmDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          labels={{
            notice: lang.notice,
            cancel: lang.cancel,
            confirmOk: lang.confirmOk,
            deletePermanently: lang.cancelInvoice
          }}
        />

        {markPaidModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-100">
              <h3 className="text-base font-bold text-gray-900 mb-2">
                {lang.markAsPaid}
              </h3>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                {lang.markAsPaidConfirm}
              </p>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                {lang.paymentMethod}
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder={lang.paymentMethodPlaceholder}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-5 text-gray-900 placeholder-gray-400 shadow-sm"
              />
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setMarkPaidModalOpen(false);
                    setPaymentMethod('');
                  }}
                  disabled={markingPaid}
                >
                  {lang.cancel}
                </Button>
                <Button
                  variant="success"
                  size="md"
                  loading={markingPaid}
                  loadingText="..."
                  onClick={handleMarkPaid}
                >
                  {lang.markAsPaid}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
