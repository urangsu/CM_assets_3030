import React from 'react';
import { cn } from '../../lib/utils';

export interface AppBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'locked' | 'success' | 'info' | 'muted';
  className?: string;
  children?: React.ReactNode;
}

export function AppBadge({ className, variant = 'default', children, ...props }: AppBadgeProps) {
  const variants = {
    default: 'bg-lithium-100 text-text-subtle',
    primary: 'bg-nickel-50 text-nickel-700',
    warning: 'bg-cobalt-50 text-cobalt-700',
    danger: 'bg-red-50 text-red-600',
    locked: 'bg-gray-100 text-gray-600',
    success: 'bg-green-50 text-green-700',
    info: 'bg-blue-50 text-blue-700',
    muted: 'bg-gray-50 text-gray-700',
  };

  return (
    <span 
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}
