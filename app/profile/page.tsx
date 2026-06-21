'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translations, t } from '@/lib/translations';
import Link from 'next/link';
import LoadingDots from '@/components/LoadingDots';
import ConfirmDialog from '@/components/ConfirmDialog';
import Button from '@/components/Button';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import LinkButton from '@/components/LinkButton';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition
} from '@headlessui/react';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [lang, setLang] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [processingDelete, setProcessingDelete] = useState(false);

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm' | 'danger';
    title?: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  // Business Profile State
  const [businessName, setBusinessName] = useState('');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [dailyRate, setDailyRate] = useState<number>(0);
  const [country, setCountry] = useState('US');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  // Automatic Down Payment Defaults
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState<number>(20);

  // Email notification preferences (default: all on)
  const [notifyOnComment, setNotifyOnComment] = useState(true);
  const [notifyOnApproved, setNotifyOnApproved] = useState(true);
  const [notifyOnRejected, setNotifyOnRejected] = useState(true);

  // Invoicing & Legal State
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankRoutingNumber, setBankRoutingNumber] = useState('');
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessState, setBusinessState] = useState('');
  const [businessZip, setBusinessZip] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [companyRegNumber, setCompanyRegNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [savingInvoicing, setSavingInvoicing] = useState(false);
  const [lifetimeSpotsUsed, setLifetimeSpotsUsed] = useState(0);
  const MAX_LIFETIME_SPOTS = 100;

  // Security Profile State
  const [authEmail, setAuthEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      setAuthEmail(user.email || '');

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile(prof);
        setLang(prof.country === 'FR' ? translations.FR : translations.US);
        setBusinessName(prof.business_name || '');
        setTaxRate(prof.default_tax_rate || 0);
        setHourlyRate(prof.default_hourly_rate || 0);
        setDailyRate(prof.default_daily_rate || 0);
        setCountry(prof.country || 'US');
        setDepositEnabled(prof.default_deposit_enabled ?? false);
        setDepositPercentage(prof.default_deposit_percentage ?? 20);
        // Notification preferences (default to true if column is null/missing)
        setNotifyOnComment(prof.notify_on_comment ?? true);
        setNotifyOnApproved(prof.notify_on_approved ?? true);
        setNotifyOnRejected(prof.notify_on_rejected ?? true);

        // Fetch lifetime spots for the upgrade nudge
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('lifetime_access', true);
        setLifetimeSpotsUsed(count || 0);
        setBankName(prof.bank_name || '');
        setBankAccountNumber(prof.bank_account_number || '');
        setBankRoutingNumber(prof.bank_routing_number || '');
        setPaymentLinkUrl(prof.payment_link_url || '');
        setBusinessAddress(prof.business_address || '');
        setBusinessCity(prof.business_city || '');
        setBusinessState(prof.business_state || '');
        setBusinessZip(prof.business_zip || '');
        setVatNumber(prof.vat_number || '');
        setCompanyRegNumber(prof.company_reg_number || '');
        setContactEmail(prof.contact_email || '');
        if (prof.logo_url) {
          setSelectedFileName('Uploaded Logo');
        }
      }
    }
    fetchData();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setSelectedFileName(e.target.files[0].name);
    }
  };

  const handleSaveInvoicing = async () => {
    setSavingInvoicing(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        bank_name: bankName.trim() || null,
        bank_account_number:
          bankAccountNumber.trim().replace(/\s/g, '') || null,
        bank_routing_number: bankRoutingNumber.trim() || null,
        payment_link_url: paymentLinkUrl.trim() || null,
        vat_number: vatNumber.trim() || null,
        company_reg_number: companyRegNumber.trim() || null,
        contact_email: contactEmail.trim() || null
      })
      .eq('id', profile.id);
    setSavingInvoicing(false);
    if (error) {
      setDialog({ type: 'alert', message: error.message });
    } else {
      setProfile((prev: any) => ({
        ...prev,
        bank_name: bankName.trim() || null,
        bank_account_number:
          bankAccountNumber.trim().replace(/\s/g, '') || null,
        bank_routing_number: bankRoutingNumber.trim() || null,
        payment_link_url: paymentLinkUrl.trim() || null,
        vat_number: vatNumber.trim() || null,
        company_reg_number: companyRegNumber.trim() || null,
        contact_email: contactEmail.trim() || null
      }));
      setDialog({ type: 'alert', message: lang.profileUpdated });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    let finalLogoUrl = profile.logo_url;

    // Step 1: Upload logo if a new file was selected
    if (selectedFile && user) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, selectedFile, { upsert: true });

      if (uploadError) {
        setSavingProfile(false);
        setDialog({
          type: 'alert',
          message: uploadError.message
        });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);
      finalLogoUrl = publicUrlData.publicUrl;
    }

    // Step 2: Update profile fields
    const currency = country === 'FR' ? 'EUR' : 'USD';

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        business_name: businessName,
        default_tax_rate: taxRate,
        default_hourly_rate: hourlyRate,
        default_daily_rate: dailyRate,
        country: country,
        currency: currency,
        logo_url: finalLogoUrl,
        default_deposit_enabled: depositEnabled,
        default_deposit_percentage: depositPercentage,
        business_address: businessAddress.trim() || null,
        business_city: businessCity.trim() || null,
        business_state: businessState.trim() || null,
        business_zip: businessZip.trim() || null
      })
      .eq('id', profile.id);

    setSavingProfile(false);

    if (profileUpdateError) {
      setDialog({
        type: 'alert',
        message: profileUpdateError.message
      });
      return;
    }

    // Step 3: Update local state on success
    setProfile((prev: any) => ({
      ...prev,
      country: country,
      currency: currency,
      logo_url: finalLogoUrl,
      business_name: businessName,
      default_tax_rate: taxRate,
      default_hourly_rate: hourlyRate,
      default_daily_rate: dailyRate,
      default_deposit_enabled: depositEnabled,
      default_deposit_percentage: depositPercentage,
      business_address: businessAddress.trim() || null,
      business_city: businessCity.trim() || null,
      business_zip: businessZip.trim() || null
    }));
    setLang(country === 'FR' ? translations.FR : translations.US);
    localStorage.setItem('public_lang', country === 'FR' ? 'FR' : 'US');

    // Notify navbar (and any other listening component) that the profile changed
    window.dispatchEvent(new CustomEvent('profileUpdated'));

    setDialog({
      type: 'alert',
      message: lang.profileUpdated,
      onConfirm: () => {
        setDialog(null);
      }
    });
  };
  // Auto-save toggle for notification preferences
  const handleNotificationToggle = async (
    field: 'notify_on_comment' | 'notify_on_approved' | 'notify_on_rejected',
    newValue: boolean
  ) => {
    // Optimistically update local state for instant UI feedback
    if (field === 'notify_on_comment') setNotifyOnComment(newValue);
    if (field === 'notify_on_approved') setNotifyOnApproved(newValue);
    if (field === 'notify_on_rejected') setNotifyOnRejected(newValue);

    const { error } = await supabase
      .from('profiles')
      .update({ [field]: newValue })
      .eq('id', profile.id);

    if (error) {
      // Revert local state on error
      if (field === 'notify_on_comment') setNotifyOnComment(!newValue);
      if (field === 'notify_on_approved') setNotifyOnApproved(!newValue);
      if (field === 'notify_on_rejected') setNotifyOnRejected(!newValue);
      setDialog({
        type: 'alert',
        message: lang.notificationUpdateError
      });
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSecurity(true);

    const updates: { email?: string; password?: string } = {};
    if (authEmail) updates.email = authEmail;
    if (newPassword) updates.password = newPassword;

    const { error } = await supabase.auth.updateUser(updates);

    setSavingSecurity(false);

    if (error) {
      setDialog({ type: 'alert', message: error.message });
    } else {
      setNewPassword('');
      // Notify navbar/footer in case email or auth-related UI needs to refresh
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      setDialog({
        type: 'alert',
        message: lang.securityUpdated
      });
    }
  };

  const handleCancelSubClick = () => {
    setDialog({
      type: 'confirm',
      message: lang.cancelSubConfirm,
      onConfirm: async () => {
        setDialog(null);

        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();

          if (!session) {
            setDialog({
              type: 'alert',
              message: lang.sessionExpired
            });
            return;
          }

          const response = await fetch('/api/cancel-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            }
          });

          const result = await response.json();

          if (!response.ok) {
            setDialog({
              type: 'alert',
              message: result.error || lang.cancelSubFailed
            });
            return;
          }

          // Update local state with the cancellation date — KEEP subscription_tier as 'pro'
          // because the user retains Pro access until the period actually ends
          const cancelAt = result.cancelAt
            ? new Date(result.cancelAt * 1000).toISOString()
            : null;

          setProfile((prev: any) =>
            prev ? { ...prev, subscription_cancel_at: cancelAt } : prev
          );

          // Notify other components in case they show cancellation status
          window.dispatchEvent(new CustomEvent('profileUpdated'));

          // Format the period-end date for the user's locale
          const formattedDate = cancelAt
            ? new Date(cancelAt).toLocaleDateString(
                country === 'FR' ? 'fr-FR' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )
            : '';

          setDialog({
            type: 'alert',
            message: result.alreadyCanceled
              ? lang.subAlreadyCanceled
              : t(lang.cancellationScheduled, { date: formattedDate })
          });
        } catch (err: any) {
          setDialog({
            type: 'alert',
            message: lang.connectionError
          });
        }
      }
    });
  };

  const handleSwitchToPayAsYouGoClick = () => {
    setDialog({
      type: 'confirm',
      message: lang.switchToPayAsYouGoConfirm,
      onConfirm: async () => {
        setDialog(null);

        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();

          if (!session) {
            setDialog({
              type: 'alert',
              message: lang.sessionExpired
            });
            return;
          }

          // Reuse the existing cancel-subscription endpoint —
          // it already handles both plain subs and scheduled subs at period end
          const response = await fetch('/api/cancel-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            }
          });

          const result = await response.json();

          if (!response.ok) {
            setDialog({
              type: 'alert',
              message: result.error || lang.switchToPayAsYouGoFailed
            });
            return;
          }

          // Update local state with the cancellation date
          const cancelAt = result.cancelAt
            ? new Date(result.cancelAt * 1000).toISOString()
            : null;

          setProfile((prev: any) =>
            prev ? { ...prev, subscription_cancel_at: cancelAt } : prev
          );

          window.dispatchEvent(new CustomEvent('profileUpdated'));

          // Format the period-end date for the user's locale
          const formattedDate = cancelAt
            ? new Date(cancelAt).toLocaleDateString(
                country === 'FR' ? 'fr-FR' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )
            : '';

          // Show success message + redirect to upgrade page after they dismiss it
          setDialog({
            type: 'alert',
            message: t(lang.switchToPayAsYouGoSuccess, {
              date: formattedDate
            }),
            onConfirm: () => {
              setDialog(null);
              router.push('/upgrade');
            }
          });
        } catch (err: any) {
          setDialog({
            type: 'alert',
            message: lang.connectionError
          });
        }
      }
    });
  };

  const handleResumeSubClick = () => {
    setDialog({
      type: 'confirm',
      message: lang.resumeSubConfirm,
      onConfirm: async () => {
        setDialog(null);

        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();

          if (!session) {
            setDialog({
              type: 'alert',
              message: lang.sessionExpired
            });
            return;
          }

          const response = await fetch('/api/resume-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            }
          });

          const result = await response.json();

          if (!response.ok) {
            setDialog({
              type: 'alert',
              message: result.error || lang.resumeSubFailed
            });
            return;
          }

          setProfile((prev: any) =>
            prev ? { ...prev, subscription_cancel_at: null } : prev
          );

          window.dispatchEvent(new CustomEvent('profileUpdated'));

          setDialog({
            type: 'alert',
            message: lang.subResumed
          });
        } catch (err: any) {
          setDialog({
            type: 'alert',
            message: lang.connectionError
          });
        }
      }
    });
  };

  const handleSwitchToAnnualClick = () => {
    setDialog({
      type: 'confirm',
      message: lang.upgradeToAnnualConfirm,
      onConfirm: async () => {
        setDialog(null);

        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();

          if (!session) {
            setDialog({
              type: 'alert',
              message: lang.sessionExpired
            });
            return;
          }

          const response = await fetch('/api/switch-to-annual', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            }
          });

          const result = await response.json();

          if (!response.ok) {
            setDialog({
              type: 'alert',
              message: result.error || lang.upgradeToAnnualFailed
            });
            return;
          }

          // Update local state to show "Switching to annual" status
          setProfile((prev: any) =>
            prev ? { ...prev, pending_plan_switch: 'annual' } : prev
          );

          window.dispatchEvent(new CustomEvent('profileUpdated'));

          setDialog({
            type: 'alert',
            message: lang.upgradeToAnnualSuccess
          });
        } catch (err: any) {
          setDialog({
            type: 'alert',
            message: lang.connectionError
          });
        }
      }
    });
  };

  const handleCancelAnnualSwitchClick = () => {
    setDialog({
      type: 'confirm',
      message: lang.cancelAnnualSwitchConfirm,
      onConfirm: async () => {
        setDialog(null);

        try {
          const {
            data: { session }
          } = await supabase.auth.getSession();

          if (!session) {
            setDialog({
              type: 'alert',
              message: lang.sessionExpired
            });
            return;
          }

          const response = await fetch('/api/cancel-annual-switch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            }
          });

          const result = await response.json();

          if (!response.ok) {
            setDialog({
              type: 'alert',
              message: result.error || lang.upgradeToAnnualFailed
            });
            return;
          }

          setProfile((prev: any) =>
            prev ? { ...prev, pending_plan_switch: null } : prev
          );

          window.dispatchEvent(new CustomEvent('profileUpdated'));

          setDialog({
            type: 'alert',
            message: lang.annualSwitchCanceled
          });
        } catch (err: any) {
          setDialog({
            type: 'alert',
            message: lang.connectionError
          });
        }
      }
    });
  };

  const executeAccountDeletion = async () => {
    setDialog(null);
    setProcessingDelete(true);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session token identified.');

      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'Failed to complete administrative account erasure.'
        );
      }

      await supabase.auth.signOut();
      localStorage.clear();
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setProcessingDelete(false);
      setDialog({
        type: 'alert',
        title: lang.error,
        message: err.message || 'An unexpected connectivity error occurred.'
      });
    }
  };

  const triggerDeleteAccountFlow = () => {
    setDialog({
      type: 'danger',
      title: lang.permanentDeletion,
      message: lang.deleteAccountConfirm,
      onConfirm: executeAccountDeletion
    });
  };

  if (!lang) return <LoadingDots />;

  const isFreePlan = profile.subscription_tier === 'free';
  const currencySymbol = country === 'FR' ? '€' : '$';

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-12 pb-40 text-black font-sans relative">
      <div className="max-w-3xl mx-auto">
        {/* Header Navigation Section */}
        <div className="flex justify-between items-end mb-12 border-b border-gray-100 pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-2">
              {lang.settings || lang.profileSettings}
            </h1>
            {/* <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {profile?.country === 'FR'
                ? 'Configuration de la plateforme'
                : 'Platform Configurations'}
            </p> */}
          </div>
          <LinkButton href="/dashboard" variant="secondary" size="sm">
            ← {lang.dashboard}
          </LinkButton>
        </div>

        {/* BUSINESS PROFILE SECTION */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 mb-8">
          <p className="text-[10px] font-black uppercase text-gray-300 mb-6 tracking-[0.2em] border-b border-gray-50 pb-3">
            {lang.businessProfile}
          </p>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.businessName}
              </label>
              <input
                required
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.primaryMarket}
                </label>
                <Listbox
                  value={country}
                  onChange={(newCountry) => {
                    setCountry(newCountry);
                    setLang(
                      newCountry === 'FR' ? translations.FR : translations.US
                    );
                  }}
                >
                  <div className="relative">
                    <ListboxButton className="w-full p-3.5 border border-gray-200 rounded-xl text-left outline-none focus:border-blue-500 font-bold bg-gray-50/40 transition-colors shadow-inner text-[10px] uppercase tracking-widest text-gray-700 flex justify-between items-center cursor-pointer">
                      <span className="block truncate">
                        {country === 'US'
                          ? 'United States (USD / English)'
                          : 'France (EUR / Français)'}
                      </span>
                      <span className="pointer-events-none text-gray-400">
                        ▼
                      </span>
                    </ListboxButton>
                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <ListboxOptions className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-auto focus:outline-none text-[10px] uppercase tracking-widest font-bold">
                        <ListboxOption
                          value="US"
                          className={({ active }) =>
                            `cursor-pointer select-none relative p-3 ${
                              active
                                ? 'bg-blue-50 text-blue-900'
                                : 'text-gray-900'
                            }`
                          }
                        >
                          United States (USD / English)
                        </ListboxOption>
                        <ListboxOption
                          value="FR"
                          className={({ active }) =>
                            `cursor-pointer select-none relative p-3 ${
                              active
                                ? 'bg-blue-50 text-blue-900'
                                : 'text-gray-900'
                            }`
                          }
                        >
                          France (EUR / Français)
                        </ListboxOption>
                      </ListboxOptions>
                    </Transition>
                  </div>
                </Listbox>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.defaultTaxRate}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold pr-10 transition-colors bg-gray-50/40 shadow-inner"
                    value={taxRate === 0 ? '' : taxRate}
                    onChange={(e) =>
                      setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                  />
                  <span className="absolute right-4 top-4 text-gray-400 font-bold text-xs font-mono">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.defaultHourlyRate}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold pr-10 transition-colors bg-gray-50/40 shadow-inner"
                    value={hourlyRate === 0 ? '' : hourlyRate}
                    onChange={(e) =>
                      setHourlyRate(
                        Math.max(0, parseFloat(e.target.value) || 0)
                      )
                    }
                  />
                  <span className="absolute right-4 top-4 text-gray-400 font-bold text-xs font-mono">
                    {currencySymbol}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.defaultDailyRate}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold pr-10 transition-colors bg-gray-50/40 shadow-inner"
                    value={dailyRate === 0 ? '' : dailyRate}
                    onChange={(e) =>
                      setDailyRate(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                  />
                  <span className="absolute right-4 top-4 text-gray-400 font-bold text-xs font-mono">
                    {currencySymbol}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
              <div className="flex flex-col justify-center">
                <span className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.defaultDownPayment}
                </span>
                <div className="flex items-center gap-3 h-full pt-1">
                  <button
                    type="button"
                    onClick={() => setDepositEnabled(!depositEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                      depositEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    aria-label={lang.defaultDownPayment}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        depositEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-black text-gray-700 uppercase tracking-wider select-none">
                    {depositEnabled ? lang.enabled : lang.disabled}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.depositPercentage}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={!depositEnabled}
                    className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold pr-10 transition-colors bg-white shadow-inner disabled:opacity-40 disabled:bg-gray-100"
                    value={depositPercentage}
                    onChange={(e) =>
                      setDepositPercentage(
                        Math.min(
                          100,
                          Math.max(1, parseInt(e.target.value) || 0)
                        )
                      )
                    }
                  />
                  <span className="absolute right-4 top-4 text-gray-400 font-bold text-xs font-mono">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Business Address — autocomplete */}
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.businessAddress}
              </label>
              <div className="flex items-center w-full border border-gray-200 rounded-xl bg-gray-50/40 shadow-inner focus-within:border-blue-500 transition-colors">
                <AddressAutocomplete
                  value={businessAddress}
                  userCountry={country}
                  onChange={(val) => setBusinessAddress(val)}
                  onSelect={(components) => {
                    setBusinessAddress(components.address);
                    setBusinessCity(components.city);
                    setBusinessZip(components.zip);
                    if (country === 'US') {
                      // Mapbox returns full state name (e.g. "New York") — store as abbrev if you want,
                      // but store as-is for now; user can correct in the state field below.
                      setBusinessState(components.state || '');
                    }
                  }}
                  placeholder={lang.businessAddress}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.zipCode}
                </label>
                <input
                  type="text"
                  placeholder={lang.zipCode}
                  maxLength={10}
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold transition-colors bg-gray-50/40 shadow-inner"
                  value={businessZip}
                  onChange={(e) => setBusinessZip(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.city}
                </label>
                <input
                  type="text"
                  placeholder={lang.city}
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner"
                  value={businessCity}
                  onChange={(e) => setBusinessCity(e.target.value)}
                />
              </div>
            </div>

            {/* State — US only */}
            {country === 'US' && (
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.stateLabel}
                </label>
                <input
                  type="text"
                  placeholder="NY"
                  maxLength={50}
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold uppercase transition-colors bg-gray-50/40 shadow-inner"
                  value={businessState}
                  onChange={(e) =>
                    setBusinessState(e.target.value.toUpperCase())
                  }
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  {lang.stateFormat}
                </p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widests">
                {lang.logo}{' '}
                {isFreePlan && (
                  <span className="text-blue-600 font-black ml-1.5">
                    ({lang.proFeature})
                  </span>
                )}
              </label>

              <div className="relative flex items-center">
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  disabled={isFreePlan}
                  onChange={handleFileChange}
                  className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isFreePlan ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                />
                <div
                  className={`flex items-center gap-4 w-full p-2.5 border rounded-xl bg-gray-50/50 transition-colors ${isFreePlan ? 'opacity-50 border-gray-200' : 'hover:border-blue-300 border-gray-200/80'}`}
                >
                  <span className="bg-white text-gray-700 font-black text-[9px] uppercase tracking-widest px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm">
                    {lang.chooseFile || 'Choose File'}
                  </span>
                  <span className="text-xs text-gray-500 font-bold truncate flex-1 pl-1">
                    {selectedFileName || lang.noFileChosen || 'No file chosen'}
                  </span>
                  {profile?.logo_url && !selectedFile && (
                    <img
                      src={profile.logo_url}
                      alt="Current Logo"
                      className="h-7 w-7 object-contain bg-white rounded p-0.5 border border-gray-100"
                    />
                  )}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={savingProfile}
              loadingText="..."
              className="px-8"
            >
              {lang.save}
            </Button>
          </form>
        </div>

        {/* INVOICING & LEGAL SECTION */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 mb-8">
          <p className="text-[10px] font-black uppercase text-gray-300 mb-6 tracking-[0.2em] border-b border-gray-50 pb-3">
            {lang.invoicingLegal}
          </p>

          <div className="space-y-6">
            {/* Structured bank fields */}
            <div className="space-y-4">
              <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                {lang.bankWireDesc}
              </p>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">
                  {lang.bankName}
                </label>
                <input
                  type="text"
                  placeholder={lang.bankNamePlaceholder}
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">
                  {lang.bankAccountNumberLabel}
                </label>
                <input
                  type="text"
                  placeholder={lang.bankAccountPlaceholder}
                  maxLength={country === 'FR' ? 34 : 17}
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold tracking-widest transition-colors bg-gray-50/40 shadow-inner uppercase"
                  value={bankAccountNumber}
                  onChange={(e) =>
                    setBankAccountNumber(e.target.value.toUpperCase())
                  }
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  {lang.bankAccountFormat}
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">
                  {lang.bankRoutingLabel}
                </label>
                <input
                  type="text"
                  placeholder={lang.bankRoutingPlaceholder}
                  maxLength={country === 'FR' ? 11 : 9}
                  pattern={country === 'FR' ? '[A-Za-z0-9]{8,11}' : '[0-9]{9}'}
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold tracking-widest transition-colors bg-gray-50/40 shadow-inner uppercase"
                  value={bankRoutingNumber}
                  onChange={(e) =>
                    setBankRoutingNumber(e.target.value.toUpperCase())
                  }
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  {lang.bankRoutingFormat}
                </p>
              </div>
            </div>

            {/* Payment link */}
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.paymentLinkLabel ||
                  (country === 'FR'
                    ? 'Lien de paiement en ligne'
                    : 'Online payment link')}
              </label>
              <p className="text-[10px] text-gray-400 mb-2 font-medium leading-relaxed">
                {lang.paymentLinkUrlDesc}
              </p>
              <input
                type="url"
                placeholder="https://..."
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono text-sm transition-colors bg-gray-50/40 shadow-inner"
                value={paymentLinkUrl}
                onChange={(e) => setPaymentLinkUrl(e.target.value)}
              />
            </div>

            {/* Contact email */}
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.contactEmailFieldLabel}
              </label>
              <p className="text-[10px] text-gray-400 mb-2 font-medium leading-relaxed">
                {lang.contactEmailFieldDesc}
              </p>
              <input
                type="email"
                placeholder={
                  country === 'FR'
                    ? 'contact@votreentreprise.fr'
                    : 'contact@yourbusiness.com'
                }
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* VAT number */}
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                  {lang.vatNumber ||
                    (country === 'FR'
                      ? 'N° TVA intracommunautaire'
                      : 'VAT number')}
                </label>
                <input
                  type="text"
                  placeholder={
                    country === 'FR' ? 'FR00000000000' : 'GB123456789'
                  }
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold transition-colors bg-gray-50/40 shadow-inner"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                />
              </div>

              {/* Company reg number */}
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widests">
                  {lang.companyRegNumber ||
                    (country === 'FR' ? 'SIRET' : 'Company reg. number')}
                </label>
                <input
                  type="text"
                  placeholder={
                    country === 'FR' ? '000 000 000 00000' : '12345678'
                  }
                  className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold transition-colors bg-gray-50/40 shadow-inner"
                  value={companyRegNumber}
                  onChange={(e) => setCompanyRegNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            loading={savingInvoicing}
            loadingText="..."
            className="px-8 mt-6"
            onClick={handleSaveInvoicing}
          >
            {lang.save}
          </Button>
        </div>

        {/* ACCOUNT SECURITY SECTION */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 mb-8">
          <p className="text-[10px] font-black uppercase text-gray-300 mb-6 tracking-[0.2em] border-b border-gray-50 pb-3">
            {lang.accountSecurity}
          </p>

          <form onSubmit={handleSaveSecurity} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.emailAddressLabel}
              </label>
              <input
                type="email"
                required
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                {lang.newPasswordLabel}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full p-3.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold transition-colors bg-gray-50/40 shadow-inner tracking-widest"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-[11px] font-bold text-gray-400 mt-2">
                {lang.keepCurrentPassword}
              </p>
            </div>

            <Button
              type="submit"
              variant="secondary"
              size="md"
              loading={savingSecurity}
              loadingText="..."
              className="px-8"
            >
              {lang.updateSecurity}
            </Button>
          </form>
        </div>

        {/* EMAIL NOTIFICATIONS SECTION */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 mb-8">
          <p className="text-[10px] font-black uppercase text-gray-300 mb-2 tracking-[0.2em]">
            {lang.notificationSettings}
          </p>
          <p className="text-xs text-gray-400 font-medium mb-6 leading-relaxed border-b border-gray-50 pb-4">
            {lang.notificationSettingsDesc}
          </p>

          <div className="space-y-3">
            {/* Comment notification */}
            <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
              <span className="text-xs font-bold text-gray-700 pr-4">
                {lang.notifyOnComment}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleNotificationToggle(
                    'notify_on_comment',
                    !notifyOnComment
                  )
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  notifyOnComment ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                aria-label={lang.notifyOnComment}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    notifyOnComment ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Approved notification */}
            <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
              <span className="text-xs font-bold text-gray-700 pr-4">
                {lang.notifyOnApproved}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleNotificationToggle(
                    'notify_on_approved',
                    !notifyOnApproved
                  )
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  notifyOnApproved ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                aria-label={lang.notifyOnApproved}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    notifyOnApproved ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Rejected notification */}
            <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
              <span className="text-xs font-bold text-gray-700 pr-4">
                {lang.notifyOnRejected}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleNotificationToggle(
                    'notify_on_rejected',
                    !notifyOnRejected
                  )
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  notifyOnRejected ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                aria-label={lang.notifyOnRejected}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    notifyOnRejected ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* SUBSCRIPTION PLAN SECTION */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/60 mb-8">
          <p className="text-[10px] font-black uppercase text-gray-300 mb-6 tracking-[0.2em] border-b border-gray-50 pb-3">
            {lang.currentPlan || 'Current Plan'}
          </p>

          {/* ── Plan status ── */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
                  isFreePlan
                    ? 'bg-gray-300'
                    : profile?.lifetime_access
                      ? 'bg-amber-400'
                      : 'bg-blue-600'
                }`}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-lg text-gray-900 uppercase tracking-tight">
                    {profile?.lifetime_access
                      ? lang.lifetimePlanName || 'Lifetime'
                      : isFreePlan
                        ? lang.freePlan
                        : lang.proPlan}
                  </p>
                  {!isFreePlan &&
                    !profile?.lifetime_access &&
                    profile?.subscription_interval && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {profile.subscription_interval === 'annual'
                          ? lang.youAreOnAnnual
                          : lang.youAreOnMonthly}
                      </span>
                    )}
                  {profile?.lifetime_access && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {lang.lifetimeOneTime || 'One-time'}
                    </span>
                  )}
                </div>

                {isFreePlan && profile?.estimate_credits > 0 && (
                  <p className="text-xs font-black text-blue-600 mt-1 uppercase tracking-wider">
                    {t(lang.creditsRemaining, {
                      count: profile.estimate_credits
                    })}
                  </p>
                )}
                {!isFreePlan &&
                  !profile?.lifetime_access &&
                  profile?.subscription_cancel_at && (
                    <p className="text-xs font-bold text-orange-500 mt-1">
                      {t(lang.cancellationScheduledFor, {
                        date: new Date(
                          profile.subscription_cancel_at
                        ).toLocaleDateString(
                          country === 'FR' ? 'fr-FR' : 'en-US',
                          { year: 'numeric', month: 'long', day: 'numeric' }
                        )
                      })}
                    </p>
                  )}
                {!isFreePlan &&
                  !profile?.lifetime_access &&
                  profile?.pending_plan_switch === 'annual' &&
                  !profile?.subscription_cancel_at && (
                    <p className="text-xs font-bold text-blue-500 mt-1">
                      ↗ {lang.upgradeToAnnual}
                    </p>
                  )}
                {profile?.lifetime_access && (
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    {lang.lifetimeTagline}
                  </p>
                )}
              </div>
            </div>

            {isFreePlan && (
              <LinkButton
                href="/upgrade"
                variant="primary"
                size="sm"
                className="shrink-0"
              >
                {lang.upgradeToPro}
              </LinkButton>
            )}
          </div>

          {/* ── Actions (Pro users only) ── */}
          {!isFreePlan && !profile?.lifetime_access && (
            <div className="border-t border-gray-100 mt-5 pt-4 space-y-1">
              {profile?.subscription_cancel_at ? (
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={handleResumeSubClick}
                  className="!justify-start !text-blue-600 hover:!text-blue-800 hover:!bg-blue-50"
                >
                  {lang.resumeSubscription}
                </Button>
              ) : (
                <>
                  {/* Lifetime nudge */}
                  {lifetimeSpotsUsed < MAX_LIFETIME_SPOTS && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-amber-900 uppercase tracking-tight">
                          {lang.lifetimePlanName} ·{' '}
                          {MAX_LIFETIME_SPOTS - lifetimeSpotsUsed}{' '}
                          {lang.lifetimeSpotsLeft}
                        </p>
                        <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                          {profile?.currency === 'EUR' ? '249€' : '$299'} ·{' '}
                          {lang.lifetimeTagline}
                        </p>
                      </div>
                      <LinkButton
                        href="/upgrade"
                        variant="ghost"
                        size="sm"
                        className="!bg-amber-400 !text-gray-900 hover:!bg-amber-300 !border-0 shrink-0 ml-3"
                      >
                        {lang.getLifetime}
                      </LinkButton>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={handleManageBilling}
                    disabled={processing}
                    className="!justify-start !text-blue-600 hover:!text-blue-800 hover:!bg-blue-50"
                  >
                    {lang.manageBilling}
                  </Button>

                  {profile?.subscription_interval === 'monthly' &&
                    !profile?.pending_plan_switch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={handleSwitchToAnnualClick}
                        className="!justify-start !text-blue-600 hover:!text-blue-800 hover:!bg-blue-50"
                      >
                        ↗ {lang.upgradeToAnnual}
                      </Button>
                    )}

                  {profile?.pending_plan_switch === 'annual' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onClick={handleCancelAnnualSwitchClick}
                      className="!justify-start !text-gray-400 hover:!text-red-500 hover:!bg-red-50"
                    >
                      {lang.cancelAnnualSwitch}
                    </Button>
                  )}

                  <div className="border-t border-gray-50 mt-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onClick={handleSwitchToPayAsYouGoClick}
                      className="!justify-start !text-gray-500 hover:!text-blue-600 hover:!bg-blue-50"
                    >
                      ⇄ {lang.switchToPayAsYouGo}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onClick={handleCancelSubClick}
                      className="!justify-start !text-gray-400 hover:!text-red-500 hover:!bg-red-50"
                    >
                      {lang.cancelSub || 'Cancel Subscription'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* COMPLIANCE DANGER ZONE - ACCOUNT ERASURE BLOCK */}
        <div className="bg-red-50/10 p-6 sm:p-8 rounded-2xl border border-red-200/60">
          <p className="text-[10px] font-black uppercase text-red-500/80 mb-4 tracking-[0.2em] border-b border-red-100/40 pb-3">
            {lang.dangerZone}
          </p>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="max-w-md">
              <p className="font-black text-base text-gray-900 tracking-tight uppercase mb-1">
                {lang.deleteAccount}
              </p>
              <p className="text-xs text-gray-400 font-bold leading-relaxed">
                {lang.deleteAccountDesc}
              </p>
            </div>
            <Button
              variant="danger"
              size="md"
              loading={processingDelete}
              loadingText="..."
              onClick={triggerDeleteAccountFlow}
              className="w-full sm:w-auto px-6 shrink-0"
            >
              {lang.deleteAccount}
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog Overlay Component Wrapper */}
      <ConfirmDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        labels={{
          notice: lang.notice,
          cancel: lang.cancel,
          confirmOk: lang.confirmOk,
          deletePermanently: lang.deletePermanently
        }}
      />
    </main>
  );
}
