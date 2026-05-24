'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations, t } from '@/lib/translations';
import { formatMoney } from '@/lib/formatMoney';
import LoadingDots from '@/components/LoadingDots';
import LinkButton from '@/components/LinkButton';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<any>(null);

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

      const { data: invs } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setInvoices(invs || []);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  if (loading || !lang) return <LoadingDots />;

  // Compute payment status (overdue is computed client-side)
  const getPaymentStatus = (inv: any): string => {
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

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans relative pb-40">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              {lang.invoices}
            </h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-0.5">
              {profile?.business_name}
            </p>
          </div>
          <LinkButton href="/dashboard" variant="secondary" size="sm">
            ← {lang.dashboard}
          </LinkButton>
        </div>

        {/* Invoice list */}
        <div className="space-y-4">
          {invoices.length === 0 ? (
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
            invoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => router.push(`/invoices/${inv.id}`)}
                className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md hover:border-blue-200 hover:ring-1 hover:ring-blue-200 hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group"
              >
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                        {inv.client_name ||
                          (profile?.country === 'FR' ? 'Client' : 'Client')}
                      </h3>
                      <span
                        className={`hidden sm:inline-block text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${getStatusColor(inv)}`}
                      >
                        {getPaymentStatus(inv)}
                      </span>
                    </div>
                    <p className="sm:hidden font-mono font-black text-lg text-blue-600">
                      {formatMoney(
                        inv.total_amount_cents,
                        inv.currency_snapshot,
                        inv.currency_snapshot === 'EUR' ? 'FR' : 'US'
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-400 font-medium mt-2 sm:mt-1">
                    <span className="font-mono bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black">
                      {inv.invoice_number}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">
                      {new Date(inv.invoice_date).toLocaleDateString(
                        profile?.country === 'FR' ? 'fr-FR' : 'en-US',
                        { year: 'numeric', month: 'short', day: 'numeric' }
                      )}
                    </span>
                    {inv.due_date && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span
                          className={`hidden sm:inline ${
                            new Date(inv.due_date) < new Date() &&
                            inv.payment_status === 'unpaid'
                              ? 'text-red-500 font-bold'
                              : ''
                          }`}
                        >
                          {profile?.country === 'FR' ? 'Échéance :' : 'Due:'}{' '}
                          {new Date(inv.due_date).toLocaleDateString(
                            profile?.country === 'FR' ? 'fr-FR' : 'en-US',
                            { year: 'numeric', month: 'short', day: 'numeric' }
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-6 mt-4 pt-4 border-t border-gray-100 sm:mt-0 sm:pt-0 sm:border-0">
                  <span
                    className={`sm:hidden text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${getStatusColor(inv)}`}
                  >
                    {getPaymentStatus(inv)}
                  </span>
                  <div className="hidden sm:block text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">
                      {lang.grandTotal}
                    </p>
                    <p className="font-mono font-black text-xl text-gray-800 group-hover:text-blue-600 transition-colors">
                      {formatMoney(
                        inv.total_amount_cents,
                        inv.currency_snapshot,
                        inv.currency_snapshot === 'EUR' ? 'FR' : 'US'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))
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
