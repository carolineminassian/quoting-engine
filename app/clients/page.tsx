'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations } from '@/lib/translations';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';
import Button from '@/components/Button';
import SireneCombobox from '@/components/SireneCombobox';

export default function ClientsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [dialog, setDialog] = useState<{
    type?: 'alert' | 'confirm' | 'danger';
    title?: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) return router.push('/');

      const { data: prof } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', session.user.id)
        .single();

      setLang(prof?.country === 'FR' ? translations.FR : translations.US);

      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name');
      if (clientData) setClients(clientData);

      setLoading(false);
    }
    loadData();
  }, [router]);

  const triggerDeleteConfirm = (id: string) => {
    setDialog({
      type: 'danger',
      title: lang.delete,
      message: lang.confirmDeleteClient,
      onConfirm: async () => {
        setDialog(null);
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) {
          setDialog({
            type: 'alert',
            message: error.message,
            onConfirm: () => setDialog(null)
          });
          return;
        }
        setClients((prev) => prev.filter((c) => c.id !== id));
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (editingClient.id) {
      const { data, error } = await supabase
        .from('clients')
        .update({
          name: editingClient.name,
          email: editingClient.email,
          phone: editingClient.phone,
          address: editingClient.address,
          city: editingClient.city || null,
          state: editingClient.state || null,
          zip: editingClient.zip || null,
          country: editingClient.country || 'US',
          siret: editingClient.siret || null,
          siren: editingClient.siren || null
        })
        .eq('id', editingClient.id)
        .select()
        .single();

      if (error) {
        setDialog({
          type: 'alert',
          message: error.message,
          onConfirm: () => setDialog(null)
        });
        return;
      }
      if (data) {
        setClients((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      }
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert([
          {
            user_id: user?.id,
            name: editingClient.name,
            email: editingClient.email,
            phone: editingClient.phone,
            address: editingClient.address,
            city: editingClient.city || null,
            state: editingClient.state || null,
            zip: editingClient.zip || null,
            country: editingClient.country || 'US',
            siret: editingClient.siret || null,
            siren: editingClient.siren || null
          }
        ])
        .select()
        .single();

      if (error) {
        setDialog({
          type: 'alert',
          message: error.message,
          onConfirm: () => setDialog(null)
        });
        return;
      }
      if (data) {
        setClients((prev) =>
          [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
    }
    setEditingClient(null);
  };
  if (loading || !lang) return <LoadingDots />;

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-12 pb-40 text-black font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header Action Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-12 border-b border-gray-100 pb-8">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none mb-2">
              {lang.clientRoster}
            </h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {lang.clientRosterSubtitle}
            </p>
          </div>
          <Button
            variant="dark"
            size="md"
            onClick={() =>
              setEditingClient({ name: '', email: '', phone: '', address: '' })
            }
            className="w-full sm:w-auto"
            icon={
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            {lang.addNewClient}
          </Button>
        </div>

        {/* Client Listing Grid */}
        {clients.length === 0 ? (
          <div className="bg-white p-16 text-center rounded-2xl border border-gray-200/60 text-gray-400 font-black uppercase tracking-widest text-xs shadow-sm">
            {lang.noClientsSaved}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {clients.map((c) => (
              <div
                key={c.id}
                className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 flex flex-col justify-between hover:shadow-md transition-all duration-200 group"
              >
                <div>
                  <h3 className="font-black text-2xl text-gray-900 group-hover:text-blue-600 transition-colors mb-6 truncate tracking-tight">
                    {c.name}
                  </h3>

                  <div className="space-y-4">
                    {c.email && (
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 block mb-0.5">
                          {lang.email}
                        </span>
                        <p className="text-sm font-bold text-gray-600 truncate">
                          {c.email}
                        </p>
                      </div>
                    )}
                    {c.phone && (
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 block mb-0.5">
                          {lang.phone}
                        </span>
                        <p className="text-sm font-bold text-gray-600 font-mono">
                          {c.phone}
                        </p>
                      </div>
                    )}
                    {(c.address || c.city || c.zip) && (
                      <div className="pt-4 border-t border-gray-50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 block mb-1">
                          {lang.billingAddress}
                        </span>
                        {c.address && (
                          <p className="text-xs font-bold text-gray-500 leading-relaxed whitespace-pre-wrap mb-1">
                            {c.address}
                          </p>
                        )}
                        {(c.city || c.zip) && (
                          <p className="text-xs font-bold text-gray-400 leading-relaxed font-mono uppercase">
                            {c.country === 'FR'
                              ? `${[c.zip, c.city].filter(Boolean).join(' ')}, ${c.country}`
                              : `${[c.city, c.country === 'US' ? c.state : null, c.zip].filter(Boolean).join(', ')}, ${c.country}`}
                          </p>
                        )}
                        {c.siret && (
                          <p className="text-[10px] text-blue-500 font-mono font-bold mt-1 uppercase">
                            SIRET: {c.siret}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid Item Card Actions */}
                <div className="mt-8 pt-4 border-t border-gray-100 space-y-2">
                  <Button
                    variant="soft-primary"
                    size="sm"
                    fullWidth
                    onClick={() =>
                      router.push(`/new-estimate?clientId=${c.id}`)
                    }
                    iconPosition="right"
                    icon={
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    }
                  >
                    {lang.createNewEstimate}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="soft-secondary"
                      size="sm"
                      fullWidth
                      onClick={() => setEditingClient(c)}
                    >
                      {lang.editProfile}
                    </Button>
                    <Button
                      variant="soft-danger"
                      size="sm"
                      fullWidth
                      onClick={() => triggerDeleteConfirm(c.id)}
                    >
                      {lang.delete}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modern Slide-Over / Centered Input Form Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100">
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">
              {editingClient.id ? lang.editProfile : lang.addNewClient}
            </h3>
            <form
              onSubmit={handleSave}
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
            >
              {/* Country Selection */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                  {lang.country}
                </label>
                <div className="flex border border-gray-200 rounded-xl p-1 bg-gray-50/50 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingClient({
                        ...editingClient,
                        country: 'US',
                        state: '',
                        siret: null, // clear French siege SIRET
                        siren: null // clear French SIREN
                      })
                    }
                    className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${editingClient.country === 'US' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    United States
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingClient({
                        ...editingClient,
                        country: 'FR',
                        state: ''
                      })
                    }
                    className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${editingClient.country === 'FR' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    France
                  </button>
                </div>
              </div>

              {/* French Autocomplete */}
              {editingClient.country === 'FR' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                    {lang.searchSirenePlaceholder || 'Recherche SIRENE'}
                  </label>
                  <SireneCombobox
                    onSelect={(biz) => {
                      setEditingClient({
                        ...editingClient,
                        name: biz.name,
                        address: biz.address,
                        city: biz.city,
                        zip: biz.zip,
                        country: 'FR',
                        siret: biz.siret,
                        siren: biz.siren
                      });
                    }}
                    placeholder={lang?.searchSirenePlaceholder}
                    noResultsLabel={lang?.noSireneResults}
                    searchingLabel={lang?.searchingSirene}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                  {lang.clientNameLabel}
                </label>
                <input
                  required
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors shadow-inner bg-gray-50/30"
                  value={editingClient.name}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                  {lang.email}
                </label>
                <input
                  type="email"
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors shadow-inner bg-gray-50/30"
                  value={editingClient.email || ''}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      email: e.target.value
                    })
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                  {lang.phone}
                </label>
                <input
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold transition-colors shadow-inner bg-gray-50/30"
                  value={editingClient.phone || ''}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      phone: e.target.value
                    })
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                  {lang.billingAddress}
                </label>
                <textarea
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors h-20 resize-none shadow-inner bg-gray-50/30"
                  value={editingClient.address || ''}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      address: e.target.value
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                    {lang.zipShort || 'Zip'}
                  </label>
                  <input
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/30"
                    value={editingClient.zip || ''}
                    onChange={(e) =>
                      setEditingClient({
                        ...editingClient,
                        zip: e.target.value
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                    {lang.city || 'City'}
                  </label>
                  <input
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/30"
                    value={editingClient.city || ''}
                    onChange={(e) =>
                      setEditingClient({
                        ...editingClient,
                        city: e.target.value
                      })
                    }
                  />
                </div>
              </div>

              {editingClient.country === 'US' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                    {lang.stateLabel || 'State'}
                  </label>
                  <input
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/30 uppercase"
                    value={editingClient.state || ''}
                    maxLength={50}
                    onChange={(e) =>
                      setEditingClient({
                        ...editingClient,
                        state: e.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
              )}

              {editingClient.siret && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                    SIRET (FR)
                  </label>
                  <input
                    disabled
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none font-mono bg-gray-100 opacity-60 text-gray-500"
                    value={editingClient.siret}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setEditingClient(null)}
                >
                  {lang.cancel}
                </Button>
                <Button type="submit" variant="primary" size="md" fullWidth>
                  {lang.saveClient}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Native In-App Confirmation Modal System */}
      <ConfirmDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        labels={{
          notice: lang.notice,
          cancel: lang.cancel,
          confirmOk: lang.confirmOk,
          deletePermanently: lang.delete
        }}
      />
    </main>
  );
}
