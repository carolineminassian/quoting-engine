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
  getSectionTotal,
  getTaxSummary,
  generateDescription,
  buildMaterialsMap,
  getAdditionalChargeAmountCents,
  type AdditionalCharge
} from '@/lib/estimateCalculations';
import { formatMoney } from '@/lib/formatMoney';

export default function InvoiceView() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [creditNotes, setCreditNotes] = useState<any[]>([]);

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

  const [editMode, setEditMode] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      // Add this missing block:
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
        // Fetch the user's profile to set their preferred language for the error screen
        const { data: prof } = await supabase
          .from('profiles')
          .select('country')
          .eq('id', user.id)
          .single();

        setLang(prof?.country === 'FR' ? translations.FR : translations.US);
        setLoading(false);
        return;
      }

      const [prof, mats] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', inv.user_id).single(),
        supabase.from('materials').select('*').eq('user_id', inv.user_id)
      ]);

      const country = inv.country_snapshot || prof.data?.country || 'US';
      setLang(country === 'FR' ? translations.FR : translations.US);

      setInvoice(inv);
      setProfile({
        ...prof.data,
        business_name: inv.business_name_snapshot || prof.data?.business_name,
        country: inv.country_snapshot || prof.data?.country,
        currency: inv.currency_snapshot || prof.data?.currency,
        tax_rate: inv.tax_rate_snapshot ?? prof.data?.default_tax_rate ?? 0
      });
      setMaterials(mats.data || []);

      // Inside your fetchData function, below the profiles/materials fetch:
      const { data: cns } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('invoice_id', id);
      setCreditNotes(cns || []);
      setLoading(false);
    }
    fetchData();
  }, [id]);

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

  // Compute live payment status
  const getPaymentStatus = () => {
    if (!invoice) return '';
    if (invoice.is_cancelled) return lang.invoiceCancelled;
    if (invoice.payment_status === 'paid') return lang.invoicePaid;
    // Partially credited — has some credit notes but not fully cancelled
    if ((invoice.credited_amount_cents || 0) > 0 && !invoice.is_cancelled)
      return profile?.country === 'FR'
        ? 'Partiellement crédité'
        : 'Partially Credited';
    if (invoice.payment_status === 'partial') return lang.invoicePartial;
    if (!invoice.is_locked) return lang.invoiceDraft;
    if (
      invoice.due_date &&
      new Date(invoice.due_date) < new Date() &&
      invoice.payment_status === 'unpaid'
    )
      return lang.invoiceOverdue;
    if (invoice.last_email_sent_at) return lang.invoiceSent;
    return lang.invoiceUnpaid;
  };
  const isOverdue =
    invoice?.is_locked &&
    !invoice?.is_cancelled &&
    invoice?.payment_status === 'unpaid' &&
    invoice?.due_date &&
    new Date(invoice.due_date) < new Date();

  // Follow-up state (same 7-day cooldown as estimates)
  const getFollowUpState = () => {
    if (
      !invoice?.is_locked ||
      invoice?.is_cancelled ||
      invoice?.payment_status === 'paid'
    )
      return { mode: 'hidden' as const };
    if (!invoice?.last_email_sent_at) return { mode: 'hidden' as const };
    if (invoice?.last_followup_sent_at) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const lastSent = new Date(invoice.last_followup_sent_at).getTime();
      const cooldownEnds = new Date(lastSent + sevenDaysMs);
      if (cooldownEnds.getTime() > Date.now()) {
        return { mode: 'cooldown' as const, cooldownUntil: cooldownEnds };
      }
    }
    return { mode: 'send' as const };
  };

  // --- ACTIONS ---

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
          grandTotal: (invoice.total_amount_cents / 100).toFixed(2),
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
          message: t(lang.invoiceSentSuccess, {
            target: invoice.client_email
          })
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
          grandTotal: (invoice.total_amount_cents / 100).toFixed(2),
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
          message: t(lang.followUpSentSuccess, {
            target: invoice.client_email
          })
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

  const handleFinalize = () => {
    setDialog({
      type: 'confirm',
      title: lang.finalizeInvoice,
      message: lang.finalizeInvoiceConfirm,
      onConfirm: async () => {
        setDialog(null);
        const { error } = await supabase
          .from('invoices')
          .update({ is_locked: true })
          .eq('id', id);
        if (error) {
          setDialog({ type: 'alert', message: error.message });
          return;
        }
        setInvoice((prev: any) => (prev ? { ...prev, is_locked: true } : prev));
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
        paid_amount_cents: invoice.total_amount_cents,
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
            paid_amount_cents: prev.total_amount_cents,
            payment_method: paymentMethod.trim() || null
          }
        : prev
    );
    setMarkPaidModalOpen(false);
    setPaymentMethod('');
  };

  const handleDeleteDraft = () => {
    setDialog({
      type: 'confirm',
      message: lang.deleteInvoiceDraftConfirm,
      onConfirm: async () => {
        setDialog(null);
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
            // Navigate back to estimate if we know it, otherwise invoices list
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
      }
    });
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const InvoicePDF = (await import('./InvoicePDF')).default;

      const { subtotalCents: pdfSubtotalCents, taxGroups: pdfTaxGroups } =
        getTaxSummary(
          {
            margin_mode_snapshot: invoice.margin_mode_snapshot,
            global_margin_snapshot: invoice.global_margin_snapshot,
            tax_rate_snapshot: invoice.tax_rate_snapshot
          },
          invoice.sections || [],
          profile.tax_rate,
          materialsById,
          invoice.additional_charges || []
        );

      const preparedSections = (invoice.sections || []).map((sec: any) => ({
        title: sec.title || lang.professionalServices,
        description: generateDescription(
          {
            margin_mode_snapshot: invoice.margin_mode_snapshot,
            global_margin_snapshot: invoice.global_margin_snapshot,
            tax_rate_snapshot: invoice.tax_rate_snapshot
          },
          sec,
          descTranslations,
          materialsById
        ),
        total: getSectionTotal(
          {
            margin_mode_snapshot: invoice.margin_mode_snapshot,
            global_margin_snapshot: invoice.global_margin_snapshot,
            tax_rate_snapshot: invoice.tax_rate_snapshot
          },
          sec,
          materialsById
        ),
        hasDetails: false,
        laborHours: sec.laborHours || 0,
        laborType: sec.laborType,
        laborRate: sec.hourlyRate || 0,
        laborTaxRate: sec.laborTaxRate ?? profile.tax_rate,
        items: (sec.items || []).map((item: any) => {
          const m = materialsById.get(item.materialId);
          return {
            name: item.name || m?.name || 'Item',
            qty: item.qty || 0,
            unit:
              lang?.units?.[item.unit || m?.unit || ''] ||
              item.unit ||
              m?.unit ||
              '',
            cost: (item.cost_per_unit_cents || 0) / 100,
            taxRate: item.taxRate ?? profile.tax_rate
          };
        })
      }));

      const blob = await pdf(
        <InvoicePDF
          invoice={invoice}
          profile={profile}
          lang={lang}
          subtotal={pdfSubtotalCents / 100}
          taxGroups={Object.entries(pdfTaxGroups) as any}
          grandTotal={invoice.total_amount_cents / 100}
          sections={preparedSections}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${lang.invoiceLabel}-${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Invoice PDF error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !lang) return <LoadingDots />;

  if (!invoice) {
    return (
      <div className="p-10 text-center font-sans text-xl font-black uppercase text-gray-400">
        {lang?.notFound || 'Invoice Not Found'}
      </div>
    );
  }

  const { subtotalCents, taxGroups } = getTaxSummary(
    {
      margin_mode_snapshot: invoice.margin_mode_snapshot,
      global_margin_snapshot: invoice.global_margin_snapshot,
      tax_rate_snapshot: invoice.tax_rate_snapshot
    },
    invoice.sections || [],
    profile.tax_rate,
    materialsById,
    invoice.additional_charges || []
  );

  const rawTerms = invoice.payment_terms_snapshot || '30_days';
  const isUponReceipt = rawTerms === 'upon_receipt';
  const displayPaymentDays = isUponReceipt
    ? 0
    : parseInt(rawTerms.replace('_days', '')) || 30;

  const followUpState = getFollowUpState();
  const handleSaveEdit = async () => {
    setSavingEdit(true);
    const { error } = await supabase
      .from('invoices')
      .update({
        due_date: editDueDate || null,
        notes: editNotes.trim() || null
      })
      .eq('id', id);

    setSavingEdit(false);

    if (error) {
      setDialog({ type: 'alert', message: error.message });
      return;
    }

    setInvoice((prev: any) =>
      prev
        ? {
            ...prev,
            due_date: editDueDate || null,
            notes: editNotes.trim() || null
          }
        : prev
    );
    setEditMode(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans print:bg-white flex flex-col">
      <main className="flex-1 p-4 sm:p-8 relative print:p-0">
        <div className="max-w-4xl mx-auto print:max-w-none print:w-full">
          {/* === ACTION TOOLBAR === */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 print:hidden justify-between">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
              <LinkButton href="/invoices" variant="secondary" size="sm">
                ← {lang.invoices}
              </LinkButton>
              {invoice.estimate_id && (
                <LinkButton
                  href={`/estimates/${invoice.estimate_id}`}
                  variant="ghost"
                  size="sm"
                  className="!text-gray-400 hover:!text-gray-700"
                >
                  {lang.relatedEstimate} ↗
                </LinkButton>
              )}
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
              {/* Send / Follow Up button */}
              {invoice.client_email &&
                !invoice.is_cancelled &&
                invoice.payment_status !== 'paid' && (
                  <>
                    {followUpState.mode === 'hidden' && invoice.is_locked && (
                      <Button
                        variant="dark"
                        size="md"
                        loading={sending}
                        loadingText={lang.sending}
                        onClick={handleSendInvoice}
                        className="flex-1"
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
                        className="flex-1"
                      >
                        {lang.followUpBtn}
                      </Button>
                    )}
                    {followUpState.mode === 'cooldown' && (
                      <Button
                        variant="dark"
                        size="md"
                        disabled
                        title={t(lang.followUpCooldown, {
                          date: followUpState.cooldownUntil!.toLocaleDateString(
                            profile.country === 'FR' ? 'fr-FR' : 'en-US',
                            { month: 'short', day: 'numeric', year: 'numeric' }
                          )
                        })}
                        className="flex-1"
                      >
                        {lang.followUpBtn}
                      </Button>
                    )}
                  </>
                )}

              {/* Download PDF */}
              <Button
                variant="primary"
                size="md"
                loading={loading}
                loadingText={lang.generating}
                onClick={handleDownloadPDF}
                className="flex-1 sm:flex-none px-6"
              >
                {lang.downloadInvoice}
              </Button>

              {/* ⋮ menu — hidden when invoice is fully cancelled */}
              {!invoice.is_cancelled && (
                <Menu as="div" className="relative shrink-0">
                  <MenuButton
                    className="inline-flex items-center justify-center font-black uppercase tracking-widests transition-all duration-200 cursor-pointer select-none whitespace-nowrap text-[10px] rounded-xl bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] px-3.5 h-[38px]"
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
                      {/* ─── DRAFT-ONLY ACTIONS ─── */}
                      {!invoice.is_locked && (
                        <>
                          {/* Edit draft */}
                          <MenuItem>
                            {({ active }) => (
                              <button
                                onClick={() => {
                                  setEditDueDate(
                                    invoice.due_date
                                      ? invoice.due_date.slice(0, 10)
                                      : ''
                                  );
                                  setEditNotes(invoice.notes || '');
                                  setEditMode(true);
                                }}
                                className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widests transition-colors cursor-pointer flex items-center gap-2.5 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}`}
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
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                {lang.reviseInvoice}
                              </button>
                            )}
                          </MenuItem>

                          {/* Finalize draft */}
                          <MenuItem>
                            {({ active }) => (
                              <button
                                onClick={handleFinalize}
                                className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widests transition-colors cursor-pointer flex items-center gap-2.5 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}`}
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
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                {lang.finalizeInvoice}
                              </button>
                            )}
                          </MenuItem>

                          {/* Delete draft — separated by divider */}
                          <MenuItem>
                            {({ active }) => (
                              <button
                                onClick={handleDeleteDraft}
                                disabled={deletingDraft}
                                className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widests transition-colors cursor-pointer flex items-center gap-2.5 border-t border-gray-100 disabled:opacity-40 ${active ? 'bg-red-50 text-red-700' : 'text-red-600'}`}
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
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                                {deletingDraft
                                  ? '...'
                                  : lang.deleteInvoiceDraft}
                              </button>
                            )}
                          </MenuItem>
                        </>
                      )}

                      {/* ─── FINALIZED INVOICE ACTIONS ─── */}
                      {invoice.is_locked && (
                        <>
                          {/* Mark as Paid — only if unpaid */}
                          {invoice.payment_status !== 'paid' && (
                            <MenuItem>
                              {({ active }) => (
                                <button
                                  onClick={() => setMarkPaidModalOpen(true)}
                                  className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widests transition-colors cursor-pointer flex items-center gap-2.5 ${active ? 'bg-green-50 text-green-700' : 'text-green-600'}`}
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
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                  </svg>
                                  {lang.markAsPaid}
                                </button>
                              )}
                            </MenuItem>
                          )}

                          {/* Create Credit Note — always available on finalized invoices */}
                          <MenuItem>
                            {({ active }) => (
                              <button
                                onClick={() =>
                                  router.push(`/invoices/${id}/credit-note`)
                                }
                                className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widests transition-colors cursor-pointer flex items-center gap-2.5 ${invoice.payment_status === 'paid' ? '' : 'border-t border-gray-100'} ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}`}
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
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="9" y1="15" x2="15" y2="15" />
                                </svg>
                                {lang.createCreditNote}
                              </button>
                            )}
                          </MenuItem>
                        </>
                      )}
                    </MenuItems>
                  </Transition>
                </Menu>
              )}
            </div>
          </div>

          {/* === STATUS BANNER === */}
          <div
            className={`mb-6 px-5 py-3.5 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden ${
              invoice.is_cancelled
                ? 'bg-gray-100 border-gray-300'
                : invoice.payment_status === 'paid'
                  ? 'bg-green-50/60 border-green-200'
                  : isOverdue
                    ? 'bg-red-50/60 border-red-200'
                    : invoice.payment_status === 'partial'
                      ? 'bg-blue-50/60 border-blue-200'
                      : !invoice.is_locked
                        ? 'bg-yellow-50/60 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {invoice.is_cancelled && (
                <>
                  <span className="text-gray-500 text-base">⊘</span>
                  <span className="text-gray-700 font-bold text-sm">
                    {lang.invoiceCancelledLabel}
                  </span>
                </>
              )}
              {!invoice.is_cancelled && invoice.payment_status === 'paid' && (
                <>
                  <span className="text-green-600 text-base">✓</span>
                  <div>
                    <span className="text-green-700 font-bold text-sm">
                      {lang.invoicePaid}
                    </span>
                    {invoice.paid_at && (
                      <span className="text-green-600 text-xs ml-2">
                        {t(lang.invoicePaidOn, {
                          date: new Date(invoice.paid_at).toLocaleDateString(
                            profile.country === 'FR' ? 'fr-FR' : 'en-US',
                            { year: 'numeric', month: 'short', day: 'numeric' }
                          )
                        })}
                      </span>
                    )}
                    {invoice.payment_method && (
                      <span className="text-green-600 text-xs ml-2 italic">
                        · {invoice.payment_method}
                      </span>
                    )}
                  </div>
                </>
              )}
              {!invoice.is_cancelled &&
                invoice.payment_status !== 'paid' &&
                isOverdue && (
                  <>
                    <span className="text-red-600 text-base">⚠</span>
                    <span className="text-red-700 font-bold text-sm">
                      {t(lang.invoiceOverdueSince, {
                        date: new Date(invoice.due_date).toLocaleDateString(
                          profile.country === 'FR' ? 'fr-FR' : 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' }
                        )
                      })}
                    </span>
                  </>
                )}
              {!invoice.is_cancelled &&
                invoice.payment_status !== 'paid' &&
                !isOverdue &&
                !invoice.is_locked && (
                  <>
                    <span className="text-yellow-600 text-base">✏</span>
                    <span className="text-yellow-700 font-bold text-sm">
                      {lang.invoiceDraft}
                    </span>
                  </>
                )}
              {!invoice.is_cancelled &&
                invoice.payment_status !== 'paid' &&
                !isOverdue &&
                invoice.is_locked && (
                  <>
                    <span className="text-gray-600 text-base">→</span>
                    <span className="text-gray-700 font-bold text-sm">
                      {invoice.last_email_sent_at
                        ? lang.invoiceSent
                        : lang.invoiceUnpaid}
                    </span>
                  </>
                )}
            </div>

            {/* Due date reminder if unpaid + locked */}
            {!invoice.is_cancelled &&
              invoice.payment_status !== 'paid' &&
              invoice.is_locked &&
              invoice.due_date && (
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {lang.dueDate}:{' '}
                  {new Date(invoice.due_date).toLocaleDateString(
                    profile.country === 'FR' ? 'fr-FR' : 'en-US',
                    { year: 'numeric', month: 'short', day: 'numeric' }
                  )}
                </span>
              )}
          </div>
          {/* Related Credit Notes Banner */}
          {creditNotes.length > 0 && (
            <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4 print:hidden">
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-800 mb-3">
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
                      <span className="font-mono font-black text-purple-700">
                        -
                        {formatMoney(
                          cn.amount_cents,
                          cn.currency_snapshot,
                          cn.country_snapshot
                        )}
                      </span>
                      <LinkButton
                        href={`/credit-notes/${cn.id}`}
                        variant="secondary"
                        size="sm"
                        className="!bg-purple-50 !text-purple-700 !border-purple-200 hover:!bg-purple-100"
                      >
                        {lang.viewCreditNote}
                      </LinkButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* === MAIN INVOICE DOCUMENT === */}
          <article className="bg-white shadow-xl border border-gray-200 rounded-xl overflow-hidden print:shadow-none print:border-none print:rounded-none">
            <div className="p-8 sm:p-14 print:p-12">
              {/* === LETTERHEAD === */}
              <header className="flex items-start justify-between gap-4 sm:gap-6 pb-8 mb-12 border-b border-gray-200">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {profile.subscription_tier === 'pro' && profile.logo_url && (
                    <img
                      src={profile.logo_url}
                      alt=""
                      className="h-10 sm:h-14 w-auto object-contain shrink-0"
                    />
                  )}
                  <h2 className="text-base sm:text-2xl font-black text-gray-900 tracking-tight break-words leading-tight">
                    {profile.business_name}
                  </h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.25em] font-bold text-gray-400 mb-1.5">
                    {lang.invoiceLabel}
                  </p>
                  <p className="font-mono text-xs sm:text-sm font-black text-blue-600">
                    {invoice.invoice_number}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 font-medium">
                    {lang.invoiceDate}:{' '}
                    {new Date(invoice.invoice_date).toLocaleDateString(
                      profile.country === 'FR' ? 'fr-FR' : 'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric' }
                    )}
                  </p>
                  {invoice.due_date && (
                    <p
                      className={`text-[10px] sm:text-xs mt-0.5 font-bold ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}
                    >
                      {lang.dueDate}:{' '}
                      {new Date(invoice.due_date).toLocaleDateString(
                        profile.country === 'FR' ? 'fr-FR' : 'en-US',
                        { year: 'numeric', month: 'short', day: 'numeric' }
                      )}
                    </p>
                  )}
                </div>
              </header>

              {/* === BILL TO === */}
              <section className="mb-12">
                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-400 mb-3">
                  {lang.clientLabel}
                </p>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-gray-900">
                    {invoice.client_name}
                  </p>
                  {invoice.client_address && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {invoice.client_address}
                    </p>
                  )}
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
                  {(invoice.sections || []).map((sec: any, idx: number) => {
                    const secContext = {
                      margin_mode_snapshot: invoice.margin_mode_snapshot,
                      global_margin_snapshot: invoice.global_margin_snapshot,
                      tax_rate_snapshot: invoice.tax_rate_snapshot
                    };
                    return (
                      <div
                        key={idx}
                        className="py-6 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex justify-between items-baseline gap-4 mb-2">
                          <h3 className="text-[16px] font-bold text-gray-900 break-words flex-1 min-w-0">
                            {sec.title || lang.professionalServices}
                          </h3>
                          <span className="font-mono font-bold text-lg text-gray-900 whitespace-nowrap shrink-0">
                            {fmt(
                              getSectionTotal(secContext, sec, materialsById) *
                                100
                            )}
                          </span>
                        </div>
                        <div className="pr-24 sm:pr-32">
                          <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
                            {generateDescription(
                              secContext,
                              sec,
                              descTranslations,
                              materialsById
                            )}
                          </p>
                          {sec.items && sec.items.length > 0 && (
                            <div className="mt-3 space-y-1">
                              {sec.items.map((item: any, i: number) => {
                                const m = materialsById.get(item.materialId);
                                const displayName =
                                  item.name || m?.name || 'Item';
                                const rawUnit = item.unit || m?.unit || '';
                                const displayUnit =
                                  lang?.units?.[rawUnit] || rawUnit;
                                return (
                                  <p
                                    key={i}
                                    className="text-xs text-gray-600 break-words"
                                  >
                                    <span className="font-medium">
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
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* === ADDITIONAL CHARGES === */}
              {Array.isArray(invoice.additional_charges) &&
                invoice.additional_charges.length > 0 && (
                  <section className="mb-10">
                    <div className="flex items-baseline justify-between pb-3 mb-2 border-b border-gray-200">
                      <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-400">
                        {lang.additionalCharges}
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-400">
                        {lang.amountHeader}
                      </p>
                    </div>
                    <div>
                      {invoice.additional_charges.map(
                        (charge: AdditionalCharge, idx: number) => {
                          const secContext = {
                            margin_mode_snapshot: invoice.margin_mode_snapshot,
                            global_margin_snapshot:
                              invoice.global_margin_snapshot,
                            tax_rate_snapshot: invoice.tax_rate_snapshot
                          };
                          const amountCents = getAdditionalChargeAmountCents(
                            secContext,
                            charge,
                            invoice.sections || [],
                            materialsById
                          );
                          const qty = charge.qty || 1;
                          const subtitle = charge.isPercentage
                            ? `${charge.percentageRate || 0}% · ${lang.basisProject}`
                            : `${qty} ${lang.units?.[charge.unit || 'ea'] || charge.unit || ''} × ${fmt(qty > 0 ? amountCents / qty : 0)}`;
                          return (
                            <div
                              key={idx}
                              className="py-4 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex justify-between items-baseline gap-4">
                                <div className="min-w-0 flex-1 pr-20">
                                  <h4 className="text-[14px] font-bold text-gray-900">
                                    {charge.name}
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
                    <span className="font-mono font-bold text-gray-900">
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
                        <span className="font-mono font-bold text-gray-900">
                          {fmt(amt)}
                        </span>
                      </div>
                    ))}
                  <div className="flex justify-between items-baseline pt-6 border-t-4 border-black">
                    <span className="text-base font-bold text-gray-900 uppercase tracking-wide">
                      {lang.grandTotalLabel}
                    </span>
                    <span className="text-2xl font-black font-mono text-blue-600">
                      {fmt(invoice.total_amount_cents)}
                    </span>
                  </div>

                  {/* Deposit breakdown */}
                  {invoice.deposit_enabled && (
                    <div className="pt-4 border-t border-dashed border-gray-200 space-y-2">
                      <div className="flex justify-between items-baseline text-sm bg-blue-50/50 px-3 py-2 rounded">
                        <span className="text-blue-600 font-medium">
                          {lang.depositLabel} ({invoice.deposit_percentage}%)
                        </span>
                        <span className="font-mono font-bold text-blue-600">
                          {fmt(
                            (invoice.total_amount_cents *
                              (invoice.deposit_percentage || 20)) /
                              100
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-sm px-3">
                        <span className="text-gray-500 font-medium">
                          {lang.balanceDue}
                        </span>
                        <span className="font-mono font-bold text-gray-700">
                          {fmt(
                            (invoice.total_amount_cents *
                              (100 - (invoice.deposit_percentage || 20))) /
                              100
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* === PAYMENT INSTRUCTIONS === */}
              {(profile.bank_wire_instructions || profile.payment_link_url) && (
                <section className="mb-12 pt-8 border-t border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">
                    {lang.paymentInstructions}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {profile.bank_wire_instructions && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                          {lang.bankWireInstructions}
                        </p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                          {profile.bank_wire_instructions}
                        </p>
                      </div>
                    )}
                    {profile.payment_link_url && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                          {lang.paymentLinkLabel}
                        </p>
                        <a
                          href={profile.payment_link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-blue-600 text-white px-4 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-colors"
                        >
                          {lang.payInvoiceOnline}
                        </a>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* === COMPLIANCE / TERMS === */}
              <div className="mt-8 pt-8 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">
                      {lang.complianceLegal}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-relaxed italic">
                      {lang.complianceText}
                    </p>
                  </div>
                  <div className="text-left sm:text-right sm:pl-16">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">
                      {lang.termsHeader}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-relaxed font-bold">
                      {isUponReceipt
                        ? profile.country === 'FR'
                          ? 'Règlement dès réception.'
                          : 'Payment due upon receipt.'
                        : profile.country === 'FR'
                          ? `Règlement sous ${displayPaymentDays} jours.`
                          : `Payment due within ${displayPaymentDays} days.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* === DIALOGS === */}
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
        {/* Edit Draft Modal */}
        {editMode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-100 animate-scale-up">
              <h3 className="text-sm font-black uppercase tracking-widest mb-5 text-gray-900">
                {lang.reviseInvoice}
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    {lang.dueDate}
                  </label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-600 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    {lang.invoiceNotes}
                  </label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={lang.invoiceNotesPlaceholder}
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-600 resize-none text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setEditMode(false)}
                  disabled={savingEdit}
                >
                  {lang.cancel}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  loading={savingEdit}
                  loadingText="..."
                  onClick={handleSaveEdit}
                >
                  {lang.save}
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Mark as Paid Modal */}
        {markPaidModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-100 animate-scale-up">
              <h3 className="text-sm font-black uppercase tracking-widest mb-3 text-gray-900">
                {lang.markAsPaid}
              </h3>
              <p className="text-xs text-gray-500 font-bold mb-5 leading-relaxed">
                {lang.markAsPaidConfirm}
              </p>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                {lang.paymentMethod} (
                {profile.country === 'FR' ? 'facultatif' : 'optional'})
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder={lang.paymentMethodPlaceholder}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-600 mb-5 text-gray-900 placeholder-gray-400"
              />
              <div className="flex gap-2 justify-end">
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

        {/* Cancel Invoice Modal removed — drafts use Delete, finalized use Credit Note */}
      </main>
    </div>
  );
}
