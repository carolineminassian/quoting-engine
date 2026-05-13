'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { translations } from '@/lib/translations';
import Link from 'next/link';

const LoadingDots = () => (
  <div className="flex items-center justify-center space-x-2 p-12 mt-20">
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
  </div>
);

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(translations.US);
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (prof) {
      setProfile(prof);
      setLang(prof.country === 'FR' ? translations.FR : translations.US);
    }

    await fetchMaterials();
    setLoading(false);
  }

  async function fetchMaterials() {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { data } = await supabase
      .from('materials')
      .select('*')
      .eq('user_id', user?.id)
      .order('name', { ascending: true });

    setMaterials(data || []);
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnit) {
      setDialog({
        type: 'alert',
        message:
          profile?.country === 'FR'
            ? 'Veuillez choisir une unité.'
            : 'Please select a unit.'
      });
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('materials').insert([
      {
        user_id: user?.id,
        name: newName,
        unit: newUnit,
        cost_per_unit_cents: Math.max(0, Math.round(parseFloat(newPrice) * 100))
      }
    ]);

    if (!error) {
      setNewName('');
      setNewPrice('');
      setNewUnit('');
      fetchMaterials();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editUnit) {
      setDialog({
        type: 'alert',
        message:
          profile?.country === 'FR'
            ? 'Veuillez choisir une unité.'
            : 'Please select a unit.'
      });
      return;
    }
    const { error } = await supabase
      .from('materials')
      .update({
        name: editName,
        unit: editUnit,
        cost_per_unit_cents: Math.max(
          0,
          Math.round(parseFloat(editPrice) * 100)
        )
      })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      fetchMaterials();
    }
  };

  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm',
      message:
        profile?.country === 'FR'
          ? 'Supprimer cet article ?'
          : 'Delete this item?',
      onConfirm: async () => {
        setDialog(null);
        await supabase.from('materials').delete().eq('id', id);
        fetchMaterials();
      }
    });
  };

  if (loading) return <LoadingDots />;

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-black font-sans relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">
              {lang.priceList}
            </h1>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">
              {profile?.business_name} •{' '}
              {profile?.currency === 'EUR' ? 'Euro (€)' : 'US Dollar ($)'}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            ← {lang.dashboard}
          </Link>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 mb-10">
          <form
            onSubmit={handleAdd}
            className="grid grid-cols-12 gap-4 items-end"
          >
            <div className="col-span-12 sm:col-span-5">
              <label className="block text-[10px] font-black uppercase text-gray-300 mb-2 tracking-widest text-left">
                {lang.itemName}
              </label>
              <input
                required
                title={lang.itemNameTooltip}
                placeholder={lang.exampleItem}
                className="w-full p-3 border rounded-lg outline-none focus:border-blue-500 font-bold"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="col-span-6 sm:col-span-3">
              <label className="block text-[10px] font-black uppercase text-gray-300 mb-2 tracking-widest text-left">
                {lang.unitLabel}
              </label>
              <select
                required
                title={lang.unitTooltip}
                className="w-full p-3 border rounded-lg bg-gray-50 font-bold uppercase text-xs"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
              >
                <option value="" disabled hidden>
                  {lang.unitPlaceholder}
                </option>
                {Object.keys(lang.units).map((key) => (
                  <option key={key} value={key}>
                    {lang.units[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-6 sm:col-span-2">
              <label className="block text-[10px] font-black uppercase text-gray-300 mb-2 tracking-widest text-left">
                {lang.cost}
              </label>
              <input
                required
                title={lang.costTooltip}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full p-3 border rounded-lg outline-none focus:border-blue-500 font-mono font-bold"
                value={newPrice === '0' ? '' : newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
            <div className="col-span-12 sm:col-span-2 mt-4 sm:mt-0">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white p-3 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-colors"
              >
                {lang.addItem}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                <tr>
                  <th className="p-5 text-left">{lang.materialName}</th>
                  <th className="p-5 text-left">{lang.unitLabel}</th>
                  <th className="p-5 text-right">{lang.unitCost}</th>
                  <th className="p-5 text-right">{lang.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {materials.map((m) => {
                  const isOutOfRegion = !Object.keys(lang.units).includes(
                    m.unit
                  );

                  return (
                    <tr
                      key={m.id}
                      className={`transition-colors ${isOutOfRegion ? 'bg-yellow-50/50' : 'hover:bg-gray-50'}`}
                    >
                      {editingId === m.id ? (
                        <>
                          <td className="p-3">
                            <input
                              title={lang.itemNameTooltip}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full p-2 border rounded font-bold"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              title={lang.unitTooltip}
                              value={editUnit}
                              onChange={(e) => setEditUnit(e.target.value)}
                              className="w-full p-2 border rounded bg-white text-xs font-bold uppercase"
                            >
                              <option value="" disabled hidden>
                                {lang.unitPlaceholder}
                              </option>
                              {Object.keys(lang.units).map((key) => (
                                <option key={key} value={key}>
                                  {lang.units[key]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-right">
                            <input
                              title={lang.costTooltip}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={editPrice === '0' ? '' : editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-32 p-2 border rounded text-right font-mono"
                            />
                          </td>
                          <td className="p-3 text-right space-x-3">
                            <button
                              onClick={() => handleUpdate(m.id)}
                              className="text-green-600 font-black text-[10px] uppercase tracking-widest"
                            >
                              {lang.save}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-400 font-black text-[10px] uppercase tracking-widest"
                            >
                              {lang.cancel}
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-5 font-bold text-gray-800">
                            {m.name}
                            {isOutOfRegion && (
                              <span className="ml-3 text-[8px] font-black uppercase tracking-widest text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                                {lang.outOfRegion}
                              </span>
                            )}
                          </td>
                          <td className="p-5">
                            <span
                              className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${isOutOfRegion ? 'text-yellow-600 bg-yellow-100' : 'text-gray-400 bg-gray-100'}`}
                            >
                              {lang.units[m.unit] || m.unit}
                            </span>
                          </td>
                          <td className="p-5 text-right font-mono font-bold text-gray-700">
                            {profile?.currency === 'EUR' ? '€' : '$'}
                            {(m.cost_per_unit_cents / 100).toFixed(2)}
                          </td>
                          <td className="p-5 text-right space-x-6">
                            <button
                              onClick={() => {
                                setEditingId(m.id);
                                setEditName(m.name);
                                setEditPrice(
                                  (m.cost_per_unit_cents / 100).toString()
                                );
                                setEditUnit(isOutOfRegion ? '' : m.unit);
                              }}
                              className="text-blue-600 text-[10px] font-black uppercase tracking-widest"
                            >
                              {lang.edit}
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="text-red-400 text-[10px] font-black uppercase tracking-widest"
                            >
                              {lang.delete}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-3 text-gray-900">
              {dialog.title ||
                (profile?.country === 'FR' ? 'Notification' : 'Notice')}
            </h3>
            <p className="text-sm text-gray-500 font-medium mb-8">
              {dialog.message}
            </p>
            <div className="flex gap-3 justify-end">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {profile?.country === 'FR' ? 'Annuler' : 'Cancel'}
                </button>
              )}
              <button
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  else setDialog(null);
                }}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors"
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
