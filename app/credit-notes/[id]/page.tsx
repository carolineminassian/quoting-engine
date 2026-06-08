'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import LoadingDots from '@/components/LoadingDots';
import LinkButton from '@/components/LinkButton';
import Button from '@/components/Button';
import { translations, t } from '@/lib/translations';
import { formatMoney } from '@/lib/formatMoney';

export default function CreditNoteView() {
  const { id } = useParams();
  const router = useRouter();
  const [creditNote, setCreditNote] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch credit note AND the related invoice details for the reference line
      const { data: cn } = await supabase
        .from('credit_notes')
        .select(
          `
          *,
          invoices (
            invoice_number,
            invoice_date
          )
        `
        )
        .eq('id', id)
        .single();

      if (!cn) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('country')
          .eq('id', user.id)
          .single();
        setLang(prof?.country === 'FR' ? translations.FR : translations.US);
        setLoading(false);
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', cn.user_id)
        .single();

      const country = cn.country_snapshot || prof?.country || 'US';
      setLang(country === 'FR' ? translations.FR : translations.US);

      setCreditNote(cn);
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

  const fmt = (cents: number) =>
    formatMoney(
      cents,
      creditNote?.currency_snapshot,
      creditNote?.country_snapshot
    );

  if (loading || !lang) return <LoadingDots />;

  if (!creditNote) {
    return (
      <div className="p-10 text-center font-sans text-xl font-black uppercase text-gray-400">
        {lang?.notFound || 'Credit Note Not Found'}
      </div>
    );
  }

  const isFR = profile?.country === 'FR';

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans print:bg-white flex flex-col">
      <main className="flex-1 p-4 sm:p-8 relative print:p-0">
        <div className="max-w-3xl mx-auto print:max-w-none print:w-full">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 print:hidden justify-between">
            <div className="flex gap-3 items-center">
              <LinkButton href="/invoices" variant="secondary" size="sm">
                ← {lang.invoices}
              </LinkButton>
              <LinkButton
                href={`/invoices/${creditNote.invoice_id}`}
                variant="ghost"
                size="sm"
                className="!text-gray-400 hover:!text-gray-700"
              >
                {lang.viewInvoice} ↗
              </LinkButton>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              className="print:hidden"
            >
              {lang.downloadPdf}
            </Button>
          </div>

          {/* Document */}
          <article className="bg-white shadow-xl border-t-8 border-t-purple-600 border-x border-b border-gray-200 rounded-xl overflow-hidden print:shadow-none print:border-none print:rounded-none">
            <div className="p-8 sm:p-14 print:p-12">
              {/* Header */}
              <header className="flex items-start justify-between gap-6 pb-8 mb-12 border-b border-gray-200">
                <div className="min-w-0">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight break-words">
                    {profile.business_name}
                  </h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] uppercase tracking-[0.25em] font-black text-purple-600 mb-1.5">
                    {lang.creditNote}
                  </p>
                  <p className="font-mono text-sm font-black text-gray-900">
                    {creditNote.credit_note_number}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1 font-medium">
                    {lang.dateLabel}{' '}
                    {new Date(creditNote.credit_note_date).toLocaleDateString(
                      isFR ? 'fr-FR' : 'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric' }
                    )}
                  </p>

                  {/* Original Invoice Reference & PO */}
                  {creditNote.invoices && (
                    <p className="text-[10px] sm:text-xs text-purple-700 mt-2 font-bold">
                      {t(lang.originalInvoiceRef, {
                        ref: creditNote.invoices.invoice_number,
                        date: new Date(
                          creditNote.invoices.invoice_date
                        ).toLocaleDateString(isFR ? 'fr-FR' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      })}
                    </p>
                  )}
                  {creditNote.po_number && (
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 font-medium">
                      {lang.poNumber}: {creditNote.po_number}
                    </p>
                  )}
                </div>
              </header>

              {/* Client Info */}
              <section className="mb-12">
                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-400 mb-3">
                  {lang.clientLabel}
                </p>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-gray-900">
                    {creditNote.client_name}
                  </p>
                  {creditNote.client_email && (
                    <p className="text-sm text-gray-500">
                      {creditNote.client_email}
                    </p>
                  )}
                </div>
              </section>

              {/* Credit Details */}
              <section className="mb-12">
                <div className="flex items-baseline justify-between pb-3 mb-4 border-b-4 border-black">
                  <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-700">
                    {lang.creditNoteAmount}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-400">
                    {lang.amountHeader}
                  </p>
                </div>

                <div className="py-4">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <h3 className="text-base font-bold text-gray-900 flex-1">
                      {creditNote.is_full_credit
                        ? lang.creditNoteFullCredit
                        : lang.creditNotePartialCredit}
                    </h3>
                    <span className="font-mono font-black text-xl text-purple-600 whitespace-nowrap">
                      -{fmt(creditNote.amount_cents)}
                    </span>
                  </div>
                  {creditNote.reason && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap mt-2 pr-12">
                      <span className="font-bold text-gray-900">
                        {lang.creditNoteReason} :{' '}
                      </span>
                      {creditNote.reason}
                    </p>
                  )}
                </div>
              </section>

              {/* Total Summary */}
              <section className="flex justify-end pt-8 mb-12 border-t border-gray-200">
                <div className="w-full sm:w-80">
                  <div className="flex justify-between items-baseline pt-4 border-t-4 border-black">
                    <span className="text-base font-bold text-gray-900 uppercase tracking-wide">
                      {lang.grandTotal}
                    </span>
                    <span className="text-2xl font-black font-mono text-purple-600">
                      -{fmt(creditNote.amount_cents)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Legal & Banking Footer */}
              <div className="mt-16 pt-8 border-t border-gray-200 text-xs text-gray-500">
                {profile?.bank_details && (
                  <div className="mb-4">
                    <p className="font-bold text-gray-900 uppercase tracking-widest text-[10px] mb-1">
                      {lang.bankDetails}
                    </p>
                    <p className="whitespace-pre-wrap">
                      {profile.bank_details}
                    </p>
                  </div>
                )}
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
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
