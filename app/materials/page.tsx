'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { translations } from '@/lib/translations';
import Link from 'next/link';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition
} from '@headlessui/react';

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
    async function fetchInitialData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile and materials in parallel
      const [profRes, matsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('materials')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true })
      ]);

      if (profRes.data) {
        setProfile(profRes.data);
        setLang(
          profRes.data.country === 'FR' ? translations.FR : translations.US
        );
      }

      setMaterials(matsRes.data || []);
      setLoading(false);
    }

    fetchInitialData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnit) {
      setDialog({
        type: 'alert',
        message: lang.selectUnitError
      });
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('materials')
      .insert([
        {
          user_id: user?.id,
          name: newName,
          unit: newUnit,
          cost_per_unit_cents: Math.max(
            0,
            Math.round(parseFloat(newPrice) * 100)
          )
        }
      ])
      .select()
      .single();

    if (error) {
      setDialog({ type: 'alert', message: error.message });
      return;
    }

    if (data) {
      setMaterials((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewName('');
      setNewPrice('');
      setNewUnit('');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editUnit) {
      setDialog({
        type: 'alert',
        message: lang.selectUnitError
      });
      return;
    }

    const { data, error } = await supabase
      .from('materials')
      .update({
        name: editName,
        unit: editUnit,
        cost_per_unit_cents: Math.max(
          0,
          Math.round(parseFloat(editPrice) * 100)
        )
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      setDialog({ type: 'alert', message: error.message });
      return;
    }

    if (data) {
      setMaterials((prev) =>
        prev
          .map((m) => (m.id === data.id ? data : m))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    }
  };

  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm',
      message: lang.deleteItemConfirm,
      onConfirm: async () => {
        setDialog(null);
        const { error } = await supabase
          .from('materials')
          .delete()
          .eq('id', id);

        if (error) {
          setDialog({ type: 'alert', message: error.message });
          return;
        }

        setMaterials((prev) => prev.filter((m) => m.id !== id));
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
            className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors cursor-pointer"
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
                className="w-full p-3.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50 shadow-inner"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="col-span-12 sm:col-span-3">
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.unitLabel}
              </label>
              <Listbox value={newUnit} onChange={setNewUnit}>
                <div className="relative">
                  <ListboxButton className="w-full p-3.5 border border-gray-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-gray-50 transition-colors shadow-inner text-[10px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                    <span className="block truncate">
                      {newUnit ? lang.units[newUnit] : lang.unitPlaceholder}
                    </span>
                    <span className="pointer-events-none text-gray-400">▼</span>
                  </ListboxButton>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <ListboxOptions className="absolute z-50 w-full top-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl max-h-60 overflow-auto focus:outline-none text-[10px] uppercase tracking-widest font-bold">
                      {Object.keys(lang.units).map((key) => (
                        <ListboxOption
                          key={key}
                          value={key}
                          className={({ active }) =>
                            `cursor-pointer select-none relative p-3 transition-colors ${
                              active
                                ? 'bg-blue-50 text-blue-900'
                                : 'text-gray-900'
                            }`
                          }
                        >
                          {lang.units[key]}
                        </ListboxOption>
                      ))}
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>
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
                  className="w-full p-3.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-mono font-bold pr-8 transition-colors bg-gray-50 shadow-inner"
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
                className="w-full flex items-center justify-center bg-gray-900 text-white hover:bg-blue-600 px-5 py-3.5 rounded-lg font-black uppercase tracking-[0.14em] text-[10px] shadow-sm hover:shadow transition-all duration-200 active:scale-95 cursor-pointer"
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
        <div className="flex flex-col gap-4 sm:gap-0 sm:bg-white sm:border-x sm:border-b sm:border-gray-200/60 sm:rounded-b-2xl sm:divide-y sm:divide-gray-100 overflow-visible">
          {materials.map((m, index) => {
            const isOutOfRegion = !Object.keys(lang.units).includes(m.unit);
            const isLastItem =
              index === materials.length - 1 && materials.length > 1;

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
                        className="w-full p-3 border border-gray-200 rounded-lg font-bold outline-none focus:border-blue-500 bg-white shadow-inner"
                      />
                    </div>

                    <div className="w-full sm:col-span-2">
                      <label className="sm:hidden text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1 block">
                        {lang.unitLabel}
                      </label>
                      <Listbox value={editUnit} onChange={setEditUnit}>
                        <div className="relative">
                          <ListboxButton className="w-full p-3 border border-gray-200 rounded-lg text-left outline-none focus:border-blue-500 font-bold bg-white transition-colors shadow-inner text-[10px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                            <span className="block truncate">
                              {editUnit
                                ? lang.units[editUnit]
                                : lang.unitPlaceholder}
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
                            {/* Dynamically shifts position context mapping anchor based on the isLastItem layout validation flag */}
                            <ListboxOptions
                              className={`absolute z-50 w-full ${
                                isLastItem
                                  ? 'bottom-full mb-1'
                                  : 'top-full mt-1'
                              } bg-white border border-gray-100 rounded-lg shadow-xl max-h-60 overflow-auto focus:outline-none text-[10px] uppercase tracking-widest font-bold`}
                            >
                              {Object.keys(lang.units).map((key) => (
                                <ListboxOption
                                  key={key}
                                  value={key}
                                  className={({ active }) =>
                                    `cursor-pointer select-none relative p-3 transition-colors ${
                                      active
                                        ? 'bg-blue-50 text-blue-900'
                                        : 'text-gray-900'
                                    }`
                                  }
                                >
                                  {lang.units[key]}
                                </ListboxOption>
                              ))}
                            </ListboxOptions>
                          </Transition>
                        </div>
                      </Listbox>
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
                          className="w-full p-3 border border-gray-200 rounded-lg sm:text-right font-mono font-bold outline-none focus:border-blue-500 bg-white pr-6 shadow-inner"
                        />
                        <span className="absolute right-3 top-3.5 text-gray-400 font-bold text-xs font-mono">
                          {currencySymbol}
                        </span>
                      </div>
                    </div>

                    <div className="w-full sm:col-span-4 flex sm:justify-end gap-2 mt-2 sm:mt-0 pt-4 sm:pt-0 border-t border-gray-100 sm:border-0">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 sm:flex-none flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] hover:bg-gray-100 hover:text-gray-700 transition-all duration-200 cursor-pointer"
                      >
                        {lang.cancel}
                      </button>
                      <button
                        onClick={() => handleUpdate(m.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] transition-all duration-200 shadow-sm active:scale-95 cursor-pointer"
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
                      <div className="flex gap-2 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setEditingId(m.id);
                            setEditName(m.name);
                            setEditPrice(
                              (m.cost_per_unit_cents / 100).toString()
                            );
                            setEditUnit(isOutOfRegion ? '' : m.unit);
                          }}
                          className="flex-1 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] transition-all duration-200 border border-gray-200 cursor-pointer"
                        >
                          {lang.edit}
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="flex-1 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] transition-all duration-200 border border-red-200 cursor-pointer"
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
                        className="bg-gray-50 text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 px-3 py-2 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] transition-all duration-200 border border-gray-200 cursor-pointer"
                      >
                        {lang.edit}
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] transition-all duration-200 border border-red-200 cursor-pointer"
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
      <ConfirmDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        labels={{
          notice: lang.notice,
          cancel: lang.cancel,
          confirmOk: lang.confirmOk
        }}
      />
    </main>
  );
}
