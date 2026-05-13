import React from 'react';
import { cn } from '../../lib/utils';

export interface ExportButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function ExportButtonGroup({ children, className, ...props }: ExportButtonGroupProps) {
  return (
    <div className={cn("flex items-center gap-1.5 p-1 bg-lithium-100 rounded-2xl w-full sm:w-auto overflow-x-auto", className)} {...props}>
      {children}
    </div>
  );
}
