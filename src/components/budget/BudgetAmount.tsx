import React from 'react';
import { cn } from '../../lib/utils';

interface BudgetAmountProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  unit?: string;
  tone?: 'default' | 'danger' | 'warning' | 'success';
  className?: string;
  displayUnit?: 'won' | 'million';
  showTooltip?: boolean;
}

export function BudgetAmount({ 
  value, 
  unit = '원', 
  tone = 'default', 
  className, 
  displayUnit = 'won',
  showTooltip = false,
  ...props 
}: BudgetAmountProps) {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  const displayValue =
    displayUnit === 'million'
      ? Math.round(absValue / 1_000_000).toLocaleString('ko-KR')
      : absValue.toLocaleString('ko-KR');

  const displayUnitText = displayUnit === 'million' ? '백만원' : unit;
  
  const tones = {
    default: isNegative ? 'text-red-500' : 'text-eco-black',
    danger: 'text-red-500',
    warning: 'text-cobalt-600',
    success: 'text-nickel-600',
  };

  return (
    <span 
      className={cn("tabular-nums inline-flex items-baseline whitespace-nowrap", tones[tone], className)} 
      title={showTooltip ? `${value.toLocaleString('ko-KR')}원` : undefined}
      {...props}
    >
      {isNegative && tone === 'default' ? '(' : (isNegative ? '-' : '')}
      {displayValue}
      {displayUnitText && <span className="ml-1 text-[0.75em] text-lithium-500">{displayUnitText}</span>}
      {isNegative && tone === 'default' ? ')' : ''}
    </span>
  );
}
