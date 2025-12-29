/**
 * 금액 포맷팅 유틸리티
 * 만원 단위 기준으로 포맷팅
 */

/**
 * 금액을 만원 단위로 포맷팅
 * @param {number} amount - 금액 (만원 단위)
 * @returns {string} 포맷팅된 금액 문자열
 */
export function formatAmount(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "0만원";
  }

  const numAmount = Number(amount);

  if (numAmount >= 10000) {
    const eok = Math.floor(numAmount / 10000);
    const remainder = numAmount % 10000;

    if (remainder === 0) {
      return `${eok}억원`;
    } else {
      return `${eok}억 ${remainder.toLocaleString()}만원`;
    }
  }

  return `${numAmount.toLocaleString()}만원`;
}

/**
 * 금액을 숫자로 변환 (만원 단위)
 * @param {string} amountStr - 금액 문자열
 * @returns {number} 숫자 금액
 */
export function parseAmount(amountStr) {
  if (!amountStr || typeof amountStr !== "string") {
    return 0;
  }

  // 숫자만 추출
  const numbers = amountStr.replace(/[^\d]/g, "");
  return numbers ? parseInt(numbers) : 0;
}

/**
 * 큰 금액을 간단하게 표시 (예: 1.2억, 5천만)
 * @param {number} amount - 금액 (만원 단위)
 * @returns {string} 간단한 금액 표시
 */
export function formatAmountShort(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "0만원";
  }

  const numAmount = Number(amount);

  if (numAmount >= 10000) {
    const eok = Math.floor(numAmount / 10000);
    const man = numAmount % 10000;
    
    if (man > 0) {
      return `${eok}억 ${man.toLocaleString()}만원`;
    } else {
      return `${eok}억원`;
    }
  }

  if (numAmount >= 1000) {
    const cheon = Math.floor(numAmount / 1000);
    return `${cheon.toLocaleString()}천만원`;
  }

  return `${numAmount.toLocaleString()}만원`;
}

/**
 * 차트용 금액 포맷팅 (축 레이블용)
 * @param {number} amount - 금액 (만원 단위)
 * @returns {string} 차트용 금액 표시
 */
export function formatAmountForChart(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "0";
  }

  const numAmount = Math.floor(Number(amount)); // 소수점 버림
  const isNegative = numAmount < 0;
  const absAmount = Math.abs(numAmount);

  if (absAmount >= 10000) {
    const eok = Math.floor(absAmount / 10000);
    const man = absAmount % 10000;
    
    if (man > 0) {
      return `${isNegative ? '-' : ''}${eok}억 ${man.toLocaleString()}만원`;
    } else {
      return `${isNegative ? '-' : ''}${eok}억원`;
    }
  }

  // 천만원 미만은 그냥 원래 금액을 천 단위 구분해서 표시
  return `${numAmount.toLocaleString()}만원`;
}
