'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';

interface EstimateItem {
  materialId: string;
  qty: number;
  taxRate: number;
}

interface EstimateSection {
  title: string;
  laborHours: number;
  hourlyRate: number;
  laborTaxRate: number;
  items: EstimateItem[];
}

export default function NewEstimatePage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center font-sans uppercase font-black text-gray-300 tracking-widest italic">
          Chargement / Loading...
        </div>
      }
    >
      <NewEstimateContent />
    </Suspense>
  );
}

function NewEstimateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [profile, setProfile] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [pastClients, setPastClients] = useState<any[]>([]);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  const [client, setClient] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [customRef, setCustomRef] = useState('');

  const [sections, setSections] = useState<EstimateSection[]>([
    { title: '', laborHours: 0, hourlyRate: 50, laborTaxRate: 0, items: [] }
  ]);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      const [prof, mats, ests] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user?.id).single(),
        supabase
          .from('materials')
          .select('*')
          .eq('user_id', user?.id)
          .order('name'),
        supabase
          .from('estimates')
          .select(
            'client_name, client_email, client_phone, client_address, created_at, custom_id, sections'
          )
          .eq('user_id', user?.id)
      ]);

      if (prof.data) {
        setProfile(prof.data);
        setLang(prof.data.country === 'FR' ? translations.FR : translations.US);

        if (!editId && prof.data.subscription_tier === 'free') {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const monthlyEstimates =
            ests.data?.filter((e) => {
              const date = new Date(e.created_at);
              return (
                date.getMonth() === currentMonth &&
                date.getFullYear() === currentYear
              );
            }).length || 0;

          if (monthlyEstimates >= 5 && (prof.data.estimate_credits || 0) <= 0) {
            setLimitReached(true);
          }
        }
      }

      setMaterials(mats.data || []);

      if (ests.data) {
        const uniqueClientsMap = new Map();
        ests.data.forEach((e) => {
          if (e.client_name && !uniqueClientsMap.has(e.client_name)) {
            uniqueClientsMap.set(e.client_name, e);
          }
        });
        setPastClients(Array.from(uniqueClientsMap.values()));
      }

      if (editId) {
        const { data: est } = await supabase
          .from('estimates')
          .select('*')
          .eq('id', editId)
          .single();
        if (est) {
          setClient({
            name: est.client_name || '',
            email: est.client_email || '',
            phone: est.client_phone || '',
            address: est.client_address || ''
          });
          setCustomRef(est.custom_id || '');
          const loadedSections = (est.sections || []).map((sec: any) => ({
            ...sec,
            laborTaxRate:
              sec.laborTaxRate !== undefined
                ? sec.laborTaxRate
                : prof.data?.default_tax_rate || 0,
            items: (sec.items || []).map((item: any) => ({
              ...item,
              taxRate:
                item.taxRate !== undefined
                  ? item.taxRate
                  : prof.data?.default_tax_rate || 0
            }))
          }));
          setSections(loadedSections);
        }
      } else if (prof.data) {
        const n = [...sections];
        n[0].hourlyRate = prof.data.default_hourly_rate || 50;
        n[0].laborTaxRate = prof.data.default_tax_rate || 0;
        setSections(n);
      }
      setLoading(false);
    }
    fetchData();
  }, [editId, router]);

  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = pastClients.find((c) => c.client_name === e.target.value);
    if (selected) {
      setClient({
        name: selected.client_name || '',
        email: selected.client_email || '',
        phone: selected.client_phone || '',
        address: selected.client_address || ''
      });
    }
  };

  const updateSection = (
    sIdx: number,
    field: keyof EstimateSection,
    val: any
  ) => {
    const n = [...sections];
    (n[sIdx] as any)[field] = val;
    setSections(n);
  };

  const updateItem = (
    sIdx: number,
    iIdx: number,
    field: keyof EstimateItem,
    val: any
  ) => {
    const n = [...sections];
    (n[sIdx].items[iIdx] as any)[field] = val;
    setSections(n);
  };

  const calculateTotals = () => {
    let subtotalCents = 0;
    let totalTaxCents = 0;

    sections.forEach((sec) => {
      const laborCents = Math.round(sec.laborHours * sec.hourlyRate * 100);
      const laborTaxCents = Math.round(
        laborCents * ((sec.laborTaxRate || 0) / 100)
      );

      subtotalCents += laborCents;
      totalTaxCents += laborTaxCents;

      sec.items.forEach((item) => {
        const m = materials.find((mat) => mat.id === item.materialId);
        if (m) {
          const itemCost = m.cost_per_unit_cents * item.qty;
          const itemTax = Math.round(itemCost * ((item.taxRate || 0) / 100));

          subtotalCents += itemCost;
          totalTaxCents += itemTax;
        }
      });
    });

    return {
      subtotalCents,
      tax: totalTaxCents,
      totalCents: subtotalCents + totalTaxCents
    };
  };

  const { subtotalCents, tax, totalCents } = calculateTotals();

  const handleSave = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\d\+\-\s\(\)]{7,20}$/;

    if (client.email && !emailRegex.test(client.email)) {
      setDialog({ type: 'alert', message: lang.invalidEmail });
      return;
    }
    if (client.phone && !phoneRegex.test(client.phone)) {
      setDialog({ type: 'alert', message: lang.invalidPhone });
      return;
    }

    const hasZeroQty = sections.some((sec) =>
      sec.items.some((item) => item.qty <= 0)
    );
    if (hasZeroQty) {
      setDialog({
        type: 'alert',
        message:
          profile?.country === 'FR'
            ? "La quantité de chaque matériau doit être supérieure à 0. Supprimez la ligne si l'article n'est pas nécessaire."
            : 'The quantity of each material must be greater than 0. Remove the row if the item is not needed.'
      });
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();
    const totals = calculateTotals();

    const payload = {
      user_id: user?.id,
      client_name: client.name,
      client_email: client.email,
      client_phone: client.phone,
      client_address: client.address,
      custom_id: customRef.trim() || null,
      total_amount_cents: totals.totalCents,
      tax_amount_cents: totals.tax,
      sections: sections,
      is_locked: false,
      business_name_snapshot: profile.business_name,
      country_snapshot: profile.country,
      currency_snapshot: profile.currency
    };

    const res = editId
      ? await supabase
          .from('estimates')
          .update(payload)
          .eq('id', editId)
          .select()
      : await supabase.from('estimates').insert([payload]).select();

    if (!res.error) {
      if (
        !editId &&
        profile.subscription_tier === 'free' &&
        profile.estimate_credits > 0
      ) {
        await supabase
          .from('profiles')
          .update({ estimate_credits: profile.estimate_credits - 1 })
          .eq('id', profile.id);
      }
      router.push(`/estimates/${res.data[0].id}`);
    } else {
      setDialog({ type: 'alert', message: res.error.message });
    }
  };

  if (loading || !lang)
    return (
      <div className="p-10 text-center font-sans text-black italic">
        Chargement / Loading...
      </div>
    );

  if (limitReached) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans text-black">
        <div className="bg-white p-10 rounded-xl shadow-2xl max-w-md text-center border border-gray-200">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">
            {lang.limitReached}
          </h2>
          <p className="text-gray-500 mb-8">{lang.limitMessage}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/upgrade"
              className="bg-blue-600 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-colors"
            >
              {lang.upgradeToPro}
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black mt-4 transition-colors"
            >
              {lang.cancel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black pb-40 font-sans relative">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">
              {editId
                ? profile?.country === 'FR'
                  ? 'Modifier le Projet'
                  : 'Edit Project'
                : lang.newEstimate.replace('+', '')}
            </h1>
            <input
              type="text"
              placeholder={lang.customRef}
              value={customRef}
              onChange={(e) => setCustomRef(e.target.value)}
              className="text-xs p-2 border rounded-md bg-transparent outline-none focus:border-blue-500 font-mono w-48 text-gray-500"
            />
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            {profile?.country === 'FR' ? 'Annuler et Quitter' : 'Cancel & Exit'}
          </Link>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex justify-between items-center mb-6">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
              {profile?.country === 'FR'
                ? 'Coordonnées du Client'
                : 'Customer Contact Details'}
            </p>
            {pastClients.length > 0 && (
              <select
                value={
                  pastClients.some((c) => c.client_name === client.name)
                    ? client.name
                    : ''
                }
                onChange={handleClientSelect}
                className="text-[10px] border border-gray-200 p-2 rounded-lg font-bold uppercase tracking-widest text-gray-500 outline-none bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <option value="" disabled hidden>
                  {lang.selectClient}
                </option>
                {pastClients.map((c, i) => (
                  <option key={i} value={c.client_name}>
                    {c.client_name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder={lang.clientName}
              className="col-span-2 p-3 border rounded-lg outline-none focus:border-blue-500 font-bold"
              value={client.name}
              onChange={(e) => setClient({ ...client, name: e.target.value })}
            />
            <input
              placeholder={lang.email}
              className="p-3 border rounded-lg outline-none focus:border-blue-500"
              value={client.email}
              onChange={(e) => setClient({ ...client, email: e.target.value })}
            />
            <input
              placeholder={lang.phone}
              className="p-3 border rounded-lg outline-none focus:border-blue-500"
              value={client.phone}
              onChange={(e) => setClient({ ...client, phone: e.target.value })}
            />
            <textarea
              placeholder={lang.address}
              className="col-span-2 p-3 border rounded-lg outline-none focus:border-blue-500 h-20"
              value={client.address}
              onChange={(e) =>
                setClient({ ...client, address: e.target.value })
              }
            />
          </div>
        </div>

        {sections.map((sec, sIdx) => (
          <div
            key={sIdx}
            className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 mb-8 relative"
          >
            <button
              onClick={() => setSections(sections.filter((_, i) => i !== sIdx))}
              className="absolute top-8 right-8 text-gray-300 hover:text-red-500 text-[10px] font-black uppercase tracking-widest"
            >
              {profile?.country === 'FR' ? 'Supprimer' : 'Remove Step'}
            </button>

            <input
              placeholder={lang.serviceStep}
              className="text-xl font-black uppercase w-full mb-6 border-b-2 border-gray-50 outline-none focus:border-blue-500 pb-2 italic tracking-tight"
              value={sec.title}
              onChange={(e) => updateSection(sIdx, 'title', e.target.value)}
            />

            <div className="grid grid-cols-3 gap-4 mb-8 bg-slate-50 p-6 rounded-lg border border-slate-100">
              <div className="col-span-3 mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {profile?.country === 'FR'
                    ? "Paramètres de Main-d'œuvre"
                    : 'Internal Labor Settings'}
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {profile?.country === 'FR'
                    ? 'Heures estimées'
                    : 'Hours for this step'}
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full p-2 rounded border border-slate-200 font-mono font-bold"
                  value={sec.laborHours}
                  onChange={(e) =>
                    updateSection(
                      sIdx,
                      'laborHours',
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {lang.hourlyRate} ({profile?.currency === 'EUR' ? '€' : '$'})
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full p-2 rounded border border-slate-200 font-mono font-bold"
                  value={sec.hourlyRate}
                  onChange={(e) =>
                    updateSection(
                      sIdx,
                      'hourlyRate',
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {profile?.country === 'FR' ? 'Taxe (%)' : 'Tax Rate (%)'}
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full p-2 rounded border border-slate-200 font-mono font-bold"
                  value={sec.laborTaxRate}
                  onChange={(e) =>
                    updateSection(
                      sIdx,
                      'laborTaxRate',
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                />
              </div>
            </div>

            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4">
              {lang.materials}
            </p>
            <div className="space-y-3">
              {sec.items.map((item, iIdx) => (
                <div key={iIdx} className="flex gap-2 sm:gap-4 items-center">
                  <select
                    className="flex-1 p-2 border border-gray-100 rounded bg-gray-50 font-bold text-xs outline-none focus:border-blue-500"
                    value={item.materialId}
                    onChange={(e) =>
                      updateItem(sIdx, iIdx, 'materialId', e.target.value)
                    }
                  >
                    <option value="" disabled hidden>
                      {lang.selectMaterial}
                    </option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({lang.units?.[m.unit] || m.unit}) (
                        {profile?.currency === 'EUR' ? '€' : '$'}
                        {(m.cost_per_unit_cents / 100).toFixed(2)})
                      </option>
                    ))}
                  </select>

                  <div className="relative">
                    <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none">
                      {profile?.country === 'FR' ? 'Qté' : 'Qty'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      className="w-24 p-2 pl-9 border border-gray-100 rounded text-right font-bold outline-none focus:border-blue-500"
                      placeholder="0"
                      value={item.qty === 0 ? '' : item.qty}
                      onChange={(e) =>
                        updateItem(
                          sIdx,
                          iIdx,
                          'qty',
                          Math.max(0, parseFloat(e.target.value) || 0)
                        )
                      }
                    />
                  </div>

                  <div className="relative">
                    <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none">
                      {profile?.country === 'FR' ? 'TVA' : 'Tax'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      className="w-28 p-2 pl-10 pr-6 border border-gray-100 rounded text-right font-bold outline-none focus:border-blue-500"
                      placeholder="0"
                      value={item.taxRate}
                      onChange={(e) =>
                        updateItem(
                          sIdx,
                          iIdx,
                          'taxRate',
                          Math.max(0, parseFloat(e.target.value) || 0)
                        )
                      }
                    />
                    <span className="absolute right-2 top-2 text-gray-400 text-xs font-bold pointer-events-none">
                      %
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      const n = [...sections];
                      n[sIdx].items = n[sIdx].items.filter(
                        (_, i) => i !== iIdx
                      );
                      setSections(n);
                    }}
                    className="text-gray-200 hover:text-red-400 text-xl font-bold transition-colors pl-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const n = [...sections];
                n[sIdx].items.push({
                  materialId: '',
                  qty: 0,
                  taxRate: profile?.default_tax_rate || 0
                });
                setSections(n);
              }}
              className="text-blue-600 font-black text-[10px] uppercase tracking-widest mt-6 hover:text-blue-800 transition-colors"
            >
              + {lang.materials}
            </button>
          </div>
        ))}

        <button
          onClick={() =>
            setSections([
              ...sections,
              {
                title: '',
                laborHours: 0,
                hourlyRate: profile?.default_hourly_rate || 50,
                laborTaxRate: profile?.default_tax_rate || 0,
                items: []
              }
            ])
          }
          className="w-full py-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-black uppercase tracking-widest hover:text-blue-500 hover:border-blue-500 transition-all mb-20"
        >
          + {lang.serviceStep}
        </button>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-6 shadow-2xl z-50">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex gap-10">
              <div>
                <p className="text-[10px] text-gray-400 font-black uppercase mb-1 tracking-widest">
                  {lang.subtotal}
                </p>
                <p className="text-xl font-mono font-bold">
                  {profile?.currency === 'EUR' ? '€' : '$'}
                  {(subtotalCents / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-black uppercase mb-1 tracking-widest">
                  {profile?.country === 'FR' ? 'TVA Totale' : 'Total Tax'}
                </p>
                <p className="text-xl font-mono font-bold">
                  {profile?.currency === 'EUR' ? '€' : '$'}
                  {(tax / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-black uppercase mb-1 tracking-widest">
                  {lang.grandTotal}
                </p>
                <p className="text-3xl font-black text-blue-600 tracking-tighter">
                  {profile?.currency === 'EUR' ? '€' : '$'}
                  {(totalCents / 100).toFixed(2)}
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-12 py-4 rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-transform hover:scale-105 active:scale-95"
            >
              {editId
                ? profile?.country === 'FR'
                  ? 'Mettre à jour'
                  : 'Update Draft'
                : profile?.country === 'FR'
                  ? 'Générer le Devis'
                  : 'Generate Estimate'}
            </button>
          </div>
        </div>
      </div>

      {/* GLOBAL DIALOG UI */}
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
