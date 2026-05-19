'use client';

import React, { useState, useEffect, useMemo, Suspense, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { translations } from '@/lib/translations';
import {
  getTaxSummary,
  type EstimateFinancialContext,
  type EstimateSection as CalcEstimateSection
} from '@/lib/estimateCalculations';
import Link from 'next/link';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';
import MaterialCombobox from '@/components/MaterialCombobox';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition,
  Switch,
  RadioGroup,
  Radio
} from '@headlessui/react';

interface EstimateItem {
  materialId: string;
  qty: number;
  taxRate: number;
  marginRate?: number;
  unit?: string;
  name?: string;
  cost_per_unit_cents?: number;
}

interface EstimateSection {
  title: string;
  description?: string;
  laborHours: number;
  hourlyRate: number;
  laborType?: 'hourly' | 'daily';
  laborTaxRate: number;
  laborMarginRate?: number;
  marginRate?: number;
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
  const targetClientId = searchParams.get('clientId');

  const [profile, setProfile] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [pastClients, setPastClients] = useState<any[]>([]);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [monthlyCount, setMonthlyCount] = useState(0);

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
    address: '',
    city: '',
    zip: '',
    country: ''
  });
  const [customRef, setCustomRef] = useState('');

  const [marginMode, setMarginMode] = useState<
    'none' | 'global' | 'service' | 'granular'
  >('none');
  const [globalMargin, setGlobalMargin] = useState<number>(0);

  // Per-estimate deposit adjustments
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState<number>(20);

  const [paymentTermsType, setPaymentTermsType] = useState<
    'upon_receipt' | 'net_days'
  >('net_days');
  const [paymentDays, setPaymentDays] = useState<number>(30);

  const [sections, setSections] = useState<EstimateSection[]>([
    {
      title: '',
      description: '',
      laborHours: 0,
      hourlyRate: 50,
      laborTaxRate: 0,
      laborType: 'hourly',
      items: []
    }
  ]);
  const [savedSteps, setSavedSteps] = useState<string[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [activeDropdownIdx, setActiveDropdownIdx] = useState<number | null>(
    null
  );
  const [visibleDescriptions, setVisibleDescriptions] = useState<
    Record<number, boolean>
  >({});

  useEffect(() => {
    async function fetchData() {
      let cachedBusinessName = '';
      const pendingRaw = localStorage.getItem('pactestim_pending_estimate');

      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          if (pending.client) setClient(pending.client);
          if (pending.sections) setSections(pending.sections);
          if (pending.customRef) setCustomRef(pending.customRef);
          if (pending.marginMode) setMarginMode(pending.marginMode);
          if (pending.globalMargin) setGlobalMargin(pending.globalMargin);
          if (pending.depositEnabled !== undefined)
            setDepositEnabled(pending.depositEnabled);
          if (pending.depositPercentage !== undefined)
            setDepositPercentage(pending.depositPercentage);
          if (pending.paymentTermsType)
            setPaymentTermsType(pending.paymentTermsType);
          if (pending.paymentDays !== undefined)
            setPaymentDays(pending.paymentDays);
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

      const storedLang = localStorage.getItem('public_lang');
      const isFrChoice =
        storedLang === 'FR' ||
        (!storedLang && navigator.language.toLowerCase().startsWith('fr'));

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

      const [prof, mats, ests, clientsRes, hiddenRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('materials')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),
        supabase
          .from('estimates')
          .select('client_name, created_at, sections')
          .eq('user_id', user.id),
        supabase.from('clients').select('*').eq('user_id', user.id),
        supabase
          .from('hidden_categories')
          .select('category_name')
          .eq('user_id', user.id)
      ]);

      if (prof.data) {
        let resolvedCountry = prof.data.country;

        // Si l'utilisateur vient de s'inscrire en FR mais que son profil DB est par défaut sur US ou vide
        if (isFrChoice && (!prof.data.country || prof.data.country === 'US')) {
          resolvedCountry = 'FR';
          prof.data.country = 'FR';
          prof.data.currency = 'EUR';

          // Persister le choix de langue de l'inscription dans la base de données
          await supabase
            .from('profiles')
            .update({ country: 'FR', currency: 'EUR' })
            .eq('id', user.id);
        }

        setProfile(prof.data);
        setLang(resolvedCountry === 'FR' ? translations.FR : translations.US);

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

      // Extraction des catégories/étapes uniques enregistrées
      const stepSet = new Set<string>();
      ests.data?.forEach((est: any) => {
        if (Array.isArray(est.sections)) {
          est.sections.forEach((s: any) => {
            if (s.title) stepSet.add(s.title);
          });
        }
      });
      setSavedSteps(Array.from(stepSet));
      if (hiddenRes?.data) {
        setHiddenCategories(hiddenRes.data.map((hc: any) => hc.category_name));
      }
      // Sélection automatique du client via l'URL
      if (targetClientId && clientsRes?.data && !editId && !pendingRaw) {
        const foundClient = clientsRes.data.find(
          (c: any) => c.id === targetClientId
        );
        if (foundClient) {
          setClient({
            name: foundClient.name || '',
            email: foundClient.email || '',
            phone: foundClient.phone || '',
            address: foundClient.address || '',
            city: foundClient.city || '',
            zip: foundClient.zip || '',
            country: foundClient.country || ''
          });
        }
      }
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
            address: est.client_address || '',
            city: est.client_city || '',
            zip: est.client_zip || '',
            country: est.client_country || ''
          });
          setCustomRef(est.custom_id || '');
          setMarginMode(est.margin_mode_snapshot || 'none');
          setGlobalMargin(est.global_margin_snapshot || 0);
          setDepositEnabled(est.deposit_enabled ?? false);
          setDepositPercentage(est.deposit_percentage ?? 20);

          const rawTerms = est.payment_terms_snapshot || '30_days';
          if (rawTerms === 'upon_receipt') {
            setPaymentTermsType('upon_receipt');
            setPaymentDays(30);
          } else {
            setPaymentTermsType('net_days');
            setPaymentDays(parseInt(rawTerms.replace('_days', '')) || 30);
          }

          const loadedSections = (est.sections || []).map((sec: any) => ({
            ...sec,
            description: sec.description || '',
            laborType: sec.laborType || 'hourly',
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
        setDepositEnabled(prof.data.default_deposit_enabled ?? false);
        setDepositPercentage(prof.data.default_deposit_percentage ?? 20);
        const defaultTerms = prof.data.default_payment_terms || '30_days';
        if (defaultTerms === 'upon_receipt') {
          setPaymentTermsType('upon_receipt');
          setPaymentDays(30);
        } else {
          setPaymentTermsType('net_days');
          setPaymentDays(parseInt(defaultTerms.replace('_days', '')) || 30);
        }
        setSections((prevSections) => {
          const n = [...prevSections];
          if (n[0]) {
            n[0].hourlyRate = prof.data.default_hourly_rate || 50;
            n[0].laborTaxRate = prof.data.default_tax_rate || 0;
          }
          return n;
        });
      }
      setLoading(false);
    }
    fetchData();
  }, [editId, router, targetClientId]);

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

  const isDescVisible = (sec: EstimateSection, sIdx: number) => {
    if (visibleDescriptions[sIdx] !== undefined) {
      return visibleDescriptions[sIdx];
    }
    return !!sec.description;
  };

  const toggleDescription = (sIdx: number) => {
    setVisibleDescriptions((prev) => ({
      ...prev,
      [sIdx]: !isDescVisible(sections[sIdx], sIdx)
    }));
  };

  const calculateTotals = useMemo(() => {
    // Build a synthetic estimate context from the live form state.
    // The calc lib expects snapshot fields; for drafts we use the current state.
    const estimateContext: EstimateFinancialContext = {
      margin_mode_snapshot: marginMode,
      global_margin_snapshot: globalMargin,
      tax_rate_snapshot: null // Use profile default as fallback
    };

    const profileTaxRate = profile?.default_tax_rate || 0;

    const { subtotalCents, totalTaxCents } = getTaxSummary(
      estimateContext,
      sections as any, // Local EstimateSection has identical shape to CalcEstimateSection
      profileTaxRate
      // No materialsById — items in new-estimate already have cost_per_unit_cents inline
    );

    return {
      subtotalCents,
      tax: totalTaxCents,
      totalCents: subtotalCents + totalTaxCents
    };
  }, [sections, marginMode, globalMargin, profile?.default_tax_rate]);

  const { subtotalCents, tax, totalCents } = calculateTotals;

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
        message: lang.qtyZeroError
      });
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      const pendingData = {
        client,
        sections,
        customRef,
        businessName,
        marginMode,
        globalMargin,
        depositEnabled,
        depositPercentage,
        paymentTermsType,
        paymentDays
      };
      localStorage.setItem(
        'pactestim_pending_estimate',
        JSON.stringify(pendingData)
      );
      setDialog({
        type: 'confirm',
        title: lang.signUpRequired,
        message: lang.signUpDesc,
        onConfirm: () => router.push('/login?view=signup')
      });
      return;
    }

    if (businessName && businessName !== profile?.business_name) {
      const { error: bizNameError } = await supabase
        .from('profiles')
        .update({ business_name: businessName })
        .eq('id', user.id);
      if (bizNameError) {
        console.error('Failed to update business name:', bizNameError);
        // Non-blocking — continue with estimate save even if name update failed
      }
    }

    const totals = calculateTotals;
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
      client_city: client.city,
      client_zip: client.zip,
      client_country: client.country,
      custom_id: customRef.trim() || null,
      total_amount_cents: totals.totalCents,
      tax_amount_cents: totals.tax,
      sections: finalSections,
      is_locked: false,
      business_name_snapshot: businessName || profile.business_name,
      country_snapshot: profile.country,
      currency_snapshot: profile.currency,
      margin_mode_snapshot: marginMode,
      global_margin_snapshot: globalMargin,
      deposit_enabled: depositEnabled,
      deposit_percentage: depositPercentage,
      payment_terms_snapshot:
        paymentTermsType === 'upon_receipt'
          ? 'upon_receipt'
          : `${paymentDays}_days`
    };

    const res = editId
      ? await supabase
          .from('estimates')
          .update(payload)
          .eq('id', editId)
          .select()
      : await supabase.from('estimates').insert([payload]).select();

    if (!res.error) {
      if (client.name) {
        const existing = pastClients.find((c) => c.name === client.name);
        if (existing) {
          const { error: clientUpdateError } = await supabase
            .from('clients')
            .update({
              email: client.email,
              phone: client.phone,
              address: client.address,
              city: client.city,
              zip: client.zip,
              country: client.country
            })
            .eq('id', existing.id);
          if (clientUpdateError) {
            console.error('Failed to update client record:', clientUpdateError);
            // Non-blocking — estimate is already saved
          }
        } else {
          const { error: clientInsertError } = await supabase
            .from('clients')
            .insert([
              {
                user_id: user?.id,
                name: client.name,
                email: client.email,
                phone: client.phone,
                address: client.address,
                city: client.city,
                zip: client.zip,
                country: client.country
              }
            ]);
          if (clientInsertError) {
            console.error('Failed to insert client record:', clientInsertError);
            // Non-blocking — estimate is already saved
          }
        }
      }
      if (
        !editId &&
        profile.subscription_tier === 'free' &&
        monthlyCount >= 5 &&
        profile.estimate_credits > 0
      ) {
        // Atomic decrement to prevent race conditions when creating estimates rapidly
        const { data: newBalance, error: creditsError } = await supabase.rpc(
          'decrement_credits',
          { p_user_id: profile.id, p_amount: 1 }
        );
        if (creditsError) {
          console.error('Failed to decrement credits:', creditsError);
          // Non-blocking — user got their estimate, support can manually correct
        } else if (typeof newBalance === 'number') {
          // Update profile state so dashboard shows correct credit count immediately
          setProfile((prev: any) =>
            prev ? { ...prev, estimate_credits: newBalance } : prev
          );
        }
      }

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
        <div className="bg-white p-10 rounded-xl shadow-2xl max-w-sm w-full text-center border border-gray-100">
          <h2 className="text-xl font-black uppercase tracking-tighter mb-4 text-gray-900">
            {lang.limitReached}
          </h2>
          <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
            {lang.limitMessage}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/upgrade"
              className="w-full inline-block bg-blue-600 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-colors"
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
    <main className="min-h-screen bg-gray-50 text-black font-sans relative flex flex-col">
      <div className="flex-1 p-6 sm:p-8 pb-32 w-full">
        <div className="max-w-4xl mx-auto">
          {/* Header Area */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
              <div className="flex justify-between items-center w-full sm:w-auto">
                <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-tight max-w-[70%] sm:max-w-none">
                  {editId
                    ? lang.editProjectTitle
                    : lang.newEstimate?.replace('+', '') || 'New Estimate'}
                </h1>
                <Link
                  href="/dashboard"
                  className="sm:hidden text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors shrink-0 text-right ml-4"
                >
                  {lang.cancel}
                </Link>
              </div>

              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  maxLength={30}
                  placeholder={lang.customRef || 'Custom Ref #'}
                  value={customRef}
                  onChange={(e) => setCustomRef(e.target.value)}
                  className="text-xs p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold bg-white w-full sm:w-48 text-gray-600 shadow-sm"
                />
              </div>
            </div>
            <Link
              href={isGuest ? '/' : '/dashboard'}
              className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
            >
              {lang.cancelExit}
            </Link>
          </div>
          {/* Guest Lock Context Overlay */}
          {isGuest && (
            <div className="bg-blue-50 p-6 sm:p-8 rounded-xl border border-blue-100 mb-8 flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">
                  {lang.guestMode}
                </p>
                <p className="text-sm font-bold text-gray-700 leading-relaxed">
                  {lang.guestModeDesc}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                  {lang.yourBusinessName}
                </label>
                <input
                  required
                  maxLength={60}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="flex-1 p-2 bg-transparent outline-none font-bold text-black border-t border-gray-100 pt-3"
                />
              </div>
            </div>
          )}
          {/* Client Contact Section */}
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
                {lang.customerContactDetails}
              </p>
              {pastClients.length > 0 && (
                <Listbox
                  value={
                    pastClients.some((c) => c.name === client.name)
                      ? client.name
                      : ''
                  }
                  onChange={(val) => {
                    const selected = pastClients.find((c) => c.name === val);
                    if (selected) {
                      setClient({
                        name: selected.name || '',
                        email: selected.email || '',
                        phone: selected.phone || '',
                        address: selected.address || '',
                        city: selected.city || '',
                        zip: selected.zip || '',
                        country: selected.country || ''
                      });
                    }
                  }}
                >
                  <div className="relative w-full sm:w-64">
                    <ListboxButton className="w-full p-3.5 border border-gray-200 rounded-xl text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[10px] uppercase tracking-widest text-gray-600 flex justify-between items-center cursor-pointer">
                      <span className="block truncate">
                        {client.name || lang.selectClient || 'Select Client'}
                      </span>
                      <span className="pointer-events-none text-gray-400">
                        ▼
                      </span>
                    </ListboxButton>
                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <ListboxOptions className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-auto focus:outline-none text-xs font-bold">
                        {pastClients.map((c, i) => (
                          <ListboxOption
                            key={i}
                            value={c.name}
                            className={({ active }) =>
                              `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                            }
                          >
                            {c.name}
                          </ListboxOption>
                        ))}
                      </ListboxOptions>
                    </Transition>
                  </div>
                </Listbox>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2 group relative">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all bg-gray-50">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-xs">
                    N
                  </div>
                  <input
                    placeholder={lang.clientName || 'Client Name'}
                    maxLength={80}
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
                    @
                  </div>
                  <input
                    type="email"
                    placeholder={lang.email || 'Email Address'}
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
                    #
                  </div>
                  <input
                    type="tel"
                    placeholder={lang.phone || 'Phone Number'}
                    className="flex-1 p-4 bg-transparent outline-none font-bold text-sm text-gray-800"
                    value={client.phone}
                    onChange={(e) =>
                      setClient({ ...client, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 group relative">
                <div className="flex items-center border border-gray-200 rounded-xl focus-within:border-blue-500 transition-all bg-gray-50">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-xs rounded-l-xl">
                    A
                  </div>
                  <AddressAutocomplete
                    value={client.address || ''}
                    userCountry={profile?.country || 'US'}
                    placeholder={lang.address || 'Street Address'}
                    onChange={(val) => setClient({ ...client, address: val })}
                    onSelect={(components) =>
                      setClient({
                        ...client,
                        address: components.address,
                        city: components.city,
                        zip: components.zip,
                        country: components.country
                      })
                    }
                  />
                </div>
              </div>

              <div className="group relative">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all bg-gray-50">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-xs">
                    {lang.cityShort}
                  </div>
                  <input
                    placeholder={lang.city}
                    maxLength={100}
                    className="flex-1 p-4 bg-transparent outline-none font-bold text-sm text-gray-800"
                    value={client.city}
                    onChange={(e) =>
                      setClient({ ...client, city: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="group relative">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all bg-gray-50">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-[10px] tracking-tighter">
                    {lang.zipShort}
                  </div>
                  <input
                    placeholder={lang.zip}
                    maxLength={20}
                    className="flex-1 p-4 bg-transparent outline-none font-bold text-sm text-gray-800"
                    value={client.zip}
                    onChange={(e) =>
                      setClient({ ...client, zip: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 group relative">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all bg-gray-50">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-xs">
                    🌐
                  </div>
                  <input
                    placeholder={lang.country}
                    maxLength={100}
                    className="flex-1 p-4 bg-transparent outline-none font-bold text-sm text-gray-800"
                    value={client.country}
                    onChange={(e) =>
                      setClient({ ...client, country: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Internal Strategy (Margin) Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
            {/* Margin Settings Column */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block h-4 flex items-center select-none">
                {lang.marginStrategy}
              </label>
              <div className="flex flex-row gap-3 items-center w-full">
                <Listbox
                  value={marginMode}
                  onChange={(val: any) => setMarginMode(val)}
                >
                  <div className="relative flex-1">
                    <ListboxButton className="w-full p-3 border border-gray-200 rounded-xl text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[10px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer h-[44px]">
                      <span className="block truncate">
                        {marginMode === 'none' && lang.marginNone}
                        {marginMode === 'global' && lang.marginGlobal}
                        {marginMode === 'service' && lang.marginService}
                        {marginMode === 'granular' && lang.marginGranular}
                      </span>
                      <span className="pointer-events-none text-gray-400 text-[10px]">
                        ▼
                      </span>
                    </ListboxButton>
                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <ListboxOptions className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-auto focus:outline-none text-[10px] uppercase tracking-widest font-bold">
                        <ListboxOption
                          value="none"
                          className={({ active }) =>
                            `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                          }
                        >
                          {lang.marginNone}
                        </ListboxOption>
                        <ListboxOption
                          value="global"
                          className={({ active }) =>
                            `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                          }
                        >
                          {lang.marginGlobal}
                        </ListboxOption>
                        <ListboxOption
                          value="service"
                          className={({ active }) =>
                            `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                          }
                        >
                          {lang.marginService}
                        </ListboxOption>
                        <ListboxOption
                          value="granular"
                          className={({ active }) =>
                            `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                          }
                        >
                          {lang.marginGranular}
                        </ListboxOption>
                      </ListboxOptions>
                    </Transition>
                  </div>
                </Listbox>

                {marginMode === 'global' && (
                  <div className="relative w-24 sm:w-28 animate-fade-in shrink-0">
                    <input
                      type="number"
                      min="0"
                      value={globalMargin === 0 ? '' : globalMargin}
                      onChange={(e) =>
                        setGlobalMargin(
                          Math.max(0, parseFloat(e.target.value) || 0)
                        )
                      }
                      className="w-full p-3 pr-8 border border-blue-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold bg-blue-50/30 text-right h-[44px] text-sm text-blue-900 shadow-inner"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-3.5 text-[10px] font-black text-blue-400 pointer-events-none">
                      %
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Builder Sections */}
          <div className="space-y-6">
            {sections.map((sec, sIdx) => (
              <div
                key={sIdx}
                className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 relative group/section"
              >
                {sections.length > 1 && (
                  <button
                    onClick={() =>
                      setSections(sections.filter((_, i) => i !== sIdx))
                    }
                    className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors font-black opacity-100 sm:opacity-0 sm:group-hover/section:opacity-100"
                  >
                    ×
                  </button>
                )}
                {/* Service Step Header */}
                <div className="flex flex-col gap-4 mb-6 items-stretch">
                  <div className="relative flex-1 w-full flex flex-col">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1 pointer-events-none">
                      {lang.serviceCategoryStep}
                    </label>

                    <div className="relative flex items-center border-b-2 border-gray-100 focus-within:border-blue-500 transition-colors w-full">
                      <input
                        placeholder={lang.servicePlaceholder}
                        maxLength={50}
                        className="text-2xl font-black text-gray-900 outline-none w-full pb-2 italic tracking-tight bg-transparent pr-8 uppercase placeholder:normal-case placeholder:not-italic placeholder:text-gray-300 select-text"
                        value={sec.title}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setActiveDropdownIdx(null);
                          }
                        }}
                        onChange={(e) => {
                          updateSection(sIdx, 'title', e.target.value);
                          if (e.target.value.trim() !== '') {
                            setActiveDropdownIdx(sIdx);
                          } else {
                            setActiveDropdownIdx(null);
                          }
                        }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setActiveDropdownIdx(
                            activeDropdownIdx === sIdx ? null : sIdx
                          )
                        }
                        className="absolute right-1 bottom-3 text-gray-400 hover:text-black transition-colors text-[10px] p-1 cursor-pointer"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="mt-2 flex justify-start">
                      <button
                        type="button"
                        onClick={() => toggleDescription(sIdx)}
                        className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="text-xs font-mono leading-none">
                          {isDescVisible(sec, sIdx) ? '−' : '＋'}
                        </span>

                        <span>
                          {isDescVisible(sec, sIdx)
                            ? lang.hideDescription
                            : lang.addDescription}
                        </span>
                      </button>
                    </div>

                    {activeDropdownIdx === sIdx && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setActiveDropdownIdx(null)}
                        />

                        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto p-1 text-black normal-case not-italic font-sans">
                          {(() => {
                            // 1. Establish a single source of truth for unhidden categories
                            const availableSteps = savedSteps.filter(
                              (step) => !hiddenCategories.includes(step)
                            );
                            const filteredSteps = availableSteps.filter(
                              (step) =>
                                step
                                  .toLowerCase()
                                  .includes((sec.title || '').toLowerCase())
                            );

                            // Case A: User typed a search or menu is open with filtered matches available
                            if (filteredSteps.length > 0) {
                              return filteredSteps.map((step, idx) => (
                                <div
                                  key={idx}
                                  className="w-full flex items-center justify-between p-1 hover:bg-blue-50 rounded-lg group/item transition-colors"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateSection(sIdx, 'title', step);
                                      setActiveDropdownIdx(null);
                                    }}
                                    className="flex-1 text-left p-2 text-[10px] font-black uppercase tracking-widest text-gray-700 group-hover/item:text-blue-900 cursor-pointer block truncate"
                                  >
                                    {step}
                                  </button>
                                  {!isGuest && (
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setHiddenCategories((prev) => [
                                          ...prev,
                                          step
                                        ]);
                                        const { error } = await supabase
                                          .from('hidden_categories')
                                          .insert([
                                            {
                                              user_id: profile.id,
                                              category_name: step
                                            }
                                          ]);
                                        if (error) {
                                          console.error(
                                            'Failed to hide category:',
                                            error
                                          );
                                          // Roll back local state if DB write failed
                                          setHiddenCategories((prev) =>
                                            prev.filter((c) => c !== step)
                                          );
                                        }
                                      }}
                                      className="p-2 text-gray-300 hover:text-red-500 rounded text-xs font-bold transition-colors cursor-pointer"
                                      title={lang.removeFromList}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ));
                            }

                            // Case B: User typed something new that has zero matches
                            if (sec.title) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setActiveDropdownIdx(null)}
                                  className="w-full text-left p-3 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg uppercase tracking-wider italic cursor-pointer block"
                                >
                                  {lang.enterToSaveCategory}
                                </button>
                              );
                            }

                            // Case C: Lookup field is blank (Display all remaining categories with action items)
                            return availableSteps.map((step, idx) => (
                              <div
                                key={idx}
                                className="w-full flex items-center justify-between p-1 hover:bg-blue-50 rounded-lg group/item transition-colors"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateSection(sIdx, 'title', step);
                                    setActiveDropdownIdx(null);
                                  }}
                                  className="flex-1 text-left p-2 text-[10px] font-black uppercase tracking-widest text-gray-700 group-hover/item:text-blue-900 cursor-pointer block truncate"
                                >
                                  {step}
                                </button>
                                {!isGuest && (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setHiddenCategories((prev) => [
                                        ...prev,
                                        step
                                      ]);
                                      const { error } = await supabase
                                        .from('hidden_categories')
                                        .insert([
                                          {
                                            user_id: profile.id,
                                            category_name: step
                                          }
                                        ]);
                                      if (error) {
                                        console.error(
                                          'Failed to hide category:',
                                          error
                                        );
                                        // Roll back local state if DB write failed
                                        setHiddenCategories((prev) =>
                                          prev.filter((c) => c !== step)
                                        );
                                      }
                                    }}
                                    className="p-2 text-gray-300 hover:text-red-500 rounded text-xs font-bold transition-colors cursor-pointer"
                                    title={lang.removeFromList}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ));
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {marginMode === 'service' && !isDescVisible(sec, sIdx) && (
                  <div className="flex items-center gap-2 mb-6 animate-fade-in">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 shrink-0">
                      {lang.serviceMargin}
                    </span>
                    <div className="relative w-24">
                      <input
                        type="number"
                        min="0"
                        value={sec.marginRate === 0 ? '' : sec.marginRate || ''}
                        onChange={(e) =>
                          updateSection(
                            sIdx,
                            'marginRate',
                            Math.max(0, parseFloat(e.target.value) || 0)
                          )
                        }
                        className="w-full p-2 pr-6 border border-blue-200 rounded-lg outline-none focus:border-blue-500 font-mono font-bold bg-blue-50/30 text-right text-sm"
                        placeholder="0"
                      />

                      <span className="absolute right-2 top-2 text-[10px] font-black text-gray-400 pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                )}
                {/* Service Description Field */}
                {isDescVisible(sec, sIdx) && (
                  <div className="mb-6 transition-all animate-fade-in">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1 pointer-events-none">
                      {lang.serviceDescription}
                    </label>

                    <input
                      type="text"
                      maxLength={500}
                      placeholder={lang.serviceDescPlaceholder}
                      className="w-full text-xs p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold bg-gray-50/20 text-gray-700 shadow-sm transition-colors"
                      value={sec.description || ''}
                      onChange={(e) =>
                        updateSection(sIdx, 'description', e.target.value)
                      }
                    />

                    {marginMode === 'service' && (
                      <div className="flex items-center gap-2 mt-4 animate-fade-in">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 shrink-0">
                          {lang.serviceMargin}
                        </span>

                        <div className="relative w-24">
                          <input
                            type="number"
                            min="0"
                            value={
                              sec.marginRate === 0 ? '' : sec.marginRate || ''
                            }
                            onChange={(e) =>
                              updateSection(
                                sIdx,
                                'marginRate',
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            className="w-full p-2 pr-6 border border-blue-200 rounded-lg outline-none focus:border-blue-500 font-mono font-bold bg-blue-50/30 text-right text-sm"
                            placeholder="0"
                          />

                          <span className="absolute right-2 top-2 text-[10px] font-black text-gray-400 pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Enhanced Labor Block */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <div className="col-span-2 sm:col-span-4 lg:col-span-5 mb-2 flex justify-between items-center border-b border-slate-200/50 pb-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {lang.laborSettings}
                    </p>

                    <Listbox
                      value={sec.laborType || 'hourly'}
                      onChange={(val) => updateSection(sIdx, 'laborType', val)}
                    >
                      <div className="relative w-36 sm:w-40">
                        <ListboxButton className="w-full p-2 border border-slate-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-white transition-colors shadow-sm text-[9px] uppercase tracking-widest text-slate-500 flex justify-between items-center cursor-pointer">
                          <span className="block truncate">
                            {sec.laborType === 'daily'
                              ? lang.dailyRate
                              : lang.hourlyRate}
                          </span>

                          <span className="pointer-events-none text-slate-400 text-[10px]">
                            ▼
                          </span>
                        </ListboxButton>

                        <Transition
                          as={Fragment}
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                        >
                          <ListboxOptions className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto focus:outline-none">
                            <ListboxOption
                              value="hourly"
                              className={({ active }) =>
                                `cursor-pointer select-none relative p-2.5 text-[9px] uppercase tracking-widest font-bold ${active ? 'bg-blue-50 text-blue-900' : 'text-slate-600'}`
                              }
                            >
                              {lang.hourlyRate}
                            </ListboxOption>

                            <ListboxOption
                              value="daily"
                              className={({ active }) =>
                                `cursor-pointer select-none relative p-2.5 text-[9px] uppercase tracking-widest font-bold ${active ? 'bg-blue-50 text-blue-900' : 'text-slate-600'}`
                              }
                            >
                              {lang.dailyRate}
                            </ListboxOption>
                          </ListboxOptions>
                        </Transition>
                      </div>
                    </Listbox>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 truncate">
                      {sec.laborType === 'daily' ? lang.estDays : lang.estHours}
                    </label>

                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-full p-3 rounded-lg border border-slate-200 font-mono font-bold outline-none focus:border-blue-500 bg-white text-sm h-[44px]"
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

                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 truncate">
                      {sec.laborType === 'daily' ? lang.rateDay : lang.rateHour}{' '}
                      ({profile?.currency === 'EUR' ? '€' : '$'})
                    </label>

                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-full p-3 rounded-lg border border-slate-200 font-mono font-bold outline-none focus:border-blue-500 bg-white text-sm h-[44px]"
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

                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 truncate">
                      {lang.taxRatePct}
                    </label>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-full p-3 pr-8 rounded-lg border border-slate-200 font-mono font-bold outline-none focus:border-blue-500 bg-white text-sm h-[44px]"
                        value={sec.laborTaxRate === 0 ? '' : sec.laborTaxRate}
                        onChange={(e) =>
                          updateSection(
                            sIdx,
                            'laborTaxRate',
                            Math.max(0, parseFloat(e.target.value) || 0)
                          )
                        }
                      />

                      <span className="absolute right-3 top-3.5 text-slate-400 text-[10px] font-bold pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>

                  {marginMode === 'granular' && (
                    <div className="col-span-1 sm:col-span-1 lg:col-span-2">
                      <label className="block text-[10px] font-black text-blue-500 uppercase mb-1.5 tracking-widest truncate">
                        {lang.laborMargin}
                      </label>

                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-full p-3 pr-8 rounded-lg border border-blue-200 font-mono font-bold outline-none focus:border-blue-500 bg-blue-50/50 text-blue-900 text-sm h-[44px]"
                          value={
                            sec.laborMarginRate === 0
                              ? ''
                              : sec.laborMarginRate || ''
                          }
                          onChange={(e) =>
                            updateSection(
                              sIdx,
                              'laborMarginRate',
                              Math.max(0, parseFloat(e.target.value) || 0)
                            )
                          }
                        />

                        <span className="absolute right-3 top-3.5 text-blue-400 text-[10px] font-bold pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Material Items Header & Loop */}

                <div className="mb-4">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">
                    {lang.materials || 'Materials'}
                  </p>

                  <div className="flex flex-col gap-4">
                    {sec.items.map((item, iIdx) => (
                      <div
                        key={iIdx}
                        className="flex flex-col lg:flex-row gap-3 items-stretch bg-gray-50/50 p-3 rounded-lg border border-gray-100/50"
                      >
                        {/* Name & Material Box */}

                        <div className="flex-1 relative min-w-[200px]">
                          {item.materialId ? (
                            <div className="flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded text-sm relative h-[34px]">
                              <span className="font-bold text-gray-900 truncate pr-4 text-xs">
                                {item.name}
                              </span>

                              <button
                                onClick={() =>
                                  updateItem(sIdx, iIdx, 'materialId', '')
                                }
                                className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 bg-blue-50/50 px-2 py-1 rounded shrink-0 transition-colors"
                              >
                                {lang.edit}
                              </button>
                            </div>
                          ) : (
                            <MaterialCombobox
                              materials={materials}
                              selectedId={item.materialId}
                              onChange={(val: any) => {
                                if (!val) return;
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
                                    (lang?.units
                                      ? Object.keys(lang.units)[0]
                                      : 'ea')
                                );
                              }}
                              onCreateNew={(name: string) =>
                                handleCreateMaterialOnTheFly(sIdx, iIdx, name)
                              }
                              placeholder={
                                lang.selectMaterial ||
                                'Select or create material...'
                              }
                              createLabel={lang.create}
                              emptyStateLabel={lang.noMaterialsFound}
                              currencySymbol={
                                profile?.currency === 'EUR' ? '€' : '$'
                              }
                              unitLabels={lang?.units || {}}
                            />
                          )}
                        </div>
                        {/* Inputs Grid */}

                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                          {/* QTY */}

                          <div className="flex-1 min-w-[80px] sm:w-20 sm:flex-none relative shrink-0 group">
                            <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none transition-colors group-focus-within:text-blue-500">
                              {lang.qtyShort}
                            </span>

                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              className="w-full py-2 pl-9 pr-2 border border-gray-100 rounded text-right font-bold outline-none focus:border-blue-500 transition-colors bg-white text-xs"
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
                          {/* UNIT */}

                          <div className="flex-1 min-w-[100px] sm:w-28 sm:flex-none relative shrink-0 group">
                            <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none z-10 transition-colors group-focus-within:text-blue-500">
                              {lang.unitShort}
                            </span>

                            <Listbox
                              value={getResolvedUnitKey(item.unit)}
                              onChange={(val) =>
                                updateItem(sIdx, iIdx, 'unit', val)
                              }
                            >
                              <div className="relative">
                                <ListboxButton className="w-full py-2 pl-11 pr-6 text-left text-xs font-bold text-gray-900 border border-gray-100 rounded outline-none focus:border-blue-500 transition-colors bg-white cursor-pointer h-[34px]">
                                  <span className="block truncate text-right">
                                    {lang?.units
                                      ? lang.units[
                                          getResolvedUnitKey(item.unit)
                                        ]
                                      : 'ea'}
                                  </span>
                                </ListboxButton>

                                <Transition
                                  as={Fragment}
                                  leave="transition ease-in duration-100"
                                  leaveFrom="opacity-100"
                                  leaveTo="opacity-0"
                                >
                                  <ListboxOptions className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded shadow-xl max-h-60 overflow-auto focus:outline-none text-xs">
                                    {lang?.units &&
                                      Object.keys(lang.units).map((key) => (
                                        <ListboxOption
                                          key={key}
                                          value={key}
                                          className={({ active }) =>
                                            `cursor-pointer select-none relative py-2 pl-3 pr-4 font-bold ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                                          }
                                        >
                                          {lang.units[key]}
                                        </ListboxOption>
                                      ))}
                                  </ListboxOptions>
                                </Transition>
                              </div>
                            </Listbox>
                          </div>
                          {/* COST */}

                          <div className="flex-1 min-w-[100px] sm:w-28 sm:flex-none relative shrink-0 group">
                            <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none transition-colors group-focus-within:text-blue-500">
                              {lang.costShort}
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className="w-full py-2 pl-10 pr-2 border border-gray-100 rounded text-right font-bold outline-none focus:border-blue-500 transition-colors bg-white text-xs"
                              value={
                                item.cost_per_unit_cents === 0
                                  ? ''
                                  : (item.cost_per_unit_cents || 0) / 100
                              }
                              onChange={(e) =>
                                updateItem(
                                  sIdx,
                                  iIdx,
                                  'cost_per_unit_cents',
                                  Math.max(
                                    0,
                                    Math.round(
                                      (parseFloat(e.target.value) || 0) * 100
                                    )
                                  )
                                )
                              }
                            />
                          </div>
                          {/* TAX */}

                          <div className="flex-1 min-w-[90px] sm:w-[100px] sm:flex-none relative shrink-0 group">
                            <span className="absolute left-2 top-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest pointer-events-none transition-colors group-focus-within:text-blue-500">
                              {lang.taxShort}
                            </span>

                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              className="w-full py-2 pl-10 pr-6 border border-gray-100 rounded text-right font-bold outline-none focus:border-blue-500 transition-colors bg-white text-xs"
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

                            <span className="absolute right-2 top-2 text-[10px] font-black text-gray-400 pointer-events-none">
                              %
                            </span>
                          </div>
                          {/* MARGIN (Granular) */}

                          {marginMode === 'granular' && (
                            <div className="flex-1 min-w-[90px] sm:w-[100px] sm:flex-none relative shrink-0 group">
                              <span className="absolute left-2 top-2.5 text-[9px] font-black text-blue-400 uppercase tracking-widest pointer-events-none transition-colors group-focus-within:text-blue-600">
                                Mgn
                              </span>

                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                className="w-full py-2 pl-10 pr-6 border border-blue-100 rounded text-right font-bold outline-none focus:border-blue-500 bg-blue-50/30 text-blue-900 text-xs"
                                value={
                                  item.marginRate === 0
                                    ? ''
                                    : item.marginRate || ''
                                }
                                onChange={(e) =>
                                  updateItem(
                                    sIdx,
                                    iIdx,
                                    'marginRate',
                                    Math.max(0, parseFloat(e.target.value) || 0)
                                  )
                                }
                              />

                              <span className="absolute right-2 top-2 text-[10px] font-black text-blue-400 pointer-events-none">
                                %
                              </span>
                            </div>
                          )}
                          {/* DELETE ROW */}

                          <button
                            onClick={() => {
                              const n = [...sections];
                              n[sIdx].items = n[sIdx].items.filter(
                                (_, i) => i !== iIdx
                              );
                              setSections(n);
                            }}
                            className="text-gray-300 hover:text-red-500 w-8 h-[34px] flex items-center justify-center font-bold transition-colors shrink-0 bg-white border border-gray-100 rounded sm:border-none sm:bg-transparent"
                          >
                            ×
                          </button>
                        </div>
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
                        marginRate: 0,
                        cost_per_unit_cents: 0,
                        unit: lang?.units ? Object.keys(lang.units)[0] : 'ea'
                      });
                      setSections(n);
                    }}
                    className="mt-4 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    + {lang.addItem || 'Add Item'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Streamlined Full-Width Dashed Add Service Button */}

          <button
            onClick={() => {
              setSections([
                ...sections,
                {
                  title: '',
                  description: '',
                  laborHours: 0,
                  hourlyRate: profile?.default_hourly_rate || 50,
                  laborTaxRate: profile?.default_tax_rate || 0,
                  laborType: 'hourly',
                  items: []
                }
              ]);
            }}
            className="w-full mt-4 p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-black uppercase tracking-widest text-[10px] hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/40 transition-all cursor-pointer"
          >
            +{lang.addService}
          </button>
          {/* Commercial Terms Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 mt-8">
            {/* Payment Terms Column */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block h-4 flex items-center select-none">
                {lang.paymentTerms}
              </label>
              <div className="flex flex-row gap-3 items-center w-full h-[44px]">
                <div className="flex flex-1 border border-gray-200 rounded-xl h-full overflow-hidden p-1 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => setPaymentTermsType('upon_receipt')}
                    className={`flex-1 rounded-lg font-bold text-xs tracking-wide transition-all uppercase text-center cursor-pointer ${
                      paymentTermsType === 'upon_receipt'
                        ? 'bg-white shadow-sm border border-gray-100 text-blue-600 font-black'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {lang.uponReceipt}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentTermsType('net_days')}
                    className={`flex-1 rounded-lg font-bold text-xs tracking-wide transition-all uppercase text-center cursor-pointer ${
                      paymentTermsType === 'net_days'
                        ? 'bg-white shadow-sm border border-gray-100 text-blue-600 font-black'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {lang.netDays}
                  </button>
                </div>

                <div
                  className={`flex items-center w-28 max-w-[112px] min-w-[112px] shrink-0 border border-blue-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 bg-blue-50/30 shadow-inner h-full overflow-hidden transition-all duration-200 ${paymentTermsType === 'net_days' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                >
                  <input
                    type="number"
                    min="1"
                    max="120"
                    disabled={paymentTermsType !== 'net_days'}
                    value={paymentDays}
                    onChange={(e) =>
                      setPaymentDays(
                        Math.min(
                          120,
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      )
                    }
                    className="flex-1 w-full py-3 pl-2 pr-1 bg-transparent outline-none font-mono font-bold text-right text-sm text-blue-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="w-12 text-center text-[10px] font-black text-blue-400 uppercase tracking-widest pointer-events-none shrink-0 select-none border-l border-blue-200/50 flex items-center justify-center h-full bg-blue-50/10">
                    {profile?.country === 'FR' ? 'Jrs' : 'Days'}
                  </span>
                </div>
              </div>
            </div>

            {/* Deposit Column */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block h-4 flex items-center select-none">
                {lang.deposit}
              </label>
              <div className="flex flex-row gap-3 items-center w-full h-[44px]">
                <div className="flex-1 h-full px-4 border border-gray-200 rounded-xl bg-white text-xs font-bold text-gray-700 flex justify-between items-center shadow-sm hover:bg-gray-50/50 transition-all select-none">
                  <span>{lang.requireDeposit}</span>
                  <Switch
                    checked={depositEnabled}
                    onChange={setDepositEnabled}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${depositEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${depositEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </Switch>
                </div>

                <div
                  className={`flex items-center w-28 max-w-[112px] min-w-[112px] shrink-0 border border-blue-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 bg-blue-50/30 shadow-inner h-full overflow-hidden transition-all duration-200 ${depositEnabled ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                >
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={!depositEnabled}
                    value={depositPercentage}
                    onChange={(e) =>
                      setDepositPercentage(
                        Math.min(
                          100,
                          Math.max(1, parseInt(e.target.value) || 0)
                        )
                      )
                    }
                    className="flex-1 w-full py-3 pl-2 pr-1 bg-transparent outline-none font-mono font-bold text-right text-sm text-blue-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="w-12 text-center text-[10px] font-black text-blue-400 uppercase tracking-widest pointer-events-none shrink-0 select-none border-l border-blue-200/50 flex items-center justify-center h-full bg-blue-50/10">
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] px-6 sm:px-8 py-4 z-40 transition-all print:hidden mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Left Block: Pure Financial Data Displays */}
          <div className="flex items-center justify-between md:justify-start gap-6 sm:gap-10 w-full md:w-auto">
            <div>
              <span className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                {lang.subtotal || 'Subtotal'}
              </span>
              <span className="font-mono font-bold text-base text-gray-700">
                {profile?.currency === 'EUR' ? '€' : '$'}
                {(subtotalCents / 100)
                  .toFixed(2)
                  .replace('.', profile?.country === 'FR' ? ',' : '.')}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                {lang.tax || 'Tax'}
              </span>
              <span className="font-mono font-bold text-base text-gray-500">
                {profile?.currency === 'EUR' ? '€' : '$'}
                {(tax / 100)
                  .toFixed(2)
                  .replace('.', profile?.country === 'FR' ? ',' : '.')}
              </span>
            </div>

            <div className="border-l border-gray-100 pl-6 sm:pl-8">
              <span className="block text-[10px] font-black uppercase tracking-widest text-blue-600 mb-0.5">
                {lang.grandTotal || 'Grand Total'}
              </span>
              <span className="font-mono font-black text-xl sm:text-2xl text-gray-950 tracking-tight">
                {profile?.currency === 'EUR' ? '€' : '$'}
                {(totalCents / 100)
                  .toFixed(2)
                  .replace('.', profile?.country === 'FR' ? ',' : '.')}
              </span>
            </div>
          </div>

          {/* Right Block: Modifiers & Primary Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto justify-end">
            {/* Main Action Button */}
            <div className="w-full sm:w-auto shrink-0">
              <button
                onClick={handleSave}
                className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-600/10 hover:bg-blue-700 hover:shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] h-[40px] flex items-center justify-center"
              >
                {editId ? lang.save : lang.generateEstimate}
              </button>
            </div>
          </div>
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
