'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [selectedFileName, setSelectedFileName] = useState('');

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return router.push('/');

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
      }
    }
    fetchData();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFileName(e.target.files[0].name);
    } else {
      setSelectedFileName('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from('profiles')
      .update({
        business_name: businessName,
        default_tax_rate: taxRate
      })
      .eq('id', profile.id);
    setSaving(false);
    alert('Settings updated.');
  };

  const handleCancelSub = async () => {
    if (!confirm('Cancel your Pro subscription?')) return;
    await supabase
      .from('profiles')
      .update({ subscription_tier: 'free' })
      .eq('id', profile.id);
    location.reload();
  };

  if (!lang)
    return (
      <div className="p-10 text-center font-sans text-black italic">
        Loading...
      </div>
    );

  const isFreePlan = profile.subscription_tier === 'free';

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <h1 className="text-4xl font-black tracking-tighter uppercase">
            {lang.settings}
          </h1>
          <Link
            href="/dashboard"
            className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            ← {lang.dashboard}
          </Link>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 mb-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">
                {lang.businessName}
              </label>
              <input
                required
                className="w-full p-3 border rounded-lg outline-none focus:border-blue-500 font-bold"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">
                {lang.defaultTaxRate}
              </label>
              <input
                type="number"
                step="0.1"
                className="w-full p-3 border rounded-lg outline-none focus:border-blue-500 font-mono font-bold"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Custom Translated File Input */}
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">
                {lang.logo}{' '}
                {isFreePlan && (
                  <span className="text-blue-500 ml-2">
                    ({lang.proFeature})
                  </span>
                )}
              </label>

              <div className="relative flex items-center">
                <input
                  type="file"
                  disabled={isFreePlan}
                  onChange={handleFileChange}
                  className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isFreePlan ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                />
                <div
                  className={`flex items-center gap-4 w-full p-2 border rounded-lg bg-gray-50 transition-colors ${isFreePlan ? 'opacity-50 border-gray-200' : 'hover:border-blue-300 border-gray-200'}`}
                >
                  <span className="bg-blue-50 text-blue-700 font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded border border-blue-100">
                    {lang.chooseFile}
                  </span>
                  <span className="text-xs text-gray-500 font-medium truncate flex-1">
                    {selectedFileName || lang.noFileChosen}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-colors"
            >
              {saving ? '...' : lang.save}
            </button>
          </form>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">
            {lang.currentPlan}
          </p>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-lg text-gray-800">
                {profile.subscription_tier === 'pro'
                  ? lang.proPlan
                  : lang.freePlan}
              </p>
              {isFreePlan && profile.estimate_credits > 0 && (
                <p className="text-sm font-mono text-blue-600 mt-1">
                  {profile.estimate_credits} Credits remaining
                </p>
              )}
            </div>
            <div>
              {isFreePlan ? (
                <Link
                  href="/upgrade"
                  className="bg-gray-800 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg inline-block hover:bg-gray-900 transition-colors"
                >
                  {lang.upgradeToPro}
                </Link>
              ) : (
                <button
                  onClick={handleCancelSub}
                  className="text-red-500 text-[10px] font-black uppercase tracking-widest hover:text-red-700 transition-colors"
                >
                  {lang.cancelSub}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
