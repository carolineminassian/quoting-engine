'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';

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

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  // Business Profile State
  const [businessName, setBusinessName] = useState('');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [country, setCountry] = useState('US');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');

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
        setCountry(prof.country || 'US');
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
        country: country,
        currency: currency,
        logo_url: finalLogoUrl
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

  if (!lang) return <LoadingDots />;

  const isFreePlan = profile.subscription_tier === 'free';

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-12 pb-40 text-black font-sans relative">
      <div className="max-w-3xl mx-auto">
        {/* Header Navigation Section */}
        <div className="flex justify-between items-end mb-12 border-b border-gray-100 pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-2">
              {lang.settings || 'Settings'}
            </h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {profile?.country === 'FR'
                ? 'Configuration de la plateforme'
                : 'Platform Configurations'}
            </p>
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
                <select
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner appearance-none"
                  value={country}
                  onChange={(e) => {
                    const newCountry = e.target.value;
                    setCountry(newCountry);
                    setLang(
                      newCountry === 'FR' ? translations.FR : translations.US
                    );
                  }}
                >
                  <option value="US">United States (USD / English)</option>
                  <option value="FR">France (EUR / Français)</option>
                </select>
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
              className="bg-red-50 text-red-600 border border-red-100/60 px-8 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-100 transition-transform active:scale-95"
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
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60">
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
      </div>

      {/* Synchronized Custom Form Dialog Component */}
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
