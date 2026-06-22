'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translations } from '@/lib/translations';
import {
  getRawLaborRateCents,
  getRawItemCostCents
} from '@/lib/estimateCalculations';
import LoadingDots from '@/components/LoadingDots';
import LinkButton from '@/components/LinkButton';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition
} from '@headlessui/react';

type TimeFilterType = 'ALL' | 'YEAR' | 'MONTH' | '6MOS';
type CurrencyType = 'EUR' | 'USD';

export default function AnalyticsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<any>(null);
  const [country, setCountry] = useState<'US' | 'FR'>('US');
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(true);

  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('ALL');
  const [targetCurrency, setTargetCurrency] = useState<CurrencyType>('USD');
  const [rawEstimates, setRawEstimates] = useState<any[]>([]);
  const [rawInvoices, setRawInvoices] = useState<any[]>([]);
  const [rawCreditNotes, setRawCreditNotes] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(1.1);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch live exchange rate (with sessionStorage cache for ~6 hours)
      try {
        const cached = sessionStorage.getItem('eur_usd_rate');
        const cachedAt = sessionStorage.getItem('eur_usd_rate_at');
        const sixHoursMs = 6 * 60 * 60 * 1000;
        const isFresh =
          cached && cachedAt && Date.now() - parseInt(cachedAt) < sixHoursMs;

        if (isFresh) {
          setExchangeRate(parseFloat(cached));
        } else {
          const rateRes = await fetch('https://open.er-api.com/v6/latest/EUR');
          const rateData = await rateRes.json();
          if (rateData?.rates?.USD) {
            setExchangeRate(rateData.rates.USD);
            sessionStorage.setItem('eur_usd_rate', String(rateData.rates.USD));
            sessionStorage.setItem('eur_usd_rate_at', String(Date.now()));
          }
        }
      } catch (rateErr) {
        console.error('Failed to fetch live exchange rates:', rateErr);
        // Falls back to hardcoded 1.1
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('country, subscription_tier, currency')
        .eq('id', user.id)
        .single();

      if (prof) {
        const profCountry: 'US' | 'FR' = prof.country === 'FR' ? 'FR' : 'US';
        setCountry(profCountry);
        setLang(profCountry === 'FR' ? translations.FR : translations.US);
        setTargetCurrency(prof.currency === 'EUR' ? 'EUR' : 'USD');
        if (prof.subscription_tier !== 'pro') {
          setIsPro(false);
          setLoading(false);
          return;
        }
      }

      // Pull cancelled_at + cancelled_reason so we can categorize cancelled estimates
      const [estsRes, invsRes, cnsRes] = await Promise.all([
        supabase
          .from('estimates')
          .select(
            'total_amount_cents, tax_amount_cents, created_at, sections, client_name, currency_snapshot, client_status, cancelled_at, cancelled_reason'
          )
          .eq('user_id', user.id)
          .eq('is_locked', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select(
            'id, total_amount_cents, paid_amount_cents, credited_amount_cents, payment_status, due_date, created_at, currency_snapshot'
          )
          .eq('user_id', user.id)
          .eq('is_locked', true)
          .eq('is_cancelled', false),
        supabase
          .from('credit_notes')
          .select('id, amount_cents, created_at, currency_snapshot')
          .eq('user_id', user.id)
      ]);

      if (estsRes.data) setRawEstimates(estsRes.data);
      if (invsRes.data) setRawInvoices(invsRes.data);
      if (cnsRes.data) setRawCreditNotes(cnsRes.data);

      setLoading(false);
    }
    fetchData();
  }, [router]);

  const getAmountInTargetCurrency = (cents: number, fromCurrency: string) => {
    const from = (fromCurrency || 'USD').toUpperCase();
    if (from === targetCurrency) return cents;
    if (from === 'EUR' && targetCurrency === 'USD')
      return Math.round(cents * exchangeRate);
    if (from === 'USD' && targetCurrency === 'EUR')
      return Math.round(cents / exchangeRate);
    return cents;
  };

  // Analytics shows whole-dollar amounts (no cents) for cleaner big numbers.
  // We use Intl directly with no fraction digits.
  const formatMoney = (cents: number) => {
    const symbol = targetCurrency === 'EUR' ? '€' : '$';
    const formattedValue = Math.round(cents / 100).toLocaleString(
      country === 'FR' ? 'fr-FR' : 'en-US'
    );
    return `${symbol}${formattedValue}`;
  };

  if (loading || !lang)
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
            {lang.analyticsLockedOnly}
          </h1>
          <p className="text-gray-500 mb-8 max-w-md mx-auto text-xs font-bold uppercase tracking-widest">
            {lang.analyticsUpgradeAlert}
          </p>
          <LinkButton
            href="/upgrade"
            variant="primary"
            size="lg"
            className="!shadow-xl !shadow-blue-600/20 hover:!shadow-blue-600/40"
          >
            {lang.upgradeToPro}
          </LinkButton>
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

  // Cancelled estimates are tracked separately, regardless of their previous status.
  // An estimate is "cancelled" if cancelled_at is set — we don't care what the
  // client_status was beforehand (could be approved, rejected, or pending).
  const cancelledEstimates = filteredEstimates.filter((e) => e.cancelled_at);

  // For all other categories, exclude cancelled estimates so each estimate is
  // counted in exactly one bucket
  const approvedEstimates = filteredEstimates.filter(
    (e) => !e.cancelled_at && e.client_status === 'approved'
  );
  const pendingEstimates = filteredEstimates.filter(
    (e) =>
      !e.cancelled_at && (!e.client_status || e.client_status === 'pending')
  );
  const rejectedEstimates = filteredEstimates.filter(
    (e) => !e.cancelled_at && e.client_status === 'rejected'
  );

  const countApproved = approvedEstimates.length;
  const countPending = pendingEstimates.length;
  const countRejected = rejectedEstimates.length;
  const countCancelled = cancelledEstimates.length;
  // Win rate: approved / (approved + rejected + cancelled). Cancelled = lost opportunity.
  const totalDecided = countApproved + countRejected + countCancelled;
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

    const cName = est.client_name?.trim() || lang.anonymousClient;
    if (!clientMap[cName]) clientMap[cName] = { total: 0, count: 0 };
    clientMap[cName].total += grossTotal;
    clientMap[cName].count += 1;

    if (Array.isArray(est.sections)) {
      est.sections.forEach((sec: any) => {
        const title = sec.title?.trim().toUpperCase() || lang.unspecified;

        // Labor cost basis (pre-margin) for this section
        const laborRawCents = getRawLaborRateCents(sec) * (sec.laborHours || 0);
        const laborNormalized = getAmountInTargetCurrency(
          laborRawCents,
          estCurrency
        );
        totalLaborCostCents += laborNormalized;

        // Materials cost basis (pre-margin) for this section
        let materialsRawCents = 0;
        if (Array.isArray(sec.items)) {
          sec.items.forEach((item: any) => {
            materialsRawCents += getRawItemCostCents(item) * (item.qty || 0);
          });
        }
        totalMaterialCostCents += getAmountInTargetCurrency(
          materialsRawCents,
          estCurrency
        );

        // Service category cost basis (labor + materials)
        const sectionTotalRawCents = laborRawCents + materialsRawCents;
        const sectionTotalNormalized = getAmountInTargetCurrency(
          sectionTotalRawCents,
          estCurrency
        );
        serviceMap[title] = (serviceMap[title] || 0) + sectionTotalNormalized;
      });
    }
  });

  const count = countApproved;
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

  // Revenue trend chart — only approved + non-cancelled estimates contribute
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.getMonth();
    const y = d.getFullYear();
    const label = d.toLocaleString(country === 'FR' ? 'fr-FR' : 'en-US', {
      month: 'short'
    });

    const val = rawEstimates
      .filter((e) => {
        const ed = new Date(e.created_at);
        return (
          ed.getMonth() === m &&
          ed.getFullYear() === y &&
          e.client_status === 'approved' &&
          !e.cancelled_at
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

  // ── Invoicing Analytics ────────────────────────────────────────────────────

  const applyTimeFilter = (dateStr: string) => {
    const date = new Date(dateStr);
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
  };

  const filteredInvoices = rawInvoices.filter((inv) =>
    applyTimeFilter(inv.created_at)
  );
  const filteredCreditNotes = rawCreditNotes.filter((cn) =>
    applyTimeFilter(cn.created_at)
  );

  let totalInvoicedCents = 0;
  let totalCollectedCents = 0;
  let totalOutstandingCents = 0;
  let totalOverdueCents = 0;
  let countPaidInvoices = 0;
  let countUnpaidInvoices = 0;
  let countOverdueInvoices = 0;

  filteredInvoices.forEach((inv) => {
    const currency = inv.currency_snapshot || 'USD';
    const gross = getAmountInTargetCurrency(
      inv.total_amount_cents || 0,
      currency
    );
    const credited = getAmountInTargetCurrency(
      inv.credited_amount_cents || 0,
      currency
    );
    const net = Math.max(0, gross - credited);

    totalInvoicedCents += gross;

    if (inv.payment_status === 'paid') {
      totalCollectedCents += getAmountInTargetCurrency(
        inv.paid_amount_cents || inv.total_amount_cents || 0,
        currency
      );
      countPaidInvoices++;
    } else {
      const isInvOverdue = inv.due_date && new Date(inv.due_date) < new Date();
      if (isInvOverdue) {
        totalOverdueCents += net;
        countOverdueInvoices++;
      } else {
        totalOutstandingCents += net;
        countUnpaidInvoices++;
      }
    }
  });

  let totalCreditedCents = 0;
  filteredCreditNotes.forEach((cn) => {
    totalCreditedCents += getAmountInTargetCurrency(
      cn.amount_cents || 0,
      cn.currency_snapshot || 'USD'
    );
  });

  const collectionRate =
    totalInvoicedCents > 0
      ? Math.round((totalCollectedCents / totalInvoicedCents) * 100)
      : 0;

  const billingRate =
    totalRevenueCents > 0
      ? Math.min(
          100,
          Math.round((totalInvoicedCents / totalRevenueCents) * 100)
        )
      : 0;

  // Billing trend: monthly invoiced vs collected (last 6 months)
  const billingChartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.getMonth();
    const y = d.getFullYear();
    const label = d.toLocaleString(country === 'FR' ? 'fr-FR' : 'en-US', {
      month: 'short'
    });
    const invoiced = rawInvoices
      .filter((inv) => {
        const ed = new Date(inv.created_at);
        return ed.getMonth() === m && ed.getFullYear() === y;
      })
      .reduce(
        (acc, inv) =>
          acc +
          getAmountInTargetCurrency(
            inv.total_amount_cents || 0,
            inv.currency_snapshot || 'USD'
          ),
        0
      );
    const collected = rawInvoices
      .filter((inv) => {
        const ed = new Date(inv.created_at);
        return (
          ed.getMonth() === m &&
          ed.getFullYear() === y &&
          inv.payment_status === 'paid'
        );
      })
      .reduce(
        (acc, inv) =>
          acc +
          getAmountInTargetCurrency(
            inv.paid_amount_cents || inv.total_amount_cents || 0,
            inv.currency_snapshot || 'USD'
          ),
        0
      );
    return { label, invoiced, collected };
  });

  const maxBillingChartVal =
    Math.max(
      ...billingChartData.map((d) => Math.max(d.invoiced, d.collected)),
      10000
    ) * 1.15;

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8 text-black font-sans pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header Area */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-gray-200 pb-8">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-tight mb-2">
              {lang.analyticsTitle}
            </h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {lang.analyticsSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            {/* Listbox Time Filter */}
            <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {lang.timePeriod}
              </span>
              <Listbox value={timeFilter} onChange={setTimeFilter}>
                <div className="relative w-full sm:w-44">
                  <ListboxButton className="w-full p-3 border border-gray-200 rounded-xl text-left outline-none focus:border-blue-500 font-bold bg-white transition-colors shadow-sm text-[10px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {timeFilter === 'ALL' && lang.allTime}
                      {timeFilter === 'YEAR' && lang.thisYear}
                      {timeFilter === '6MOS' && lang.last6MonthsFilter}
                      {timeFilter === 'MONTH' && lang.thisMonth}
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
                        {lang.allTime}
                      </ListboxOption>
                      <ListboxOption
                        value="YEAR"
                        className={({ active }) =>
                          `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.thisYear}
                      </ListboxOption>
                      <ListboxOption
                        value="6MOS"
                        className={({ active }) =>
                          `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.last6MonthsFilter}
                      </ListboxOption>
                      <ListboxOption
                        value="MONTH"
                        className={({ active }) =>
                          `cursor-pointer select-none relative p-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.thisMonth}
                      </ListboxOption>
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
            </div>

            {/* Listbox Currency Selector */}
            <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {lang.displayCurrency}
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
          {/* Row 1: Status Counts — now 4 columns including Cancelled */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between overflow-hidden">
            <div className="flex-1 p-5 flex justify-between items-center w-full">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {lang.approvedProjects}
              </span>
              <Link
                href="/dashboard?status=approved"
                className="text-3xl font-black font-mono text-green-600 bg-green-50 px-3 py-0.5 rounded-md hover:scale-105 hover:brightness-95 shadow-sm hover:shadow transition-all duration-200 cursor-pointer block"
              >
                {countApproved}
              </Link>
            </div>

            <div
              className="hidden sm:block bg-gray-200 shrink-0"
              style={{ width: '3px', height: '36px' }}
            />

            <div className="flex-1 p-5 flex justify-between items-center w-full">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {lang.pendingProjects}
              </span>
              <Link
                href="/dashboard?status=pending"
                className="text-3xl font-black font-mono text-blue-600 bg-blue-50 px-3 py-0.5 rounded-md hover:scale-105 hover:brightness-95 shadow-sm hover:shadow transition-all duration-200 cursor-pointer block"
              >
                {countPending}
              </Link>
            </div>

            <div
              className="hidden sm:block bg-gray-200 shrink-0"
              style={{ width: '3px', height: '36px' }}
            />

            <div className="flex-1 p-5 flex justify-between items-center w-full">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {lang.rejectedProjects}
              </span>
              <Link
                href="/dashboard?status=rejected"
                className="text-3xl font-black font-mono text-red-500 bg-red-50 px-3 py-0.5 rounded-md hover:scale-105 hover:brightness-95 shadow-sm hover:shadow transition-all duration-200 cursor-pointer block"
              >
                {countRejected}
              </Link>
            </div>

            <div
              className="hidden sm:block bg-gray-200 shrink-0"
              style={{ width: '3px', height: '36px' }}
            />

            <div className="flex-1 p-5 flex justify-between items-center w-full">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {lang.cancelledOnly}
              </span>
              <Link
                href="/dashboard?status=cancelled"
                className="text-3xl font-black font-mono text-gray-500 bg-gray-100 px-3 py-0.5 rounded-md hover:scale-105 hover:brightness-95 shadow-sm hover:shadow transition-all duration-200 cursor-pointer block"
              >
                {countCancelled}
              </Link>
            </div>
          </div>

          {/* Row 2: Financials & Rates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                {lang.confirmedRevenue}
              </p>
              <p className="text-3xl font-black text-green-600 font-mono">
                {formatMoney(totalRevenueCents)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                {lang.pendingPipeline}
              </p>
              <p className="text-3xl font-black text-blue-600 font-mono">
                {formatMoney(pendingRevenueCents)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                {lang.winRate}
              </p>
              <p className="text-3xl font-black text-gray-800 font-mono">
                {conversionRate}%
              </p>
            </div>
          </div>
          {/* Row 3: Billing KPIs */}
          {(totalInvoicedCents > 0 || filteredInvoices.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between overflow-hidden">
              <div className="flex-1 p-5 flex justify-between items-center w-full">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {lang.totalInvoiced}
                </span>
                <Link
                  href="/invoices?filter=all"
                  className="text-2xl font-black font-mono text-blue-700 bg-blue-50 px-3 py-0.5 rounded-md hover:scale-105 hover:brightness-95 shadow-sm hover:shadow transition-all duration-200 cursor-pointer block"
                >
                  {formatMoney(totalInvoicedCents)}
                </Link>
              </div>
              <div
                className="hidden sm:block bg-gray-200 shrink-0"
                style={{ width: '3px', height: '36px' }}
              />
              <div className="flex-1 p-5 flex justify-between items-center w-full">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {lang.totalCollected}
                </span>
                <Link
                  href="/invoices?filter=paid"
                  className="text-2xl font-black font-mono text-green-600 bg-green-50 px-3 py-0.5 rounded-md hover:scale-105 hover:brightness-95 shadow-sm hover:shadow transition-all duration-200 cursor-pointer block"
                >
                  {formatMoney(totalCollectedCents)}
                </Link>
              </div>
              <div
                className="hidden sm:block bg-gray-200 shrink-0"
                style={{ width: '3px', height: '36px' }}
              />
              <div className="flex-1 p-5 flex justify-between items-center w-full">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {lang.outstandingAmount}
                </span>
                <Link
                  href="/invoices?filter=unpaid"
                  className="text-2xl font-black font-mono text-amber-600 bg-amber-50 px-3 py-0.5 rounded-md hover:scale-105 hover:brightness-95 shadow-sm hover:shadow transition-all duration-200 cursor-pointer block"
                >
                  {formatMoney(totalOutstandingCents)}
                </Link>
              </div>
              <div
                className="hidden sm:block bg-gray-200 shrink-0"
                style={{ width: '3px', height: '36px' }}
              />
              <div className="flex-1 p-5 flex justify-between items-center w-full">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {lang.overdueAmount}
                </span>
                <Link
                  href="/invoices?filter=overdue"
                  className="text-2xl font-black font-mono text-red-500 bg-red-50 px-3 py-0.5 rounded-md hover:scale-105 hover:brightness-95 shadow-sm hover:shadow transition-all duration-200 cursor-pointer block"
                >
                  {formatMoney(totalOverdueCents)}
                </Link>
              </div>
            </div>
          )}
        </div>

        {count === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-gray-200 text-gray-400 text-[10px] font-black uppercase tracking-widest">
            {lang.noDataAvailable}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Gross Revenue vs Net Margin Card */}
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 border-b border-gray-100 pb-4">
                {lang.revenueVsMargin}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase block mb-1 tracking-widest">
                      {lang.grossRevenue}
                    </span>
                    <span className="text-3xl font-black font-mono text-gray-700">
                      {formatMoney(netRevenueHT)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-emerald-500 uppercase block mb-1 tracking-widest">
                      {lang.netMargin}
                    </span>
                    <span className="text-3xl font-black font-mono text-emerald-600">
                      {formatMoney(netMarginCents)}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 text-gray-400">
                    <span>{lang.profitability}</span>
                    <span className="text-emerald-600 font-mono text-xs font-bold">
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
                    {lang.laborMaterialRatio}
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
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {lang.laborLabelShort}
                      </span>
                      <span className="text-xs font-bold font-mono text-gray-800">
                        {formatMoney(totalLaborCostCents)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-orange-400 rounded-sm shrink-0" />
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {lang.materialsLabelShort}
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
                  {lang.profitableServices}
                </p>
                <div className="space-y-3.5">
                  {sortedServices.map((service, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs font-bold text-gray-800">
                        <span className="truncate max-w-[70%] uppercase text-[10px] font-black tracking-wider text-gray-500">
                          {service.name}
                        </span>
                        <span className="font-mono text-xs font-bold text-blue-600">
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
                {lang.topClients}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div className="sm:col-span-1 bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    {lang.retentionRate}
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
                  <span className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest">
                    {repeatClientsCount} {lang.repeatCustomers}
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
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            {client.count}{' '}
                            {client.count > 1
                              ? lang.finalizedEstimates
                              : lang.finalizedEstimate}
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

            {/* Billing & Collections Card */}
            {filteredInvoices.length > 0 && (
              <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 border-b border-gray-100 pb-4">
                  {lang.billingCollections}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                  {/* Collection Rate */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                      {lang.collectionRate}
                    </span>
                    <span className="text-3xl font-black font-mono text-green-600">
                      {collectionRate}%
                    </span>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-green-500 h-full transition-all duration-700"
                        style={{ width: `${collectionRate}%` }}
                      />
                    </div>
                  </div>
                  {/* Billing Rate */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                      {lang.billingRate}
                    </span>
                    <span className="text-3xl font-black font-mono text-blue-600">
                      {billingRate}%
                    </span>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-blue-500 h-full transition-all duration-700"
                        style={{ width: `${billingRate}%` }}
                      />
                    </div>
                  </div>
                  {/* Credit Notes */}
                  <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">
                      {lang.creditNotes}
                    </span>
                    <span className="text-3xl font-black font-mono text-purple-600">
                      {totalCreditedCents > 0
                        ? `-${formatMoney(totalCreditedCents)}`
                        : '—'}
                    </span>
                  </div>
                </div>
                {/* Invoice breakdown */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Link
                    href="/invoices?filter=paid"
                    className="bg-green-50 p-3 rounded-lg border border-green-100 hover:brightness-95 hover:scale-105 transition-all duration-200 block text-center"
                  >
                    <p className="text-2xl font-black font-mono text-green-600">
                      {countPaidInvoices}
                    </p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                      {lang.invoicePaid}
                    </p>
                  </Link>
                  <Link
                    href="/invoices?filter=unpaid"
                    className="bg-amber-50 p-3 rounded-lg border border-amber-100 hover:brightness-95 hover:scale-105 transition-all duration-200 block text-center"
                  >
                    <p className="text-2xl font-black font-mono text-amber-600">
                      {countUnpaidInvoices}
                    </p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                      {lang.invoiceUnpaid}
                    </p>
                  </Link>
                  <Link
                    href="/invoices?filter=overdue"
                    className="bg-red-50 p-3 rounded-lg border border-red-100 hover:brightness-95 hover:scale-105 transition-all duration-200 block text-center"
                  >
                    <p className="text-2xl font-black font-mono text-red-500">
                      {countOverdueInvoices}
                    </p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                      {lang.invoiceOverdue}
                    </p>
                  </Link>
                </div>
              </div>
            )}

            {/* Billing Trend Chart */}
            {filteredInvoices.length > 0 && (
              <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 border-b border-gray-100 pb-4">
                  {lang.billingTrend}
                </p>
                <div className="flex gap-4 mb-6">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-blue-500 rounded-sm" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {lang.totalInvoiced}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-green-500 rounded-sm" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {lang.totalCollected}
                    </span>
                  </div>
                </div>
                <div className="h-48 flex items-end justify-between gap-2 sm:gap-4">
                  {billingChartData.map((d, i) => (
                    <div
                      key={i}
                      className="flex-1 h-full flex flex-col justify-end items-center gap-3 group"
                    >
                      <div
                        className="w-full flex items-end gap-0.5"
                        style={{ height: '100%' }}
                      >
                        {/* Invoiced bar */}
                        <div
                          className="flex-1 bg-blue-100 rounded-t-sm border-t-4 border-blue-500 transition-all duration-500 hover:bg-blue-200 relative"
                          style={{
                            height: `${(d.invoiced / maxBillingChartVal) * 100}%`,
                            minHeight: d.invoiced > 0 ? '4px' : '0'
                          }}
                        >
                          <div className="absolute -top-8 left-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded font-mono whitespace-nowrap z-10 pointer-events-none">
                            {formatMoney(d.invoiced)}
                          </div>
                        </div>
                        {/* Collected bar */}
                        <div
                          className="flex-1 bg-green-100 rounded-t-sm border-t-4 border-green-500 transition-all duration-500 hover:bg-green-200"
                          style={{
                            height: `${(d.collected / maxBillingChartVal) * 100}%`,
                            minHeight: d.collected > 0 ? '4px' : '0'
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-black transition-colors">
                        {d.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revenue Trend Graph Card */}
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 border-b border-gray-100 pb-4">
                {lang.revenueTrend}
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
                      <div className="absolute -top-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded font-mono whitespace-nowrap z-10 pointer-events-none">
                        {formatMoney(d.val)}
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-black transition-colors">
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
