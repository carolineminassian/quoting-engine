'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
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
    subtitle: 'Manage your saved client details.',
    addBtn: 'Add Client',
    edit: 'Edit',
    delete: 'Delete',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    cancel: 'Cancel',
    save: 'Save',
    confirmDelete: 'Are you sure you want to delete this client?',
    noClients: 'No clients saved yet.'
  },
  FR: {
    title: 'Répertoire Clients',
    subtitle: 'Gérez les coordonnées de vos clients.',
    addBtn: 'Ajouter un Client',
    edit: 'Modifier',
    delete: 'Supprimer',
    name: 'Nom',
    email: 'E-mail',
    phone: 'Téléphone',
    address: 'Adresse',
    cancel: 'Annuler',
    save: 'Enregistrer',
    confirmDelete: 'Voulez-vous vraiment supprimer ce client ?',
    noClients: 'Aucun client enregistré.'
  }
};

export default function ClientsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingClient, setEditingClient] = useState<any>(null);

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

  const handleDelete = async (id: string) => {
    if (!window.confirm(dict[lang].confirmDelete)) return;
    await supabase.from('clients').delete().eq('id', id);
    setClients(clients.filter((c) => c.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (editingClient.id) {
      // Update
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
      // Insert
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
    <main className="min-h-screen bg-gray-50 p-8 pb-40 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">
              {t.title}
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              {t.subtitle}
            </p>
          </div>
          <button
            onClick={() =>
              setEditingClient({ name: '', email: '', phone: '', address: '' })
            }
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-blue-700 transition-colors"
          >
            + {t.addBtn}
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-200 text-gray-400 font-bold uppercase tracking-widest text-xs">
            {t.noClients}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {clients.map((c) => (
              <div
                key={c.id}
                className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between hover:shadow-md hover:border-blue-200 hover:ring-1 hover:ring-blue-200 transition-all group"
              >
                <div>
                  <h3 className="font-black text-xl text-gray-900 group-hover:text-blue-600 transition-colors mb-4 truncate">
                    {c.name}
                  </h3>
                  <div className="space-y-3 text-xs text-gray-500 font-medium">
                    {c.email && (
                      <p className="flex items-center gap-3">
                        <span className="text-gray-300 text-base">✉️</span>
                        <span className="truncate">{c.email}</span>
                      </p>
                    )}
                    {c.phone && (
                      <p className="flex items-center gap-3">
                        <span className="text-gray-300 text-base">📞</span>
                        <span>{c.phone}</span>
                      </p>
                    )}
                    {c.address && (
                      <p className="flex items-start gap-3 mt-4 pt-4 border-t border-gray-50">
                        <span className="text-gray-300 text-base">📍</span>
                        <span className="leading-relaxed">{c.address}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setEditingClient(c)}
                    className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors"
                  >
                    {t.edit}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="flex-1 bg-red-50 text-red-500 hover:bg-red-100 py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors"
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-6">
              {editingClient.id ? t.edit : t.addBtn}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <input
                required
                placeholder={t.name}
                className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold"
                value={editingClient.name}
                onChange={(e) =>
                  setEditingClient({ ...editingClient, name: e.target.value })
                }
              />
              <input
                type="email"
                placeholder={t.email}
                className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                value={editingClient.email || ''}
                onChange={(e) =>
                  setEditingClient({ ...editingClient, email: e.target.value })
                }
              />
              <input
                placeholder={t.phone}
                className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                value={editingClient.phone || ''}
                onChange={(e) =>
                  setEditingClient({ ...editingClient, phone: e.target.value })
                }
              />
              <textarea
                placeholder={t.address}
                className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-blue-500 h-24"
                value={editingClient.address || ''}
                onChange={(e) =>
                  setEditingClient({
                    ...editingClient,
                    address: e.target.value
                  })
                }
              />

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="flex-1 bg-gray-100 text-gray-600 px-4 py-3 rounded-lg font-black uppercase tracking-widest text-[10px]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-black uppercase tracking-widest text-[10px]"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
