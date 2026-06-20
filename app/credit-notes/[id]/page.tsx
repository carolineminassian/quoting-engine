'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import LoadingDots from '@/components/LoadingDots';
import LinkButton from '@/components/LinkButton';
import Button from '@/components/Button';
import { translations, t } from '@/lib/translations';
import { formatMoney } from '@/lib/formatMoney';
import {
  buildMaterialsMap,
  getEffectiveLaborRateCents,
  getEffectiveItemCostCents,
  getAdditionalChargeAmountCents
} from '@/lib/estimateCalculations';

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
  )
};

export default function CreditNoteView() {
  const { id } = useParams();
  const router = useRouter();

  const [creditNote, setCreditNote] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      // Allow guest viewing

      const { data: cn } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('id', id)
        .single();

      if (!cn) {
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('country')
            .eq('id', user.id)
            .single();
          setLang(prof?.country === 'FR' ? translations.FR : translations.US);
        } else {
          setLang(translations.US);
        }
        setLoading(false);
        return;
      }

      const [profRes, invRes, matsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', cn.user_id).single(),
        cn.invoice_id
          ? supabase
              .from('invoices')
              .select('*')
              .eq('id', cn.invoice_id)
              .single()
          : Promise.resolve({ data: null }),
        supabase.from('materials').select('*').eq('user_id', cn.user_id)
      ]);

      const prof = profRes.data;
      const inv = invRes.data;
      const country = cn.country_snapshot || prof?.country || 'US';

      setLang(country === 'FR' ? translations.FR : translations.US);
      setIsOwner(!!user && user.id === cn.user_id);
      setCreditNote(cn);
      setInvoice(inv || null);
      setMaterials(matsRes.data || []);
      setProfile({
        ...prof,
        business_name: cn.business_name_snapshot || prof?.business_name,
        country: cn.country_snapshot || prof?.country,
        currency: cn.currency_snapshot || prof?.currency
      });
      setLoading(false);
    }
    fetchData();
  }, [id, router]);

  const materialsById = useMemo(
    () => buildMaterialsMap(materials),
    [materials]
  );

  const fmt = (cents: number) =>
    formatMoney(
      cents,
      creditNote?.currency_snapshot,
      creditNote?.country_snapshot
    );

  const handleDownloadPDF = async () => {
    setLoadingPdf(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      // InvoicePDF lives in app/invoices/[id]/InvoicePDF.tsx
      const InvoicePDF = (await import('../../invoices/[id]/InvoicePDF'))
        .default;

      const isFr = profile?.country === 'FR';
      const currentLang = isFr ? translations.FR : translations.US;
      const taxRate =
        invoice?.tax_rate_snapshot ?? profile?.default_tax_rate ?? 0;

      const invContext = {
        margin_mode_snapshot: invoice?.margin_mode_snapshot,
        global_margin_snapshot: invoice?.global_margin_snapshot,
        tax_rate_snapshot: invoice?.tax_rate_snapshot
      };

      let preparedSections: any[] = [];
      let preparedLineItems: any[] | undefined = undefined;
      let preparedAdditionalCharges: any[] = [];
      let subtotal = 0;
      let taxGroupsArr: [string, number][] = [];

      // For full credit notes, mirror the original invoice structure in the PDF
      if (creditNote.is_full_credit && invoice) {
        const hasSections =
          Array.isArray(invoice.sections) && invoice.sections.length > 0;

        if (hasSections) {
          preparedSections = invoice.sections.map((sec: any) => {
            let sectionTotal = 0;
            if (sec.laborHours > 0)
              sectionTotal += Math.round(
                sec.laborHours * getEffectiveLaborRateCents(invContext, sec)
              );
            (sec.items || []).forEach((item: any) => {
              sectionTotal += Math.round(
                (item.qty || 0) *
                  getEffectiveItemCostCents(
                    invContext,
                    sec,
                    item,
                    materialsById
                  )
              );
            });
            return {
              title: sec.title || (isFr ? 'Prestation' : 'Service'),
              description: sec.description || '',
              total: sectionTotal / 100,
              hasDetails: invoice.show_details_snapshot === true,
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
            };
          });

          preparedAdditionalCharges = (invoice.additional_charges || []).map(
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
                invoice.sections || [],
                materialsById
              ),
              basisLabel: currentLang.basisProject
            })
          );
        } else if (
          Array.isArray(invoice.line_items) &&
          invoice.line_items.length > 0
        ) {
          preparedLineItems = invoice.line_items;
        }

        // Use stored totals for subtotal / tax rows
        const storedSubtotal =
          invoice.subtotal_cents || invoice.subtotal_amount_cents || 0;
        const storedTax = invoice.tax_amount_cents || 0;
        subtotal = storedSubtotal / 100;
        if (storedTax > 0) {
          taxGroupsArr = [[String(taxRate), storedTax]];
        }
      }

      const blob = await pdf(
        <InvoicePDF
          creditNote={{
            ...creditNote,
            relatedInvoiceNumber: invoice?.invoice_number
          }}
          profile={profile}
          lang={currentLang}
          subtotal={subtotal}
          taxGroups={taxGroupsArr as any}
          grandTotal={creditNote.amount_cents / 100}
          sections={preparedSections}
          lineItems={preparedLineItems}
          additionalCharges={preparedAdditionalCharges}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentLang.creditNote || 'Credit-Note'}-${creditNote.credit_note_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Credit note PDF error:', err);
    } finally {
      setLoadingPdf(false);
    }
  };

  if (loading || !lang) return <LoadingDots />;

  if (!creditNote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {lang?.notFound || 'Credit Note Not Found'}
          </h2>
          <LinkButton href="/invoices" variant="primary" size="md">
            {lang.invoices}
          </LinkButton>
        </div>
      </div>
    );
  }

  const isFR = profile?.country === 'FR';
  const isFullCredit = creditNote.is_full_credit;

  const invContext = {
    margin_mode_snapshot: invoice?.margin_mode_snapshot,
    global_margin_snapshot: invoice?.global_margin_snapshot,
    tax_rate_snapshot: invoice?.tax_rate_snapshot
  };

  const hasSections =
    isFullCredit &&
    invoice &&
    Array.isArray(invoice.sections) &&
    invoice.sections.length > 0;

  const hasLineItems =
    isFullCredit &&
    invoice &&
    !hasSections &&
    Array.isArray(invoice.line_items) &&
    invoice.line_items.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900 font-sans flex flex-col">
      <main className="flex-1 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          {/* ── Toolbar ── owner only */}
          {isOwner && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 justify-between">
              <div className="flex gap-3 items-center">
                <LinkButton href="/invoices" variant="secondary" size="sm">
                  <Icons.ArrowLeft />
                  <span className="ml-1.5">{lang.invoices}</span>
                </LinkButton>
                {creditNote.invoice_id && (
                  <LinkButton
                    href={`/invoices/${creditNote.invoice_id}`}
                    variant="ghost"
                    size="sm"
                    className="!text-gray-400 hover:!text-gray-700"
                  >
                    <span>{lang.viewInvoice}</span>
                    <Icons.ExternalLink />
                  </LinkButton>
                )}
              </div>
              <Button
                variant="primary"
                size="md"
                loading={loadingPdf}
                onClick={handleDownloadPDF}
                icon={<Icons.Download />}
              >
                {lang.downloadInvoice ||
                  (isFR ? 'Télécharger PDF' : 'Download PDF')}
              </Button>
            </div>
          )}{' '}
          {/* end isOwner toolbar */}
          {/* Guest download bar */}
          {!isOwner && !loading && creditNote && (
            <div className="flex sm:justify-end mb-6">
              <Button
                variant="primary"
                size="md"
                loading={loadingPdf}
                onClick={handleDownloadPDF}
                icon={<Icons.Download />}
                className="w-full sm:w-auto"
              >
                {lang.downloadInvoice}
              </Button>
            </div>
          )}
          {/* ── Document ── */}
          <article className="bg-white shadow-xl border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-8 sm:p-12">
              {/* Header */}
              <header className="flex items-start justify-between gap-6 pb-8 mb-10 border-b border-gray-200">
                <div className="flex items-center gap-4 min-w-0">
                  {profile?.subscription_tier === 'pro' &&
                    profile?.logo_url && (
                      <img
                        src={profile.logo_url}
                        alt=""
                        className="h-12 sm:h-14 w-auto object-contain shrink-0"
                      />
                    )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight break-words">
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
                            {profile.country === 'US'
                              ? `${profile.business_city || ''}${profile.business_state ? `, ${profile.business_state}` : ''} ${profile.business_zip || ''}`.trim()
                              : [profile.business_zip, profile.business_city]
                                  .filter(Boolean)
                                  .join(' ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-purple-600">
                    {lang.creditNote}
                  </p>
                  <p className="font-mono text-sm sm:text-base font-bold text-gray-900">
                    {creditNote.credit_note_number}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs text-gray-500 font-medium">
                      {lang.creditNoteDateLabel ||
                        (isFR ? "Date de l'avoir :" : 'Credit note date:')}{' '}
                      {new Date(creditNote.credit_note_date).toLocaleDateString(
                        isFR ? 'fr-FR' : 'en-US',
                        { year: 'numeric', month: 'short', day: 'numeric' }
                      )}
                    </p>
                    {invoice && (
                      <p className="text-xs text-purple-600 font-bold">
                        {t(lang.originalInvoiceRef, {
                          ref: invoice.invoice_number,
                          date: new Date(
                            invoice.invoice_date
                          ).toLocaleDateString(isFR ? 'fr-FR' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        })}
                      </p>
                    )}
                    {creditNote.po_number && (
                      <p className="text-xs text-gray-500 font-medium">
                        {lang.poNumber}: {creditNote.po_number}
                      </p>
                    )}
                  </div>
                </div>
              </header>

              {/* Client */}
              <section className="mb-10">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-400 mb-3">
                  {lang.clientLabel}
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {creditNote.client_name}
                </p>
                {creditNote.client_email && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {creditNote.client_email}
                  </p>
                )}
              </section>

              {/* Credit type + reason banner */}
              <section className="mb-10 p-4 bg-purple-50 border border-purple-100 rounded-xl flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-purple-900">
                    {isFullCredit
                      ? lang.creditNoteFullCredit
                      : lang.creditNotePartialCredit}
                  </p>
                  {creditNote.reason && (
                    <p className="text-sm text-purple-700 mt-1.5 whitespace-pre-wrap leading-relaxed">
                      <span className="font-bold">
                        {lang.creditNoteReason}:{' '}
                      </span>
                      {creditNote.reason}
                    </p>
                  )}
                </div>
                <span className="font-mono font-black text-xl text-purple-700 whitespace-nowrap shrink-0">
                  -{fmt(creditNote.amount_cents)}
                </span>
              </section>

              {/* ── Original invoice sections (full credit only) ── */}
              {hasSections && (
                <section className="mb-10">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-400 mb-4">
                    {lang.cancelledInvoiceBreakdown}
                  </p>

                  {/* Sections */}
                  <div className="flex items-baseline justify-between pb-3 mb-2 border-b-2 border-gray-900">
                    <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-700">
                      {lang.serviceCategoryHeader}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-700">
                      {lang.amountHeader}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {invoice.sections.map((sec: any, idx: number) => {
                      let sectionTotal = 0;
                      if (sec.laborHours > 0)
                        sectionTotal += Math.round(
                          sec.laborHours *
                            getEffectiveLaborRateCents(invContext, sec)
                        );
                      (sec.items || []).forEach((item: any) => {
                        sectionTotal += Math.round(
                          (item.qty || 0) *
                            getEffectiveItemCostCents(
                              invContext,
                              sec,
                              item,
                              materialsById
                            )
                        );
                      });
                      return (
                        <div key={idx} className="py-5 first:pt-2">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <h3 className="text-base font-bold text-gray-900">
                              {sec.title || lang.professionalServices}
                            </h3>
                            <span className="font-mono font-bold text-base text-gray-900 tabular-nums whitespace-nowrap">
                              {fmt(sectionTotal)}
                            </span>
                          </div>
                          {sec.description && (
                            <p className="text-sm text-gray-500 whitespace-pre-wrap mb-2">
                              {sec.description}
                            </p>
                          )}
                          {sec.items && sec.items.length > 0 && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                              {sec.items.map((item: any, i: number) => {
                                const m = materialsById.get(item.materialId);
                                return (
                                  <span
                                    key={i}
                                    className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100"
                                  >
                                    <span className="font-medium text-gray-700">
                                      {item.name || m?.name || lang.itemLabel}
                                    </span>
                                    {item.qty > 0 && (
                                      <span className="text-gray-400">
                                        {' '}
                                        · {item.qty}
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Additional charges */}
                  {invoice.additional_charges &&
                    invoice.additional_charges.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-gray-100">
                        <div className="flex items-baseline justify-between pb-3 mb-2 border-b border-gray-200">
                          <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-500">
                            {lang.additionalCharges}
                          </p>
                          <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-gray-500">
                            {lang.amountHeader}
                          </p>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {invoice.additional_charges.map(
                            (charge: any, idx: number) => {
                              const amountCents =
                                getAdditionalChargeAmountCents(
                                  invContext,
                                  charge,
                                  invoice.sections || [],
                                  materialsById
                                );
                              return (
                                <div
                                  key={idx}
                                  className="py-3 flex justify-between items-center"
                                >
                                  <p className="text-sm font-medium text-gray-700">
                                    {charge.name || lang.additionalCharges}
                                  </p>
                                  <span className="font-mono text-sm font-bold text-gray-900 tabular-nums">
                                    {fmt(amountCents)}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}
                </section>
              )}

              {/* ── Flat line items (full credit, flat invoice) ── */}
              {hasLineItems && (
                <section className="mb-10">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-400 mb-4">
                    {lang.cancelledInvoiceBreakdown}
                  </p>
                  <div className="divide-y divide-gray-100">
                    {invoice.line_items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="py-3 flex justify-between items-start gap-4"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {item.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.quantity} × {fmt(item.unit_price_cents)}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-bold text-gray-900 tabular-nums">
                          {fmt(item.amount_cents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Totals ── */}
              <section className="flex justify-end pt-8 mb-10 border-t-2 border-gray-200">
                <div className="w-full sm:w-80 space-y-3">
                  {/* Show subtotal/tax breakdown for full credit notes */}
                  {isFullCredit && invoice && (
                    <>
                      {(invoice.subtotal_cents ||
                        invoice.subtotal_amount_cents) > 0 && (
                        <div className="flex justify-between items-baseline text-sm">
                          <span className="text-gray-500">
                            {lang.invoiceSubtotal ||
                              (isFR ? 'Sous-total HT' : 'Subtotal')}
                          </span>
                          <span className="font-mono text-gray-700 tabular-nums">
                            {fmt(
                              invoice.subtotal_cents ||
                                invoice.subtotal_amount_cents ||
                                0
                            )}
                          </span>
                        </div>
                      )}
                      {(invoice.tax_amount_cents || 0) > 0 && (
                        <div className="flex justify-between items-baseline text-sm">
                          <span className="text-gray-500">
                            {lang.tax} ({invoice.tax_rate_snapshot ?? 0}%)
                          </span>
                          <span className="font-mono text-gray-700 tabular-nums">
                            {fmt(invoice.tax_amount_cents)}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-between items-baseline pt-5 border-t-2 border-gray-900">
                    <span className="text-base font-bold text-gray-900 uppercase tracking-wide">
                      {lang.grandTotalLabel}
                    </span>
                    <span className="text-2xl font-black font-mono text-purple-600 tabular-nums">
                      -{fmt(creditNote.amount_cents)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Footer — compliance + terms */}
              <footer className="mt-12 pt-8 border-t border-gray-100">
                {(profile?.bank_name || profile?.bank_account_number) && (
                  <div className="mb-8 pb-6 border-b border-gray-100">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 mb-3">
                      {lang.bankWireInstructions}
                    </p>
                    <div className="text-sm text-gray-500 space-y-0.5">
                      {profile.bank_name && (
                        <p>
                          <span className="font-semibold text-gray-400">
                            {lang.bankLabel}:
                          </span>{' '}
                          {profile.bank_name}
                        </p>
                      )}
                      {profile.bank_account_number && (
                        <p>
                          <span className="font-semibold text-gray-400">
                            {lang.bankAccountNumberLabel}:
                          </span>{' '}
                          <span className="font-mono tracking-wider">
                            {profile.bank_account_number}
                          </span>
                        </p>
                      )}
                      {profile.bank_routing_number && (
                        <p>
                          <span className="font-semibold text-gray-400">
                            {lang.bicSwiftLabel}:
                          </span>{' '}
                          <span className="font-mono tracking-wider">
                            {profile.bank_routing_number}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

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
                      {isFR
                        ? "Cet avoir annule et remplace en tout ou partie la facture référencée ci-dessus. Aucune date d'échéance applicable."
                        : 'This credit note cancels and supersedes the referenced invoice in full or in part. No payment due date applies.'}
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                  <p className="text-[10px] font-bold text-gray-600">
                    {profile.business_name}
                  </p>
                  {(profile?.business_address || profile?.business_city) && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {[
                        profile.business_address,
                        profile.country === 'US'
                          ? `${profile.business_city || ''}${profile.business_state ? `, ${profile.business_state}` : ''} ${profile.business_zip || ''}`.trim()
                          : `${profile.business_zip || ''} ${profile.business_city || ''}`.trim()
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {(profile?.company_reg_number || profile?.vat_number) && (
                    <div className="flex flex-wrap justify-center gap-4 mt-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
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
                  )}
                </div>
              </footer>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
