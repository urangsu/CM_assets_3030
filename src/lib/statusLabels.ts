export type ReviewStatus = 'DRAFT' | 'ACTION_REQ' | 'APPROVED' | 'REJECTED' | 'HELD';
export type BudgetApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'LOCKED';
export type ExecutionStatus = 'OVERRUN' | 'UNDERRUN' | 'UNBUDGETED' | 'NORMAL';

export function getReviewStatusLabel(status: ReviewStatus | string): string {
  switch (status) {
    case 'ACTION_REQ': return '조치 요청';
    case 'APPROVED': return '승인';
    case 'REJECTED': return '반려';
    case 'HELD': return '보류';
    case 'DRAFT': return '검토 전';
    default: return '검토 전';
  }
}

export function getApprovalStatusLabel(status: BudgetApprovalStatus | string): string {
  switch (status) {
    case 'DRAFT': return '작성중';
    case 'SUBMITTED': return '상신완료';
    case 'REVIEWING': return '검토중';
    case 'APPROVED': return '승인완료';
    case 'REJECTED': return '반려';
    case 'LOCKED': return '잠금';
    default: return '작성중';
  }
}

export function getExecutionStatusLabel(status: ExecutionStatus | string): string {
  switch (status) {
    case 'OVERRUN': return '초과';
    case 'UNDERRUN': return '미달';
    case 'UNBUDGETED': return '무예산';
    case 'NORMAL': return '정상';
    default: return '정상';
  }
}
