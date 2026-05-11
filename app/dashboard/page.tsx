'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);
  const [exportModal, setExportModal] = useState(false);

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
        if (!prof.business_name) {
          router.push('/profile?firstTime=true');
          return;
        }
        setProfile(prof);
        setLang(prof.country === 'FR' ? translations.FR : translations.US);
      }

      const [estsRes, matsRes] = await Promise.all([
        supabase
          .from('estimates')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('materials').select('*').eq('user_id', user.id)
      ]);

      setEstimates(estsRes.data || []);
      setMaterials(matsRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm',
      message:
        profile?.country === 'FR'
          ? 'Supprimer ce brouillon ?'
          : 'Delete this draft?',
      onConfirm: async () => {
        setDialog(null);
        await supabase.from('estimates').delete().eq('id', id);
        setEstimates(estimates.filter((e) => e.id !== id));
      }
    });
  };

  const handleExportCSV = (type: 'summary' | 'detailed') => {
    let csv = '';

    if (type === 'summary') {
      // Summary Header
      csv =
        'Estimate ID,Date,Client Name,Client Email,Amount,Currency,Status\n';
      estimates.forEach((e) => {
        const date = new Date(e.created_at).toLocaleDateString();
        const amt = (e.total_amount_cents / 100).toFixed(2);
        const status = e.is_locked ? 'Finalized' : 'Draft';
        csv += `"${e.custom_id || e.id}","${date}","${e.client_name || ''}","${e.client_email || ''}",${amt},${e.currency_snapshot},${status}\n`;
      });
    } else {
      // Detailed Header
      csv =
        'Estimate ID,Date,Client Name,Status,Section Title,Item Type,Item Name,Quantity,Cost/Rate,Tax %\n';
      estimates.forEach((e) => {
        const date = new Date(e.created_at).toLocaleDateString();
        const status = e.is_locked ? 'Finalized' : 'Draft';
        const baseInfo = `"${e.custom_id || e.id}","${date}","${e.client_name || ''}",${status}`;

        (e.sections || []).forEach((sec: any) => {
          // Labor Row
          if (sec.laborHours > 0) {
            csv += `${baseInfo},"${sec.title}","Labor","",${sec.laborHours},${sec.hourlyRate},${sec.laborTaxRate}\n`;
          }
          // Material Rows
          (sec.items || []).forEach((item: any) => {
            const m = materials.find((mat) => mat.id === item.materialId);
            if (m) {
              const cost = (m.cost_per_unit_cents / 100).toFixed(2);
              csv += `${baseInfo},"${sec.title}","Material","${m.name}",${item.qty},${cost},${item.taxRate}\n`;
            }
          });
        });
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Estimates_${type}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportModal(false);
  };

  const formatDate = (dateString: string) => {
    const locale = profile?.country === 'FR' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading || !lang)
    return (
      <div className="p-10 text-center font-sans italic text-black">
        Chargement / Loading...
      </div>
    );

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">
              {lang.dashboard}
            </h1>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">
              {profile?.business_name}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 w-full sm:w-auto">
            {profile.subscription_tier === 'pro' && estimates.length > 0 && (
              <button
                onClick={() => setExportModal(true)}
                className="flex-1 sm:flex-none px-6 py-3 border border-green-200 bg-green-50 text-green-700 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-sm hover:border-green-300 transition-colors"
              >
                {profile.country === 'FR' ? 'Exporter Excel' : 'Export Data'}
              </button>
            )}
            <Link
              href="/materials"
              className="flex-1 sm:flex-none text-center px-6 py-3 border border-gray-200 bg-white rounded-lg font-black uppercase tracking-widest text-[10px] shadow-sm hover:border-gray-300 transition-colors"
            >
              {lang.priceList}
            </Link>
            <Link
              href="/new-estimate"
              className="flex-1 sm:flex-none text-center px-6 py-3 bg-blue-600 text-white rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-colors"
            >
              {lang.newEstimate}
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {estimates.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-xl border border-gray-200">
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
                {profile.country === 'FR'
                  ? 'Aucun devis trouvé.'
                  : 'No estimates found.'}
              </p>
            </div>
          ) : (
            estimates.map((est) => (
              <div
                key={est.id}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-200 transition-colors"
              >
                <div
                  className="flex-1 cursor-pointer w-full"
                  onClick={() =>
                    router.push(
                      est.is_locked
                        ? `/estimates/${est.id}`
                        : `/new-estimate?edit=${est.id}`
                    )
                  }
                >
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg text-gray-800">
                      {est.client_name ||
                        (profile.country === 'FR'
                          ? 'Projet sans nom'
                          : 'Untitled Project')}
                    </h3>
                    <span
                      className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${est.is_locked ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}
                    >
                      {est.is_locked ? lang.finalized : lang.draft}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">
                    {formatDate(est.created_at)} •{' '}
                    {est.client_email ||
                      (profile.country === 'FR'
                        ? 'Aucun contact'
                        : 'No contact email')}
                  </p>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto gap-6 border-t sm:border-0 pt-4 sm:pt-0 border-gray-100">
                  <div className="w-32 text-left sm:text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">
                      {lang.grandTotal}
                    </p>
                    <p className="font-mono font-black text-xl text-gray-800">
                      {est.currency_snapshot === 'EUR' ? '€' : '$'}
                      {(est.total_amount_cents / 100).toFixed(2)}
                    </p>
                  </div>

                  <div className="w-6 flex justify-end">
                    {!est.is_locked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(est.id);
                        }}
                        className="text-gray-200 hover:text-red-400 transition-colors p-2"
                        title="Delete Draft"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6 sm:h-5 sm:w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* EXPORT MODAL */}
      {exportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-100">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-2 text-gray-900">
              {profile?.country === 'FR'
                ? "Format d'exportation"
                : 'Export Format'}
            </h3>
            <p className="text-sm text-gray-500 font-medium mb-6">
              {profile?.country === 'FR'
                ? 'Choisissez le niveau de détail pour votre rapport Excel (CSV).'
                : 'Choose the level of detail for your Excel (CSV) report.'}
            </p>

            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={() => handleExportCSV('summary')}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <p className="font-bold text-sm text-gray-900">
                  {profile?.country === 'FR'
                    ? 'Vue Résumée'
                    : 'Summarized View'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {profile?.country === 'FR'
                    ? 'Une ligne par devis avec les totaux.'
                    : 'One row per estimate with grand totals.'}
                </p>
              </button>
              <button
                onClick={() => handleExportCSV('detailed')}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <p className="font-bold text-sm text-gray-900">
                  {profile?.country === 'FR'
                    ? 'Vue Détaillée'
                    : 'Detailed View'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {profile?.country === 'FR'
                    ? "Inclut la main-d'œuvre et les matériaux ligne par ligne."
                    : 'Includes line-by-line breakdown of labor and materials.'}
                </p>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setExportModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {profile?.country === 'FR' ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STANDARD DIALOG */}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-3 text-gray-900">
              {dialog.title ||
                (profile?.country === 'FR' ? 'Notification' : 'Notice')}
            </h3>
            <p className="text-sm text-gray-500 font-medium mb-8">
              {dialog.message}
            </p>
            <div className="flex gap-3 justify-end">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {profile?.country === 'FR' ? 'Annuler' : 'Cancel'}
                </button>
              )}
              <button
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  else setDialog(null);
                }}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors"
              >
                {profile?.country === 'FR' ? 'Confirmer' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
