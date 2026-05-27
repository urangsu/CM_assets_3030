import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

export interface AppSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  leftIcon?: React.ReactNode;
}

export const AppSelect = React.forwardRef<HTMLSelectElement, AppSelectProps>(
  ({ className, leftIcon, children, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-lithium-500">
            {leftIcon}
          </div>
        )}
        <select
          ref={ref}
          className={cn(
            'flex h-9 w-full appearance-none rounded-lg border border-lithium-300 bg-white px-2.5 py-1.5 pr-8 text-[13px] font-medium text-eco-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nickel-500 disabled:cursor-not-allowed disabled:bg-lithium-50 disabled:text-lithium-500 transition-shadow',
            leftIcon && 'pl-9',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-3 flex items-center pointer-events-none text-lithium-500">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    );
  }
);
AppSelect.displayName = 'AppSelect';
