import React from 'react';
import { AppCard } from '../ui/AppCard';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  variant?: 'default' | 'muted' | 'interactive' | 'warning' | 'danger' | 'success';
  className?: string;
  onClick?: () => void;
  size?: 'default' | 'compact';
}

export function MetricCard({ title, value, description, icon: Icon, variant = 'default', className, onClick, size = 'default' }: MetricCardProps) {
  return (
    <AppCard 
      variant={onClick ? 'interactive' : variant} 
      className={cn(
        size === 'compact' ? "p-4 min-w-0" : "p-6",
        "flex flex-col justify-between items-start w-full relative overflow-hidden",
        className
      )}
      onClick={onClick}
    >
      <div className={cn("flex items-center justify-between w-full z-10 min-w-0", size === 'compact' ? "mb-2" : "mb-4")}>
        <h3 className={cn("font-medium text-lithium-600 truncate", size === 'compact' ? "text-[12px]" : "text-sm")}>{title}</h3>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-lithium-50 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-lithium-500" />
          </div>
        )}
      </div>
      <div className="z-10 w-full min-w-0">
        <div className={cn(
          "font-black text-eco-black tabular-nums tracking-tight mb-1 whitespace-nowrap overflow-hidden text-ellipsis",
          size === 'compact' ? "text-lg xl:text-xl" : "text-2xl sm:text-3xl"
        )}>
          {value}
        </div>
        {description && (
          <div className="text-xs text-lithium-500">
            {description}
          </div>
        )}
      </div>
    </AppCard>
  );
}
