'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Optional: Check if we actually have a session, otherwise redirect to login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      }
    });
  }, [router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage('Password updated successfully. Redirecting to dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-black">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-xl border border-gray-100">
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-2 text-center">
          Update Password
        </h1>
        <p className="text-xs text-gray-500 font-medium text-center mb-8">
          Please enter your new secure password.
        </p>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">
              New Password
            </label>
            <input
              type="password"
              required
              className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">
              Confirm Password
            </label>
            <input
              type="password"
              required
              className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-red-500 mt-2">{error}</p>
          )}
          {message && (
            <p className="text-xs font-bold text-green-600 mt-2">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-colors mt-6"
          >
            {loading ? 'Updating...' : 'Save Password'}
          </button>
        </form>
      </div>
    </main>
  );
}
