'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) return null;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-8 font-sans text-black relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-green-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40"></div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="inline-block mb-6 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-500 font-black text-[10px] uppercase tracking-[0.2em] shadow-sm">
          Professional Estimate Software
        </div>

        <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tighter mb-8 text-gray-900 leading-none">
          Win More <span className="text-blue-600 italic">Projects.</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-500 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
          Create, manage, and finalize professional estimates in seconds. Build
          your custom material price lists, calculate internal margins, and lock
          in clients faster.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {/* UPDATED LINK HERE */}
          <Link
            href="/login?view=signup"
            className="w-full sm:w-auto bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-transform hover:scale-105 active:scale-95"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto bg-white text-gray-800 border border-gray-200 px-10 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm hover:border-gray-300 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
