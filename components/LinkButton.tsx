'use client';

import React from 'react';
import Link from 'next/link';

type Variant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'dark'
  | 'ghost'
  | 'soft-primary'
  | 'soft-secondary'
  | 'soft-danger';
type Size = 'sm' | 'md' | 'lg';

interface LinkButtonProps {
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
  onClick?: () => void;
}

const baseStyles =
  'inline-flex items-center justify-center font-black uppercase tracking-widest transition-all duration-200 cursor-pointer select-none whitespace-nowrap';

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-2 text-[9px] rounded-lg gap-1.5',
  md: 'px-5 py-3 text-[10px] rounded-xl gap-2',
  lg: 'px-8 py-4 text-[11px] rounded-xl gap-2'
};

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',

  secondary:
    'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',

  danger:
    'bg-red-600 text-white shadow-md shadow-red-600/20 hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',

  success:
    'bg-green-600 text-white shadow-md shadow-green-600/20 hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',

  dark: 'bg-gray-900 text-white shadow-md shadow-gray-900/20 hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',

  ghost:
    'text-gray-500 hover:text-gray-900 hover:bg-gray-50 active:scale-[0.98]',

  // Soft variants — for use inside cards / sections where solid colors would be too heavy.
  // Tinted background, colored text, matching border. Hover deepens the tint.
  'soft-primary':
    'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',

  'soft-secondary':
    'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',

  'soft-danger':
    'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 hover:border-red-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]'
};

export default function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
  children,
  target,
  rel,
  onClick
}: LinkButtonProps) {
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthClass} ${className}`}
    >
      {icon && iconPosition === 'left' && (
        <span className="shrink-0">{icon}</span>
      )}
      {children}
      {icon && iconPosition === 'right' && (
        <span className="shrink-0">{icon}</span>
      )}
    </Link>
  );
}
