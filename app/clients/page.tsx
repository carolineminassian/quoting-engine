'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

  if (loading) return null;

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
          <div className="bg-white p-12 text-center rounded-xl border border-gray-200 text-gray-400 font-bold uppercase tracking-widest text-xs">
            {t.noClients}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {clients.map((c) => (
              <div
                key={c.id}
                className="p-6 border-b border-gray-100 flex justify-between items-start hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-black text-lg text-gray-900">{c.name}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500 font-medium">
                    {c.email && <p>✉️ {c.email}</p>}
                    {c.phone && <p>📞 {c.phone}</p>}
                  </div>
                  {c.address && (
                    <p className="text-xs text-gray-400 mt-1 block">
                      {c.address}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingClient(c)}
                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {t.edit}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors"
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
