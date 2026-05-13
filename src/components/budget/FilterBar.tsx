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
    <AppCard className={cn("p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6", className)} {...props}>
      <div className="flex flex-wrap gap-4 w-full md:w-auto flex-1">
        {children}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 w-full md:w-auto shrink-0">
          {actions}
        </div>
      )}
    </AppCard>
  );
}

export function FilterItem({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[120px]">
      <label className="text-xs font-bold text-lithium-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
