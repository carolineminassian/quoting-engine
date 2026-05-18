'use client';

import React, { useState, useEffect, useRef } from 'react';

interface AddressComponents {
  address: string;
  city: string;
  zip: string;
  country: string;
}

interface AddressAutocompleteProps {
  value: string;
  userCountry: string;
  onChange: (val: string) => void;
  onSelect: (components: AddressComponents) => void;
  placeholder?: string;
}

export default function AddressAutocomplete({
  value,
  userCountry,
  onChange,
  onSelect,
  placeholder
}: AddressAutocompleteProps) {
  const [rawFeatures, setRawFeatures] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown securely when clicking outside the component layout
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced API router tracking parent value strings directly
  useEffect(() => {
    if (!value || value.length < 3) {
      setRawFeatures([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const country = userCountry || 'US';
        if (country === 'FR') {
          const res = await fetch(
            `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(value)}&limit=5`
          );
          const data = await res.json();
          if (data?.features) {
            setRawFeatures(data.features);
          }
        } else {
          const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
          if (!token) return;

          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${token}&limit=5&types=address`
          );
          const data = await res.json();
          if (data?.features) {
            setRawFeatures(data.features);
          }
        }
      } catch (err) {
        console.error('Address autocomplete matching error:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [value, userCountry]);

  const handleSelect = (feature: any) => {
    let parsed: AddressComponents = {
      address: '',
      city: '',
      zip: '',
      country: ''
    };

    const country = userCountry || 'US';
    if (country === 'FR') {
      parsed.address = feature.properties.name || '';
      parsed.city = feature.properties.city || '';
      parsed.zip = feature.properties.postcode || '';
      parsed.country = 'France';
    } else {
      parsed.address =
        feature.address && feature.text
          ? `${feature.address} ${feature.text}`
          : feature.text || '';
      parsed.country = 'United States';

      if (feature.context) {
        feature.context.forEach((ctx: any) => {
          if (ctx.id.startsWith('postcode')) parsed.zip = ctx.text;
          if (ctx.id.startsWith('place')) parsed.city = ctx.text;
          if (ctx.id.startsWith('country')) parsed.country = ctx.text;
        });
      }
    }

    onSelect(parsed);
    setShowDropdown(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
        maxLength={250}
        className="w-full p-4 bg-transparent outline-none font-bold text-sm text-gray-800"
      />

      {showDropdown && rawFeatures.length > 0 && (
        <ul className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 text-xs font-bold tracking-tight text-gray-700 divide-y divide-gray-100">
          {rawFeatures.map((feature, idx) => {
            const label =
              (userCountry || 'US') === 'FR'
                ? feature.properties.label
                : feature.place_name;
            return (
              <li
                key={idx}
                onClick={() => handleSelect(feature)}
                className="p-3 hover:bg-blue-50 cursor-pointer transition-colors text-left truncate font-bold text-gray-800"
              >
                {label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
