'use client';

import React, { useState, useEffect, Suspense, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';
import MaterialCombobox from '@/components/MaterialCombobox';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition
} from '@headlessui/react';

const LoadingDots = () => (
  <div className="flex items-center justify-center space-x-2 p-12 mt-20">
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
  </div>
);

interface EstimateItem {
  materialId: string;
  qty: number;
  taxRate: number;
  unit?: string;
  name?: string;
  cost_per_unit_cents?: number;
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
    <Suspense fallback={<LoadingDots />}>
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
  const [monthlyCount, setMonthlyCount] = useState(0);

  // Logic for Guest Handling
  const [isGuest, setIsGuest] = useState(false);
  const [businessName, setBusinessName] = useState('');

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
      // 1. Capture cached data in local variables immediately to prevent overwrite
      let cachedBusinessName = '';
      const pendingRaw = localStorage.getItem('pactestim_pending_estimate');

      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          if (pending.client) setClient(pending.client);
          if (pending.sections) setSections(pending.sections);
          if (pending.customRef) setCustomRef(pending.customRef);
          if (pending.businessName) {
            cachedBusinessName = pending.businessName;
            setBusinessName(pending.businessName);
          }
        } catch (e) {
          console.error('Failed to parse pending estimate');
        }
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();

      // 2. Handle Language Sync (Priority: LocalStorage > Browser Language)
      const storedLang = localStorage.getItem('public_lang');
      const isFrChoice =
        storedLang === 'FR' ||
        (!storedLang && navigator.language.toLowerCase().startsWith('fr'));

      // 3. Handle Unauthenticated (Guest) User
      if (!user) {
        setIsGuest(true);
        setProfile({
          country: isFrChoice ? 'FR' : 'US',
          currency: isFrChoice ? 'EUR' : 'USD',
          default_hourly_rate: 50,
          default_tax_rate: 0
        });
        setLang(isFrChoice ? translations.FR : translations.US);
        setMaterials([]);
        setPastClients([]);
        setLoading(false);
        return;
      }

      // 4. Handle Authenticated User
      const [prof, mats, ests, clientsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('materials')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),
        supabase
          .from('estimates')
          .select('client_name, created_at')
          .eq('user_id', user.id),
        supabase.from('clients').select('*').eq('user_id', user.id)
      ]);

      if (prof.data) {
        setProfile(prof.data);
        setLang(prof.data.country === 'FR' ? translations.FR : translations.US);

        // DATA PERSISTENCE FIX: Priority to cached guest name over empty profile name
        if (cachedBusinessName) {
          setBusinessName(cachedBusinessName);
        } else {
          setBusinessName(prof.data.business_name || '');
        }

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

          setMonthlyCount(monthlyEstimates);
          if (monthlyEstimates >= 5 && (prof.data.estimate_credits || 0) <= 0) {
            setLimitReached(true);
          }
        }
      }

      setMaterials(mats.data || []);
      if (clientsRes?.data) setPastClients(clientsRes.data);

      if (editId && !pendingRaw) {
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
      } else if (prof.data && !pendingRaw) {
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
    const selected = pastClients.find((c) => c.name === e.target.value);
    if (selected) {
      setClient({
        name: selected.name || '',
        email: selected.email || '',
        phone: selected.phone || '',
        address: selected.address || ''
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

  const handleCreateMaterialOnTheFly = (
    sIdx: number,
    iIdx: number,
    rawName: string
  ) => {
    const tempId = `temp_${Math.random().toString(36).substring(2, 9)}`;
    const defaultUnit = lang?.units ? Object.keys(lang.units)[0] : 'ea';
    const newMaterial = {
      id: tempId,
      name: rawName,
      cost_per_unit_cents: 0,
      unit: defaultUnit
    };
    setMaterials([...materials, newMaterial]);
    updateItem(sIdx, iIdx, 'materialId', tempId);
    updateItem(sIdx, iIdx, 'name', rawName);
    updateItem(sIdx, iIdx, 'cost_per_unit_cents', 0);
    updateItem(sIdx, iIdx, 'unit', defaultUnit);
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
        const itemCost = (item.cost_per_unit_cents || 0) * (item.qty || 0);
        const itemTax = Math.round(itemCost * ((item.taxRate || 0) / 100));
        subtotalCents += itemCost;
        totalTaxCents += itemTax;
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

    // 1. Guest Check: Cache and Redirect to Signup view on Login page
    if (!user) {
      const pendingData = { client, sections, customRef, businessName };
      localStorage.setItem(
        'pactestim_pending_estimate',
        JSON.stringify(pendingData)
      );
      setDialog({
        type: 'confirm',
        title:
          profile?.country === 'FR'
            ? 'Inscription Requise'
            : 'Sign Up Required',
        message:
          profile?.country === 'FR'
            ? 'Créez un compte gratuit pour enregistrer et générer ce devis.'
            : 'Create a free account to save and generate this estimate.',
        onConfirm: () => router.push('/login?view=signup')
      });
      return;
    }

    // 2. Auth Logic: Update profile if business name was provided or changed
    if (businessName && businessName !== profile?.business_name) {
      await supabase
        .from('profiles')
        .update({ business_name: businessName })
        .eq('id', user.id);
    }

    const totals = calculateTotals();
    const finalSections = [];

    for (const sec of sections) {
      const finalItems = [];
      for (const item of sec.items) {
        let finalMatId = item.materialId;
        if (finalMatId.startsWith('temp_') && user?.id) {
          const { data, error } = await supabase
            .from('materials')
            .insert([
              {
                user_id: user.id,
                name: item.name,
                cost_per_unit_cents: item.cost_per_unit_cents || 0,
                unit:
                  item.unit || (lang?.units ? Object.keys(lang.units)[0] : 'ea')
              }
            ])
            .select()
            .single();
          if (error) console.error('Material Insert Error:', error);
          if (data) finalMatId = data.id;
        }
        finalItems.push({
          ...item,
          materialId: finalMatId,
          name: item.name || 'Unknown Material',
          cost_per_unit_cents: item.cost_per_unit_cents || 0,
          unit: item.unit || (lang?.units ? Object.keys(lang.units)[0] : 'ea')
        });
      }
      finalSections.push({ ...sec, items: finalItems });
    }

    const payload = {
      user_id: user?.id,
      client_name: client.name,
      client_email: client.email,
      client_phone: client.phone,
      client_address: client.address,
      custom_id: customRef.trim() || null,
      total_amount_cents: totals.totalCents,
      tax_amount_cents: totals.tax,
      sections: finalSections,
      is_locked: false,
      business_name_snapshot: businessName || profile.business_name,
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
      // Client Sync logic
      if (client.name) {
        const existing = pastClients.find((c) => c.name === client.name);
        if (existing) {
          await supabase
            .from('clients')
            .update({
              email: client.email,
              phone: client.phone,
              address: client.address
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('clients').insert([
            {
              user_id: user?.id,
              name: client.name,
              email: client.email,
              phone: client.phone,
              address: client.address
            }
          ]);
        }
      }

      // Billing credit deduction
      if (
        !editId &&
        profile.subscription_tier === 'free' &&
        monthlyCount >= 5 &&
        profile.estimate_credits > 0
      ) {
        await supabase
          .from('profiles')
          .update({ estimate_credits: profile.estimate_credits - 1 })
          .eq('id', profile.id);
      }

      // 3. Clear Cache and Redirect to newly created view
      localStorage.removeItem('pactestim_pending_estimate');
      router.push(`/estimates/${res.data[0].id}`);
    } else {
      setDialog({ type: 'alert', message: res.error.message });
    }
  };

  const getResolvedUnitKey = (rawUnit: string | undefined) => {
    const u = (rawUnit || '').toLowerCase();
    if (u === 'each' || u === 'unit') return 'ea';
    return rawUnit || (lang?.units ? Object.keys(lang.units)[0] : 'ea');
  };

  if (loading || !lang) return <LoadingDots />;

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
        {/* Header Area */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
            <div className="flex justify-between items-center w-full sm:w-auto">
              <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-tight max-w-[70%] sm:max-w-none">
                {editId
                  ? profile?.country === 'FR'
                    ? 'Modifier le Projet'
                    : 'Edit Project'
                  : lang.newEstimate.replace('+', '')}
              </h1>
              <Link
                href="/dashboard"
                className="sm:hidden text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors shrink-0 text-right ml-4"
              >
                {profile?.country === 'FR' ? 'Annuler' : 'Cancel'}
              </Link>
            </div>
            <input
              type="text"
              placeholder={lang.customRef}
              value={customRef}
              onChange={(e) => setCustomRef(e.target.value)}
              className="text-xs p-3 sm:p-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-blue-500 font-mono w-full sm:w-48 text-gray-500 shadow-sm"
            />
          </div>
          <Link
            href={isGuest ? '/' : '/dashboard'}
            className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            {profile?.country === 'FR' ? 'Annuler et Quitter' : 'Cancel & Exit'}
          </Link>
        </div>

        {/* Guest Context Banner */}
        {isGuest && (
          <div className="bg-blue-50 border border-blue-100 p-4 sm:p-5 rounded-xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0">👋</span>
              <p className="text-xs font-bold text-blue-900 leading-relaxed">
                {profile?.country === 'FR'
                  ? 'Vous utilisez le générateur en mode invité. Votre progression est sauvegardée localement. Créez un compte pour finaliser ce devis.'
                  : 'You are using the builder as a guest. Your progress is saved locally. Create an account to finalize this estimate.'}
              </p>
            </div>
            <Link
              href="/login?view=signup"
              className="w-full sm:w-auto text-center text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
            >
              {profile?.country === 'FR' ? 'Créer un compte' : 'Create Account'}
            </Link>
          </div>
        )}

        {/* Business Settings Section - Only shown for guests or users without a business name */}
        {(isGuest || !profile?.business_name) && (
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 mb-8">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">
              {profile?.country === 'FR' ? 'Votre Entreprise' : 'Your Business'}
            </p>
            <div className="group relative">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all bg-gray-50">
                <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-xs">
                  B
                </div>
                <input
                  placeholder={
                    profile?.country === 'FR'
                      ? 'Nom de votre entreprise'
                      : 'Your Business Name'
                  }
                  className="flex-1 p-4 bg-transparent outline-none font-bold text-sm text-gray-800"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Client Contact Section */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
              {profile?.country === 'FR'
                ? 'Coordonnées du Client'
                : 'Customer Contact Details'}
            </p>
            {pastClients.length > 0 && (
              <select
                value={
                  pastClients.some((c) => c.name === client.name)
                    ? client.name
                    : ''
                }
                onChange={handleClientSelect}
                className="w-full sm:w-auto text-[10px] border border-gray-200 p-3 sm:p-2 rounded-lg font-bold uppercase tracking-widest text-gray-500 outline-none bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <option value="" disabled hidden>
                  {lang.selectClient}
                </option>
                {pastClients.map((c, i) => (
                  <option key={i} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2 group relative">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all bg-gray-50">
                <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-xs">
                  N
                </div>
                <input
                  placeholder={lang.clientName}
                  className="flex-1 p-4 bg-transparent outline-none font-bold text-sm text-gray-800"
                  value={client.name}
                  onChange={(e) =>
                    setClient({ ...client, name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="group relative">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all bg-gray-50">
                <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-xs">
                  M
                </div>
                <input
                  placeholder={lang.email}
                  className="flex-1 p-4 bg-transparent outline-none font-bold text-sm text-gray-800"
                  value={client.email}
                  onChange={(e) =>
                    setClient({ ...client, email: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="group relative">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all bg-gray-50">
                <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-xs">
                  T
                </div>
                <input
                  placeholder={lang.phone}
                  className="flex-1 p-4 bg-transparent outline-none font-bold text-sm text-gray-800"
                  value={client.phone}
                  onChange={(e) =>
                    setClient({ ...client, phone: e.target.value })
                  }
                />
              </div>
            </div>
            <textarea
              placeholder={lang.address}
              className="col-span-1 sm:col-span-2 p-4 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50 font-bold text-sm resize-none h-24 text-gray-800 transition-all"
              value={client.address}
              onChange={(e) =>
                setClient({ ...client, address: e.target.value })
              }
            />
          </div>
        </div>

        {/* Sections Map */}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 bg-slate-50 p-6 rounded-lg border border-slate-100">
              <div className="col-span-1 sm:col-span-3 mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {profile?.country === 'FR'
                    ? "Paramètres de Main-d'œuvre"
                    : 'Internal Labor Settings'}
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {profile?.country === 'FR' ? 'Heures estimées' : 'Hours'}
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="w-full p-2 rounded border border-slate-200 font-mono font-bold"
                  value={sec.laborHours === 0 ? '' : sec.laborHours}
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
                  placeholder="0"
                  className="w-full p-2 rounded border border-slate-200 font-mono font-bold"
                  value={sec.hourlyRate === 0 ? '' : sec.hourlyRate}
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
                  placeholder="0"
                  className="w-full p-2 rounded border border-slate-200 font-mono font-bold"
                  value={sec.laborTaxRate === 0 ? '' : sec.laborTaxRate}
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
            <div className="space-y-4 sm:space-y-3">
              {sec.items.map((item, iIdx) => (
                <div
                  key={iIdx}
                  className="flex flex-wrap sm:flex-nowrap gap-3 sm:gap-4 items-center bg-gray-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none border border-gray-200 sm:border-none"
                >
                  <div className="w-full sm:flex-[2] relative">
                    {item.materialId ? (
                      <div className="flex items-center justify-between w-full py-2 pl-3 pr-2 border border-gray-200 rounded-lg bg-gray-50 transition-colors">
                        <span className="text-xs font-bold text-gray-900 truncate pr-4">
                          {item.name}
                        </span>
                        <button
                          onClick={() =>
                            updateItem(sIdx, iIdx, 'materialId', '')
                          }
                          className="text-[10px] text-gray-400 hover:text-blue-600 font-black uppercase tracking-widest transition-colors shrink-0"
                        >
                          {profile?.country === 'FR' ? 'Modifier' : 'Edit'}
                        </button>
                      </div>
                    ) : (
                      <MaterialCombobox
                        materials={materials}
                        selectedId={item.materialId}
                        placeholder={lang.selectMaterial}
                        createLabel={
                          profile?.country === 'FR' ? 'Créer :' : 'Create:'
                        }
                        emptyStateLabel={
                          profile?.country === 'FR'
                            ? 'Aucun matériau.'
                            : 'No materials found.'
                        }
                        currencySymbol={profile?.currency === 'EUR' ? '€' : '$'}
                        unitLabels={lang?.units || {}}
                        onChange={(val) => {
                          if (!val) {
                            updateItem(sIdx, iIdx, 'materialId', '');
                            updateItem(sIdx, iIdx, 'name', '');
                            updateItem(sIdx, iIdx, 'cost_per_unit_cents', 0);
                            updateItem(
                              sIdx,
                              iIdx,
                              'unit',
                              lang?.units ? Object.keys(lang.units)[0] : 'ea'
                            );
                            return;
                          }
                          updateItem(sIdx, iIdx, 'materialId', val.id);
                          updateItem(sIdx, iIdx, 'name', val.name);
                          updateItem(
                            sIdx,
                            iIdx,
                            'cost_per_unit_cents',
                            val.cost_per_unit_cents || 0
                          );
                          updateItem(
                            sIdx,
                            iIdx,
                            'unit',
                            val.unit ||
                              (lang?.units ? Object.keys(lang.units)[0] : 'ea')
                          );
                        }}
                        onCreateNew={(name) =>
                          handleCreateMaterialOnTheFly(sIdx, iIdx, name)
                        }
                      />
                    )}
                  </div>
                  <div className="w-24 relative shrink-0 group">
                    <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none transition-colors group-focus-within:text-blue-500">
                      {profile?.country === 'FR' ? 'Qté' : 'Qty'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-full py-2 pl-9 pr-2 border border-gray-100 rounded text-right font-bold outline-none focus:border-blue-500 transition-colors bg-white"
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
                  <div className="w-36 relative shrink-0 group">
                    <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none transition-colors group-focus-within:text-blue-500 z-10">
                      {profile?.country === 'FR' ? 'Unité' : 'Unit'}
                    </span>
                    <Listbox
                      value={getResolvedUnitKey(item.unit)}
                      onChange={(val) => updateItem(sIdx, iIdx, 'unit', val)}
                    >
                      <div className="relative">
                        <ListboxButton className="w-full py-2 pl-12 pr-8 text-left text-xs font-bold text-gray-900 border border-gray-100 rounded outline-none focus:border-blue-500 transition-colors bg-white cursor-pointer flex items-center h-[34px]">
                          <span className="block truncate">
                            {lang?.units
                              ? lang.units[getResolvedUnitKey(item.unit)]
                              : 'ea'}
                          </span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 9l6 6 6-6"
                              />
                            </svg>
                          </span>
                        </ListboxButton>
                        <Transition
                          as={Fragment}
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                        >
                          <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white shadow-xl border border-gray-100">
                            {Object.entries(lang?.units || { ea: 'ea' }).map(
                              ([key, label]) => (
                                <ListboxOption
                                  key={key}
                                  className={({ focus }) =>
                                    `cursor-pointer select-none py-2 px-4 transition-colors ${
                                      focus
                                        ? 'bg-blue-50 text-blue-900'
                                        : 'text-gray-900'
                                    }`
                                  }
                                  value={key}
                                >
                                  {({ selected }) => (
                                    <span
                                      className={`block truncate text-xs ${
                                        selected
                                          ? 'font-black text-blue-600'
                                          : 'font-bold'
                                      }`}
                                    >
                                      {label as string}
                                    </span>
                                  )}
                                </ListboxOption>
                              )
                            )}
                          </ListboxOptions>
                        </Transition>
                      </div>
                    </Listbox>
                  </div>
                  <div className="w-32 relative shrink-0 group">
                    <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none transition-colors group-focus-within:text-blue-500">
                      {profile?.country === 'FR' ? 'Prix' : 'Cost'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0.00"
                      className="w-full py-2 pl-12 pr-2 border border-gray-100 rounded text-right font-bold outline-none focus:border-blue-500 transition-colors bg-white"
                      value={
                        (item.cost_per_unit_cents || 0) === 0
                          ? ''
                          : item.cost_per_unit_cents! / 100
                      }
                      onChange={(e) =>
                        updateItem(
                          sIdx,
                          iIdx,
                          'cost_per_unit_cents',
                          Math.max(0, parseFloat(e.target.value) || 0) * 100
                        )
                      }
                    />
                  </div>
                  <div className="w-28 relative shrink-0 group">
                    <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none transition-colors group-focus-within:text-blue-500">
                      Tax
                    </span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-full py-2 pl-10 pr-6 border border-gray-100 rounded text-right font-bold outline-none focus:border-blue-500 transition-colors bg-white"
                      value={item.taxRate === 0 ? '' : item.taxRate}
                      onChange={(e) =>
                        updateItem(
                          sIdx,
                          iIdx,
                          'taxRate',
                          Math.max(0, parseFloat(e.target.value) || 0)
                        )
                      }
                    />
                    <span className="absolute right-2 top-2.5 text-gray-400 text-[10px] font-bold pointer-events-none">
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
                  taxRate: profile?.default_tax_rate || 0,
                  cost_per_unit_cents: 0,
                  unit: lang?.units ? Object.keys(lang.units)[0] : 'ea'
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

        {/* Totals Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 p-4 sm:p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] z-40">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-center">
            <div className="flex w-full sm:w-auto justify-between sm:justify-start gap-4 sm:gap-10">
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

      {/* Dialog Intercepts */}
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
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
