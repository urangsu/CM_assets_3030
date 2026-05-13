import React from 'react';
import { AppBadge } from '../ui/AppBadge';

export type BudgetStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'LOCKED' | 'ARCHIVED';

interface BudgetStatusBadgeProps {
  status: BudgetStatus;
  className?: string;
}

export function BudgetStatusBadge({ status, className }: BudgetStatusBadgeProps) {
  const config: Record<BudgetStatus, { label: string; variant: 'default' | 'primary' | 'warning' | 'danger' | 'locked' | 'success' }> = {
    DRAFT: { label: '작성 중', variant: 'default' },
    SUBMITTED: { label: '제출 완료', variant: 'primary' },
    REVIEWING: { label: '검토 중', variant: 'warning' },
    APPROVED: { label: '승인 완료', variant: 'success' },
    REJECTED: { label: '반려됨', variant: 'danger' },
    LOCKED: { label: '마감', variant: 'locked' },
    ARCHIVED: { label: '보관됨', variant: 'default' },
  };

  const { label, variant } = config[status] || { label: status, variant: 'default' };

  return <AppBadge variant={variant} className={className}>{label}</AppBadge>;
}
