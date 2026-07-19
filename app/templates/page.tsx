'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations } from '@/lib/translations';
import LoadingDots from '@/components/LoadingDots';
import Button from '@/components/Button';
import LinkButton from '@/components/LinkButton';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [lang, setLang] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data: prof } = await supabase
        .from('profiles')
        .select('country, subscription_tier, default_lang') // Explicitly select default_lang column
        .eq('id', user.id)
        .single();

      if (!prof || prof.subscription_tier !== 'pro') {
        router.push('/dashboard');
        return;
      }

      setProfile(prof);
      const activeLang =
        prof.default_lang || (prof.country === 'FR' ? 'FR' : 'EN');
      setLang(activeLang === 'FR' ? translations.FR : translations.US);

      const { data } = await supabase
        .from('estimate_templates')
        .select('id, name, sections, additional_charges, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setTemplates(data || []);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;
    setSavingId(id);
    const { error } = await supabase
      .from('estimate_templates')
      .update({
        name: editingName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    setSavingId(null);
    if (error) {
      setDialog({ type: 'alert', message: error.message });
    } else {
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, name: editingName.trim() } : t))
      );
      setEditingId(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDialog({
      type: 'confirm',
      message: lang?.deleteTemplateConfirm
        ? lang.deleteTemplateConfirm.replace('{name}', name)
        : `Delete template "${name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDialog(null);
        const { error } = await supabase
          .from('estimate_templates')
          .delete()
          .eq('id', id);
        if (error) {
          setDialog({ type: 'alert', message: error.message });
        } else {
          setTemplates((prev) => prev.filter((t) => t.id !== id));
        }
      }
    });
  };

  if (loading || !lang) return <LoadingDots />;

  const isFR = profile?.default_lang === 'FR';

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8 pb-40 font-sans text-black">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              {lang.templates || (isFR ? 'Modèles' : 'Templates')}
            </h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-0.5">
              {isFR
                ? 'Vos structures de devis réutilisables'
                : 'Your reusable estimate structures'}
            </p>
          </div>
          <LinkButton href="/dashboard" variant="secondary" size="sm">
            ← {lang.dashboard}
          </LinkButton>
        </div>

        {templates.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-2">
              {isFR ? 'Aucun modèle enregistré' : 'No templates saved yet'}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              {isFR
                ? 'Ouvrez un devis approuvé et utilisez ··· → Enregistrer comme modèle.'
                : 'Open any approved estimate and use ··· → Save as Template.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  {editingId === tmpl.id ? (
                    <input
                      type="text"
                      value={editingName}
                      maxLength={80}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(tmpl.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full p-2 border border-blue-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <>
                      <p className="font-bold text-gray-900 truncate">
                        {tmpl.name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase tracking-widest">
                        {(tmpl.sections || []).length}{' '}
                        {isFR ? 'catégorie(s)' : 'category(ies)'} ·{' '}
                        {new Date(tmpl.created_at).toLocaleDateString(
                          isFR ? 'fr-FR' : 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' }
                        )}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {editingId === tmpl.id ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={savingId === tmpl.id}
                        loadingText="..."
                        onClick={() => handleRename(tmpl.id)}
                        disabled={!editingName.trim()}
                      >
                        {lang.save}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        {lang.cancel}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(tmpl.id);
                          setEditingName(tmpl.name);
                        }}
                      >
                        {lang.rename || (isFR ? 'Renommer' : 'Rename')}
                      </Button>
                      <button
                        onClick={() => handleDelete(tmpl.id, tmpl.name)}
                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-2 transition-all duration-200 cursor-pointer"
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        labels={{
          notice: lang.notice,
          cancel: lang.cancel,
          confirmOk: lang.confirmOk
        }}
      />
    </main>
  );
}
