'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        setProfile(prof);
        setLang(prof.country === 'FR' ? translations.FR : translations.US);
      }

      const { data: ests } = await supabase
        .from('estimates')
        .select('*')
        .order('created_at', { ascending: false });

      setEstimates(ests || []);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        profile?.country === 'FR'
          ? 'Supprimer ce brouillon ?'
          : 'Delete this draft?'
      )
    )
      return;
    await supabase.from('estimates').delete().eq('id', id);
    setEstimates(estimates.filter((e) => e.id !== id));
  };

  const formatDate = (dateString: string) => {
    const locale = profile?.country === 'FR' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading || !lang)
    return (
      <div className="p-10 text-center font-sans italic text-black">
        Loading Dashboard...
      </div>
    );

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">
              {lang.dashboard}
            </h1>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">
              {profile?.business_name}
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/materials"
              className="px-6 py-3 border border-gray-200 bg-white rounded-lg font-black uppercase tracking-widest text-[10px] shadow-sm hover:border-gray-300 transition-colors"
            >
              {lang.priceList}
            </Link>
            <Link
              href="/new-estimate"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-colors"
            >
              {lang.newEstimate}
            </Link>
          </div>
        </div>

        {/* Estimates List */}
        <div className="space-y-4">
          {estimates.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-xl border border-gray-200">
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
                No estimates found.
              </p>
            </div>
          ) : (
            estimates.map((est) => (
              <div
                key={est.id}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center hover:border-blue-200 transition-colors"
              >
                {/* Left side: Client Info & Status */}
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() =>
                    router.push(
                      est.is_locked
                        ? `/estimates/${est.id}`
                        : `/new-estimate?edit=${est.id}`
                    )
                  }
                >
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg text-gray-800">
                      {est.client_name || 'Untitled Project'}
                    </h3>
                    <span
                      className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${est.is_locked ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}
                    >
                      {est.is_locked ? lang.finalized : lang.draft}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">
                    {formatDate(est.created_at)} •{' '}
                    {est.client_email || 'No contact email'}
                  </p>
                </div>

                {/* Right side: Amount & Fixed-Width Action Area */}
                <div className="flex items-center gap-6">
                  {/* Fixed width for the amount ensures it never shifts */}
                  <div className="w-32 text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">
                      {lang.grandTotal}
                    </p>
                    <p className="font-mono font-black text-xl text-gray-800">
                      {est.currency_snapshot === 'EUR' ? '€' : '$'}
                      {(est.total_amount_cents / 100).toFixed(2)}
                    </p>
                  </div>

                  {/* Fixed width for the trash icon slot ensures the layout holds structure */}
                  <div className="w-6 flex justify-end">
                    {!est.is_locked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(est.id);
                        }}
                        className="text-gray-200 hover:text-red-400 transition-colors"
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
    </main>
  );
}
