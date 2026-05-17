'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition
} from '@headlessui/react';

const dict = {
  EN: {
    title: 'Analytics',
    subtitle: 'Insights based on your pipeline and approved estimates.',
    lockedOnly: 'Pro Feature',
    totalRev: 'Confirmed Revenue',
    approvedProj: 'Approved Projects',
    pipelineValue: 'Pending Pipeline',
    conversionRate: 'Win Rate',
    pendingProj: 'Pending Projects',
    rejectedProj: 'Rejected Projects',
    avgValue: 'Avg Estimate Value',
    last6Months: 'Revenue Trend',
    upgradeAlert: 'Analytics are exclusively available on the Pro Plan.',
    timeFilter: 'Time Period',
    currencySelect: 'Display Currency',
    allTime: 'All Time',
    thisYear: 'This Year',
    thisMonth: 'This Month',
    last6MonthsFilter: 'Last 6 Months',
    revenueVsMargin: 'Gross Revenue vs Net Margin',
    grossRevenue: 'Gross Rev (Excl. Tax)',
    netMargin: 'Net Margin',
    laborMaterialRatio: 'Labor / Material Ratio',
    labor: 'Labor',
    materials: 'Materials',
    profitableServices: 'Most Profitable Services',
    topClients: 'Top Customers & Retention',
    retentionRate: 'Customer Retention Rate',
    repeatCustomers: 'Repeat Customers',
    noData: 'No data available for this selection.'
  },
  FR: {
    title: 'Analytique',
    subtitle: 'Données basées sur vos devis en attente et approuvés.',
    lockedOnly: 'Fonctionnalité Pro',
    totalRev: 'Revenus Confirmés',
    approvedProj: 'Projets Approuvés',
    pipelineValue: 'Valeur en Attente',
    conversionRate: 'Taux de Conversion',
    pendingProj: 'Projets en Attente',
    rejectedProj: 'Projets Refusés',
    avgValue: 'Valeur Moyenne',
    last6Months: 'Évolution des Revenus',
    upgradeAlert:
      'Les analyses sont exclusivement disponibles avec le Plan Pro.',
    timeFilter: 'Période',
    currencySelect: 'Devise d’Affichage',
    allTime: 'Tout le temps',
    thisYear: 'Cette Année',
    thisMonth: 'Ce Mois',
    last6MonthsFilter: '6 Derniers Mois',
    revenueVsMargin: 'CA Brut vs. Marge Nette',
    grossRevenue: 'CA Brut (HT)',
    netMargin: 'Marge Nette',
    laborMaterialRatio: 'Ratio Main-d’œuvre / Matériaux',
    labor: 'Main-d’œuvre',
    materials: 'Matériaux',
    profitableServices: 'Services les plus Rentables',
    topClients: 'Top Clients & Fidélisation',
    retentionRate: 'Taux de Fidélisation',
    repeatCustomers: 'Clients Récurrents',
    noData: 'Aucune donnée disponible pour cette sélection.'
  }
};

const LoadingDots = () => (
  <div className="flex items-center justify-center space-x-2 p-12 mt-20">
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
  </div>
);

const EXCHANGE_RATE_EUR_TO_USD = 1.1;

type TimeFilterType = 'ALL' | 'YEAR' | 'MONTH' | '6MOS';
type CurrencyType = 'EUR' | 'USD';

export default function AnalyticsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(true);

  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('ALL');
  const [targetCurrency, setTargetCurrency] = useState<CurrencyType>('USD');
  const [rawEstimates, setRawEstimates] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('country, subscription_tier, currency')
        .eq('id', user.id)
        .single();

      if (prof) {
        setLang(prof.country === 'FR' ? 'FR' : 'EN');
        setTargetCurrency(prof.currency === 'EUR' ? 'EUR' : 'USD');
        if (prof.subscription_tier !== 'pro') {
          setIsPro(false);
          setLoading(false);
          return;
        }
      }

      const { data: ests } = await supabase
        .from('estimates')
        .select(
          'total_amount_cents, tax_amount_cents, created_at, sections, client_name, currency_snapshot, client_status'
        )
        .eq('user_id', user.id)
        .eq('is_locked', true)
        .order('created_at', { ascending: false });

      if (ests) {
        setRawEstimates(ests);
      }

      setLoading(false);
    }
    fetchData();
  }, [router]);

  const getAmountInTargetCurrency = (cents: number, fromCurrency: string) => {
    const from = (fromCurrency || 'USD').toUpperCase();
    if (from === targetCurrency) return cents;
    if (from === 'EUR' && targetCurrency === 'USD')
      return Math.round(cents * EXCHANGE_RATE_EUR_TO_USD);
    if (from === 'USD' && targetCurrency === 'EUR')
      return Math.round(cents / EXCHANGE_RATE_EUR_TO_USD);
    return cents;
  };

  const formatMoney = (cents: number) => {
    const symbol = targetCurrency === 'EUR' ? '€' : '$';
    const formattedValue = (cents / 100).toLocaleString(
      lang === 'FR' ? 'fr-FR' : 'en-US',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
    return `${symbol}${formattedValue}`;
  };

  const t = dict[lang];

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <LoadingDots />
      </div>
    );

  if (!isPro) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 font-sans text-black">
        <div className="max-w-4xl mx-auto text-center mt-20">
          <div className="text-6xl mb-6">📊</div>
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">
            {t.lockedOnly}
          </h1>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            {t.upgradeAlert}
          </p>
          <Link
            href="/upgrade"
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-transform active:scale-95"
          >
            Upgrade to Pro
          </Link>
        </div>
      </main>
    );
  }

  const now = new Date();
  const filteredEstimates = rawEstimates.filter((e) => {
    const date = new Date(e.created_at);
    if (timeFilter === 'YEAR') return date.getFullYear() === now.getFullYear();
    if (timeFilter === 'MONTH')
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    if (timeFilter === '6MOS') {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      return date >= sixMonthsAgo;
    }
    return true;
  });

  const approvedEstimates = filteredEstimates.filter(
    (e) => e.client_status === 'approved'
  );
  const pendingEstimates = filteredEstimates.filter(
    (e) => !e.client_status || e.client_status === 'pending'
  );
  const rejectedEstimates = filteredEstimates.filter(
    (e) => e.client_status === 'rejected'
  );

  const countApproved = approvedEstimates.length;
  const countPending = pendingEstimates.length;
  const countRejected = rejectedEstimates.length;
  const totalDecided = countApproved + countRejected;
  const conversionRate =
    totalDecided > 0 ? Math.round((countApproved / totalDecided) * 100) : 0;

  let pendingRevenueCents = 0;
  pendingEstimates.forEach((est) => {
    pendingRevenueCents += getAmountInTargetCurrency(
      est.total_amount_cents || 0,
      est.currency_snapshot || 'USD'
    );
  });

  let totalRevenueCents = 0;
  let totalTaxCents = 0;
  let totalLaborCostCents = 0;
  let totalMaterialCostCents = 0;

  const serviceMap: { [key: string]: number } = {};
  const clientMap: { [key: string]: { total: number; count: number } } = {};

  approvedEstimates.forEach((est) => {
    const estCurrency = est.currency_snapshot || 'USD';
    const grossTotal = getAmountInTargetCurrency(
      est.total_amount_cents || 0,
      estCurrency
    );
    const taxTotal = getAmountInTargetCurrency(
      est.tax_amount_cents || 0,
      estCurrency
    );

    totalRevenueCents += grossTotal;
    totalTaxCents += taxTotal;

    const cName =
      est.client_name?.trim() ||
      (lang === 'FR' ? 'Client Anonyme' : 'Anonymous Client');
    if (!clientMap[cName]) clientMap[cName] = { total: 0, count: 0 };
    clientMap[cName].total += grossTotal;
    clientMap[cName].count += 1;

    if (Array.isArray(est.sections)) {
      est.sections.forEach((sec: any) => {
        const title =
          sec.title?.trim().toUpperCase() ||
          (lang === 'FR' ? 'INDÉTERMINÉ' : 'UNSPECIFIED');

        const laborRaw = Math.round(
          (sec.laborHours || 0) * (sec.hourlyRate || 0) * 100
        );
        const laborNormalized = getAmountInTargetCurrency(
          laborRaw,
          estCurrency
        );
        totalLaborCostCents += laborNormalized;

        let materialsNormalized = 0;
        if (Array.isArray(sec.items)) {
          sec.items.forEach((item: any) => {
            const itemCost = Math.round(
              (item.cost_per_unit_cents || 0) * (item.qty || 0)
            );
            materialsNormalized += getAmountInTargetCurrency(
              itemCost,
              estCurrency
            );
          });
        }
        totalMaterialCostCents += materialsNormalized;

        const sectionTotalRaw =
          laborRaw +
          (Array.isArray(sec.items)
            ? sec.items.reduce(
                (acc: number, item: any) =>
                  acc +
                  Math.round((item.cost_per_unit_cents || 0) * (item.qty || 0)),
                0
              )
            : 0);
        const sectionTotalNormalized = getAmountInTargetCurrency(
          sectionTotalRaw,
          estCurrency
        );
        serviceMap[title] = (serviceMap[title] || 0) + sectionTotalNormalized;
      });
    }
  });

  const count = countApproved; // Maps to existing downstream UI logic
  const avgValue = count > 0 ? Math.round(totalRevenueCents / count) : 0;

  const netRevenueHT = totalRevenueCents - totalTaxCents;
  const totalCostBasis = totalLaborCostCents + totalMaterialCostCents;
  const netMarginCents = Math.max(0, netRevenueHT - totalCostBasis);

  const totalCombinedStructure = totalLaborCostCents + totalMaterialCostCents;
  const laborPercentage =
    totalCombinedStructure > 0
      ? Math.round((totalLaborCostCents / totalCombinedStructure) * 100)
      : 50;
  const materialPercentage =
    totalCombinedStructure > 0
      ? Math.round((totalMaterialCostCents / totalCombinedStructure) * 100)
      : 50;

  const sortedServices = Object.entries(serviceMap)
    .map(([name, val]) => ({ name, val }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 4);

  const clientList = Object.entries(clientMap)
    .map(([name, data]) => ({ name, total: data.total, count: data.count }))
    .sort((a, b) => b.total - a.total);

  const topClients = clientList.slice(0, 3);
  const totalUniqueClients = clientList.length;
  const repeatClientsCount = clientList.filter((c) => c.count > 1).length;
  const retentionRate =
    totalUniqueClients > 0
      ? Math.round((repeatClientsCount / totalUniqueClients) * 100)
      : 0;

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.getMonth();
    const y = d.getFullYear();
    const label = d.toLocaleString(lang === 'FR' ? 'fr-FR' : 'en-US', {
      month: 'short'
    });

    const val = rawEstimates
      .filter((e) => {
        const ed = new Date(e.created_at);
        return (
          ed.getMonth() === m &&
          ed.getFullYear() === y &&
          e.client_status === 'approved'
        );
      })
      .reduce(
        (acc, e) =>
          acc +
          getAmountInTargetCurrency(
            e.total_amount_cents || 0,
            e.currency_snapshot
          ),
        0
      );
    return { label, val };
  });
  const maxChartVal = Math.max(...chartData.map((d) => d.val), 10000) * 1.15;

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8 text-black font-sans pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header Area */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-gray-200 pb-8">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-tight mb-2">
              {t.title}
            </h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            {/* Listbox Time Filter */}
            <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                {t.timeFilter}
              </span>
              <Listbox value={timeFilter} onChange={setTimeFilter}>
                <div className="relative w-full sm:w-44">
                  <ListboxButton className="w-full p-3 border border-gray-200 rounded-xl text-left outline-none focus:border-blue-500 font-bold bg-white transition-colors shadow-sm text-[10px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {timeFilter === 'ALL' && t.allTime}
                      {timeFilter === 'YEAR' && t.thisYear}
                      {timeFilter === '6MOS' && t.last6MonthsFilter}
                      {timeFilter === 'MONTH' && t.thisMonth}
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
                    <ListboxOptions className="absolute right-0 z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-auto focus:outline-none text-[10px] uppercase tracking-widest font-bold">
                      <ListboxOption
                        value="ALL"
                        className={({ active }) =>
                          `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {t.allTime}
                      </ListboxOption>
                      <ListboxOption
                        value="YEAR"
                        className={({ active }) =>
                          `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {t.thisYear}
                      </ListboxOption>
                      <ListboxOption
                        value="6MOS"
                        className={({ active }) =>
                          `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {t.last6MonthsFilter}
                      </ListboxOption>
                      <ListboxOption
                        value="MONTH"
                        className={({ active }) =>
                          `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {t.thisMonth}
                      </ListboxOption>
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
            </div>

            {/* Listbox Currency Selector */}
            <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                {t.currencySelect}
              </span>
              <Listbox value={targetCurrency} onChange={setTargetCurrency}>
                <div className="relative w-full sm:w-36">
                  <ListboxButton className="w-full p-3 border border-gray-200 rounded-xl text-left outline-none focus:border-blue-500 font-bold bg-white transition-colors shadow-sm text-[10px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {targetCurrency === 'USD' ? 'USD ($)' : 'EUR (€)'}
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
                    <ListboxOptions className="absolute right-0 z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-auto focus:outline-none text-[10px] uppercase tracking-widest font-bold">
                      <ListboxOption
                        value="USD"
                        className={({ active }) =>
                          `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        USD ($)
                      </ListboxOption>
                      <ListboxOption
                        value="EUR"
                        className={({ active }) =>
                          `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        EUR (€)
                      </ListboxOption>
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
            </div>
          </div>
        </div>

        {/* KPIs Cards Block */}
        <div className="flex flex-col gap-4 sm:gap-6 mb-8">
          {/* Row 1: Consolidated Status Counts */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <div className="flex-1 p-5 flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {t.approvedProj}
              </span>
              <span className="text-lg font-black font-mono text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md">
                {countApproved}
              </span>
            </div>
            <div className="flex-1 p-5 flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {t.pendingProj}
              </span>
              <span className="text-lg font-black font-mono text-blue-600 bg-blue-50 px-3 py-1 rounded-md">
                {countPending}
              </span>
            </div>
            <div className="flex-1 p-5 flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {t.rejectedProj}
              </span>
              <span className="text-lg font-black font-mono text-red-500 bg-red-50 px-3 py-1 rounded-md">
                {countRejected}
              </span>
            </div>
          </div>

          {/* Row 2: Financials & Rates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                {t.totalRev}
              </p>
              <p className="text-3xl font-black text-emerald-600 font-mono">
                {formatMoney(totalRevenueCents)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                {t.pipelineValue}
              </p>
              <p className="text-3xl font-black text-blue-600 font-mono">
                {formatMoney(pendingRevenueCents)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                {t.conversionRate}
              </p>
              <p className="text-3xl font-black text-gray-800 font-mono">
                {conversionRate}%
              </p>
            </div>
          </div>
        </div>

        {count === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-gray-200 text-gray-400 font-bold text-sm uppercase tracking-wider">
            {t.noData}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Gross Revenue vs Net Margin Card */}
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 border-b border-gray-100 pb-4">
                {t.revenueVsMargin}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">
                      {t.grossRevenue}
                    </span>
                    <span className="text-xl font-bold font-mono text-gray-700">
                      {formatMoney(netRevenueHT)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-emerald-500 uppercase block mb-1">
                      {t.netMargin}
                    </span>
                    <span className="text-3xl font-black font-mono text-emerald-600">
                      {formatMoney(netMarginCents)}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-wider mb-2">
                    <span>Rentabilité</span>
                    <span className="text-emerald-600 font-mono">
                      {netRevenueHT > 0
                        ? Math.round((netMarginCents / netRevenueHT) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-1000"
                      style={{
                        width: `${netRevenueHT > 0 ? Math.min(100, (netMarginCents / netRevenueHT) * 100) : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Split Cards: Labor Ratio & Top Services */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Labor / Material Ratio Card */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 border-b border-gray-100 pb-4">
                    {t.laborMaterialRatio}
                  </p>
                  <div className="flex h-8 rounded-lg overflow-hidden mb-6 shadow-inner">
                    <div
                      className="bg-blue-600 flex items-center justify-center text-white text-[10px] font-black font-mono"
                      style={{ width: `${laborPercentage}%` }}
                    >
                      {laborPercentage > 15 && `${laborPercentage}%`}
                    </div>
                    <div
                      className="bg-orange-400 flex items-center justify-center text-white text-[10px] font-black font-mono"
                      style={{ width: `${materialPercentage}%` }}
                    >
                      {materialPercentage > 15 && `${materialPercentage}%`}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-600 rounded-sm shrink-0" />
                    <div>
                      <span className="block text-[9px] font-black text-gray-400 uppercase">
                        {t.labor}
                      </span>
                      <span className="text-xs font-bold font-mono text-gray-800">
                        {formatMoney(totalLaborCostCents)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-orange-400 rounded-sm shrink-0" />
                    <div>
                      <span className="block text-[9px] font-black text-gray-400 uppercase">
                        {t.materials}
                      </span>
                      <span className="text-xs font-bold font-mono text-gray-800">
                        {formatMoney(totalMaterialCostCents)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profitable Services Card */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 border-b border-gray-100 pb-4">
                  {t.profitableServices}
                </p>
                <div className="space-y-3.5">
                  {sortedServices.map((service, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs font-bold text-gray-800">
                        <span className="truncate max-w-[70%] tracking-tight uppercase text-[10px]">
                          {service.name}
                        </span>
                        <span className="font-mono text-[11px] text-blue-600">
                          {formatMoney(service.val)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full"
                          style={{
                            width: `${(service.val / (sortedServices[0]?.val || 1)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Customer Retention Card */}
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 border-b border-gray-100 pb-4">
                {t.topClients}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div className="sm:col-span-1 bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-3">
                    {t.retentionRate}
                  </span>
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg
                      className="w-full h-full transform -rotate-90"
                      viewBox="0 0 36 36"
                    >
                      <path
                        className="text-gray-200"
                        strokeWidth="3"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-blue-600"
                        strokeDasharray={`${retentionRate}, 100`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute font-mono font-black text-xl text-gray-900">
                      {retentionRate}%
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 mt-2">
                    {repeatClientsCount} {t.repeatCustomers}
                  </span>
                </div>

                <div className="sm:col-span-2 space-y-4 flex flex-col justify-center">
                  {topClients.map((client, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-none last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-900 text-white font-black text-[10px] flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-black uppercase text-gray-800 tracking-tight">
                            {client.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold">
                            {client.count}{' '}
                            {client.count > 1
                              ? lang === 'FR'
                                ? 'devis validés'
                                : 'finalized estimates'
                              : lang === 'FR'
                                ? 'devis validé'
                                : 'finalized estimate'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-gray-950">
                        {formatMoney(client.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Revenue Trend Graph Card */}
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 border-b border-gray-100 pb-4">
                {t.last6Months}
              </p>
              <div className="h-48 flex items-end justify-between gap-2 sm:gap-4">
                {chartData.map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full flex flex-col justify-end items-center gap-3 group"
                  >
                    <div
                      className="w-full bg-blue-100 rounded-t-sm border-t-4 border-blue-600 transition-all duration-500 hover:bg-blue-200 relative flex justify-center"
                      style={{
                        height: `${(d.val / maxChartVal) * 100}%`,
                        minHeight: '4px'
                      }}
                    >
                      <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded font-mono whitespace-nowrap z-10 pointer-events-none">
                        {formatMoney(d.val)}
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400 group-hover:text-black transition-colors">
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
