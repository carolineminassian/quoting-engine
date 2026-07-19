'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import LoadingDots from '@/components/LoadingDots';
import Button from '@/components/Button';
import LinkButton from '@/components/LinkButton';
import { translations, t } from '@/lib/translations';
import { formatMoney } from '@/lib/formatMoney';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { DialogConfig } from '@/components/ConfirmDialog';

export default function CreateCreditNotePage() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isFullCredit, setIsFullCredit] = useState(true);
  const [partialAmount, setPartialAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  useEffect(() => {
    async function fetchData() {
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
        .eq('user_id', user.id)
        .single();

      if (!inv) {
        // Fetch the user's profile to set their preferred language for the error screen
        const { data: prof } = await supabase
          .from('profiles')
          .select('country, default_lang')
          .eq('id', user.id)
          .single();

        const activeLang =
          prof?.default_lang || (prof?.country === 'FR' ? 'FR' : 'EN');
        setLang(activeLang === 'FR' ? translations.FR : translations.US);
        setLoading(false);
        return;
      }

      if (!inv.is_locked) {
        router.push(`/invoices/${id}`);
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', inv.user_id)
        .single();

      // ALWAYS use the invoice's snapshots for language and currency,
      // so a FR invoice stays FR even if the user later moved to the US.
      const invoiceLang = inv.lang_snapshot || 'EN';
      const invoiceCountry = inv.country_snapshot || prof?.country || 'US';
      const invoiceCurrency = inv.currency_snapshot || prof?.currency || 'USD';

      setLang(invoiceLang === 'FR' ? translations.FR : translations.US);

      setPoNumber(inv.po_number || '');

      setInvoice(inv);
      // Create a merged profile object that enforces the invoice's currency/country
      setProfile({
        ...prof,
        country: invoiceCountry,
        currency: invoiceCurrency
      });
      setLoading(false);
    }
    fetchData();
  }, [id, router]);

  const fmt = (cents: number) =>
    formatMoney(cents, profile?.currency, profile?.country);

  const remainingCreditableCents =
    (invoice?.total_amount_cents || 0) - (invoice?.credited_amount_cents || 0);

  const handleSubmit = () => {
    setError('');

    let amountCents: number;
    if (isFullCredit) {
      amountCents = remainingCreditableCents;
    } else {
      const parsed = parseFloat(partialAmount);
      if (!parsed || parsed <= 0) {
        setError(lang.invalidAmountEntered);
        return;
      }
      amountCents = Math.round(parsed * 100);
      if (amountCents > remainingCreditableCents) {
        setError(
          t(lang.amountExceedsLimit, { limit: fmt(remainingCreditableCents) })
        );
        return;
      }
    }

    if (!reason.trim()) {
      setError(lang.pleaseProvideReason);
      return;
    }

    const capturedAmount = amountCents;
    setDialog({
      type: isFullCredit ? 'danger' : 'confirm',
      title: isFullCredit
        ? lang.creditNoteFullCancelTitle
        : lang.creditNotePartialTitle,
      message: isFullCredit
        ? t(lang.creditNoteFullCancelMessage, {
            amount: fmt(capturedAmount),
            number: invoice.invoice_number
          })
        : t(lang.creditNotePartialMessage, {
            amount: fmt(capturedAmount),
            number: invoice.invoice_number
          }),
      onConfirm: async () => {
        setDialog(null);
        setSubmitting(true);
        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();
          if (!session) return;
          const res = await fetch('/api/create-credit-note', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              invoiceId: id,
              amountCents: capturedAmount,
              isFullCredit,
              reason,
              poNumber
            })
          });
          const data = await res.json();
          if (res.ok) {
            router.push(`/invoices/${id}`);
          } else {
            setError(data.error || lang.creditNoteError);
          }
        } catch {
          setError(lang.connectionError);
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  if (loading || !lang) return <LoadingDots />;

  if (!invoice) {
    return (
      <div className="p-10 text-center font-sans text-xl font-black uppercase text-gray-400">
        {lang.notFound}
      </div>
    );
  }

  const currencySymbol = profile?.currency === 'EUR' ? '€' : '$';

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8 text-black font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <LinkButton href={`/invoices/${id}`} variant="secondary" size="sm">
            ← {lang.relatedInvoice}
          </LinkButton>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h1 className="text-2xl font-black uppercase tracking-tighter mb-1">
            {lang.createCreditNote}
          </h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widests mb-8">
            {lang.invoiceLabel} {invoice.invoice_number} ·{' '}
            {fmt(invoice.total_amount_cents)}
          </p>

          {/* Already credited indicator */}
          {(invoice.credited_amount_cents || 0) > 0 && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-bold text-amber-700">
                {t(lang.alreadyCreditedWarning, {
                  credited: fmt(invoice.credited_amount_cents),
                  remaining: fmt(remainingCreditableCents)
                })}
              </p>
            </div>
          )}

          {/* Credit type selection */}
          <div className="mb-6">
            <label className="block text-[10px] font-black uppercase tracking-widests text-gray-400 mb-3">
              {lang.creditTypeSelectorLabel}
            </label>
            <div className="flex border border-gray-200 rounded-xl p-1 bg-gray-50/50 gap-1">
              <button
                type="button"
                onClick={() => setIsFullCredit(true)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-[10px] font-black uppercase tracking-widests transition-all duration-200 cursor-pointer ${
                  isFullCredit
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {lang.creditNoteFullCredit}
              </button>
              <button
                type="button"
                onClick={() => setIsFullCredit(false)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-[10px] font-black uppercase tracking-widests transition-all duration-200 cursor-pointer ${
                  !isFullCredit
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {lang.creditNotePartialCredit}
              </button>
            </div>
          </div>

          {/* Full credit summary */}
          {isFullCredit && (
            <div className="mb-6 space-y-3">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] font-black uppercase tracking-widests text-gray-400">
                    {lang.creditNoteAmount}
                  </span>
                  <span className="text-xl font-black font-mono text-gray-900">
                    {fmt(remainingCreditableCents)}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
                <span className="text-red-500 text-base leading-none mt-0.5">
                  ⚠
                </span>
                <div>
                  <p className="text-xs font-bold text-red-700">
                    {lang.creditNoteFullWarningTitle}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
                    {t(lang.creditNoteFullWarning, {
                      amount: fmt(remainingCreditableCents),
                      number: invoice.invoice_number
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Partial amount input */}
          {!isFullCredit && (
            <div className="mb-6">
              <label className="block text-[10px] font-black uppercase tracking-widests text-gray-400 mb-2">
                {lang.creditNoteAmount} ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={(remainingCreditableCents / 100).toFixed(2)}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold text-gray-900 text-sm"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                {lang.maxLabel} : {fmt(remainingCreditableCents)}
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="mb-6">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              {lang.creditNoteReason} *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={lang.creditNoteReasonPlaceholder}
              maxLength={500}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none text-gray-900 placeholder-gray-400"
            />
          </div>

          {/* PO Number */}
          <div className="mb-6">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              {lang.poNumber}{' '}
              <span className="font-medium normal-case tracking-normal opacity-70">
                (Optional)
              </span>
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder={lang.poPlaceholder}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-gray-900 placeholder-gray-400"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-6 mt-6 border-t border-gray-100">
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <LinkButton
                href={`/invoices/${id}`}
                variant="secondary"
                size="md"
                className="w-full sm:w-40 justify-center"
              >
                {lang.cancel}
              </LinkButton>
              <Button
                variant={isFullCredit ? 'danger' : 'primary'}
                size="md"
                loading={submitting}
                loadingText="..."
                onClick={handleSubmit}
                className="w-full sm:w-48 justify-center"
              >
                {isFullCredit
                  ? lang.creditNoteFullWarningTitle
                  : lang.createCreditNote}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        labels={{
          notice: lang.notice || 'Notice',
          cancel: lang.cancel,
          confirmOk: lang.creditNoteConfirmPartial,
          deletePermanently: lang.creditNoteConfirmFull
        }}
      />
    </main>
  );
}
