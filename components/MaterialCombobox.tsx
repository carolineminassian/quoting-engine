'use client';

import { useState, Fragment } from 'react';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
  Transition
} from '@headlessui/react';

interface Material {
  id: string;
  name: string;
  cost_per_unit_cents: number;
  unit: string;
}

interface MaterialComboboxProps {
  materials: Material[];
  selectedId: string;
  onChange: (material: Material | null) => void;
  onCreateNew: (name: string) => void;
  placeholder: string;
  createLabel: string;
  emptyStateLabel: string;
  currencySymbol: string;
  unitLabels: Record<string, string>;
}

export default function MaterialCombobox({
  materials,
  selectedId,
  onChange,
  onCreateNew,
  placeholder,
  createLabel,
  emptyStateLabel,
  currencySymbol,
  unitLabels
}: MaterialComboboxProps) {
  const [query, setQuery] = useState('');

  const selectedMaterial = materials.find((m) => m.id === selectedId) || null;

  const filteredMaterials =
    query === ''
      ? materials
      : materials.filter((material) =>
          material.name
            .toLowerCase()
            .includes(query.toLowerCase().replace(/\s+/g, ''))
        );

  const exactMatchExists = materials.some(
    (material) => material.name.toLowerCase() === query.toLowerCase()
  );

  // Normalizes legacy DB strings ('each', 'unit') to the 'ea' translation key
  const getUnitLabel = (u: string) => {
    if (!u) return unitLabels?.['ea'] || 'unit';
    const normalized = u.toLowerCase().trim();
    if (normalized === 'each' || normalized === 'unit' || normalized === 'ea') {
      return unitLabels?.['ea'] || u;
    }
    return unitLabels?.[u] || u;
  };

  return (
    <Combobox
      value={selectedMaterial}
      onChange={(val: any) => {
        if (!val) {
          onChange(null);
          return;
        }
        if (val.isNew) {
          onCreateNew(query);
          setQuery('');
        } else {
          onChange(val);
        }
      }}
    >
      <div className="relative w-full">
        <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white border border-gray-200 focus-within:border-blue-500 transition-colors sm:text-sm">
          <ComboboxInput
            className="w-full border-none py-3 sm:py-2 pl-3 pr-10 text-xs font-bold text-gray-900 outline-none leading-5"
            displayValue={(material: Material) => material?.name || ''}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 9l6 6 6-6"
              />
            </svg>
          </ComboboxButton>
        </div>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          afterLeave={() => setQuery('')}
        >
          <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white py-1 text-base shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100 ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {filteredMaterials.map((material) => (
              <ComboboxOption
                key={material.id}
                className={({ focus }) =>
                  `relative cursor-pointer select-none py-2 pl-10 pr-4 transition-colors ${
                    focus ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                  }`
                }
                value={material}
              >
                {({ selected, focus }) => (
                  <>
                    <span
                      className={`block truncate text-xs flex items-baseline gap-2 ${
                        selected ? 'font-black' : 'font-medium'
                      }`}
                    >
                      <span>{material.name}</span>
                      <span
                        className={`text-[10px] font-bold ${
                          focus ? 'text-blue-400' : 'text-gray-400'
                        }`}
                      >
                        ({getUnitLabel(material.unit)}) — {currencySymbol}
                        {((material.cost_per_unit_cents || 0) / 100).toFixed(2)}
                      </span>
                    </span>
                    {selected ? (
                      <span
                        className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                          focus ? 'text-blue-600' : 'text-blue-600'
                        }`}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    ) : null}
                  </>
                )}
              </ComboboxOption>
            ))}

            {query.length > 0 && !exactMatchExists && (
              <ComboboxOption
                value={{ id: 'NEW', isNew: true, name: query }}
                className={({ focus }) =>
                  `relative cursor-pointer select-none py-3 px-4 border-t border-gray-50 transition-colors ${
                    focus ? 'bg-green-50 text-green-900' : 'text-green-700'
                  }`
                }
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[10px] font-black text-green-600">
                    +
                  </span>
                  <span className="text-xs font-bold">
                    {createLabel} <span className="italic">"{query}"</span>
                  </span>
                </div>
              </ComboboxOption>
            )}

            {filteredMaterials.length === 0 && query === '' && (
              <div className="relative cursor-default select-none py-4 px-4 text-center text-xs text-gray-500 font-medium">
                {emptyStateLabel}
              </div>
            )}
          </ComboboxOptions>
        </Transition>
      </div>
    </Combobox>
  );
}
