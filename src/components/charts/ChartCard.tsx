import React from 'react';
import { AppCard } from '../ui/AppCard';
import { cn } from '../../lib/utils';
import { EmptyState } from '../ui/EmptyState';
import { BarChart3 } from 'lucide-react';

interface ChartCardProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  contentClassName?: string;
}

export function ChartCard({ 
  title, 
  description, 
  actions, 
  children, 
  isEmpty = false, 
  emptyMessage = "차트를 표시할 데이터가 없습니다.",
  className,
  contentClassName 
}: ChartCardProps) {
  return (
    <AppCard className={cn("flex flex-col w-full min-w-0", className)}>
      <div className="px-6 py-5 border-b border-lithium-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-eco-black">{title}</h3>
          {description && <p className="text-sm text-lithium-500 mt-1">{description}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      <div className={cn("p-6 w-full min-w-0 h-[320px] min-h-[320px]", contentClassName)}>
        {isEmpty ? (
          <EmptyState icon={BarChart3} title="데이터 없음" description={emptyMessage} />
        ) : (
          children
        )}
      </div>
    </AppCard>
  );
}
