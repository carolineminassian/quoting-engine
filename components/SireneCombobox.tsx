'use client';

import React, { useState, useEffect, Fragment } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
  Transition
} from '@headlessui/react';

interface SireneComboboxProps {
  onSelect: (business: {
    name: string;
    siret: string;
    siren: string;
    address: string;
    zip: string;
    city: string;
    country: string;
  }) => void;
  placeholder?: string;
  noResultsLabel?: string;
  searchingLabel?: string;
}

export default function SireneCombobox({
  onSelect,
  placeholder = 'Search French Business (SIRET or Name)...',
  noResultsLabel = 'No business found',
  searchingLabel = 'Searching...'
}: SireneComboboxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/sirene-lookup?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (data.results) {
          setResults(data.results);
        }
      } catch (err) {
        console.error('Sirene search error:', err);
      } finally {
        setLoading(false);
      }
    }, 400); // 400ms debounce to prevent hitting the API too rapidly

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <Combobox
      onChange={(val: any) => {
        if (val) onSelect(val);
      }}
    >
      <div className="relative w-full">
        <div className="relative w-full flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all bg-gray-50 h-[50px]">
          <div className="w-12 h-12 flex items-center justify-center bg-gray-100/50 border-r border-gray-200 font-black text-gray-400 text-[10px] tracking-widest shrink-0 select-none">
            {loading ? '...' : '🔍'}
          </div>
          <ComboboxInput
            className="w-full p-4 bg-transparent outline-none font-bold text-sm text-gray-800 placeholder-gray-400"
            placeholder={placeholder}
            displayValue={() => ''}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          afterLeave={() => setQuery('')}
        >
          <ComboboxOptions className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-auto focus:outline-none p-1 text-xs font-bold divide-y divide-gray-50">
            {loading && (
              <div className="p-3 text-gray-400 text-[10px] uppercase tracking-wider">
                {searchingLabel}
              </div>
            )}
            {!loading && results.length === 0 && query.trim().length >= 3 && (
              <div className="p-3 text-gray-400 text-[10px] uppercase tracking-wider">
                {noResultsLabel}
              </div>
            )}
            {results.map((biz, idx) => (
              <ComboboxOption
                key={biz.siret || idx}
                value={biz}
                className={({ active }) =>
                  `cursor-pointer select-none relative p-3 rounded-lg transition-colors ${
                    active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                  }`
                }
              >
                <span className="block truncate font-black uppercase text-gray-800 tracking-tight text-xs mb-0.5">
                  {biz.name}
                </span>
                <span className="block text-[10px] text-gray-400 font-mono font-medium truncate">
                  SIRET: {biz.siret} · {biz.address}
                </span>
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        </Transition>
      </div>
    </Combobox>
  );
}
