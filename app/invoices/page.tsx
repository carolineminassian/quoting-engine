'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations, t } from '@/lib/translations';
import { formatMoney } from '@/lib/formatMoney';
import LoadingDots from '@/components/LoadingDots';
import LinkButton from '@/components/LinkButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import Button from '@/components/Button';

// Native browser download helper (replaces the need for the file-saver package)
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
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<any>(null);
  const [archiving, setArchiving] = useState(false);

  const [filterStatus, setFilterStatus] = useState<
    'all' | 'draft' | 'paid' | 'unpaid' | 'overdue' | 'credit_note'
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

      // Fetch invoices
      const { data: invs } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id);

      // Fetch credit notes
      const { data: cns } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('user_id', user.id);

      // Normalize and combine
      const combined = [
        ...(invs || []).map((i) => ({
          ...i,
          itemType: 'invoice',
          dateKey: i.created_at
        })),
        ...(cns || []).map((c) => ({
          ...c,
          itemType: 'credit_note',
          dateKey: c.created_at
        }))
      ].sort(
        (a, b) => new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime()
      );

      setInvoices(combined);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  if (loading || !lang) return <LoadingDots />;

  // Compute payment status (overdue is computed client-side)
  const getPaymentStatus = (inv: any): string => {
    if (inv.itemType === 'credit_note') return lang.creditNote || 'Credit Note';
    if (inv.is_cancelled) return lang.invoiceCancelled;
    if (inv.payment_status === 'paid') return lang.invoicePaid;
    if (inv.payment_status === 'partial') return lang.invoicePartial;
    if (!inv.is_locked) return lang.invoiceDraft;
    if (
      inv.due_date &&
      new Date(inv.due_date) < new Date() &&
      inv.payment_status === 'unpaid'
    ) {
      return lang.invoiceOverdue;
    }
    if (inv.last_email_sent_at) return lang.invoiceSent;
    return lang.invoiceUnpaid;
  };

  const getStatusColor = (inv: any): string => {
    if (inv.itemType === 'credit_note') return 'bg-purple-50 text-purple-600';
    if (inv.is_cancelled) return 'bg-gray-100 text-gray-500';
    if (inv.payment_status === 'paid') return 'bg-green-50 text-green-600';
    if (inv.payment_status === 'partial') return 'bg-blue-50 text-blue-600';
    if (!inv.is_locked) return 'bg-yellow-50 text-yellow-600';
    if (
      inv.due_date &&
      new Date(inv.due_date) < new Date() &&
      inv.payment_status === 'unpaid'
    ) {
      return 'bg-red-50 text-red-600';
    }
    if (inv.last_email_sent_at) return 'bg-blue-50 text-blue-600';
    return 'bg-gray-50 text-gray-600';
  };

  // Process filters once so it can be used for UI and Exports
  const filteredItems = invoices.filter((inv) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'credit_note') return inv.itemType === 'credit_note';

    // For standard invoice filters, exclude credit notes entirely
    if (inv.itemType !== 'invoice') return false;

    if (filterStatus === 'draft') return !inv.is_locked;
    if (filterStatus === 'paid') return inv.payment_status === 'paid';
    if (filterStatus === 'unpaid')
      return (
        inv.is_locked && !inv.is_cancelled && inv.payment_status !== 'paid'
      );
    if (filterStatus === 'overdue')
      return (
        inv.is_locked &&
        !inv.is_cancelled &&
        inv.payment_status === 'unpaid' &&
        inv.due_date &&
        new Date(inv.due_date) < new Date()
      );
    return true;
  });

  const getCSVContent = () => {
    const headers = [
      'Type',
      'Document Number',
      'Date',
      'Client Name',
      'Status',
      'Amount',
      'Currency'
    ];

    const rows = filteredItems.map((item) => {
      const isCredit = item.itemType === 'credit_note';
      return [
        isCredit ? 'Credit Note' : 'Invoice',
        isCredit ? item.credit_note_number : item.invoice_number,
        new Date(
          isCredit ? item.credit_note_date : item.invoice_date
        ).toLocaleDateString(),
        `"${item.client_name || 'Client'}"`,
        isCredit ? 'Issued' : getPaymentStatus(item),
        (isCredit ? -item.amount_cents : item.total_amount_cents) / 100,
        item.currency_snapshot || profile?.currency || 'USD'
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  };

  const handleExportExcel = () => {
    const csvContent = getCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(
      blob,
      `Billing_Export_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleDownloadZIP = async () => {
    if (filteredItems.length === 0) return;
    setArchiving(true);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Include the CSV export automatically in the ZIP bundle
      const csvContent = getCSVContent();
      zip.file(
        `Billing_Summary_${new Date().toISOString().split('T')[0]}.csv`,
        csvContent
      );

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(
        content,
        `Billing_Archive_${new Date().toISOString().split('T')[0]}.zip`
      );
    } catch (err) {
      console.error(err);
      setDialog({ type: 'alert', message: 'Failed to generate ZIP archive.' });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans relative pb-40">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              {lang.invoices}
            </h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-0.5">
              {profile?.business_name}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button variant="secondary" size="sm" onClick={handleExportExcel}>
              Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadZIP}
              loading={archiving}
            >
              ZIP
            </Button>
            <LinkButton href="/dashboard" variant="secondary" size="sm">
              ← {lang.dashboard}
            </LinkButton>
          </div>
        </div>

        {/* Filters */}
        {invoices.length > 0 && (
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-6 flex gap-2 w-full sm:w-auto">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0 self-center px-2">
              {lang.filterLabel || 'Filter:'}
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${filterStatus === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {profile?.country === 'FR' ? 'Toutes' : 'All'}
              </button>
              <button
                onClick={() => setFilterStatus('unpaid')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${filterStatus === 'unpaid' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
              >
                {lang.invoiceUnpaid}
              </button>
              <button
                onClick={() => setFilterStatus('overdue')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${filterStatus === 'overdue' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
              >
                {lang.invoiceOverdue}
              </button>
              <button
                onClick={() => setFilterStatus('paid')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${filterStatus === 'paid' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
              >
                {lang.invoicePaid}
              </button>
              <button
                onClick={() => setFilterStatus('draft')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${filterStatus === 'draft' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}
              >
                {lang.invoiceDraft}
              </button>
              <button
                onClick={() => setFilterStatus('credit_note')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${filterStatus === 'credit_note' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
              >
                {lang.creditNote ||
                  (profile?.country === 'FR' ? 'Avoirs' : 'Credit Notes')}
              </button>
            </div>
          </div>
        )}

        {/* Invoice list */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-xl border border-gray-200">
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                {lang.noInvoicesYet}
              </p>
              <p className="text-gray-400 text-xs mt-2">
                {profile?.country === 'FR'
                  ? 'Créez une facture depuis un devis approuvé.'
                  : 'Create an invoice from an approved estimate.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              // --- CREDIT NOTE CARD ---
              if (item.itemType === 'credit_note') {
                return (
                  <div
                    key={`cn-${item.id}`}
                    onClick={() => router.push(`/credit-notes/${item.id}`)}
                    className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md hover:border-purple-200 hover:ring-1 hover:ring-purple-200 hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group"
                  >
                    <div className="flex-1 w-full">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-black text-lg text-gray-900 group-hover:text-purple-600 transition-colors">
                            {item.client_name ||
                              (profile?.country === 'FR' ? 'Client' : 'Client')}
                          </h3>
                          <span className="hidden sm:inline-block text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm bg-purple-50 text-purple-600">
                            {lang.creditNote ||
                              (profile?.country === 'FR'
                                ? 'Avoir'
                                : 'Credit Note')}
                          </span>
                        </div>
                        <p className="sm:hidden font-mono font-black text-lg text-purple-600">
                          -
                          {formatMoney(
                            item.amount_cents,
                            item.currency_snapshot,
                            item.country_snapshot
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 font-medium mt-2 sm:mt-1">
                        <span className="font-mono bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[10px] font-black">
                          {item.credit_note_number}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">
                          {new Date(item.credit_note_date).toLocaleDateString(
                            profile?.country === 'FR' ? 'fr-FR' : 'en-US',
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-6 mt-4 pt-4 border-t border-gray-100 sm:mt-0 sm:pt-0 sm:border-0">
                      <span className="sm:hidden text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm bg-purple-50 text-purple-600">
                        {lang.creditNote ||
                          (profile?.country === 'FR' ? 'Avoir' : 'Credit Note')}
                      </span>
                      <div className="hidden sm:block text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">
                          {profile?.country === 'FR' ? 'Montant' : 'Amount'}
                        </p>
                        <p className="font-mono font-black text-xl text-gray-800 group-hover:text-purple-600 transition-colors">
                          -
                          {formatMoney(
                            item.amount_cents,
                            item.currency_snapshot,
                            item.country_snapshot
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }

              // --- STANDARD INVOICE CARD ---
              return (
                <div
                  key={`inv-${item.id}`}
                  onClick={() => router.push(`/invoices/${item.id}`)}
                  className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md hover:border-blue-200 hover:ring-1 hover:ring-blue-200 hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group"
                >
                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                          {item.client_name ||
                            (profile?.country === 'FR' ? 'Client' : 'Client')}
                        </h3>
                        <span
                          className={`hidden sm:inline-block text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${getStatusColor(item)}`}
                        >
                          {getPaymentStatus(item)}
                        </span>
                      </div>
                      <p className="sm:hidden font-mono font-black text-lg text-blue-600">
                        {formatMoney(
                          item.total_amount_cents,
                          item.currency_snapshot,
                          item.currency_snapshot === 'EUR' ? 'FR' : 'US'
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400 font-medium mt-2 sm:mt-1">
                      <span className="font-mono bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black">
                        {item.invoice_number}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">
                        {new Date(item.invoice_date).toLocaleDateString(
                          profile?.country === 'FR' ? 'fr-FR' : 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' }
                        )}
                      </span>
                      {item.due_date && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span
                            className={`hidden sm:inline ${
                              new Date(item.due_date) < new Date() &&
                              item.payment_status === 'unpaid'
                                ? 'text-red-500 font-bold'
                                : ''
                            }`}
                          >
                            {profile?.country === 'FR' ? 'Échéance :' : 'Due:'}{' '}
                            {new Date(item.due_date).toLocaleDateString(
                              profile?.country === 'FR' ? 'fr-FR' : 'en-US',
                              {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              }
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-6 mt-4 pt-4 border-t border-gray-100 sm:mt-0 sm:pt-0 sm:border-0">
                    <span
                      className={`sm:hidden text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${getStatusColor(item)}`}
                    >
                      {getPaymentStatus(item)}
                    </span>
                    <div className="hidden sm:block text-right">
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">
                        {lang.grandTotal}
                      </p>
                      <p className="font-mono font-black text-xl text-gray-800 group-hover:text-blue-600 transition-colors">
                        {formatMoney(
                          item.total_amount_cents,
                          item.currency_snapshot,
                          item.currency_snapshot === 'EUR' ? 'FR' : 'US'
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
