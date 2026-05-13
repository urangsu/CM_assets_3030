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
}

export function MetricCard({ title, value, description, icon: Icon, variant = 'default', className, onClick }: MetricCardProps) {
  return (
    <AppCard 
      variant={onClick ? 'interactive' : variant} 
      className={cn("p-6 flex flex-col justify-between items-start w-full relative overflow-hidden", className)}
      onClick={onClick}
    >
      <div className="flex items-center justify-between w-full mb-4 z-10">
        <h3 className="text-sm font-medium text-lithium-600">{title}</h3>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-lithium-50 flex items-center justify-center">
            <Icon className="w-5 h-5 text-lithium-500" />
          </div>
        )}
      </div>
      <div className="z-10 w-full">
        <div className="text-2xl sm:text-3xl font-black text-eco-black tabular-nums tracking-tight mb-1">
          {value}
        </div>
        {description && (
          <div className="text-xs text-lithium-500">
            {description}
          </div>
        )}
      </div>
      {/* Decorative element could go here if needed */}
    </AppCard>
  );
}
