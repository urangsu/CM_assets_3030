import React from 'react';
import { AppBadge } from '../ui/AppBadge';

export type OverrunStatus = '정상' | '초과' | '무예산 집행' | '미달' | string;

interface OverrunBadgeProps {
  status: OverrunStatus;
  className?: string;
}

export function OverrunBadge({ status, className }: OverrunBadgeProps) {
  const config = {
    '정상': { variant: 'primary' as const },
    '초과': { variant: 'danger' as const },
    '무예산 집행': { variant: 'warning' as const },
    '미달': { variant: 'success' as const },
  };

  const { variant } = config[status] || { variant: 'default' };

  return <AppBadge variant={variant} className={className}>{status}</AppBadge>;
}
