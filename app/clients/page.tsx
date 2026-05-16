'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const LoadingDots = () => (
  <div className="flex items-center justify-center space-x-2 p-12 mt-20">
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
  </div>
);

const dict = {
  EN: {
    title: 'Client Roster',
    subtitle: 'Manage and reference your saved client records.',
    addBtn: 'Add New Client',
    createEstimate: 'Create New Estimate',
    edit: 'Edit Profile',
    delete: 'Delete',
    name: 'Client Name',
    email: 'Email Address',
    phone: 'Phone Number',
    address: 'Billing Address',
    cancel: 'Cancel',
    save: 'Save Client',
    confirmDelete:
      'Are you sure you want to permanently delete this client? This action cannot be undone.',
    noClients: 'No clients saved yet.',
    notice: 'Notice'
  },
  FR: {
    title: 'Répertoire Clients',
    subtitle: 'Gerez et référencez les coordonnées de vos clients.',
    addBtn: 'Ajouter un Client',
    createEstimate: 'Créer un Devis',
    edit: 'Modifier',
    delete: 'Supprimer',
    name: 'Nom du Client',
    email: 'Adresse E-mail',
    phone: 'Numéro de Téléphone',
    address: 'Adresse de Facturation',
    cancel: 'Annuler',
    save: 'Enregistrer',
    confirmDelete:
      'Voulez-vous vraiment supprimer définitivement ce client ? Cette action est irréversible.',
    noClients: 'Aucun client enregistré.',
    notice: 'Notification'
  }
};

export default function ClientsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [dialog, setDialog] = useState<{
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
      if (prof?.country === 'FR') setLang('FR');

      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (clientData) setClients(clientData);

      setLoading(false);
    }
    loadData();
  }, [router]);

  const triggerDeleteConfirm = (id: string) => {
    setDialog({
      title: t.delete,
      message: t.confirmDelete,
      onConfirm: async () => {
        setDialog(null);
        await supabase.from('clients').delete().eq('id', id);
        setClients(clients.filter((c) => c.id !== id));
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (editingClient.id) {
      const { data } = await supabase
        .from('clients')
        .update({
          name: editingClient.name,
          email: editingClient.email,
          phone: editingClient.phone,
          address: editingClient.address
        })
        .eq('id', editingClient.id)
        .select()
        .single();

      if (data) setClients(clients.map((c) => (c.id === data.id ? data : c)));
    } else {
      const { data } = await supabase
        .from('clients')
        .insert([
          {
            user_id: user?.id,
            name: editingClient.name,
            email: editingClient.email,
            phone: editingClient.phone,
            address: editingClient.address
          }
        ])
        .select()
        .single();

      if (data)
        setClients(
          [...clients, data].sort((a, b) => a.name.localeCompare(b.name))
        );
    }
    setEditingClient(null);
  };

  const t = dict[lang];

  if (loading) return <LoadingDots />;

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-12 pb-40 text-black font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header Action Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-12 border-b border-gray-100 pb-8">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none mb-2">
              {t.title}
            </h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {t.subtitle}
            </p>
          </div>
          <button
            onClick={() =>
              setEditingClient({ name: '', email: '', phone: '', address: '' })
            }
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-900 text-white hover:bg-blue-600 px-5 py-3.5 rounded-lg font-black uppercase tracking-[0.14em] text-[10px] shadow-sm hover:shadow transition-all duration-200 active:scale-95 group"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors duration-200 stroke-[3]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>{t.addBtn}</span>
          </button>
        </div>

        {/* Client Listing Grid */}
        {clients.length === 0 ? (
          <div className="bg-white p-16 text-center rounded-2xl border border-gray-200/60 text-gray-400 font-black uppercase tracking-widest text-xs shadow-sm">
            {t.noClients}
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
                          {t.email}
                        </span>
                        <p className="text-sm font-bold text-gray-600 truncate">
                          {c.email}
                        </p>
                      </div>
                    )}
                    {c.phone && (
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 block mb-0.5">
                          {t.phone}
                        </span>
                        <p className="text-sm font-bold text-gray-600 font-mono">
                          {c.phone}
                        </p>
                      </div>
                    )}
                    {c.address && (
                      <div className="pt-4 border-t border-gray-50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 block mb-1">
                          {t.address}
                        </span>
                        <p className="text-xs font-bold text-gray-500 leading-relaxed whitespace-pre-wrap">
                          {c.address}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid Item Card Actions */}
                <div className="mt-8 pt-4 border-t border-gray-100 space-y-2">
                  <button
                    onClick={() =>
                      router.push(`/new-estimate?clientId=${c.id}`)
                    }
                    className="w-full flex items-center justify-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] transition-all duration-200 border border-blue-200 group/btn"
                  >
                    <span>{t.createEstimate}</span>
                    <svg
                      className="w-3.5 h-3.5 transform transition-transform duration-200 group-hover/btn:translate-x-0.5 stroke-[2.5]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingClient(c)}
                      className="flex-1 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] transition-all duration-200 border border-gray-200"
                    >
                      {t.edit}
                    </button>
                    <button
                      onClick={() => triggerDeleteConfirm(c.id)}
                      className="flex-1 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] transition-all duration-200 border border-red-200"
                    >
                      {t.delete}
                    </button>
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
              {editingClient.id ? t.edit : t.addBtn}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                  {t.name}
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
                  {t.email}
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
                  {t.phone}
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
                  {t.address}
                </label>
                <textarea
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors h-24 resize-none shadow-inner bg-gray-50/30"
                  value={editingClient.address || ''}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      address: e.target.value
                    })
                  }
                />
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="flex-1 bg-gray-50 text-gray-500 border border-gray-200 px-4 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 hover:text-gray-700 transition-all duration-200"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-blue-700 transition-all duration-200 active:scale-95"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Native In-App Confirmation Modal System */}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full border border-gray-100 animate-scale-up">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 text-red-600">
              {dialog.title || t.notice}
            </h3>
            <p className="text-xs text-gray-500 font-bold mb-6 leading-relaxed">
              {dialog.message}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDialog(null)}
                className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-all duration-200 border border-gray-200"
              >
                {t.cancel}
              </button>
              <button
                onClick={dialog.onConfirm}
                className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 transition-all duration-200"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
