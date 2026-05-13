import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-nickel-600 text-white hover:bg-nickel-700 active:bg-nickel-700 shadow-sm disabled:bg-lithium-200 disabled:text-lithium-500',
      secondary: 'bg-white text-text-base border border-lithium-300 hover:bg-lithium-50 active:bg-lithium-100 shadow-sm disabled:opacity-50 disabled:bg-lithium-50',
      ghost: 'bg-transparent text-text-base hover:bg-lithium-100 active:bg-lithium-200 disabled:opacity-50',
      danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm disabled:opacity-50',
      warning: 'bg-cobalt-600 text-white hover:bg-cobalt-700 active:bg-cobalt-700 shadow-sm disabled:opacity-50',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs w-auto',
      md: 'h-10 px-4 text-sm w-auto',
      lg: 'h-12 px-6 text-base w-auto',
      icon: 'h-10 w-10 p-2 justify-center shrink-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nickel-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed whitespace-nowrap',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />}
        {!isLoading && leftIcon && <span className={cn("shrink-0", children ? "mr-2" : "")}>{leftIcon}</span>}
        {children}
        {rightIcon && <span className="ml-2 shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);
AppButton.displayName = 'AppButton';
