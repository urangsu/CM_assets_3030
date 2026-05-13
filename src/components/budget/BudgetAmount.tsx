import React from 'react';
import { cn } from '../../lib/utils';

interface BudgetAmountProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  unit?: string;
  tone?: 'default' | 'danger' | 'warning' | 'success';
  className?: string;
}

export function BudgetAmount({ value, unit = '원', tone = 'default', className, ...props }: BudgetAmountProps) {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  const tones = {
    default: isNegative ? 'text-red-500' : 'text-eco-black',
    danger: 'text-red-500',
    warning: 'text-cobalt-600',
    success: 'text-nickel-600',
  };

  return (
    <span 
      className={cn("tabular-nums inline-flex items-baseline", tones[tone], className)} 
      {...props}
    >
      {isNegative && tone === 'default' ? '(' : (isNegative ? '-' : '')}
      {absValue.toLocaleString()}
      {unit && <span className="ml-1 text-[0.8em] text-lithium-500">{unit}</span>}
      {isNegative && tone === 'default' ? ')' : ''}
    </span>
  );
}
