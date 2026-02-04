/**
 * 금액 단위 변환 유틸리티
 *
 * DB 저장: 원 단위
 * 클라이언트: 만원 단위
 *
 * 조회 시: 원 -> 만원 (convertFromWon)
 * 저장 시: 만원 -> 원 (convertToWon)
 */

import { wonToManwon, manwonToWon } from '@/lib/utils'

/**
 * 객체의 특정 필드들을 원 -> 만원 변환 (DB 조회 시)
 */
export function convertFromWon<T>(
  data: T,
  fields: readonly string[]
): T {
  const result = { ...data } as Record<string, unknown>
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'number' && value !== 0) {
      result[field] = wonToManwon(value)
    }
  }
  return result as T
}

/**
 * 객체의 특정 필드들을 만원 -> 원 변환 (DB 저장 시)
 */
export function convertToWon<T>(
  data: T,
  fields: readonly string[]
): T {
  const result = { ...data } as Record<string, unknown>
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'number' && value !== 0) {
      result[field] = manwonToWon(value)
    }
  }
  return result as T
}

/**
 * 배열의 각 항목에 대해 원 -> 만원 변환 (DB 조회 시)
 */
export function convertArrayFromWon<T>(
  data: T[],
  fields: readonly string[]
): T[] {
  return data.map(item => convertFromWon(item, fields))
}

/**
 * Partial 객체의 필드들을 만원 -> 원 변환 (업데이트 시)
 */
export function convertPartialToWon<T>(
  data: Partial<T>,
  fields: readonly string[]
): Partial<T> {
  const result = { ...data } as Record<string, unknown>
  for (const field of fields) {
    if (field in result) {
      const value = result[field]
      if (typeof value === 'number' && value !== 0) {
        result[field] = manwonToWon(value)
      }
    }
  }
  return result as Partial<T>
}
