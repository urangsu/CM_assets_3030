import React from 'react';
import { cn } from '../../lib/utils';

interface BudgetRateProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | null | undefined;
  decimals?: number;
  highlightOverrun?: boolean;
  className?: string;
}

export function BudgetRate({ value, decimals = 1, highlightOverrun = true, className, ...props }: BudgetRateProps) {
  if (value === null || value === undefined || isNaN(value)) {
    return <span className={cn("text-lithium-500", className)}>예산 없음</span>;
  }

  const isOverrun = value > 100;
  
  return (
    <span 
      className={cn(
        "tabular-nums font-semibold",
        isOverrun && highlightOverrun ? "text-cobalt-600" : "text-eco-black",
        className
      )}
      {...props}
    >
      {value.toFixed(decimals)}%
    </span>
  );
}
