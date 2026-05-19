'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations, t } from '@/lib/translations';
import Link from 'next/link';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition
} from '@headlessui/react';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [processingDelete, setProcessingDelete] = useState(false);

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm' | 'danger';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  // Business Profile State
  const [businessName, setBusinessName] = useState('');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [dailyRate, setDailyRate] = useState<number>(0);
  const [country, setCountry] = useState('US');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  // Automatic Down Payment Defaults
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState<number>(20);

  // Security Profile State
  const [authEmail, setAuthEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      setAuthEmail(user.email || '');

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile(prof);
        setLang(prof.country === 'FR' ? translations.FR : translations.US);
        setBusinessName(prof.business_name || '');
        setTaxRate(prof.default_tax_rate || 0);
        setHourlyRate(prof.default_hourly_rate || 0);
        setDailyRate(prof.default_daily_rate || 0);
        setCountry(prof.country || 'US');
        setDepositEnabled(prof.default_deposit_enabled ?? false);
        setDepositPercentage(prof.default_deposit_percentage ?? 20);
        if (prof.logo_url) {
          setSelectedFileName('Uploaded Logo');
        }
      }
    }
    fetchData();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setSelectedFileName(e.target.files[0].name);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    let finalLogoUrl = profile.logo_url;

    // Step 1: Upload logo if a new file was selected
    if (selectedFile && user) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, selectedFile, { upsert: true });

      if (uploadError) {
        setSavingProfile(false);
        setDialog({
          type: 'alert',
          message: uploadError.message
        });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);
      finalLogoUrl = publicUrlData.publicUrl;
    }

    // Step 2: Update profile fields
    const currency = country === 'FR' ? 'EUR' : 'USD';

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        business_name: businessName,
        default_tax_rate: taxRate,
        default_hourly_rate: hourlyRate,
        default_daily_rate: dailyRate,
        country: country,
        currency: currency,
        logo_url: finalLogoUrl,
        default_deposit_enabled: depositEnabled,
        default_deposit_percentage: depositPercentage
      })
      .eq('id', profile.id);

    setSavingProfile(false);

    if (profileUpdateError) {
      setDialog({
        type: 'alert',
        message: profileUpdateError.message
      });
      return;
    }

    // Step 3: Update local state on success
    setProfile((prev: any) => ({
      ...prev,
      country: country,
      currency: currency,
      logo_url: finalLogoUrl,
      business_name: businessName,
      default_tax_rate: taxRate,
      default_hourly_rate: hourlyRate,
      default_daily_rate: dailyRate,
      default_deposit_enabled: depositEnabled,
      default_deposit_percentage: depositPercentage
    }));
    setLang(country === 'FR' ? translations.FR : translations.US);
    localStorage.setItem('public_lang', country === 'FR' ? 'FR' : 'US');

    // Notify navbar (and any other listening component) that the profile changed
    window.dispatchEvent(new CustomEvent('profileUpdated'));

    setDialog({
      type: 'alert',
      message: lang.profileUpdated,
      onConfirm: () => {
        setDialog(null);
      }
    });
  };
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSecurity(true);

    const updates: { email?: string; password?: string } = {};
    if (authEmail) updates.email = authEmail;
    if (newPassword) updates.password = newPassword;

    const { error } = await supabase.auth.updateUser(updates);

    setSavingSecurity(false);

    if (error) {
      setDialog({ type: 'alert', message: error.message });
    } else {
      setNewPassword('');
      // Notify navbar/footer in case email or auth-related UI needs to refresh
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      setDialog({
        type: 'alert',
        message: lang.securityUpdated
      });
    }
  };

  const handleCancelSubClick = () => {
    setDialog({
      type: 'confirm',
      message: lang.cancelSubConfirm,
      onConfirm: async () => {
        setDialog(null);

        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();

          if (!session) {
            setDialog({
              type: 'alert',
              message: lang.sessionExpired
            });
            return;
          }

          const response = await fetch('/api/cancel-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            }
          });

          const result = await response.json();

          if (!response.ok) {
            setDialog({
              type: 'alert',
              message: result.error || lang.cancelSubFailed
            });
            return;
          }

          // Update local state with the cancellation date — KEEP subscription_tier as 'pro'
          // because the user retains Pro access until the period actually ends
          const cancelAt = result.cancelAt
            ? new Date(result.cancelAt * 1000).toISOString()
            : null;

          setProfile((prev: any) =>
            prev ? { ...prev, subscription_cancel_at: cancelAt } : prev
          );

          // Notify other components in case they show cancellation status
          window.dispatchEvent(new CustomEvent('profileUpdated'));

          // Format the period-end date for the user's locale
          const formattedDate = cancelAt
            ? new Date(cancelAt).toLocaleDateString(
                country === 'FR' ? 'fr-FR' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )
            : '';

          setDialog({
            type: 'alert',
            message: result.alreadyCanceled
              ? lang.subAlreadyCanceled
              : t(lang.cancellationScheduled, { date: formattedDate })
          });
        } catch (err: any) {
          setDialog({
            type: 'alert',
            message: lang.connectionError
          });
        }
      }
    });
  };

  const handleResumeSubClick = () => {
    setDialog({
      type: 'confirm',
      message: lang.resumeSubConfirm,
      onConfirm: async () => {
        setDialog(null);

        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();

          if (!session) {
            setDialog({
              type: 'alert',
              message: lang.sessionExpired
            });
            return;
          }

          const response = await fetch('/api/resume-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            }
          });

          const result = await response.json();

          if (!response.ok) {
            setDialog({
              type: 'alert',
              message: result.error || lang.resumeSubFailed
            });
            return;
          }

          setProfile((prev: any) =>
            prev ? { ...prev, subscription_cancel_at: null } : prev
          );

          window.dispatchEvent(new CustomEvent('profileUpdated'));

          setDialog({
            type: 'alert',
            message: lang.subResumed
          });
        } catch (err: any) {
          setDialog({
            type: 'alert',
            message: lang.connectionError
          });
        }
      }
    });
  };

  const executeAccountDeletion = async () => {
    setDialog(null);
    setProcessingDelete(true);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session token identified.');

      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'Failed to complete administrative account erasure.'
        );
      }

      await supabase.auth.signOut();
      localStorage.clear();
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setProcessingDelete(false);
      setDialog({
        type: 'alert',
        title: lang.error,
        message: err.message || 'An unexpected connectivity error occurred.'
      });
    }
  };

  const triggerDeleteAccountFlow = () => {
    setDialog({
      type: 'danger',
      title: lang.permanentDeletion,
      message: lang.deleteAccountConfirm,
      onConfirm: executeAccountDeletion
    });
  };

  if (!lang) return <LoadingDots />;

  const isFreePlan = profile.subscription_tier === 'free';
  const currencySymbol = country === 'FR' ? '€' : '$';

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-12 pb-40 text-black font-sans relative">
      <div className="max-w-3xl mx-auto">
        {/* Header Navigation Section */}
        <div className="flex justify-between items-end mb-12 border-b border-gray-100 pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-2">
              {lang.settings || lang.profileSettings}
            </h1>
            {/* <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {profile?.country === 'FR'
                ? 'Configuration de la plateforme'
                : 'Platform Configurations'}
            </p> */}
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            ← {lang.dashboard}
          </Link>
        </div>

        {/* BUSINESS PROFILE SECTION */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 mb-8">
          <p className="text-[10px] font-black uppercase text-gray-300 mb-6 tracking-[0.2em] border-b border-gray-50 pb-3">
            {lang.businessProfile}
          </p>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.businessName}
              </label>
              <input
                required
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.primaryMarket}
                </label>
                <Listbox
                  value={country}
                  onChange={(newCountry) => {
                    setCountry(newCountry);
                    setLang(
                      newCountry === 'FR' ? translations.FR : translations.US
                    );
                  }}
                >
                  <div className="relative">
                    <ListboxButton className="w-full p-3.5 border border-gray-200 rounded-xl text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[10px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                      <span className="block truncate">
                        {country === 'US'
                          ? 'United States (USD / English)'
                          : 'France (EUR / Français)'}
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
                      <ListboxOptions className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-auto focus:outline-none text-[10px] uppercase tracking-widest font-bold">
                        <ListboxOption
                          value="US"
                          className={({ active }) =>
                            `cursor-pointer select-none relative p-3 ${
                              active
                                ? 'bg-blue-50 text-blue-900'
                                : 'text-gray-900'
                            }`
                          }
                        >
                          United States (USD / English)
                        </ListboxOption>
                        <ListboxOption
                          value="FR"
                          className={({ active }) =>
                            `cursor-pointer select-none relative p-3 ${
                              active
                                ? 'bg-blue-50 text-blue-900'
                                : 'text-gray-900'
                            }`
                          }
                        >
                          France (EUR / Français)
                        </ListboxOption>
                      </ListboxOptions>
                    </Transition>
                  </div>
                </Listbox>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.defaultTaxRate}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold pr-10 transition-colors bg-gray-50/40 shadow-inner"
                    value={taxRate === 0 ? '' : taxRate}
                    onChange={(e) =>
                      setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                  />
                  <span className="absolute right-4 top-4 text-gray-400 font-bold text-xs font-mono">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.defaultHourlyRate}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold pr-10 transition-colors bg-gray-50/40 shadow-inner"
                    value={hourlyRate === 0 ? '' : hourlyRate}
                    onChange={(e) =>
                      setHourlyRate(
                        Math.max(0, parseFloat(e.target.value) || 0)
                      )
                    }
                  />
                  <span className="absolute right-4 top-4 text-gray-400 font-bold text-xs font-mono">
                    {currencySymbol}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.defaultDailyRate}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold pr-10 transition-colors bg-gray-50/40 shadow-inner"
                    value={dailyRate === 0 ? '' : dailyRate}
                    onChange={(e) =>
                      setDailyRate(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                  />
                  <span className="absolute right-4 top-4 text-gray-400 font-bold text-xs font-mono">
                    {currencySymbol}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
              <div className="flex flex-col justify-center">
                <span className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.defaultDownPayment}
                </span>
                <div className="flex items-center gap-3 h-full pt-1">
                  <button
                    type="button"
                    onClick={() => setDepositEnabled(!depositEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${depositEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${depositEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </button>
                  <span className="text-xs font-black text-gray-700 uppercase tracking-wider select-none">
                    {depositEnabled ? lang.enabled : lang.disabled}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.depositPercentage}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={!depositEnabled}
                    className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold pr-10 transition-colors bg-white shadow-inner disabled:opacity-40 disabled:bg-gray-100"
                    value={depositPercentage}
                    onChange={(e) =>
                      setDepositPercentage(
                        Math.min(
                          100,
                          Math.max(1, parseInt(e.target.value) || 0)
                        )
                      )
                    }
                  />
                  <span className="absolute right-4 top-4 text-gray-400 font-bold text-xs font-mono">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.logo}{' '}
                {isFreePlan && (
                  <span className="text-blue-600 font-black ml-1.5">
                    ({lang.proFeature})
                  </span>
                )}
              </label>

              <div className="relative flex items-center">
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  disabled={isFreePlan}
                  onChange={handleFileChange}
                  className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isFreePlan ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                />
                <div
                  className={`flex items-center gap-4 w-full p-2.5 border rounded-xl bg-gray-50/50 transition-colors ${isFreePlan ? 'opacity-50 border-gray-200' : 'hover:border-blue-300 border-gray-200/80'}`}
                >
                  <span className="bg-white text-gray-700 font-black text-[9px] uppercase tracking-widest px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm">
                    {lang.chooseFile || 'Choose File'}
                  </span>
                  <span className="text-xs text-gray-500 font-bold truncate flex-1 pl-1">
                    {selectedFileName || lang.noFileChosen || 'No file chosen'}
                  </span>
                  {profile?.logo_url && !selectedFile && (
                    <img
                      src={profile.logo_url}
                      alt="Current Logo"
                      className="h-7 w-7 object-contain bg-white rounded p-0.5 border border-gray-100"
                    />
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-md hover:bg-blue-700 transition-transform active:scale-95"
            >
              {savingProfile ? '...' : lang.save}
            </button>
          </form>
        </div>

        {/* ACCOUNT SECURITY SECTION */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 mb-8">
          <p className="text-[10px] font-black uppercase text-gray-300 mb-6 tracking-[0.2em] border-b border-gray-50 pb-3">
            {lang.accountSecurity}
          </p>

          <form onSubmit={handleSaveSecurity} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.emailAddressLabel}
              </label>
              <input
                type="email"
                required
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.newPasswordLabel}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner tracking-widest"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-[11px] font-bold text-gray-400 mt-2">
                {lang.keepCurrentPassword}
              </p>
            </div>

            <button
              type="submit"
              disabled={savingSecurity}
              className="bg-gray-100 text-gray-700 border border-gray-200 px-8 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-transform active:scale-95"
            >
              {savingSecurity ? '...' : lang.updateSecurity}
            </button>
          </form>
        </div>

        {/* SUBSCRIPTION PLAN SECTION */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 mb-8">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest border-b border-gray-50 pb-3">
            {lang.currentPlan || 'Current Plan'}
          </p>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="font-black text-xl text-gray-900 tracking-tight uppercase">
                {profile?.subscription_tier === 'pro'
                  ? lang.proPlan || 'Pro Plan'
                  : lang.freePlan || 'Free Plan'}
              </p>
              {isFreePlan && profile?.estimate_credits > 0 && (
                <p className="text-xs font-black uppercase font-mono text-blue-600 tracking-wider mt-1.5">
                  {t(lang.creditsRemaining, {
                    count: profile.estimate_credits
                  })}
                </p>
              )}
              {!isFreePlan && profile?.subscription_cancel_at && (
                <p className="text-xs font-black uppercase font-mono text-orange-500 tracking-wider mt-1.5">
                  {t(lang.cancellationScheduledFor, {
                    date: new Date(
                      profile.subscription_cancel_at
                    ).toLocaleDateString(country === 'FR' ? 'fr-FR' : 'en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  })}
                </p>
              )}
            </div>
            <div className="w-full sm:w-auto">
              {isFreePlan ? (
                <Link
                  href="/upgrade"
                  className="w-full sm:w-auto text-center bg-blue-600 text-white px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg inline-block hover:bg-blue-700 transition-transform active:scale-95"
                >
                  {lang.upgradeToPro || 'Upgrade to Pro'}
                </Link>
              ) : profile?.subscription_cancel_at ? (
                <button
                  onClick={handleResumeSubClick}
                  className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:text-blue-800 transition-colors"
                >
                  {lang.resumeSubscription}
                </button>
              ) : (
                <button
                  onClick={handleCancelSubClick}
                  className="text-gray-400 text-[10px] font-black uppercase tracking-widest hover:text-red-500 transition-colors"
                >
                  {lang.cancelSub || 'Cancel Subscription'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* COMPLIANCE DANGER ZONE - ACCOUNT ERASURE BLOCK */}
        <div className="bg-red-50/10 p-6 sm:p-8 rounded-2xl border border-red-200/60">
          <p className="text-[10px] font-black uppercase text-red-500/80 mb-4 tracking-[0.2em] border-b border-red-100/40 pb-3">
            {lang.dangerZone}
          </p>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="max-w-md">
              <p className="font-black text-base text-gray-900 tracking-tight uppercase mb-1">
                {lang.deleteAccount}
              </p>
              <p className="text-xs text-gray-400 font-bold leading-relaxed">
                {lang.deleteAccountDesc}
              </p>
            </div>
            <button
              onClick={triggerDeleteAccountFlow}
              disabled={processingDelete}
              className="w-full sm:w-auto text-center bg-red-600 text-white px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-red-700 transition-colors shrink-0 disabled:opacity-40"
            >
              {processingDelete ? '...' : lang.deleteAccount}
            </button>
          </div>
        </div>
      </div>

      {/* Dialog Overlay Component Wrapper */}
      <ConfirmDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        labels={{
          notice: lang.notice,
          cancel: lang.cancel,
          confirmOk: lang.confirmOk,
          deletePermanently: lang.deletePermanently
        }}
      />
    </main>
  );
}
