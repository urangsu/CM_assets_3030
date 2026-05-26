export function formatMillionWon(value: number, digits = 0): string {
  const n = Number(value) || 0;
  const million = n / 1_000_000;

  return `${million.toLocaleString('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })}백만원`;
}

export function formatWon(value: number): string {
  const n = Number(value) || 0;
  return `${n.toLocaleString('ko-KR')}원`;
}

export function formatMillionWonWithFull(value: number): string {
  return `${formatMillionWon(value)} (${formatWon(value)})`;
}
