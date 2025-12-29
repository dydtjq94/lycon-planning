/**
 * 나이 계산 유틸리티 (만 나이 기준)
 * 만 나이: 출생년도 기준으로 현재 년도 - 출생년도
 * 예: 1994년생이 55살에 은퇴하면 은퇴 년도는 2049년
 */

/**
 * 출생년도로부터 만 나이 계산
 * @param {number} birthYear - 출생년도
 * @param {number} currentYear - 현재 년도 (기본값: 2025)
 * @returns {number} 만 나이
 */
export function calculateKoreanAge(birthYear, currentYear = 2025) {
  return currentYear - birthYear;
}

/**
 * 만 나이로부터 출생년도 계산
 * @param {number} age - 만 나이
 * @param {number} currentYear - 현재 년도 (기본값: 2025)
 * @returns {number} 출생년도
 */
export function calculateBirthYearFromKoreanAge(age, currentYear = 2025) {
  return currentYear - age;
}

/**
 * 특정 년도의 만 나이 계산
 * @param {number} birthYear - 출생년도
 * @param {number} targetYear - 대상 년도
 * @returns {number} 해당 년도의 만 나이
 */
export function getKoreanAgeInYear(birthYear, targetYear) {
  return targetYear - birthYear;
}

/**
 * 가구 구성원의 만 나이 계산
 * @param {Array} familyMembers - 가구 구성원 배열 [{name, birthYear}, ...]
 * @param {number} currentYear - 현재 년도 (기본값: 2025)
 * @returns {Array} 나이 정보가 포함된 가구 구성원 배열
 */
export function calculateFamilyAges(familyMembers, currentYear = 2025) {
  return familyMembers.map((member) => ({
    ...member,
    koreanAge: calculateKoreanAge(member.birthYear, currentYear),
  }));
}
