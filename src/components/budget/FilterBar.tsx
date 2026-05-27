import React from 'react';
import { cn } from '../../lib/utils';
import { AppCard } from '../ui/AppCard';

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, actions, className, ...props }: FilterBarProps) {
  return (
    <AppCard
      className={cn(
        "p-4 mb-5 flex flex-col gap-4",
        className
      )}
      {...props}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 w-full">
        {children}
      </div>

      {actions && (
        <div className="flex justify-end gap-2 w-full border-t border-lithium-100 pt-3">
          {actions}
        </div>
      )}
    </AppCard>
  );
}

export function FilterItem({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[11px] font-bold text-lithium-500 tracking-tight truncate">
        {label}
      </label>
      {children}
    </div>
  );
}
