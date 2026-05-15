'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [lang, setLang] = useState<any>(null); // Start null to prevent English flash
  const [country, setCountry] = useState<'US' | 'FR'>('US');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function fetchLang() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .single();
      setCountry(prof?.country === 'FR' ? 'FR' : 'US');
      setLang(prof?.country === 'FR' ? translations.FR : translations.US);
    }
    fetchLang();
  }, [pathname]);

  // Don't render until language is loaded or if on auth pages
  if (pathname === '/' || pathname === '/login' || !lang) return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 print:hidden text-black font-sans relative z-50">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link
          href="/dashboard"
          className="text-xl font-black uppercase tracking-tighter text-blue-600 italic"
        >
          PactEstim
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-8 items-center">
          <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <Link
              href="/dashboard"
              className={
                pathname.includes('/dashboard')
                  ? 'text-black'
                  : 'hover:text-black transition-colors'
              }
            >
              {lang.projects}
            </Link>
            <Link
              href="/materials"
              className={
                pathname.includes('/materials')
                  ? 'text-black'
                  : 'hover:text-black transition-colors'
              }
            >
              {lang.priceList}
            </Link>
            <Link
              href="/clients"
              className={
                pathname.includes('/clients')
                  ? 'text-black'
                  : 'hover:text-black transition-colors'
              }
            >
              {country === 'FR' ? 'Clients' : 'Clients'}
            </Link>
            <Link
              href="/analytics"
              className={
                pathname.includes('/analytics')
                  ? 'text-black'
                  : 'hover:text-black transition-colors'
              }
            >
              {country === 'FR' ? 'Analytique' : 'Analytics'}
            </Link>
            <Link
              href="/profile"
              className={
                pathname.includes('/profile')
                  ? 'text-black'
                  : 'hover:text-black transition-colors'
              }
            >
              {lang.settings}
            </Link>
          </div>
          <button
            onClick={handleSignOut}
            className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
          >
            {lang.signOut}
          </button>
        </div>

        {/* Mobile Hamburger Icon */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-2xl text-gray-800"
        >
          {mobileMenuOpen ? '×' : '☰'}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-gray-200 shadow-xl py-4 px-6 flex flex-col gap-6 text-xs font-black uppercase tracking-widest text-gray-400">
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className={pathname.includes('/dashboard') ? 'text-black' : ''}
          >
            {lang.projects}
          </Link>
          <Link
            href="/materials"
            onClick={() => setMobileMenuOpen(false)}
            className={pathname.includes('/materials') ? 'text-black' : ''}
          >
            {lang.priceList}
          </Link>
          <Link
            href="/clients"
            onClick={() => setMobileMenuOpen(false)}
            className={pathname.includes('/clients') ? 'text-black' : ''}
          >
            {country === 'FR' ? 'Clients' : 'Clients'}
          </Link>
          <Link
            href="/analytics"
            onClick={() => setMobileMenuOpen(false)}
            className={pathname.includes('/analytics') ? 'text-black' : ''}
          >
            {country === 'FR' ? 'Analytique' : 'Analytics'}
          </Link>
          <Link
            href="/profile"
            onClick={() => setMobileMenuOpen(false)}
            className={pathname.includes('/profile') ? 'text-black' : ''}
          >
            {lang.settings}
          </Link>
          <button
            onClick={handleSignOut}
            className="text-left text-red-500 mt-2 pt-4 border-t border-gray-100"
          >
            {lang.signOut}
          </button>
        </div>
      )}
    </nav>
  );
}
