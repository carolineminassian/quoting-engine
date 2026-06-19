'use client';

import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations, t } from '@/lib/translations';
import { formatMoney } from '@/lib/formatMoney';
import {
  buildMaterialsMap,
  getTaxSummary,
  getEffectiveLaborRateCents,
  getEffectiveItemCostCents,
  getAdditionalChargeAmountCents
} from '@/lib/estimateCalculations';
import LoadingDots from '@/components/LoadingDots';
import LinkButton from '@/components/LinkButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import Button from '@/components/Button';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition
} from '@headlessui/react';

const saveAs = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<any>(null);
  const [archiving, setArchiving] = useState(false);
  const [bulkFollowupSending, setBulkFollowupSending] = useState(false);

  const [filterStatus, setFilterStatus] = useState<
    'all' | 'draft' | 'paid' | 'unpaid' | 'overdue' | 'credit_note'
  >('all');

  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc'>('date_desc');
  const [clientSearchText, setClientSearchText] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [filterDate, setFilterDate] = useState<
    'all' | 'this-month' | 'last-30' | 'this-year' | 'last-year'
  >('all');

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile(prof);
        setLang(prof.country === 'FR' ? translations.FR : translations.US);
      }

      const [invsRes, cnsRes, matsRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('user_id', user.id),
        supabase.from('credit_notes').select('*').eq('user_id', user.id),
        supabase.from('materials').select('*').eq('user_id', user.id)
      ]);

      const combined = [
        ...(invsRes.data || []).map((i) => ({ ...i, itemType: 'invoice' })),
        ...(cnsRes.data || []).map((c) => ({ ...c, itemType: 'credit_note' }))
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setInvoices(combined);
      setMaterials(matsRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  const materialsById = useMemo(
    () => buildMaterialsMap(materials),
    [materials]
  );

  if (loading || !lang) return <LoadingDots />;

  const isFr = profile?.country === 'FR';

  const isOverdue = (inv: any) =>
    inv.is_locked &&
    !inv.is_cancelled &&
    inv.payment_status === 'unpaid' &&
    inv.due_date &&
    new Date(inv.due_date) < new Date();

  const getStatusLabel = (inv: any): string => {
    if (inv.itemType === 'credit_note') return lang.creditNote;
    if (inv.is_cancelled) return lang.invoiceCancelledLabel;
    if (inv.payment_status === 'paid') return lang.invoicePaid;
    if (!inv.is_locked) return lang.draft;
    if (isOverdue(inv)) return lang.invoiceOverdue;
    if (inv.last_email_sent_at) return lang.invoiceSent;
    return lang.invoiceUnpaid;
  };

  const getStatusStyle = (inv: any): string => {
    if (inv.itemType === 'credit_note') return 'bg-purple-50 text-purple-600';
    if (inv.is_cancelled) return 'bg-gray-100 text-gray-500';
    if (inv.payment_status === 'paid') return 'bg-green-50 text-green-600';
    if (!inv.is_locked) return 'bg-amber-50 text-amber-600';
    if (isOverdue(inv)) return 'bg-red-50 text-red-500';
    if (inv.last_email_sent_at) return 'bg-blue-50 text-blue-600';
    return 'bg-gray-50 text-gray-500';
  };

  const toggleClient = (name: string) => {
    setSelectedClients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const uniqueClientNames = Array.from(
    new Set(
      invoices
        .map((i) => i.client_name)
        .filter((n): n is string => Boolean(n?.trim()))
    )
  ).sort((a, b) => a.localeCompare(b));

  const filteredClientNames = uniqueClientNames.filter((n) =>
    n.toLowerCase().includes(clientSearchText.toLowerCase())
  );

  const filteredItems = invoices
    .filter((inv) => {
      // 1. Client filter — chip selections take priority over typed text.
      //    If no chips, text alone filters the list as you type.
      if (selectedClients.length > 0) {
        if (!selectedClients.includes(inv.client_name || '')) return false;
      } else if (clientSearchText) {
        if (
          !(inv.client_name || '')
            .toLowerCase()
            .includes(clientSearchText.toLowerCase())
        )
          return false;
      }

      // 2. Date filter — return false so it compounds with all other filters
      if (filterDate !== 'all') {
        const now = new Date();
        const created = new Date(inv.created_at);
        if (filterDate === 'this-month') {
          if (
            created.getMonth() !== now.getMonth() ||
            created.getFullYear() !== now.getFullYear()
          )
            return false;
        } else if (filterDate === 'last-30') {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          if (created < d) return false;
        } else if (filterDate === 'this-year') {
          if (created.getFullYear() !== now.getFullYear()) return false;
        } else if (filterDate === 'last-year') {
          if (created.getFullYear() !== now.getFullYear() - 1) return false;
        }
      }

      if (filterStatus === 'all') return true;
      if (filterStatus === 'credit_note') return inv.itemType === 'credit_note';
      if (inv.itemType !== 'invoice') return false;
      if (filterStatus === 'draft') return !inv.is_locked;
      if (filterStatus === 'paid') return inv.payment_status === 'paid';
      if (filterStatus === 'overdue') return isOverdue(inv);
      if (filterStatus === 'unpaid')
        return (
          inv.is_locked &&
          !inv.is_cancelled &&
          inv.payment_status !== 'paid' &&
          !isOverdue(inv)
        );
      return true;
    })
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortBy === 'date_desc' ? db - da : da - db;
    });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

  // ─── CSV Export ────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const escapeCsv = (s: any) =>
      `"${(s || '').toString().replace(/"/g, '""')}"`;

    const headers = isFr
      ? 'Type,Numéro,Date,Client,Statut,Montant,Devise'
      : 'Type,Number,Date,Client,Status,Amount,Currency';

    const rows = filteredItems.map((item) => {
      const isCN = item.itemType === 'credit_note';
      return [
        escapeCsv(
          isCN ? (isFr ? 'Avoir' : 'Credit Note') : isFr ? 'Facture' : 'Invoice'
        ),
        escapeCsv(isCN ? item.credit_note_number : item.invoice_number),
        escapeCsv(formatDate(isCN ? item.credit_note_date : item.invoice_date)),
        escapeCsv(item.client_name),
        escapeCsv(getStatusLabel(item)),
        ((isCN ? -item.amount_cents : item.total_amount_cents) / 100).toFixed(
          2
        ),
        escapeCsv(item.currency_snapshot || (isFr ? 'EUR' : 'USD'))
      ].join(',');
    });

    const blob = new Blob(['\uFEFF' + [headers, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;'
    });
    saveAs(blob, `Billing_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ─── ZIP + PDF Export ──────────────────────────────────────────────────────

  const handleDownloadZIP = async () => {
    const exportable = filteredItems.filter(
      (item) => item.itemType === 'invoice' && item.is_locked
    );
    if (exportable.length === 0) return;

    setArchiving(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { pdf } = await import('@react-pdf/renderer');
      const InvoicePDF = (await import('./[id]/InvoicePDF')).default;

      const zip = new JSZip();

      for (const inv of exportable) {
        const country = inv.country_snapshot || profile?.country || 'US';
        const currentLang =
          country === 'FR' ? translations.FR : translations.US;
        const taxRate = inv.tax_rate_snapshot ?? profile?.default_tax_rate ?? 0;

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
                let t = 0;
                if (sec.laborHours > 0)
                  t += Math.round(
                    sec.laborHours * getEffectiveLaborRateCents(invContext, sec)
                  );
                (sec.items || []).forEach((it: any) => {
                  t += Math.round(
                    (it.qty || 0) *
                      getEffectiveItemCostCents(
                        invContext,
                        sec,
                        it,
                        materialsById
                      )
                  );
                });
                return t / 100;
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
                    currentLang?.units?.[item.unit || m?.unit || ''] ||
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
            unit: currentLang?.units?.[charge.unit] || charge.unit || 'ea',
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

        const storedSubtotal =
          inv.subtotal_cents || inv.subtotal_amount_cents || 0;
        const storedTax = inv.tax_amount_cents || 0;
        const storedTotal = inv.total_amount_cents || 0;
        const taxGroups: [number, number][] =
          storedTax > 0 ? [[taxRate, storedTax / 100]] : [];

        const blob = await pdf(
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

        const filename = `${currentLang.invoiceLabel}-${inv.invoice_number}.pdf`;
        zip.file(filename, blob);
      }

      const csvContent = (() => {
        const escapeCsv = (s: any) =>
          `"${(s || '').toString().replace(/"/g, '""')}"`;
        const headers = isFr
          ? 'Type,Numéro,Date,Client,Statut,Montant,Devise'
          : 'Type,Number,Date,Client,Status,Amount,Currency';
        const rows = filteredItems.map((item) => {
          const isCN = item.itemType === 'credit_note';
          return [
            escapeCsv(
              isCN
                ? isFr
                  ? 'Avoir'
                  : 'Credit Note'
                : isFr
                  ? 'Facture'
                  : 'Invoice'
            ),
            escapeCsv(isCN ? item.credit_note_number : item.invoice_number),
            escapeCsv(
              formatDate(isCN ? item.credit_note_date : item.invoice_date)
            ),
            escapeCsv(item.client_name),
            escapeCsv(getStatusLabel(item)),
            (
              (isCN ? -item.amount_cents : item.total_amount_cents) / 100
            ).toFixed(2),
            escapeCsv(item.currency_snapshot || (isFr ? 'EUR' : 'USD'))
          ].join(',');
        });
        return '\uFEFF' + [headers, ...rows].join('\n');
      })();
      zip.file(
        `Billing_Summary_${new Date().toISOString().slice(0, 10)}.csv`,
        csvContent
      );

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(
        zipBlob,
        `Billing_Archive_${new Date().toISOString().slice(0, 10)}.zip`
      );
    } catch (err) {
      console.error(err);
      setDialog({ type: 'alert', message: lang.pdfError });
    } finally {
      setArchiving(false);
    }
  };
  const handleBulkInvoiceFollowUp = async () => {
    // Eligible: finalized, unpaid, not cancelled, has email, already sent once
    const candidateIds = filteredItems
      .filter(
        (item) =>
          item.itemType === 'invoice' &&
          item.is_locked &&
          !item.is_cancelled &&
          item.payment_status !== 'paid' &&
          item.client_email &&
          item.last_email_sent_at
      )
      .map((item) => item.id);

    if (candidateIds.length === 0) {
      setDialog({
        type: 'alert',
        message: lang.followUpAllNothingToSend
      });
      return;
    }

    setDialog({
      type: 'confirm',
      message: t(lang.followUpAllConfirm, { count: candidateIds.length }),
      onConfirm: async () => {
        setDialog(null);
        setBulkFollowupSending(true);

        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();
          if (!session) return;

          const res = await fetch('/api/send-bulk-invoice-followup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              invoiceIds: candidateIds,
              baseUrl: window.location.origin
            })
          });

          const result = await res.json();

          if (!res.ok) {
            setDialog({
              type: 'alert',
              message: result.error || lang.connectionError
            });
            return;
          }

          // Optimistically update last_followup_sent_at in local state
          const nowIso = new Date().toISOString();
          setInvoices((prev) =>
            prev.map((inv) =>
              candidateIds.includes(inv.id)
                ? { ...inv, last_followup_sent_at: nowIso }
                : inv
            )
          );

          setDialog({
            type: 'alert',
            message: t(lang.followUpAllResult, {
              sent: result.sent ?? 0,
              skipped: result.skipped ?? 0,
              failed: result.failed ?? 0
            })
          });
        } catch {
          setDialog({ type: 'alert', message: lang.connectionError });
        } finally {
          setBulkFollowupSending(false);
        }
      }
    });
  };
  // ─── Render ─────────────────────────────────────────────────────────────────

  const filterOptions: { value: typeof filterStatus; label: string }[] = [
    { value: 'all', label: lang.allProjects },
    { value: 'unpaid', label: lang.invoiceUnpaid },
    { value: 'overdue', label: lang.invoiceOverdue },
    { value: 'paid', label: lang.invoicePaid },
    { value: 'draft', label: lang.draft },
    { value: 'credit_note', label: lang.creditNote }
  ];

  const currentFilterLabel =
    filterOptions.find((o) => o.value === filterStatus)?.label ?? '';

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans relative pb-40">
      <div className="max-w-5xl mx-auto">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              {lang.invoices}
            </h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-0.5">
              {profile?.business_name}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Bulk follow-up — only when there are eligible unpaid invoices */}
            {filteredItems.some(
              (item) =>
                item.itemType === 'invoice' &&
                item.is_locked &&
                !item.is_cancelled &&
                item.payment_status !== 'paid' &&
                item.client_email &&
                item.last_email_sent_at
            ) && (
              <Button
                variant="secondary"
                size="sm"
                loading={bulkFollowupSending}
                loadingText={lang.followUpSending}
                disabled={bulkFollowupSending}
                onClick={handleBulkInvoiceFollowUp}
                icon={
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12c0 4.97-4.03 9-9 9-1.32 0-2.58-.28-3.7-.79l-4.3 1.29 1.29-4.3A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z" />
                  </svg>
                }
              >
                {lang.followUpAllBtn}
              </Button>
            )}

            {/* Excel — matches dashboard green style */}
            <button
              disabled={filteredItems.length === 0}
              onClick={handleExportCSV}
              className="inline-flex items-center justify-center font-black uppercase tracking-widest transition-all duration-200 cursor-pointer select-none whitespace-nowrap px-3 py-2 text-[9px] rounded-lg gap-1.5 bg-green-50/60 text-green-700 border border-green-200 hover:bg-green-100/70 hover:text-green-800 hover:border-green-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              Excel (CSV)
            </button>

            {/* ZIP — matches dashboard ZIP button */}
            <Button
              variant="secondary"
              size="sm"
              disabled={
                archiving ||
                filteredItems.filter(
                  (i) => i.itemType === 'invoice' && i.is_locked
                ).length === 0
              }
              loading={archiving}
              loadingText={lang.archiving}
              onClick={handleDownloadZIP}
              icon={
                <svg
                  className="w-3.5 h-3.5 text-gray-400"
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
              }
            >
              {t(lang.downloadPdfsZip, {
                count: filteredItems.filter(
                  (i) => i.itemType === 'invoice' && i.is_locked
                ).length
              })}
            </Button>

            <LinkButton href="/dashboard" variant="secondary" size="sm">
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
              <span className="ml-1.5">{lang.dashboard}</span>
            </LinkButton>
          </div>
        </div>

        {/* ── Client search ── */}
        {invoices.length > 0 && (
          <div className="flex gap-3 justify-between items-center mb-4">
            <div className="relative flex-1 max-w-md">
              <div className="flex items-start min-h-[52px] border border-gray-200 rounded-xl bg-white shadow-sm focus-within:border-blue-500 transition-colors px-2 py-1.5 cursor-text gap-1">
                {/* Chips + input — flex-wrap so they flow freely */}
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 items-center">
                  {selectedClients.map((name) => (
                    <span
                      key={name}
                      className="flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleClient(name);
                        }}
                        className="text-blue-500 hover:text-blue-800 leading-none cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <input
                    type="text"
                    value={clientSearchText}
                    onChange={(e) => {
                      setClientSearchText(e.target.value);
                      if (e.target.value.length > 0) {
                        setShowClientDropdown(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setShowClientDropdown(false);
                    }}
                    placeholder={
                      selectedClients.length === 0 ? lang.filterByClient : ''
                    }
                    className="flex-1 min-w-[80px] h-[32px] px-2 bg-transparent outline-none text-xs font-bold text-black placeholder-gray-400"
                  />
                </div>

                {/* Clear + arrow — always pinned to top-right */}
                <div className="flex items-center gap-0.5 shrink-0 pt-2">
                  {(selectedClients.length > 0 || clientSearchText) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClients([]);
                        setClientSearchText('');
                        setShowClientDropdown(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md text-xs font-bold transition-colors cursor-pointer"
                      aria-label="Clear filter"
                    >
                      ✕
                    </button>
                  )}

                  {uniqueClientNames.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowClientDropdown((prev) => !prev);
                      }}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-100 rounded-md text-[10px] transition-colors cursor-pointer"
                      aria-label="Toggle client list"
                    >
                      ▼
                    </button>
                  )}
                </div>
              </div>

              {showClientDropdown && uniqueClientNames.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowClientDropdown(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto p-1">
                    {filteredClientNames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = filteredClientNames.every((n) =>
                            selectedClients.includes(n)
                          );
                          if (allSelected) {
                            setSelectedClients((prev) =>
                              prev.filter(
                                (n) => !filteredClientNames.includes(n)
                              )
                            );
                          } else {
                            setSelectedClients((prev) => [
                              ...new Set([...prev, ...filteredClientNames])
                            ]);
                          }
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-2 mb-0.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 rounded-lg border-b border-gray-100 pb-2.5"
                      >
                        {(() => {
                          const allSelected = filteredClientNames.every((n) =>
                            selectedClients.includes(n)
                          );
                          const someSelected = filteredClientNames.some((n) =>
                            selectedClients.includes(n)
                          );
                          return (
                            <>
                              <span
                                className={`w-4 h-4 flex items-center justify-center rounded border-2 shrink-0 transition-colors ${
                                  allSelected
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : someSelected
                                      ? 'bg-blue-50 border-blue-400'
                                      : 'border-gray-300'
                                }`}
                              >
                                {allSelected ? (
                                  <svg
                                    className="w-2.5 h-2.5"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                  >
                                    <polyline points="2 6 5 9 10 3" />
                                  </svg>
                                ) : someSelected ? (
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-sm inline-block" />
                                ) : null}
                              </span>
                              <span>
                                {allSelected
                                  ? lang.deselectAll || 'Deselect All'
                                  : lang.selectAll || 'Select All'}
                              </span>
                            </>
                          );
                        })()}
                      </button>
                    )}
                    {filteredClientNames.length > 0 ? (
                      filteredClientNames.map((name, idx) => {
                        const isSelected = selectedClients.includes(name);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              toggleClient(name);
                              // Keep text so the filtered list stays visible
                              // for continued multi-selection
                            }}
                            className="w-full flex items-center gap-2.5 text-left p-2 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-900 rounded-lg cursor-pointer transition-colors"
                          >
                            <span
                              className={`w-4 h-4 flex items-center justify-center rounded border-2 shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-gray-300'
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  className="w-2.5 h-2.5"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <polyline points="2 6 5 9 10 3" />
                                </svg>
                              )}
                            </span>
                            <span className="truncate">{name}</span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="p-3 text-[10px] font-bold text-gray-400 italic uppercase tracking-widest">
                        {lang.noEstimatesMatch}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Filter + Sort bar ── */}
        {invoices.length > 0 && (
          <div className="bg-white p-3 sm:px-4 sm:py-2.5 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Status filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">
                {lang.statusLabel}
              </span>
              <Listbox value={filterStatus} onChange={setFilterStatus}>
                <div className="relative w-full sm:w-44">
                  <ListboxButton className="w-full py-2 px-3 border border-gray-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[9px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">{currentFilterLabel}</span>
                    <span className="pointer-events-none text-gray-400 text-[8px]">
                      ▼
                    </span>
                  </ListboxButton>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <ListboxOptions className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl max-h-60 overflow-auto focus:outline-none text-[9px] uppercase tracking-widest font-bold">
                      {filterOptions.map((opt, i) => (
                        <ListboxOption
                          key={opt.value}
                          value={opt.value}
                          className={({ active }) =>
                            `cursor-pointer select-none relative py-2 px-3 ${
                              i < filterOptions.length - 1
                                ? 'border-b border-gray-50'
                                : ''
                            } ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                          }
                        >
                          {opt.label}
                        </ListboxOption>
                      ))}
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
            </div>

            {/* Date filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">
                {lang.dateFilterLabel}
              </span>
              <Listbox value={filterDate} onChange={setFilterDate}>
                <div className="relative w-full sm:w-36">
                  <ListboxButton className="w-full py-2 px-3 border border-gray-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[9px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {filterDate === 'all' && lang.allTime}
                      {filterDate === 'this-month' && lang.thisMonth}
                      {filterDate === 'last-30' && lang.last30Days}
                      {filterDate === 'this-year' && lang.thisYear}
                      {filterDate === 'last-year' && lang.lastYear}
                    </span>
                    <span className="pointer-events-none text-gray-400 text-[8px]">
                      ▼
                    </span>
                  </ListboxButton>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <ListboxOptions className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl max-h-60 overflow-auto focus:outline-none text-[9px] uppercase tracking-widest font-bold">
                      {(
                        [
                          ['all', lang.allTime],
                          ['this-month', lang.thisMonth],
                          ['last-30', lang.last30Days],
                          ['this-year', lang.thisYear],
                          ['last-year', lang.lastYear]
                        ] as const
                      ).map(([val, label], i, arr) => (
                        <ListboxOption
                          key={val}
                          value={val}
                          className={({ active }) =>
                            `cursor-pointer select-none relative py-2 px-3 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''} ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                          }
                        >
                          {label}
                        </ListboxOption>
                      ))}
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">
                {lang.sortByLabel}
              </span>
              <Listbox value={sortBy} onChange={setSortBy}>
                <div className="relative w-full sm:w-44">
                  <ListboxButton className="w-full py-2 px-3 border border-gray-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[9px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {sortBy === 'date_desc'
                        ? lang.newestFirst
                        : lang.oldestFirst}
                    </span>
                    <span className="pointer-events-none text-gray-400 text-[8px]">
                      ▼
                    </span>
                  </ListboxButton>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <ListboxOptions className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl overflow-auto focus:outline-none text-[9px] uppercase tracking-widest font-bold">
                      <ListboxOption
                        value="date_desc"
                        className={({ active }) =>
                          `cursor-pointer select-none py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.newestFirst}
                      </ListboxOption>
                      <ListboxOption
                        value="date_asc"
                        className={({ active }) =>
                          `cursor-pointer select-none py-2 px-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.oldestFirst}
                      </ListboxOption>
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
            </div>
          </div>
        )}

        {/* ── List ── */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-xl border border-gray-200">
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                {lang.noInvoicesYet}
              </p>
              <p className="text-gray-400 text-xs mt-2">
                {isFr
                  ? 'Créez une facture depuis un devis approuvé.'
                  : 'Create an invoice from an approved estimate.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isCN = item.itemType === 'credit_note';
              const hoverColor = isCN
                ? 'hover:border-purple-200 hover:ring-purple-200'
                : 'hover:border-blue-200 hover:ring-blue-200';
              const titleHover = isCN
                ? 'group-hover:text-purple-600'
                : 'group-hover:text-blue-600';
              const amountColor = isCN
                ? 'text-purple-700 group-hover:text-purple-700'
                : 'text-gray-800 group-hover:text-blue-600';
              const numberStyle = isCN
                ? 'font-mono bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[10px] font-black'
                : 'font-mono bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-500';

              const docNumber = isCN
                ? item.credit_note_number
                : item.invoice_number;
              const docDate = isCN ? item.credit_note_date : item.invoice_date;
              const amount = isCN
                ? -item.amount_cents
                : item.total_amount_cents;
              const amountLabel = isCN
                ? isFr
                  ? 'Montant'
                  : 'Amount'
                : lang.grandTotal;

              const statusLabel = getStatusLabel(item);
              const statusStyle = getStatusStyle(item);

              const dueDate = !isCN && item.due_date ? item.due_date : null;
              const isDueOverdue =
                dueDate &&
                new Date(dueDate) < new Date() &&
                item.payment_status === 'unpaid';

              return (
                <div
                  key={`${item.itemType}-${item.id}`}
                  onClick={() =>
                    router.push(
                      isCN ? `/credit-notes/${item.id}` : `/invoices/${item.id}`
                    )
                  }
                  className={`bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center ${hoverColor} hover:shadow-md hover:ring-1 hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group`}
                >
                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-start mb-1 sm:mb-0">
                      <div className="flex items-center gap-3">
                        <h3
                          className={`font-black text-lg text-gray-900 ${titleHover} transition-colors`}
                        >
                          {item.client_name || (isFr ? 'Client' : 'Client')}
                        </h3>
                        <span
                          className={`hidden sm:inline-block text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${statusStyle}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      {/* Mobile amount */}
                      <p
                        className={`sm:hidden font-mono font-black text-lg ${isCN ? 'text-purple-600' : 'text-blue-600'}`}
                      >
                        {isCN && '-'}
                        {formatMoney(
                          Math.abs(amount),
                          item.currency_snapshot,
                          item.country_snapshot ||
                            (item.currency_snapshot === 'EUR' ? 'FR' : 'US')
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400 font-medium mt-2 sm:mt-1 flex-wrap">
                      <span className={numberStyle}>{docNumber}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">
                        {formatDate(docDate)}
                      </span>
                      {dueDate && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span
                            className={`hidden sm:inline font-medium ${isDueOverdue ? 'text-red-500 font-bold' : ''}`}
                          >
                            {isFr ? 'Échéance :' : 'Due:'} {formatDate(dueDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-6 mt-4 pt-4 border-t border-gray-100 sm:mt-0 sm:pt-0 sm:border-0">
                    {/* Mobile status badge */}
                    <span
                      className={`sm:hidden text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${statusStyle}`}
                    >
                      {statusLabel}
                    </span>

                    {/* Desktop amount */}
                    <div className="hidden sm:block text-right">
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">
                        {amountLabel}
                      </p>
                      <p
                        className={`font-mono font-black text-xl ${amountColor} transition-colors`}
                      >
                        {isCN && '-'}
                        {formatMoney(
                          Math.abs(amount),
                          item.currency_snapshot,
                          item.country_snapshot ||
                            (item.currency_snapshot === 'EUR' ? 'FR' : 'US')
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        labels={{
          notice: lang.notice,
          cancel: lang.cancel,
          confirmOk: lang.confirmOk
        }}
      />
    </main>
  );
}
