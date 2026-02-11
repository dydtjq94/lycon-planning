/**
 * 차트 툴팁 유틸리티
 * - document.body에 fixed 위치로 렌더링 (clipping 방지)
 * - backdrop-filter: blur 효과
 * - 자동 위치 조정 (화면 밖 방지)
 * - lerp 기반 부드러운 마우스 추적
 */

const TOOLTIP_ID = 'sim-chart-tooltip'

// 부드러운 추적을 위한 내부 상태
let currentLeft = 0
let currentTop = 0
let targetLeft = 0
let targetTop = 0
let rafId: number | null = null
let isAnimating = false

const LERP_FACTOR = 0.15 // 0~1, 작을수록 부드럽고 느림

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function animateTooltip(el: HTMLDivElement) {
  if (!isAnimating) return

  currentLeft = lerp(currentLeft, targetLeft, LERP_FACTOR)
  currentTop = lerp(currentTop, targetTop, LERP_FACTOR)

  el.style.left = `${currentLeft}px`
  el.style.top = `${currentTop}px`

  // 충분히 가까우면 스냅
  const dx = Math.abs(currentLeft - targetLeft)
  const dy = Math.abs(currentTop - targetTop)
  if (dx < 0.5 && dy < 0.5) {
    el.style.left = `${targetLeft}px`
    el.style.top = `${targetTop}px`
    currentLeft = targetLeft
    currentTop = targetTop
    isAnimating = false
    rafId = null
    return
  }

  rafId = requestAnimationFrame(() => animateTooltip(el))
}

export function getOrCreateTooltip(isDark: boolean): HTMLDivElement {
  let el = document.getElementById(TOOLTIP_ID) as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = TOOLTIP_ID
    document.body.appendChild(el)
  }

  Object.assign(el.style, {
    position: 'fixed',
    pointerEvents: 'none',
    background: isDark ? 'rgba(34, 37, 41, 0.5)' : 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    borderRadius: '14px',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)'}`,
    boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.5)' : '0 8px 32px rgba(0, 0, 0, 0.12)',
    padding: '16px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    whiteSpace: 'nowrap',
    zIndex: '10000',
    minWidth: '240px',
    transition: 'opacity 0.15s ease',
  })

  return el
}

export function removeTooltip(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  isAnimating = false
  const el = document.getElementById(TOOLTIP_ID)
  if (el) el.remove()
}

export function positionTooltip(
  el: HTMLDivElement,
  _canvas: HTMLCanvasElement,
  screenX: number,
  screenY: number
): void {
  const tooltipWidth = el.offsetWidth || 240
  const tooltipHeight = el.offsetHeight || 200

  // 마우스 커서 오른쪽 위에 배치
  let left = screenX + 16
  let top = screenY - tooltipHeight - 8

  // Right overflow -> 커서 왼쪽으로
  if (left + tooltipWidth > window.innerWidth - 10) {
    left = screenX - tooltipWidth - 16
  }
  // Left overflow
  if (left < 10) {
    left = 10
  }
  // Top overflow -> 커서 아래로
  if (top < 10) {
    top = screenY + 20
  }
  // Bottom overflow
  if (top + tooltipHeight > window.innerHeight - 10) {
    top = window.innerHeight - tooltipHeight - 10
  }

  // 타겟 위치 업데이트
  targetLeft = left
  targetTop = top

  // 첫 등장이면 즉시 이동 (점프 방지)
  if (el.style.opacity === '0' || el.style.opacity === '') {
    currentLeft = left
    currentTop = top
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }

  el.style.transform = 'none'
  el.style.opacity = '1'

  // 애니메이션 루프 시작
  if (!isAnimating) {
    isAnimating = true
    rafId = requestAnimationFrame(() => animateTooltip(el))
  }
}

export function hideTooltip(el: HTMLDivElement): void {
  el.style.opacity = '0'
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  isAnimating = false
}

export function formatMoneyWithUnit(amount: number): string {
  const absAmount = Math.abs(amount)
  if (absAmount >= 10000) {
    const uk = Math.floor(absAmount / 10000)
    const man = Math.round(absAmount % 10000)
    if (man === 0) return `${uk}억원`
    return `${uk}억 ${man.toLocaleString()}만원`
  }
  return `${absAmount.toLocaleString()}만원`
}

export function getAgeText(
  year: number,
  birthYear?: number,
  spouseBirthYear?: number | null
): string {
  if (!birthYear) return ''
  const selfAge = year - birthYear
  if (spouseBirthYear) {
    const spouseAge = year - spouseBirthYear
    return `본인 ${selfAge}세 \u00B7 배우자 ${spouseAge}세`
  }
  return `${selfAge}세`
}
