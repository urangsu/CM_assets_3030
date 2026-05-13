import React from 'react';
import { cn } from '../../lib/utils';

export interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'interactive' | 'warning' | 'danger' | 'success';
}

export const AppCard = React.forwardRef<HTMLDivElement, AppCardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-white border border-lithium-200 outline-none',
      muted: 'bg-lithium-50 border border-lithium-200 outline-none',
      interactive: 'bg-white border border-lithium-200 outline-none hover:bg-lithium-50 hover:border-nickel-100 transition-all cursor-pointer',
      warning: 'bg-cobalt-50 border border-cobalt-200 outline-none',
      danger: 'bg-red-50 border border-red-200 outline-none',
      success: 'bg-nickel-50 border border-nickel-200 outline-none',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-2xl shadow-card', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AppCard.displayName = 'AppCard';
