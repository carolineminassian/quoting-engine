'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

const LoadingDots = () => (
  <div className="flex items-center justify-center space-x-2 p-12">
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
  </div>
);

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <LoadingDots />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'signup' || viewParam === 'forgot') {
      setView(viewParam);
    }
  }, [searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (view === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        setDialog({ type: 'alert', message: error.message });
      } else {
        setDialog({
          type: 'alert',
          message:
            'Account created! Please check your email for the verification link before logging in.'
        });
        setView('login');
      }
    } else if (view === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setDialog({ type: 'alert', message: error.message });
      } else {
        router.push('/dashboard');
      }
    } else if (view === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`
      });

      if (error) {
        setDialog({ type: 'alert', message: error.message });
      } else {
        setDialog({
          type: 'alert',
          message:
            'If an account exists, a password reset link has been sent to your email.'
        });
        setView('login');
      }
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-black relative">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-xl shadow-xl border border-gray-100">
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-2 text-center text-gray-900">
          {view === 'login' && 'Welcome Back'}
          {view === 'signup' && 'Create Account'}
          {view === 'forgot' && 'Reset Password'}
        </h1>

        <p className="text-xs text-gray-500 font-medium text-center mb-8">
          {view === 'login' &&
            'Enter your credentials to access your dashboard.'}
          {view === 'signup' && 'Start creating professional estimates today.'}
          {view === 'forgot' &&
            'Enter your email to receive a secure reset link.'}
        </p>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold bg-gray-50 focus:bg-white transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {view !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  Password
                </label>
                {view === 'login' && (
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold bg-gray-50 focus:bg-white transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          {view === 'signup' && (
            <div className="text-[10px] text-gray-400 text-center font-medium leading-relaxed px-4">
              By creating an account, you agree to our{' '}
              <Link
                href="/terms"
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
                Privacy Policy
              </Link>
              .
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-4 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100 mt-2"
          >
            {loading
              ? 'Processing...'
              : view === 'login'
                ? 'Sign In'
                : view === 'signup'
                  ? 'Create Account'
                  : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center flex flex-col gap-3">
          {view === 'login' ? (
            <p className="text-xs font-bold text-gray-500">
              Don't have an account?{' '}
              <button
                onClick={() => setView('signup')}
                className="text-blue-600 uppercase tracking-widest text-[10px] font-black hover:text-blue-800 ml-1"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-xs font-bold text-gray-500">
              Return to{' '}
              <button
                onClick={() => setView('login')}
                className="text-blue-600 uppercase tracking-widest text-[10px] font-black hover:text-blue-800 ml-1"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-3 text-gray-900">
              {dialog.title || 'Notification'}
            </h3>
            <p className="text-sm text-gray-500 font-medium mb-8">
              {dialog.message}
            </p>
            <div className="flex gap-3 justify-end">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  else setDialog(null);
                }}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors"
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
