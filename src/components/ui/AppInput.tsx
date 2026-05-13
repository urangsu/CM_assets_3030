import React from 'react';
import { cn } from '../../lib/utils';

export interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>(
  ({ className, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-lithium-500">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-xl border border-lithium-300 bg-white px-3 py-2 text-sm text-eco-black placeholder:text-lithium-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nickel-500 disabled:cursor-not-allowed disabled:bg-lithium-50 disabled:text-lithium-500 transition-shadow',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 flex items-center text-lithium-500">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);
AppInput.displayName = 'AppInput';
