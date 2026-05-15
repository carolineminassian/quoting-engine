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

  const currencySymbol = profile?.currency === 'EUR' ? '€' : '$';

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-12 text-black font-sans relative pb-40">
      <div className="max-w-5xl mx-auto">
        {/* Header Action Block */}
        <div className="flex justify-between items-end mb-12 border-b border-gray-100 pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-2">
              {lang.priceList}
            </h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
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

        {/* Create reference item form panel */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 mb-10">
          <form
            onSubmit={handleAdd}
            className="grid grid-cols-12 gap-5 items-end"
          >
            <div className="col-span-12 sm:col-span-5">
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.itemName}
              </label>
              <input
                required
                title={lang.itemNameTooltip}
                placeholder={lang.exampleItem}
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="col-span-12 sm:col-span-3">
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.unitLabel}
              </label>
              <div className="relative">
                <select
                  required
                  title={lang.unitTooltip}
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner appearance-none uppercase text-xs tracking-wider"
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
            </div>

            <div className="col-span-12 sm:col-span-2">
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.cost}
              </label>
              <div className="relative">
                <input
                  required
                  title={lang.costTooltip}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold pr-8 transition-colors bg-gray-50/40 shadow-inner"
                  value={newName === '' && newPrice === '0' ? '' : newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                />
                <span className="absolute right-4 top-4 text-gray-400 font-bold text-xs font-mono">
                  {currencySymbol}
                </span>
              </div>
            </div>

            <div className="col-span-12 sm:col-span-2">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-md hover:bg-blue-700 transition-transform active:scale-95"
              >
                {lang.addItem}
              </button>
            </div>
          </form>
        </div>

        {/* Table layout block definitions */}
        <div className="hidden sm:grid sm:grid-cols-12 gap-4 bg-gray-50 border border-gray-200/80 rounded-t-2xl text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 p-5">
          <div className="sm:col-span-4">{lang.materialName}</div>
          <div className="sm:col-span-2">{lang.unitLabel}</div>
          <div className="sm:col-span-2 text-right">{lang.unitCost}</div>
          <div className="sm:col-span-4 text-right">{lang.actions}</div>
        </div>

        {/* Master Data Grid Mapping List */}
        <div className="flex flex-col gap-4 sm:gap-0 sm:bg-white sm:border-x sm:border-b sm:border-gray-200/60 sm:rounded-b-2xl sm:divide-y sm:divide-gray-100 overflow-hidden">
          {materials.map((m) => {
            const isOutOfRegion = !Object.keys(lang.units).includes(m.unit);

            return (
              <div
                key={m.id}
                className={`bg-white p-6 sm:p-5 rounded-2xl sm:rounded-none shadow-sm sm:shadow-none border border-gray-200/60 sm:border-none flex flex-col sm:grid sm:grid-cols-12 gap-4 items-start sm:items-center transition-all ${
                  isOutOfRegion
                    ? 'ring-2 ring-yellow-400 sm:ring-0 sm:bg-yellow-50/30'
                    : 'hover:border-blue-500/20 sm:hover:bg-gray-50/40'
                } group`}
              >
                {editingId === m.id ? (
                  /* INLINE CARD EDIT LINE BLOCK ENGINE */
                  <div className="w-full flex flex-col sm:contents gap-4">
                    <div className="w-full sm:col-span-4">
                      <label className="sm:hidden text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1 block">
                        {lang.materialName}
                      </label>
                      <input
                        title={lang.itemNameTooltip}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="w-full sm:col-span-2">
                      <label className="sm:hidden text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1 block">
                        {lang.unitLabel}
                      </label>
                      <select
                        title={lang.unitTooltip}
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-white text-xs font-bold uppercase outline-none focus:border-blue-500 appearance-none"
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

                    <div className="w-full sm:col-span-2">
                      <label className="sm:hidden text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1 block">
                        {lang.unitCost}
                      </label>
                      <div className="relative">
                        <input
                          title={lang.costTooltip}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={editPrice === '0' ? '' : editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl sm:text-right font-mono font-bold outline-none focus:border-blue-500 bg-white pr-6"
                        />
                        <span className="absolute right-3 top-3.5 text-gray-400 font-bold text-xs font-mono">
                          {currencySymbol}
                        </span>
                      </div>
                    </div>

                    <div className="w-full sm:col-span-4 flex sm:justify-end gap-2 mt-2 sm:mt-0 pt-4 sm:pt-0 border-t border-gray-100 sm:border-0">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 sm:flex-none bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors"
                      >
                        {lang.cancel}
                      </button>
                      <button
                        onClick={() => handleUpdate(m.id)}
                        className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors shadow-sm"
                      >
                        {lang.save}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* INLINE DRAFT PRESENTATION STRUCT VIEW */
                  <>
                    {/* MOBILE STRUCT VIEW CARDS */}
                    <div className="w-full sm:hidden flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="pr-4">
                          <h3 className="font-black text-lg text-gray-900 group-hover:text-blue-600 transition-colors leading-tight tracking-tight">
                            {m.name}
                          </h3>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span
                              className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isOutOfRegion ? 'text-yellow-700 bg-yellow-100' : 'text-gray-500 bg-gray-100'}`}
                            >
                              {lang.units[m.unit] || m.unit}
                            </span>
                            {isOutOfRegion && (
                              <span className="inline-block text-[9px] font-black uppercase tracking-widest text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                                {lang.outOfRegion}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-black text-xl text-blue-600">
                            {currencySymbol}
                            {(m.cost_per_unit_cents / 100)
                              .toFixed(2)
                              .replace(
                                '.',
                                profile?.currency === 'EUR' ? ',' : '.'
                              )}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setEditingId(m.id);
                            setEditName(m.name);
                            setEditPrice(
                              (m.cost_per_unit_cents / 100).toString()
                            );
                            setEditUnit(isOutOfRegion ? '' : m.unit);
                          }}
                          className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors border border-gray-100"
                        >
                          {lang.edit}
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="flex-1 bg-red-50 hover:bg-red-100/70 text-red-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors"
                        >
                          {lang.delete}
                        </button>
                      </div>
                    </div>

                    {/* DESKTOP ROW MAP ITEM INTERFACE */}
                    <div className="hidden sm:flex sm:col-span-4 font-bold text-gray-900 items-center truncate pr-4 text-sm">
                      <span className="truncate">{m.name}</span>
                      {isOutOfRegion && (
                        <span className="ml-3 shrink-0 text-[8px] font-black uppercase tracking-widest text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                          {lang.outOfRegion}
                        </span>
                      )}
                    </div>

                    <div className="hidden sm:flex sm:col-span-2 items-center">
                      <span
                        className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isOutOfRegion ? 'text-yellow-700 bg-yellow-100' : 'text-gray-400 bg-gray-100'}`}
                      >
                        {lang.units[m.unit] || m.unit}
                      </span>
                    </div>

                    <div className="hidden sm:flex sm:col-span-2 justify-end items-center font-mono font-black text-gray-700 text-sm">
                      {currencySymbol}
                      {(m.cost_per_unit_cents / 100)
                        .toFixed(2)
                        .replace('.', profile?.currency === 'EUR' ? ',' : '.')}
                    </div>

                    <div className="hidden sm:flex sm:col-span-4 justify-end items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditName(m.name);
                          setEditPrice(
                            (m.cost_per_unit_cents / 100).toString()
                          );
                          setEditUnit(isOutOfRegion ? '' : m.unit);
                        }}
                        className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors border border-gray-100"
                      >
                        {lang.edit}
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="bg-red-50 hover:bg-red-100/70 text-red-600 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors"
                      >
                        {lang.delete}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SYNC INTERCEPTOR CONTEXT SYSTEM DIALOG */}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
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
                  {lang.cancel}
                </button>
              )}
              <button
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  else setDialog(null);
                }}
                className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
