'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [lang, setLang] = useState<any>(null);
  const [country, setCountry] = useState<'US' | 'FR'>('US');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [hasBusinessProfile, setHasBusinessProfile] = useState<boolean>(false);

  useEffect(() => {
    async function fetchAuthAndLang() {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();
      setSession(currentSession);

      if (!currentSession?.user) {
        setHasBusinessProfile(false);
        return;
      }

      // Fetch both country and business_name to check if profile is complete
      const { data: prof } = await supabase
        .from('profiles')
        .select('country, business_name')
        .eq('id', currentSession.user.id)
        .single();

      if (prof) {
        setCountry(prof.country === 'FR' ? 'FR' : 'US');
        setLang(prof.country === 'FR' ? translations.FR : translations.US);

        // If business_name exists, the profile is considered complete
        setHasBusinessProfile(!!prof.business_name);
      }
    }
    fetchAuthAndLang();
  }, [pathname]);

  // GUEST & PROFILE GUARD:
  // We hide the navbar if:
  // 1. We are on the landing page or login page
  // 2. There is no active session (Guest)
  // 3. The user is logged in but hasn't saved a business name yet (New account lock)
  if (
    pathname === '/' ||
    pathname === '/login' ||
    !session ||
    !lang ||
    !hasBusinessProfile
  ) {
    return null;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const t = lang;

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link
              href="/dashboard"
              className="text-xl font-black uppercase tracking-tighter italic"
            >
              PactEstim
            </Link>

            <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
              <Link
                href="/dashboard"
                className={`inline-flex items-center px-1 pt-1 text-[10px] font-black uppercase tracking-widest ${
                  pathname === '/dashboard'
                    ? 'border-b-2 border-blue-600 text-gray-900'
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                {t.projects}
              </Link>
              <Link
                href="/materials"
                className={`inline-flex items-center px-1 pt-1 text-[10px] font-black uppercase tracking-widest ${
                  pathname === '/materials'
                    ? 'border-b-2 border-blue-600 text-gray-900'
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                {t.priceList}
              </Link>
              <Link
                href="/clients"
                className={`inline-flex items-center px-1 pt-1 text-[10px] font-black uppercase tracking-widest ${
                  pathname === '/clients'
                    ? 'border-b-2 border-blue-600 text-gray-900'
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                Clients
              </Link>
              <Link
                href="/analytics"
                className={`inline-flex items-center px-1 pt-1 text-[10px] font-black uppercase tracking-widest ${
                  pathname === '/analytics'
                    ? 'border-b-2 border-blue-600 text-gray-900'
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                {country === 'FR' ? 'Analytique' : 'Analytics'}
              </Link>
              <Link
                href="/profile"
                className={`inline-flex items-center px-1 pt-1 text-[10px] font-black uppercase tracking-widest ${
                  pathname === '/profile'
                    ? 'border-b-2 border-blue-600 text-gray-900'
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                {t.settings}
              </Link>
            </div>
          </div>

          <div className="hidden sm:flex items-center">
            <button
              onClick={handleSignOut}
              className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
            >
              {country === 'FR' ? 'Déconnexion' : 'Sign Out'}
            </button>
          </div>

          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 outline-none"
            >
              <svg
                className="h-6 w-6"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="sm:hidden bg-white border-b border-gray-100">
          <div className="pt-2 pb-3 space-y-1 px-4 flex flex-col text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-4 ${pathname === '/dashboard' ? 'text-black' : ''}`}
            >
              {t.projects}
            </Link>
            <Link
              href="/materials"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-4 ${
                pathname === '/materials' ? 'text-black' : ''
              }`}
            >
              {t.priceList}
            </Link>
            <Link
              href="/clients"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-4 ${pathname === '/clients' ? 'text-black' : ''}`}
            >
              Clients
            </Link>
            <Link
              href="/analytics"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-4 ${pathname === '/analytics' ? 'text-black' : ''}`}
            >
              {country === 'FR' ? 'Analytique' : 'Analytics'}
            </Link>
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-4 ${pathname === '/profile' ? 'text-black' : ''}`}
            >
              {t.settings}
            </Link>
            <button
              onClick={handleSignOut}
              className="text-left text-red-500 py-4 mt-2 border-t border-gray-100"
            >
              {country === 'FR' ? 'Déconnexion' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
