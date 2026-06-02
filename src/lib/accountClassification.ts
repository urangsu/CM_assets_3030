export type AccountingType = '전체' | '제조' | '판관' | '투자' | '기타';

export const ACCOUNTING_TYPE_OPTIONS: AccountingType[] = ['전체', '제조', '판관', '투자', '기타'];

export type AccountClass =
  | '전체'
  | '직원급여'
  | '임원급여'
  | '업무활동경비'
  | '협력작업'
  | '수선비'
  | '감가상각비'
  | '복리후생비'
  | '여비교통비'
  | '통신비'
  | '유틸리티비'
  | '세금과공과'
  | '지급수수료'
  | '판매비'
  | '임차·보험·차량'
  | '교육·협회'
  | '소모품·피복·도서'
  | '안전·환경'
  | '품질관리비'
  | '투자'
  | '기타';

export const ACCOUNT_CLASS_OPTIONS: AccountClass[] = [
  '전체',
  '직원급여',
  '임원급여',
  '업무활동경비',
  '협력작업',
  '수선비',
  '감가상각비',
  '복리후생비',
  '여비교통비',
  '통신비',
  '유틸리티비',
  '세금과공과',
  '지급수수료',
  '판매비',
  '임차·보험·차량',
  '교육·협회',
  '소모품·피복·도서',
  '안전·환경',
  '품질관리비',
  '투자',
  '기타',
];

function normalize(str?: string): string {
  if (!str) return '';
  return str.replace(/\s+/g, '').toLowerCase();
}

export function getAccountingType(accountCode?: string, accountName?: string): AccountingType {
  const code = String(accountCode ?? '').trim().toUpperCase();
  const name = accountName ?? '';

  if (/^\d/.test(code) || code.startsWith('A7')) return '투자';
  if (code.startsWith('A6') || name.startsWith('제조')) return '제조';
  if (code.startsWith('B') || name.startsWith('판관')) return '판관';

  if (name.includes('제조비용')) return '제조';
  if (name.includes('판관비')) return '판관';

  return '기타';
}

export function classifyAccount(accountCode?: string, accountName?: string): AccountClass {
  const code = String(accountCode ?? '').trim().toUpperCase();
  const name = normalize(accountName);

  if (/^\d/.test(code)) return '투자';

  if (
    name.includes('판매수수료') ||
    name.includes('판매촉진비') ||
    name.includes('견본비') ||
    name.includes('판매보험료') ||
    name.includes('기타판매비') ||
    name.includes('운반보관비') ||
    name.includes('광고선전비')
  ) {
    return '판매비';
  }

  // 복리후생비보다 먼저 처리
  if (
    name.includes('직원간담회지원') ||
    name.includes('부서별그룹활동지원') ||
    name.includes('회의비')
  ) {
    return '업무활동경비';
  }

  if (
    name.includes('직원급여') ||
    name.includes('직원경영성과금') ||
    name.includes('시간외수당') ||
    name.includes('연차수당') ||
    name.includes('휴일근무수당') ||
    name.includes('직책수당') ||
    name.includes('조정수당') ||
    name.includes('기타수당') ||
    name.includes('퇴직급여충당부채전입액_사내') ||
    name.includes('퇴직급여충당부채전입액사내')
  ) {
    return '직원급여';
  }

  if (
    name.includes('임원급여') ||
    name.includes('임원활동수당') ||
    name.includes('임원경영성과금') ||
    name.includes('기타보수') ||
    name.includes('퇴직급여충당부채전입액_임원') ||
    name.includes('퇴직급여충당부채전입액임원')
  ) {
    return '임원급여';
  }

  // 수선비보다 먼저 처리해서 제조비용_협력작업_수선비가 협력작업으로 남게 함
  if (
    name.includes('협력작업') ||
    name.includes('작업비변동비') ||
    name.includes('작업비고정비')
  ) {
    return '협력작업';
  }

  // 수석님 지정 수선비 범위
  const nameNoSpaceOrUnder = name.replace(/_/g, '');
  if (
    nameNoSpaceOrUnder.includes('제조비용수선비정비외주') ||
    nameNoSpaceOrUnder.includes('제조비용수선비eic') ||
    nameNoSpaceOrUnder.includes('제조비용수선비기계장치') ||
    nameNoSpaceOrUnder.includes('제조비용수선비기타') ||
    nameNoSpaceOrUnder.includes('제조비용외주용역비정비용역비')
  ) {
    return '수선비';
  }

  if (
    name.includes('품질관리비') ||
    name.includes('품질검사') ||
    name.includes('분석수수료') ||
    name.includes('시험분석')
  ) {
    return '품질관리비';
  }

  if (
    name.includes('안전관리비') ||
    name.includes('환경관리비') ||
    name.includes('산업안전') ||
    name.includes('폐기물') ||
    name.includes('대기환경') ||
    name.includes('수질환경')
  ) {
    return '안전·환경';
  }

  if (
    name.includes('감가상각비') ||
    name.includes('사용권자산감가상각비') ||
    name.includes('투자부동산감가상각비')
  ) {
    return '감가상각비';
  }

  if (
    name.includes('전력비') ||
    name.includes('용수비') ||
    name.includes('연료유지비')
  ) {
    return '유틸리티비';
  }

  if (
    name.includes('세금과공과') ||
    name.includes('재산세') ||
    name.includes('주민세') ||
    name.includes('면허세') ||
    name.includes('자동차세') ||
    name.includes('등록세') ||
    name.includes('수입인지') ||
    name.includes('사업소세')
  ) {
    return '세금과공과';
  }

  if (
    name.includes('지급수수료') ||
    name.includes('검사및측량용역') ||
    name.includes('자문용역') ||
    name.includes('전산운영용역') ||
    name.includes('전산개발용역') ||
    name.includes('소프트웨어유지보수') ||
    name.includes('금융기관수수료') ||
    name.includes('신용평가수수료') ||
    name.includes('채용수수료') ||
    name.includes('번역수수료') ||
    name.includes('제증명발급수수료') ||
    name.includes('담보설정수수료') ||
    name.includes('경영관리비')
  ) {
    return '지급수수료';
  }

  if (
    name.includes('복리후생비') ||
    name.includes('건강보험료') ||
    name.includes('산재보험료') ||
    name.includes('국민연금') ||
    name.includes('고용보험료') ||
    name.includes('직원중식비') ||
    name.includes('식대지원') ||
    name.includes('건강검진') ||
    name.includes('경조사') ||
    name.includes('복지카드') ||
    name.includes('출산장려') ||
    name.includes('동호회') ||
    name.includes('사택지원') ||
    name.includes('통근버스') ||
    name.includes('자녀교육비') ||
    name.includes('주택임차료')
  ) {
    return '복리후생비';
  }

  if (
    name.includes('여비교통비') ||
    name.includes('국내여비') ||
    name.includes('해외여비') ||
    name.includes('교육출장')
  ) {
    return '여비교통비';
  }

  if (
    name.includes('통신비') ||
    name.includes('무선전화') ||
    name.includes('전용선') ||
    name.includes('우편료') ||
    name.includes('인터넷사용료')
  ) {
    return '통신비';
  }

  if (
    name.includes('지급임차료') ||
    name.includes('보험료') ||
    name.includes('차량유지비')
  ) {
    return '임차·보험·차량';
  }

  if (
    name.includes('교육훈련비') ||
    name.includes('협회비') ||
    name.includes('포상비')
  ) {
    return '교육·협회';
  }

  if (
    name.includes('소모품비') ||
    name.includes('피복비') ||
    name.includes('도서인쇄비') ||
    name.includes('사무용품') ||
    name.includes('전산용품')
  ) {
    return '소모품·피복·도서';
  }

  return '기타';
}

export function isSalaryAccountRow(row: {
  accountCode?: string;
  accountName?: string;
  accountClass?: string;
}): boolean {
  const code = String(row.accountCode || '').trim();
  const name = String(row.accountName || '').replace(/\s+/g, '');
  const accountClass = String(row.accountClass || '');

  if (accountClass === '직원급여' || accountClass === '임원급여') return true;

  return [
    '급여',
    '임금',
    '상여',
    '성과금',
    '퇴직금',
    '퇴직급여',
    '퇴직급여충당',
    '직책수당',
    '임원활동수당',
    '기타수당',
    '시간외수당',
    '연차수당',
    '휴일근무수당',
    '조정수당',
  ].some(keyword => name.includes(keyword));
}
