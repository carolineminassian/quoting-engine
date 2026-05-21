'use client';

import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations, t } from '@/lib/translations';
import {
  getMultiplier,
  getEffectiveLaborRateCents,
  getEffectiveItemCostCents,
  getSectionTotalCents,
  getTaxSummary,
  generateDescription,
  buildMaterialsMap,
  hydrateSections
} from '@/lib/estimateCalculations';
import Link from 'next/link';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';
import ProLockModal from '@/components/ProLockModal';
import Button from '@/components/Button';
import LinkButton from '@/components/LinkButton';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition
} from '@headlessui/react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Modal States
  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);
  const [exportModal, setExportModal] = useState(false);
  const [proLockModal, setProLockModal] = useState<null | 'csv' | 'zip'>(null);

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

      // Check URL parameters to automatically set the dashboard view context
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get('status');
      if (
        statusParam &&
        ['all', 'draft', 'pending', 'approved', 'rejected'].includes(
          statusParam
        )
      ) {
        setFilterStatus(statusParam as any);
      }
    }
    fetchData();
  }, [router]);

  const handleExportZip = async () => {
    if (processedEstimates.length === 0) return;
    setIsZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { pdf } = await import('@react-pdf/renderer');
      const EstimatePDF = (await import('../estimates/[id]/EstimatePDF'))
        .default;

      const zip = new JSZip();
      const materialsById = buildMaterialsMap(materials);

      for (const est of processedEstimates) {
        const country = est.country_snapshot || profile?.country || 'US';
        const currentLang =
          country === 'FR' ? translations.FR : translations.US;

        // 1. Hydrate items with material data (name/cost/unit) where missing
        const hydratedSections = hydrateSections(
          est.sections || [],
          materialsById
        );

        // 2. Compute subtotal + tax breakdown using the central helper
        const profileTaxRate = profile?.default_tax_rate || 0;
        const { subtotalCents, taxGroups } = getTaxSummary(
          est,
          hydratedSections,
          profileTaxRate,
          materialsById
        );

        const baseTaxRate =
          est.tax_rate_snapshot !== null
            ? est.tax_rate_snapshot
            : profileTaxRate;

        // 3. Prepare sections for the PDF: each gets resolved description, totals, items
        const isDetailsEnabled = est.show_details_snapshot === true;
        const descTranslations = {
          descBase: currentLang.descBase,
          descZeroCostMats: currentLang.descZeroCostMats,
          descZeroCostLabor: currentLang.descZeroCostLabor
        };

        const preparedSections = hydratedSections.map((sec: any) => {
          const sectionTotalDollars =
            getSectionTotalCents(est, sec, materialsById) / 100;
          const effectiveLaborRate = getEffectiveLaborRateCents(est, sec) / 100;

          return {
            ...sec,
            description: generateDescription(
              est,
              sec,
              descTranslations,
              materialsById
            ),
            total: sectionTotalDollars,
            sectionTotal: sectionTotalDollars,
            hasDetails: isDetailsEnabled,
            show_details: isDetailsEnabled,
            laborRate: effectiveLaborRate,
            laborTaxRate:
              sec.laborTaxRate !== undefined ? sec.laborTaxRate : baseTaxRate,
            items: (sec.items || []).map((item: any) => ({
              ...item,
              cost:
                getEffectiveItemCostCents(est, sec, item, materialsById) / 100,
              taxRate: item.taxRate !== undefined ? item.taxRate : baseTaxRate
            }))
          };
        });

        const docBlob = await pdf(
          <EstimatePDF
            estimate={{
              ...est,
              show_details: isDetailsEnabled,
              show_details_snapshot: isDetailsEnabled,
              sections: preparedSections
            }}
            profile={{
              ...profile,
              country,
              currency: est.currency_snapshot || profile?.currency
            }}
            lang={currentLang}
            subtotal={subtotalCents / 100}
            taxGroups={Object.entries(taxGroups) as any}
            grandTotal={est.total_amount_cents / 100}
            sections={preparedSections}
          />
        ).toBlob();

        const filename = `${currentLang.estimateLabel}-${est.custom_id || est.id.slice(0, 8)}.pdf`;
        zip.file(filename, docBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      downloadAnchor.download = `PactEstim-Export-${filterStatus}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('ZIP generation failed:', error);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm',
      message: lang.deleteDraftConfirm,
      onConfirm: async () => {
        setDialog(null);
        const { error } = await supabase
          .from('estimates')
          .delete()
          .eq('id', id);
        if (error) {
          setDialog({ type: 'alert', message: error.message });
          return;
        }
        setEstimates((prev) => prev.filter((e) => e.id !== id));
      }
    });
  };

  const query = searchQuery.toLowerCase();
  // Build the client list from estimates that match the current STATUS filter
  // (so the dropdown only shows clients you'd actually see on the dashboard).
  // Important: we apply only the status filter, not the search filter — otherwise
  // typing would shrink the list to nothing once your query no longer matches.
  const clientsMatchingStatus = estimates.filter((est) => {
    if (filterStatus === 'draft') return !est.is_locked;
    if (filterStatus === 'pending')
      return (
        est.is_locked && (!est.client_status || est.client_status === 'pending')
      );
    if (filterStatus === 'approved')
      return est.is_locked && est.client_status === 'approved';
    if (filterStatus === 'rejected')
      return est.is_locked && est.client_status === 'rejected';
    return true;
  });

  const uniqueClientNames = Array.from(
    new Set(
      clientsMatchingStatus
        .map((e) => e.client_name)
        .filter((name): name is string => Boolean(name?.trim()))
    )
  ).sort((a, b) => a.localeCompare(b));

  const filteredClientNames = uniqueClientNames.filter((name) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const processedEstimates = [...estimates]
    .filter((est) => {
      // Combined status + search filter in single pass
      const matchesSearch = (est.client_name || '')
        .toLowerCase()
        .includes(query);
      if (!matchesSearch) return false;

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

  const materialsById = useMemo(
    () => buildMaterialsMap(materials),
    [materials]
  );

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

            const mult = getMultiplier(e, sec, null, true);
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
            const m = materialsById.get(item.materialId);
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

            const mult = getMultiplier(e, sec, item, false);
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
        {/* CLEAN MINIMAL HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              {lang.dashboard}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                {profile?.business_name}
              </p>
              {isFreePlan && (
                <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-sm">
                    {lang.statusFree}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">
                    {standardLimitReached
                      ? remainingCredits
                      : 5 - monthlyEstimates}{' '}
                    {lang.statusLeft}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* PRIMARY CALL TO ACTION */}
          <LinkButton
            href="/new-estimate"
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
          >
            {lang.newEstimate}
          </LinkButton>
        </div>

        {/* UNIFIED ACTION & CONTROL PANEL */}
        {estimates.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center mb-4">
            {/* Live Text Filter input — also acts as a dropdown of past clients */}
            <div className="relative flex-1 max-w-md">
              {/* Input group: input + buttons in a single row that looks like one input */}
              <div className="flex items-center h-[52px] border border-gray-200 rounded-xl bg-white shadow-sm focus-within:border-blue-500 transition-colors px-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.length > 0) {
                      setShowClientDropdown(true);
                    } else {
                      setShowClientDropdown(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setShowClientDropdown(false);
                    }
                    if (e.key === 'Escape') {
                      setShowClientDropdown(false);
                    }
                  }}
                  placeholder={lang.filterByClient}
                  className="flex-1 min-w-0 h-full px-2 bg-transparent outline-none text-xs font-bold text-black placeholder-gray-400"
                />

                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setShowClientDropdown(false);
                    }}
                    className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md text-xs font-bold transition-colors cursor-pointer"
                    type="button"
                    aria-label="Clear filter"
                  >
                    ✕
                  </button>
                )}

                {uniqueClientNames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClientDropdown((prev) => !prev)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-100 rounded-md text-[10px] transition-colors cursor-pointer"
                    aria-label="Toggle client list"
                  >
                    ▼
                  </button>
                )}
              </div>

              {/* Dropdown panel */}
              {showClientDropdown && uniqueClientNames.length > 0 && (
                <>
                  {/* Click-outside overlay */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowClientDropdown(false)}
                  />

                  <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto p-1">
                    {filteredClientNames.length > 0 ? (
                      filteredClientNames.map((name, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSearchQuery(name);
                            setShowClientDropdown(false);
                          }}
                          className="w-full text-left p-2 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-900 rounded-lg cursor-pointer block truncate transition-colors"
                        >
                          {name}
                        </button>
                      ))
                    ) : (
                      <p className="p-3 text-[10px] font-bold text-gray-400 italic uppercase tracking-widest">
                        {lang.noEstimatesMatch}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            {/* Utility operational downloads row */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (profile.subscription_tier === 'pro') {
                    setExportModal(true);
                  } else {
                    setProLockModal('csv');
                  }
                }}
                className="inline-flex items-center justify-center font-black uppercase tracking-widest transition-all duration-200 cursor-pointer select-none whitespace-nowrap px-3 py-2 text-[9px] rounded-lg gap-1.5 bg-green-50/60 text-green-700 border border-green-200 hover:bg-green-100/70 hover:text-green-800 hover:border-green-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] flex-1 sm:flex-none"
              >
                Excel (CSV)
              </button>

              <Button
                variant="secondary"
                size="sm"
                disabled={isZipping || processedEstimates.length === 0}
                loading={isZipping}
                loadingText={lang.archiving}
                onClick={() => {
                  if (profile.subscription_tier !== 'pro') {
                    setProLockModal('zip');
                    return;
                  }
                  handleExportZip();
                }}
                className="flex-1 sm:flex-none"
                icon={
                  <svg
                    className="w-3.5 h-3.5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                }
              >
                {t(lang.downloadPdfsZip, {
                  count: processedEstimates.length
                })}
              </Button>
            </div>
          </div>
        )}

        {/* CONTROLS: SORT & FILTER */}
        {estimates.length > 0 && (
          <div className="bg-white p-3 sm:px-4 sm:py-2.5 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">
                {lang.filterLabel}
              </span>
              <Listbox value={filterStatus} onChange={setFilterStatus}>
                <div className="relative w-full sm:w-40">
                  <ListboxButton className="w-full py-2 px-3 border border-gray-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[9px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {filterStatus === 'all' && lang.allProjects}
                      {filterStatus === 'draft' && lang.draftsOnly}
                      {filterStatus === 'pending' && lang.pendingOnly}
                      {filterStatus === 'approved' && lang.approvedOnly}
                      {filterStatus === 'rejected' && lang.rejectedOnly}
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
                        {lang.allProjects}
                      </ListboxOption>
                      <ListboxOption
                        value="draft"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.draftsOnly}
                      </ListboxOption>
                      <ListboxOption
                        value="pending"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.pendingOnly}
                      </ListboxOption>
                      <ListboxOption
                        value="approved"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.approvedOnly}
                      </ListboxOption>
                      <ListboxOption
                        value="rejected"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.rejectedOnly}
                      </ListboxOption>
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">
                {lang.sortByLabel}
              </span>
              <Listbox value={sortBy} onChange={setSortBy}>
                <div className="relative w-full sm:w-44">
                  <ListboxButton className="w-full py-2 px-3 border border-gray-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[9px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {sortBy === 'date_desc' && lang.newestFirst}
                      {sortBy === 'date_asc' && lang.oldestFirst}
                      {sortBy === 'amount_desc' && lang.highestAmount}
                      {sortBy === 'amount_asc' && lang.lowestAmount}
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
                        {lang.newestFirst}
                      </ListboxOption>
                      <ListboxOption
                        value="date_asc"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.oldestFirst}
                      </ListboxOption>
                      <ListboxOption
                        value="amount_desc"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 border-b border-gray-50 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.highestAmount}
                      </ListboxOption>
                      <ListboxOption
                        value="amount_asc"
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 px-3 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`
                        }
                      >
                        {lang.lowestAmount}
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
                {lang.noEstimatesMatch}
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
                className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md hover:border-blue-200 hover:ring-1 hover:ring-blue-200 hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group"
              >
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start mb-1 sm:mb-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                        {est.client_name || lang.untitledProject}
                      </h3>
                      <span
                        className={`hidden sm:inline-block text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${
                          !est.is_locked
                            ? 'bg-yellow-50 text-yellow-600'
                            : est.client_status === 'approved'
                              ? 'bg-green-50 text-green-600'
                              : est.client_status === 'rejected'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {!est.is_locked
                          ? lang.draft
                          : est.client_status === 'approved'
                            ? lang.statusApproved
                            : est.client_status === 'rejected'
                              ? lang.statusRejected
                              : lang.statusPending}
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
                      {est.client_email || lang.noContactEmail}
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
                          ? 'bg-green-50 text-green-600'
                          : est.client_status === 'rejected'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {!est.is_locked
                      ? lang.draft
                      : est.client_status === 'approved'
                        ? lang.statusApproved
                        : est.client_status === 'rejected'
                          ? lang.statusRejected
                          : lang.statusPending}
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
                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-2 transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95"
                        title="Delete Draft"
                        aria-label="Delete Draft"
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
              {lang.exportFormat}
            </h3>
            <p className="text-[11px] text-gray-500 font-bold mb-6 uppercase tracking-widest leading-relaxed">
              {lang.exportFormatDesc}
            </p>

            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={() => handleExportCSV('summary')}
                className="text-left p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer"
              >
                <p className="font-black text-sm text-gray-900 uppercase tracking-widest">
                  {lang.summarizedView}
                </p>
                <p className="text-xs text-gray-500 mt-2 font-bold">
                  {lang.summarizedViewDesc}
                </p>
              </button>
              <button
                onClick={() => handleExportCSV('detailed')}
                className="text-left p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer"
              >
                <p className="font-black text-sm text-gray-900 uppercase tracking-widest">
                  {lang.detailedView}
                </p>
                <p className="text-xs text-gray-500 mt-2 font-bold">
                  {lang.detailedViewDesc}
                </p>
              </button>
            </div>

            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setExportModal(false)}
              >
                {lang.cancel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STANDARD DIALOG */}
      <ConfirmDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        labels={{
          notice: lang.notice,
          cancel: lang.cancel,
          confirmOk: lang.confirmOk
        }}
      />

      {/* PRO LOCK MODAL */}
      <ProLockModal
        open={proLockModal !== null}
        onClose={() => setProLockModal(null)}
        labels={{
          title: lang.proLockTitle,
          message:
            proLockModal === 'csv'
              ? lang.proLockCsvMessage
              : proLockModal === 'zip'
                ? lang.proLockZipMessage
                : '',
          upgrade: lang.proLockUpgradeBtn,
          cancel: lang.cancel
        }}
      />
    </main>
  );
}
