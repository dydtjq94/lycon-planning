/**
 * YYYYMM period input utilities
 * Shared across all dashboard tabs for consistent date input UX
 */

/** "202601" → "2026.01" */
export function formatPeriodDisplay(raw: string): string {
  if (raw.length > 4) return raw.slice(0, 4) + '.' + raw.slice(4);
  return raw;
}

/** (2026, 1) → "202601" */
export function toPeriodRaw(year: number, month: number): string {
  return `${year}${String(month).padStart(2, '0')}`;
}

/** 6자리 + 월 1~12 검증 */
export function isPeriodValid(raw: string): boolean {
  if (raw.length !== 6) return false;
  const m = parseInt(raw.slice(4));
  return m >= 1 && m <= 12;
}

/** 포맷 변환 시 커서 위치 보존 */
export function restorePeriodCursor(input: HTMLInputElement, raw: string): void {
  const cursorPos = input.selectionStart || 0;
  const digitsBefore = input.value.slice(0, cursorPos).replace(/\D/g, '').length;
  const formatted = formatPeriodDisplay(raw);
  let newCursor = 0;
  let counted = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (counted === digitsBefore) break;
    if (formatted[i] !== '.') counted++;
    newCursor = i + 1;
  }
  requestAnimationFrame(() => {
    if (input === document.activeElement) {
      input.setSelectionRange(newCursor, newCursor);
    }
  });
}

/** onChange handler: strip non-digits, cap at 6, update text + year + month states */
export function handlePeriodTextChange(
  e: React.ChangeEvent<HTMLInputElement>,
  setText: (t: string) => void,
  setYear: (y: number) => void,
  setMonth: (m: number) => void,
): void {
  const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
  restorePeriodCursor(e.target, raw);
  setText(raw);
  if (raw.length >= 4) {
    const y = parseInt(raw.slice(0, 4));
    if (!isNaN(y)) setYear(y);
  }
  if (raw.length >= 5) {
    const m = parseInt(raw.slice(4));
    if (!isNaN(m) && m >= 1 && m <= 12) setMonth(m);
  }
}
