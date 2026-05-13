import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center", className)} {...props}>
      {Icon && (
        <div className="w-16 h-16 bg-lithium-50 rounded-2xl flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-lithium-500" />
        </div>
      )}
      <h3 className="text-lg font-bold text-eco-black mb-2">{title}</h3>
      {description && <p className="text-sm text-lithium-600 mb-6 max-w-sm">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
