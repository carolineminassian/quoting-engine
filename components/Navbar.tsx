'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { translations } from '@/lib/translations';
import Link from 'next/link';

interface NotificationBadgeProps {
  count: number;
}

const NotificationBadge = ({ count }: NotificationBadgeProps) => {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-md shadow-red-500/30 ring-2 ring-white">
      {count > 15 ? '15+' : count}
    </span>
  );
};

interface BrandLogoProps {
  country: 'US' | 'FR';
}

const BrandLogo = ({ country }: BrandLogoProps) => (
  <div className="flex items-center gap-3 select-none group">
    <svg
      className="w-9 h-9 transition-transform duration-300 group-hover:scale-105"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={country === 'FR' ? 'text-blue-600' : 'text-gray-900'}
      />
      <path
        d="M9 20L14 14L19 18L25 10M25 10H20M25 10V15"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={country === 'FR' ? 'text-gray-900' : 'text-blue-600'}
      />
    </svg>
    <span className="text-2xl tracking-tighter font-sans antialiased">
      <span className="font-black text-gray-900">Pact</span>
      <span className="font-light text-blue-600">Estim</span>
    </span>
  </div>
);

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [lang, setLang] = useState<any>(null);
  const [country, setCountry] = useState<'US' | 'FR'>('US');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [hasBusinessProfile, setHasBusinessProfile] = useState<boolean>(false);
  const [notificationCount, setNotificationCount] = useState<number>(0);

  // 1. Fetch Session & Profile Data (re-runs on path change OR custom 'profileUpdated' event)
  useEffect(() => {
    async function fetchAuthAndLang() {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();
      setSession(currentSession);

      if (!currentSession?.user) {
        setHasBusinessProfile(false);
        setNotificationCount(0);
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('country, business_name')
        .eq('id', currentSession.user.id)
        .single();

      if (prof) {
        const primaryCountry = prof.country === 'FR' ? 'FR' : 'US';
        setCountry(primaryCountry);
        setLang(primaryCountry === 'FR' ? translations.FR : translations.US);
        setHasBusinessProfile(!!prof.business_name);
      }

      // Fetch unread notification count for the current user
      const { count } = await supabase
        .from('estimate_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentSession.user.id);

      setNotificationCount(count || 0);
    }
    fetchAuthAndLang();

    // Listen for profile updates from anywhere in the app (e.g. profile page save)
    const handleProfileUpdate = () => fetchAuthAndLang();
    window.addEventListener('profileUpdated', handleProfileUpdate);

    // Listen for custom event when notifications are cleared elsewhere in the app
    const handleNotificationsCleared = () => fetchAuthAndLang();
    window.addEventListener('notificationsCleared', handleNotificationsCleared);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener(
        'notificationsCleared',
        handleNotificationsCleared
      );
    };
  }, [pathname]);

  // 2. Real-time notification subscription — updates badge count when new notifications arrive
  // or are cleared elsewhere in the app
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel(`navbar-notifications-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'estimate_notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        async () => {
          // Refetch the count whenever any notification row changes
          const { count } = await supabase
            .from('estimate_notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id);
          setNotificationCount(count || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // 3. Sync Tab Title and Favicon Using Translation File Schema
  useEffect(() => {
    if (!lang || !lang.tabTitle || !lang.faviconUrl) return;

    // Changes the tab text string
    document.title = lang.tabTitle;

    // Selects and overrides the primary favicon link references
    const links = document.querySelectorAll("link[rel~='icon']");
    links.forEach((link: any) => {
      link.href = `${lang.faviconUrl}?v=2`;
    });
  }, [lang, pathname]);

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

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link
              href={
                notificationCount > 0
                  ? '/dashboard?status=unread'
                  : '/dashboard'
              }
              className="flex items-center outline-none relative"
              aria-label={
                notificationCount > 0
                  ? `${notificationCount} ${lang.unreadFilterLabel}`
                  : 'Dashboard'
              }
            >
              <BrandLogo country={country} />
              <NotificationBadge count={notificationCount} />
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
                {lang.projects}
              </Link>
              <Link
                href="/materials"
                className={`inline-flex items-center px-1 pt-1 text-[10px] font-black uppercase tracking-widest ${
                  pathname === '/materials'
                    ? 'border-b-2 border-blue-600 text-gray-900'
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                {lang.priceList}
              </Link>
              <Link
                href="/clients"
                className={`inline-flex items-center px-1 pt-1 text-[10px] font-black uppercase tracking-widest ${
                  pathname === '/clients'
                    ? 'border-b-2 border-blue-600 text-gray-900'
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                {lang.clientsNav}
              </Link>
              <Link
                href="/analytics"
                className={`inline-flex items-center px-1 pt-1 text-[10px] font-black uppercase tracking-widest ${
                  pathname === '/analytics'
                    ? 'border-b-2 border-blue-600 text-gray-900'
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                {lang.analytics}
              </Link>
              <Link
                href="/profile"
                className={`inline-flex items-center px-1 pt-1 text-[10px] font-black uppercase tracking-widest ${
                  pathname === '/profile'
                    ? 'border-b-2 border-blue-600 text-gray-900'
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                {lang.settings}
              </Link>
            </div>
          </div>

          <div className="hidden sm:flex items-center">
            <button
              onClick={handleSignOut}
              className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
            >
              {lang.signOut}
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
              {lang.projects}
            </Link>
            <Link
              href="/materials"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-4 ${pathname === '/materials' ? 'text-black' : ''}`}
            >
              {lang.priceList}
            </Link>
            <Link
              href="/clients"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-4 ${pathname === '/clients' ? 'text-black' : ''}`}
            >
              {lang.clientsNav}
            </Link>
            <Link
              href="/analytics"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-4 ${pathname === '/analytics' ? 'text-black' : ''}`}
            >
              {lang.analytics}
            </Link>
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-4 ${pathname === '/profile' ? 'text-black' : ''}`}
            >
              {lang.settings}
            </Link>
            <button
              onClick={handleSignOut}
              className="text-left text-red-500 py-4 mt-2 border-t border-gray-100"
            >
              {lang.signOut}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
