'use client';

import React from 'react';
import Link from 'next/link';

interface ProLockModalProps {
  open: boolean;
  onClose: () => void;
  labels: {
    title: string;
    message: string;
    upgrade: string;
    cancel: string;
  };
}

export default function ProLockModal({
  open,
  onClose,
  labels
}: ProLockModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-gray-100 animate-scale-up text-center">
        {/* Lock icon in colored circle */}
        <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center shadow-inner">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-black uppercase tracking-tighter mb-3 text-gray-900">
          {labels.title}
        </h3>
        <p className="text-sm text-gray-500 font-medium mb-8 leading-relaxed">
          {labels.message}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/upgrade"
            className="block w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/30 transition-all active:scale-[0.98]"
          >
            {labels.upgrade}
          </Link>
          <button
            onClick={onClose}
            className="w-full px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
          >
            {labels.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
