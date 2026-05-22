import React from 'react';
import Button from '@/components/Button';

export type DialogType = 'alert' | 'confirm' | 'danger';

export interface DialogConfig {
  type?: DialogType;
  title?: string;
  message: string;
  onConfirm?: () => void;
}

interface ConfirmDialogProps {
  dialog: DialogConfig | null;
  onClose: () => void;
  /** Translation strings — pass `lang` from the parent so dialog matches the page's language */
  labels: {
    notice: string;
    cancel: string;
    confirmOk: string;
    /** Optional: only used when dialog.type === 'danger'. Defaults to confirmOk if not provided. */
    deletePermanently?: string;
  };
}

export default function ConfirmDialog({
  dialog,
  onClose,
  labels
}: ConfirmDialogProps) {
  if (!dialog) return null;

  const isDanger = dialog.type === 'danger';
  const isConfirmable = dialog.type === 'confirm' || dialog.type === 'danger';

  const handleConfirm = () => {
    if (dialog.onConfirm) {
      dialog.onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full border border-gray-100 animate-scale-up">
        <h3
          className={`text-sm font-black uppercase tracking-widests mb-3 ${
            isDanger ? 'text-red-600' : 'text-gray-900'
          }`}
        >
          {dialog.title || labels.notice}
        </h3>
        <p className="text-xs text-gray-500 font-bold mb-6 leading-relaxed">
          {dialog.message}
        </p>
        <div className="flex gap-2 justify-end">
          {isConfirmable && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              {labels.cancel}
            </Button>
          )}
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            size="sm"
            onClick={handleConfirm}
          >
            {isDanger
              ? labels.deletePermanently || labels.confirmOk
              : labels.confirmOk}
          </Button>
        </div>
      </div>
    </div>
  );
}
