'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const LoadingDots = () => (
  <div className="flex items-center justify-center space-x-2 p-12">
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
  </div>
);

const dict = {
  EN: {
    welcome: 'Welcome Back',
    create: 'Create Account',
    resetTitle: 'Reset Password',
    descLogin: 'Enter your credentials to access your dashboard.',
    descSignup: 'Start creating professional estimates today.',
    descForgot: 'Enter your email to receive a secure reset link.',
    email: 'Email Address',
    pass: 'Password',
    forgot: 'Forgot?',
    btnSign: 'Sign In',
    btnCreate: 'Create Account',
    btnReset: 'Send Reset Link',
    processing: 'Processing...',
    noAccount: "Don't have an account?",
    returnSign: 'Return to',
    terms1: 'By creating an account, you agree to our',
    terms2: 'and',
    termsLink: 'Terms of Service',
    privLink: 'Privacy Policy',
    showPass: 'Show',
    hidePass: 'Hide'
  },
  FR: {
    welcome: 'Bon retour',
    create: 'Créer un compte',
    resetTitle: 'Réinitialiser le mot de passe',
    descLogin: 'Entrez vos identifiants pour accéder à votre tableau de bord.',
    descSignup: "Commencez à créer des devis professionnels dès aujourd'hui.",
    descForgot: 'Entrez votre e-mail pour recevoir un lien sécurisé.',
    email: 'Adresse E-mail',
    pass: 'Mot de passe',
    forgot: 'Oublié ?',
    btnSign: 'Se Connecter',
    btnCreate: "S'inscrire",
    btnReset: 'Envoyer le lien',
    processing: 'Traitement...',
    noAccount: 'Pas encore de compte ?',
    returnSign: 'Retour à la',
    terms1: 'En créant un compte, vous acceptez nos',
    terms2: 'et notre',
    termsLink: 'Conditions Générales',
    privLink: 'Politique de Conf.',
    showPass: 'Afficher',
    hidePass: 'Masquer'
  }
};

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
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setTimeout(() => setView(viewParam), 0);
    }
    const storedLang = localStorage.getItem('public_lang');
    if (storedLang === 'FR') {
      setTimeout(() => setLang('FR'), 0);
    }
  }, [searchParams]);

  // Utility to handle redirection after login/signup
  const handleRedirect = () => {
    const hasPendingEstimate = localStorage.getItem(
      'pactestim_pending_estimate'
    );
    if (hasPendingEstimate) {
      router.push('/new-estimate');
    } else {
      router.push('/dashboard');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (view === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            country: lang === 'FR' ? 'FR' : 'US',
            currency: lang === 'FR' ? 'EUR' : 'USD'
          }
        }
      });

      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          setDialog({
            type: 'alert',
            message:
              lang === 'FR'
                ? 'Un compte existe déjà avec cet e-mail. Veuillez vous connecter.'
                : 'An account with this email already exists. Please sign in.'
          });
          setView('login');
        } else {
          setDialog({ type: 'alert', message: error.message });
        }
      } else if (data.session) {
        // SEAMLESS UX: Auto-login if session is returned (Email confirmation disabled)
        handleRedirect();
      } else {
        // Fallback if email confirmation is still enabled in Supabase
        setDialog({
          type: 'alert',
          message:
            lang === 'FR'
              ? 'Compte créé ! Veuillez vérifier votre e-mail pour finaliser.'
              : 'Account created! Please check your email to finalize.'
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
        // SEAMLESS UX: Check if they were working as a guest
        handleRedirect();
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
            lang === 'FR'
              ? 'Si un compte existe, un lien a été envoyé à votre e-mail.'
              : 'If an account exists, a password reset link has been sent to your email.'
        });
        setView('login');
      }
    }

    setLoading(false);
  };

  const t = dict[lang];

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-black relative">
      <div className="absolute top-6 right-8 flex gap-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
        <Link href="/" className="hover:text-gray-800 transition-colors">
          ← {lang === 'FR' ? 'Retour' : 'Home'}
        </Link>
      </div>

      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-xl shadow-xl border border-gray-100">
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-2 text-center text-gray-900">
          {view === 'login' && t.welcome}
          {view === 'signup' && t.create}
          {view === 'forgot' && t.resetTitle}
        </h1>

        <p className="text-xs text-gray-500 font-medium text-center mb-8">
          {view === 'login' && t.descLogin}
          {view === 'signup' && t.descSignup}
          {view === 'forgot' && t.descForgot}
        </p>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">
              {t.email}
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
                  {t.pass}
                </label>
                {view === 'login' && (
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {t.forgot}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full p-3 pr-16 border border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold bg-gray-50 focus:bg-white transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? t.hidePass : t.showPass}
                </button>
              </div>
            </div>
          )}

          {view === 'signup' && (
            <div className="text-[10px] text-gray-400 text-center font-medium leading-relaxed px-4">
              {t.terms1}{' '}
              <Link
                href="/terms"
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
                {t.termsLink}
              </Link>{' '}
              {t.terms2}{' '}
              <Link
                href="/privacy"
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
                {t.privLink}
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
              ? t.processing
              : view === 'login'
                ? t.btnSign
                : view === 'signup'
                  ? t.btnCreate
                  : t.btnReset}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center flex flex-col gap-3">
          {view === 'login' ? (
            <p className="text-xs font-bold text-gray-500">
              {t.noAccount}{' '}
              <button
                onClick={() => setView('signup')}
                className="text-blue-600 uppercase tracking-widest text-[10px] font-black hover:text-blue-800 ml-1"
              >
                {t.btnCreate}
              </button>
            </p>
          ) : (
            <p className="text-xs font-bold text-gray-500">
              {t.returnSign}{' '}
              <button
                onClick={() => setView('login')}
                className="text-blue-600 uppercase tracking-widest text-[10px] font-black hover:text-blue-800 ml-1"
              >
                {t.btnSign}
              </button>
            </p>
          )}
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-3 text-gray-900">
              {dialog.title || (lang === 'FR' ? 'Notification' : 'Notice')}
            </h3>
            <p className="text-sm text-gray-500 font-medium mb-8">
              {dialog.message}
            </p>
            <div className="flex justify-end">
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
