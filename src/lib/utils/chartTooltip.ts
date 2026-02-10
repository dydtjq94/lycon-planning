/**
 * 차트 툴팁 유틸리티
 * - document.body에 fixed 위치로 렌더링 (clipping 방지)
 * - backdrop-filter: blur 효과
 * - 자동 위치 조정 (화면 밖 방지)
 */

const TOOLTIP_ID = 'sim-chart-tooltip'

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
    background: isDark ? 'rgba(34, 37, 41, 0.65)' : 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
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
  const el = document.getElementById(TOOLTIP_ID)
  if (el) el.remove()
}

export function positionTooltip(
  el: HTMLDivElement,
  canvas: HTMLCanvasElement,
  caretX: number,
  caretY: number
): void {
  const canvasRect = canvas.getBoundingClientRect()
  const tooltipWidth = el.offsetWidth || 240
  const tooltipHeight = el.offsetHeight || 200

  let left = canvasRect.left + caretX
  let top = canvasRect.top + caretY - tooltipHeight - 12

  // Right overflow
  if (left + tooltipWidth / 2 > window.innerWidth - 10) {
    left = window.innerWidth - tooltipWidth / 2 - 10
  }
  // Left overflow
  if (left - tooltipWidth / 2 < 10) {
    left = tooltipWidth / 2 + 10
  }
  // Top overflow -> show below cursor
  if (top < 10) {
    top = canvasRect.top + caretY + 12
  }
  // Bottom overflow
  if (top + tooltipHeight > window.innerHeight - 10) {
    top = window.innerHeight - tooltipHeight - 10
  }

  el.style.left = `${left}px`
  el.style.top = `${top}px`
  el.style.transform = 'translate(-50%, 0)'
  el.style.opacity = '1'
}

export function hideTooltip(el: HTMLDivElement): void {
  el.style.opacity = '0'
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
