'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';
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

export default function DashboardPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter & Sort State
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'draft' | 'pending' | 'approved' | 'rejected'
  >('all');
  const [sortBy, setSortBy] = useState<
    'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
  >('date_desc');

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

  const processedEstimates = [...estimates]
    .filter((est) => {
      if (filterStatus === 'draft') return !est.is_locked;
      if (filterStatus === 'pending')
        return (
          est.is_locked &&
          (!est.client_status || est.client_status === 'pending')
        );
      if (filterStatus === 'approved')
        return est.is_locked && est.client_status === 'approved';
      if (filterStatus === 'rejected')
        return est.is_locked && est.client_status === 'rejected';
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc')
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      if (sortBy === 'date_asc')
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      if (sortBy === 'amount_desc')
        return b.total_amount_cents - a.total_amount_cents;
      if (sortBy === 'amount_asc')
        return a.total_amount_cents - b.total_amount_cents;
      return 0;
    });

  const handleExportCSV = (type: 'summary' | 'detailed') => {
    let csv = '';
    const isFr = profile?.country === 'FR';

    // CSV Escape Helper: Wraps text in quotes and escapes internal quotes
    const escapeCsv = (str: string) =>
      `"${(str || '').toString().replace(/"/g, '""')}"`;

    // Numeric formatters adapting to standard US vs FR (comma) decimals
    const formatNum = (num: number) => {
      const str = num.toFixed(2);
      return isFr ? `"${str.replace('.', ',')}"` : str;
    };
    const formatPct = (pct: number) => {
      const str = pct.toFixed(1);
      return isFr ? `"${str.replace('.', ',')}%"` : `"${str}%"`;
    };
    const formatQty = (qty: number) => {
      const str = qty.toString();
      return isFr ? `"${str.replace('.', ',')}"` : str;
    };

    if (type === 'summary') {
      const headers = isFr
        ? 'ID Devis,Date,Nom du Client,Email du Client,Téléphone du Client,Adresse du Client,Statut,Stratégie de Marge,% Marge Globale,Devise,Total TTC\n'
        : 'Estimate ID,Date,Client Name,Client Email,Client Phone,Client Address,Status,Margin Strategy,Global Margin %,Currency,Grand Total\n';

      csv = headers;

      processedEstimates.forEach((e) => {
        const date = escapeCsv(
          new Date(e.created_at).toLocaleDateString(isFr ? 'fr-FR' : 'en-US')
        );
        const cName = escapeCsv(e.client_name);
        const cEmail = escapeCsv(e.client_email);
        const cPhone = escapeCsv(e.client_phone);
        const cAddr = escapeCsv(e.client_address);
        const statusText = isFr
          ? e.is_locked
            ? e.client_status === 'approved'
              ? 'Approuvé'
              : e.client_status === 'rejected'
                ? 'Refusé'
                : 'En Attente'
            : 'Brouillon'
          : e.is_locked
            ? e.client_status === 'approved'
              ? 'Approved'
              : e.client_status === 'rejected'
                ? 'Rejected'
                : 'Pending'
            : 'Draft';
        const status = escapeCsv(statusText);
        const marginMode = escapeCsv(e.margin_mode_snapshot || 'none');
        const globalMargin = formatPct(e.global_margin_snapshot || 0);
        const currency = escapeCsv(
          e.currency_snapshot || (isFr ? 'EUR' : 'USD')
        );
        const grandTotal = formatNum(e.total_amount_cents / 100);

        csv += `${escapeCsv(e.custom_id || e.id)},${date},${cName},${cEmail},${cPhone},${cAddr},${status},${marginMode},${globalMargin},${currency},${grandTotal}\n`;
      });
    } else {
      const headers = isFr
        ? "ID Devis,Date,Nom du Client,Email du Client,Téléphone du Client,Adresse du Client,Statut,Catégorie de Service,Description du Service,Catégorie de Coût,Nom de l'Article/Main d'œuvre,Quantité,Unité,Coût de Base,Montant de Base,% Marge,Montant Marge,Prix Client (HT),% TVA,Montant TVA,Prix Client (TTC),Devise\n"
        : 'Estimate ID,Date,Client Name,Client Email,Client Phone,Client Address,Status,Service Category,Service Description,Cost Category,Item/Labor Name,Quantity,Unit,Base Cost,Base Amount,Margin %,Margin Amount,Client Price (Before Tax),Tax %,Tax Amount,Client Price (Including Tax),Currency\n';

      csv = headers;

      processedEstimates.forEach((e) => {
        const date = escapeCsv(
          new Date(e.created_at).toLocaleDateString(isFr ? 'fr-FR' : 'en-US')
        );
        const cName = escapeCsv(e.client_name);
        const cEmail = escapeCsv(e.client_email);
        const cPhone = escapeCsv(e.client_phone);
        const cAddr = escapeCsv(e.client_address);
        const statusText = isFr
          ? e.is_locked
            ? e.client_status === 'approved'
              ? 'Approuvé'
              : e.client_status === 'rejected'
                ? 'Refusé'
                : 'En Attente'
            : 'Brouillon'
          : e.is_locked
            ? e.client_status === 'approved'
              ? 'Approved'
              : e.client_status === 'rejected'
                ? 'Rejected'
                : 'Pending'
            : 'Draft';
        const status = escapeCsv(statusText);
        const currency = escapeCsv(
          e.currency_snapshot || (isFr ? 'EUR' : 'USD')
        );

        const baseInfo = `${escapeCsv(e.custom_id || e.id)},${date},${cName},${cEmail},${cPhone},${cAddr},${status}`;

        const getMultiplier = (
          sec: any,
          item: any = null,
          isLabor: boolean = false
        ) => {
          const mode = e.margin_mode_snapshot || 'none';
          if (mode === 'global')
            return 1 + (e.global_margin_snapshot || 0) / 100;
          if (mode === 'service') return 1 + (sec.marginRate || 0) / 100;
          if (mode === 'granular') {
            if (isLabor) return 1 + (sec.laborMarginRate || 0) / 100;
            if (item) return 1 + (item.marginRate || 0) / 100;
          }
          return 1;
        };

        (e.sections || []).forEach((sec: any) => {
          const serviceTitle = escapeCsv(
            sec.title || (isFr ? 'Service' : 'Service')
          );
          const serviceDesc = escapeCsv(sec.description || '');

          // Process Labor
          if (sec.laborHours > 0) {
            const qty = sec.laborHours;
            const baseCost = sec.hourlyRate || 0;
            const baseAmount = baseCost * qty;

            const mult = getMultiplier(sec, null, true);
            const marginPct = (mult - 1) * 100;
            const clientPriceBeforeTax = baseAmount * mult;
            const marginAmount = clientPriceBeforeTax - baseAmount;

            const taxRate = sec.laborTaxRate || 0;
            const taxAmount = clientPriceBeforeTax * (taxRate / 100);
            const clientPriceInclTax = clientPriceBeforeTax + taxAmount;

            const unit =
              sec.laborType === 'daily'
                ? isFr
                  ? 'Jours'
                  : 'Days'
                : isFr
                  ? 'Heures'
                  : 'Hours';
            const laborName =
              sec.laborType === 'daily'
                ? isFr
                  ? "Main-d'œuvre (Jour)"
                  : 'Daily Labor'
                : isFr
                  ? "Main-d'œuvre (Heure)"
                  : 'Hourly Labor';
            const costCategory = isFr ? '"Main-d\'œuvre"' : '"Labor"';

            csv += `${baseInfo},${serviceTitle},${serviceDesc},${costCategory},${escapeCsv(laborName)},${formatQty(qty)},${escapeCsv(unit)},${formatNum(baseCost)},${formatNum(baseAmount)},${formatPct(marginPct)},${formatNum(marginAmount)},${formatNum(clientPriceBeforeTax)},${formatPct(taxRate)},${formatNum(taxAmount)},${formatNum(clientPriceInclTax)},${currency}\n`;
          }

          // Process Materials
          (sec.items || []).forEach((item: any) => {
            const m = materials.find((mat) => mat.id === item.materialId);
            const name =
              item.name ||
              m?.name ||
              (isFr ? 'Article inconnu' : 'Unknown Material');

            const rawCostCents =
              item.cost_per_unit_cents !== undefined
                ? item.cost_per_unit_cents
                : m?.cost_per_unit_cents || 0;
            const baseCost = rawCostCents / 100;
            const qty = item.qty || 0;
            const baseAmount = baseCost * qty;

            const mult = getMultiplier(sec, item, false);
            const marginPct = (mult - 1) * 100;
            const clientPriceBeforeTax = baseAmount * mult;
            const marginAmount = clientPriceBeforeTax - baseAmount;

            const taxRate = item.taxRate || 0;
            const taxAmount = clientPriceBeforeTax * (taxRate / 100);
            const clientPriceInclTax = clientPriceBeforeTax + taxAmount;

            let unit = item.unit || m?.unit || 'ea';
            if (lang?.units?.[unit]) {
              unit = lang.units[unit];
            }
            const costCategory = isFr ? '"Matériel"' : '"Material"';

            csv += `${baseInfo},${serviceTitle},${serviceDesc},${costCategory},${escapeCsv(name)},${formatQty(qty)},${escapeCsv(unit)},${formatNum(baseCost)},${formatNum(baseAmount)},${formatPct(marginPct)},${formatNum(marginAmount)},${formatNum(clientPriceBeforeTax)},${formatPct(taxRate)},${formatNum(taxAmount)},${formatNum(clientPriceInclTax)},${currency}\n`;
          });
        });
      });
    }

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;'
    });
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

  if (loading || !lang) return <LoadingDots />;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyEstimates = estimates.filter((e) => {
    const date = new Date(e.created_at);
    return (
      date.getMonth() === currentMonth && date.getFullYear() === currentYear
    );
  }).length;

  const isFreePlan = profile?.subscription_tier === 'free';
  const remainingCredits = profile?.estimate_credits || 0;
  const standardLimitReached = monthlyEstimates >= 5;

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans relative pb-40">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">
              {lang.dashboard}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">
                {profile?.business_name}
              </p>
              {isFreePlan && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    {profile?.country === 'FR' ? 'Plan Gratuit' : 'Free Plan'}
                  </span>
                  {standardLimitReached ? (
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                      {remainingCredits}{' '}
                      {profile?.country === 'FR'
                        ? 'Crédits Restants'
                        : 'Credits Left'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {5 - monthlyEstimates}{' '}
                      {profile?.country === 'FR'
                        ? 'Gratuits Restants'
                        : 'Free Left'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 w-full sm:w-auto">
            {profile.subscription_tier === 'pro' && estimates.length > 0 && (
              <button
                onClick={() => setExportModal(true)}
                className="flex flex-1 sm:flex-none items-center justify-center text-center px-6 py-3 border border-green-200 bg-green-50 text-green-700 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-sm hover:border-green-300 transition-colors min-h-[44px]"
              >
                {profile.country === 'FR' ? 'Exporter Excel' : 'Export Data'}
              </button>
            )}
            <Link
              href="/materials"
              className="flex flex-1 sm:flex-none items-center justify-center text-center px-6 py-3 border border-gray-200 bg-white rounded-lg font-black uppercase tracking-widest text-[10px] shadow-sm hover:border-gray-300 transition-colors min-h-[44px]"
            >
              {lang.priceList}
            </Link>
            <Link
              href="/new-estimate"
              className="flex flex-1 sm:flex-none items-center justify-center text-center px-6 py-3 bg-blue-600 text-white rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              {lang.newEstimate}
            </Link>
          </div>
        </div>

        {/* CONTROLS: SORT & FILTER */}
        {estimates.length > 0 && (
          <div className="bg-white p-3 sm:px-4 sm:py-2.5 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">
                {profile?.country === 'FR' ? 'Statut:' : 'Filter:'}
              </span>
              <Listbox value={filterStatus} onChange={setFilterStatus}>
                <div className="relative w-full sm:w-40">
                  <ListboxButton className="w-full py-2 px-3 border border-gray-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[9px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {filterStatus === 'all' &&
                        (profile?.country === 'FR'
                          ? 'Tous les Projets'
                          : 'All Projects')}
                      {filterStatus === 'draft' &&
                        (profile?.country === 'FR'
                          ? 'Brouillons'
                          : 'Drafts Only')}
                      {filterStatus === 'pending' &&
                        (profile?.country === 'FR'
                          ? 'En Attente'
                          : 'Pending Only')}
                      {filterStatus === 'approved' &&
                        (profile?.country === 'FR'
                          ? 'Approuvés'
                          : 'Approved Only')}
                      {filterStatus === 'rejected' &&
                        (profile?.country === 'FR'
                          ? 'Refusés'
                          : 'Rejected Only')}
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
                      <ListboxOption
                        value="all"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {profile?.country === 'FR'
                          ? 'Tous les Projets'
                          : 'All Projects'}
                      </ListboxOption>
                      <ListboxOption
                        value="draft"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {profile?.country === 'FR'
                          ? 'Brouillons'
                          : 'Drafts Only'}
                      </ListboxOption>
                      <ListboxOption
                        value="pending"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {profile?.country === 'FR'
                          ? 'En Attente'
                          : 'Pending Only'}
                      </ListboxOption>
                      <ListboxOption
                        value="approved"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {profile?.country === 'FR'
                          ? 'Approuvés'
                          : 'Approved Only'}
                      </ListboxOption>
                      <ListboxOption
                        value="rejected"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {profile?.country === 'FR'
                          ? 'Refusés'
                          : 'Rejected Only'}
                      </ListboxOption>
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">
                {profile?.country === 'FR' ? 'Trier par:' : 'Sort by:'}
              </span>
              <Listbox value={sortBy} onChange={setSortBy}>
                <div className="relative w-full sm:w-44">
                  <ListboxButton className="w-full py-2 px-3 border border-gray-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[9px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {sortBy === 'date_desc' &&
                        (profile?.country === 'FR'
                          ? 'Plus Récents'
                          : 'Newest First')}
                      {sortBy === 'date_asc' &&
                        (profile?.country === 'FR'
                          ? 'Plus Anciens'
                          : 'Oldest First')}
                      {sortBy === 'amount_desc' &&
                        (profile?.country === 'FR'
                          ? 'Montant Supérieur'
                          : 'Highest Amount')}
                      {sortBy === 'amount_asc' &&
                        (profile?.country === 'FR'
                          ? 'Montant Inférieur'
                          : 'Lowest Amount')}
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
                      <ListboxOption
                        value="date_desc"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {profile?.country === 'FR'
                          ? 'Plus Récents'
                          : 'Newest First'}
                      </ListboxOption>
                      <ListboxOption
                        value="date_asc"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {profile?.country === 'FR'
                          ? 'Plus Anciens'
                          : 'Oldest First'}
                      </ListboxOption>
                      <ListboxOption
                        value="amount_desc"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {profile?.country === 'FR'
                          ? 'Montant Supérieur'
                          : 'Highest Amount'}
                      </ListboxOption>
                      <ListboxOption
                        value="amount_asc"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {profile?.country === 'FR'
                          ? 'Montant Inférieur'
                          : 'Lowest Amount'}
                      </ListboxOption>
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
            </div>
          </div>
        )}

        {/* ESTIMATES LIST */}
        <div className="space-y-4">
          {processedEstimates.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-xl border border-gray-200">
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                {profile.country === 'FR'
                  ? 'Aucun devis ne correspond aux critères.'
                  : 'No estimates match your criteria.'}
              </p>
            </div>
          ) : (
            processedEstimates.map((est) => (
              <div
                key={est.id}
                onClick={() =>
                  router.push(
                    est.is_locked
                      ? `/estimates/${est.id}`
                      : `/new-estimate?edit=${est.id}`
                  )
                }
                className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md hover:border-blue-200 hover:ring-1 hover:ring-blue-200 cursor-pointer transition-all group"
              >
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start mb-1 sm:mb-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                        {est.client_name ||
                          (profile.country === 'FR'
                            ? 'Projet sans nom'
                            : 'Untitled Project')}
                      </h3>
                      <span
                        className={`hidden sm:inline-block text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${
                          !est.is_locked
                            ? 'bg-yellow-50 text-yellow-600'
                            : est.client_status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : est.client_status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {!est.is_locked
                          ? lang.draft
                          : est.client_status === 'approved'
                            ? profile.country === 'FR'
                              ? 'Approuvé'
                              : 'Approved'
                            : est.client_status === 'rejected'
                              ? profile.country === 'FR'
                                ? 'Refusé'
                                : 'Rejected'
                              : profile.country === 'FR'
                                ? 'En Attente'
                                : 'Pending'}
                      </span>
                    </div>
                    {/* Mobile Price */}
                    <p className="sm:hidden font-mono font-black text-lg text-blue-600">
                      {est.currency_snapshot === 'EUR' ? '€' : '$'}
                      {(est.total_amount_cents / 100)
                        .toFixed(2)
                        .replace(
                          '.',
                          est.currency_snapshot === 'EUR' ? ',' : '.'
                        )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-400 font-medium mt-2 sm:mt-1">
                    <span>{formatDate(est.created_at)}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">
                      {est.client_email ||
                        (profile.country === 'FR'
                          ? 'Aucun contact'
                          : 'No contact email')}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-500">
                      {est.custom_id || est.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-6 mt-4 pt-4 border-t border-gray-100 sm:mt-0 sm:pt-0 sm:border-0">
                  {/* Mobile Status Badge */}
                  <span
                    className={`sm:hidden text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${
                      !est.is_locked
                        ? 'bg-yellow-50 text-yellow-600'
                        : est.client_status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : est.client_status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {!est.is_locked
                      ? lang.draft
                      : est.client_status === 'approved'
                        ? profile.country === 'FR'
                          ? 'Approuvé'
                          : 'Approved'
                        : est.client_status === 'rejected'
                          ? profile.country === 'FR'
                            ? 'Refusé'
                            : 'Rejected'
                          : profile.country === 'FR'
                            ? 'En Attente'
                            : 'Pending'}
                  </span>

                  {/* Desktop Price */}
                  <div className="hidden sm:block text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">
                      {lang.grandTotal}
                    </p>
                    <p className="font-mono font-black text-xl text-gray-800 group-hover:text-blue-600 transition-colors">
                      {est.currency_snapshot === 'EUR' ? '€' : '$'}
                      {(est.total_amount_cents / 100)
                        .toFixed(2)
                        .replace(
                          '.',
                          est.currency_snapshot === 'EUR' ? ',' : '.'
                        )}
                    </p>
                  </div>

                  <div className="w-8 flex justify-end">
                    {!est.is_locked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(est.id);
                        }}
                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded p-2 transition-all"
                        title="Delete Draft"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
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
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-100">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-2 text-gray-900">
              {profile?.country === 'FR'
                ? "Format d'exportation"
                : 'Export Format'}
            </h3>
            <p className="text-[11px] text-gray-500 font-bold mb-6 uppercase tracking-widest leading-relaxed">
              {profile?.country === 'FR'
                ? 'Choisissez le niveau de détail pour votre rapport Excel (CSV).'
                : 'Choose the level of detail for your Excel (CSV) report.'}
            </p>

            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={() => handleExportCSV('summary')}
                className="text-left p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors shadow-sm"
              >
                <p className="font-black text-sm text-gray-900 uppercase tracking-widest">
                  {profile?.country === 'FR'
                    ? 'Vue Résumée'
                    : 'Summarized View'}
                </p>
                <p className="text-xs text-gray-500 mt-2 font-bold">
                  {profile?.country === 'FR'
                    ? 'Une ligne par devis avec les totaux.'
                    : 'One row per estimate with grand totals.'}
                </p>
              </button>
              <button
                onClick={() => handleExportCSV('detailed')}
                className="text-left p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors shadow-sm"
              >
                <p className="font-black text-sm text-gray-900 uppercase tracking-widest">
                  {profile?.country === 'FR'
                    ? 'Vue Détaillée'
                    : 'Detailed View'}
                </p>
                <p className="text-xs text-gray-500 mt-2 font-bold">
                  {profile?.country === 'FR'
                    ? "Inclut la main-d'œuvre, les matériaux et marges ligne par ligne."
                    : 'Line-by-line breakdown of labor, materials, and profit margins.'}
                </p>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setExportModal(false)}
                className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100"
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
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full border border-gray-100 animate-scale-up">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 text-gray-900">
              {dialog.title ||
                (profile?.country === 'FR' ? 'Notification' : 'Notice')}
            </h3>
            <p className="text-xs text-gray-500 font-bold mb-6 leading-relaxed">
              {dialog.message}
            </p>
            <div className="flex gap-2 justify-end">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => setDialog(null)}
                  className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
                >
                  {profile?.country === 'FR' ? 'Annuler' : 'Cancel'}
                </button>
              )}
              <button
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  else setDialog(null);
                }}
                className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
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
