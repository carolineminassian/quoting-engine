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

    if (selectedFile && user) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, selectedFile, { upsert: true });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName);
        finalLogoUrl = publicUrlData.publicUrl;
      }
    }

    const currency = country === 'FR' ? 'EUR' : 'USD';

    await supabase
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

    setProfile((prev: any) => ({
      ...prev,
      country: country,
      currency: currency
    }));
    setLang(country === 'FR' ? translations.FR : translations.US);
    localStorage.setItem('public_lang', country === 'FR' ? 'FR' : 'EN');
    setSavingProfile(false);

    setDialog({
      type: 'alert',
      message:
        country === 'FR'
          ? 'Paramètres du profil mis à jour.'
          : 'Profile settings updated.',
      onConfirm: () => {
        setDialog(null);
        window.location.reload();
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
      setDialog({
        type: 'alert',
        message:
          country === 'FR'
            ? 'Sécurité mise à jour. Si vous avez modifié votre email, veuillez vérifier votre boîte de réception pour le lien de confirmation.'
            : 'Security updated. If you changed your email, please check your inbox to verify the change.'
      });
    }
  };

  const handleCancelSubClick = () => {
    setDialog({
      type: 'confirm',
      message:
        profile?.country === 'FR'
          ? 'Annuler votre abonnement Pro ?'
          : 'Cancel your Pro subscription?',
      onConfirm: async () => {
        setDialog(null);
        await supabase
          .from('profiles')
          .update({ subscription_tier: 'free' })
          .eq('id', profile.id);
        location.reload();
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
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setProcessingDelete(false);
      setDialog({
        type: 'alert',
        title: country === 'FR' ? 'Erreur' : 'Error',
        message: err.message || 'An unexpected connectivity error occurred.'
      });
    }
  };

  const triggerDeleteAccountFlow = () => {
    setDialog({
      type: 'danger',
      title: country === 'FR' ? 'Suppression Définitive' : 'Permanent Deletion',
      message:
        country === 'FR'
          ? 'Attention: Cette action est irréversible. Toutes vos données d’entreprise, listes de prix de matériaux, répertoire clients et devis archivés seront définitivement effacés conformément à la politique RGPD. Confirmer la suppression ?'
          : 'Warning: This action cannot be undone. All your business parameters, material rosters, master price lists, client profiles, and historical finalized estimates will be purged permanently. Confirm account erasure?',
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
              {lang.settings || 'Settings'}
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
            {profile?.country === 'FR'
              ? "Profil de l'entreprise"
              : 'Business Profile'}
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
                  {country === 'FR' ? 'Marché Principal' : 'Primary Market'}
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
                  {country === 'FR'
                    ? 'Taux Horaire (Défaut)'
                    : 'Default Hourly Rate'}
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
                  {country === 'FR'
                    ? 'Taux Journalier (Défaut)'
                    : 'Default Daily Rate'}
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
                  {country === 'FR'
                    ? 'Acompte Automatique (Défaut)'
                    : 'Default Down Payment'}
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
                    {depositEnabled
                      ? country === 'FR'
                        ? 'Activé'
                        : 'Enabled'
                      : country === 'FR'
                        ? 'Désactivé'
                        : 'Disabled'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {country === 'FR'
                    ? "Pourcentage d'acompte (%)"
                    : 'Deposit Percentage (%)'}
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
            {country === 'FR' ? 'Sécurité du compte' : 'Account Security'}
          </p>

          <form onSubmit={handleSaveSecurity} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {country === 'FR' ? 'Adresse E-mail' : 'Email Address'}
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
                {country === 'FR' ? 'Nouveau Mot de Passe' : 'New Password'}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner tracking-widest"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-[11px] font-bold text-gray-400 mt-2">
                {country === 'FR'
                  ? 'Laissez vide pour conserver votre mot de passe actuel.'
                  : 'Leave blank to keep your current password.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={savingSecurity}
              className="bg-gray-100 text-gray-700 border border-gray-200 px-8 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-transform active:scale-95"
            >
              {savingSecurity
                ? '...'
                : country === 'FR'
                  ? 'Mettre à jour la sécurité'
                  : 'Update Security'}
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
                  {profile.estimate_credits} Credits remaining
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
          <p className="text-[10px] font-black uppercase text-red-500/80 mb-4 tracking-[0.2em] border-b border-red-100/40 playbook pb-3">
            {country === 'FR' ? 'Zone de Danger' : 'Danger Zone'}
          </p>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="max-w-md">
              <p className="font-black text-base text-gray-900 tracking-tight uppercase mb-1">
                {country === 'FR' ? 'Supprimer le compte' : 'Delete Account'}
              </p>
              <p className="text-xs text-gray-400 font-bold leading-relaxed">
                {country === 'FR'
                  ? 'Supprimez définitivement votre profil, tous les devis archivés, listes de prix et données clients. Cette opération est immédiate et irréversible.'
                  : 'Permanently eliminate your account authentication profile, all historical estimates, materials, and clients records.'}
              </p>
            </div>
            <button
              onClick={triggerDeleteAccountFlow}
              disabled={processingDelete}
              className="w-full sm:w-auto text-center bg-red-600 text-white px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-red-700 transition-colors shrink-0 disabled:opacity-40"
            >
              {processingDelete
                ? '...'
                : country === 'FR'
                  ? 'Supprimer le compte'
                  : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>

      {/* Dialog Overlay Component Wrapper */}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full border border-gray-100 animate-scale-up">
            <h3
              className={`text-sm font-black uppercase tracking-widest mb-3 ${dialog.type === 'danger' ? 'text-red-600' : 'text-gray-900'}`}
            >
              {dialog.title ||
                (profile?.country === 'FR' ? 'Notification' : 'Notice')}
            </h3>
            <p className="text-xs text-gray-500 font-bold mb-6 leading-relaxed">
              {dialog.message}
            </p>
            <div className="flex gap-2 justify-end">
              {(dialog.type === 'confirm' || dialog.type === 'danger') && (
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
                className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white rounded-lg shadow-sm transition-colors ${
                  dialog.type === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {dialog.type === 'danger'
                  ? profile?.country === 'FR'
                    ? 'Supprimer Définitivement'
                    : 'Delete Permanently'
                  : profile?.country === 'FR'
                    ? 'Confirmer'
                    : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
