/**
 * 생애 주기 마일스톤 아이콘 & 색상 상수
 * 차트 annotation, 타임라인 마커 등에서 재사용
 */
import {
  Landmark, Briefcase, Sunset, Flag, Coffee,
  Heart, Clock, Hourglass, CalendarCheck, Sparkles,
  CircleAlert,
  type LucideIcon,
} from 'lucide-react'

// 아이콘 프리셋
export const LIFECYCLE_ICONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'landmark', icon: Landmark, label: '은퇴' },
  { id: 'briefcase', icon: Briefcase, label: '커리어' },
  { id: 'sunset', icon: Sunset, label: '석양' },
  { id: 'flag', icon: Flag, label: '목표' },
  { id: 'coffee', icon: Coffee, label: '여유' },
  { id: 'heart', icon: Heart, label: '건강' },
  { id: 'clock', icon: Clock, label: '시간' },
  { id: 'hourglass', icon: Hourglass, label: '수명' },
  { id: 'calendar-check', icon: CalendarCheck, label: '계획' },
  { id: 'sparkles', icon: Sparkles, label: '특별' },
  { id: 'circle-alert', icon: CircleAlert, label: '경고' },
]

// 색상 프리셋
export const LIFECYCLE_COLORS: { id: string; color: string }[] = [
  { id: 'amber', color: '#f59e0b' },
  { id: 'purple', color: '#8b5cf6' },
  { id: 'rose', color: '#f43f5e' },
  { id: 'blue', color: '#3b82f6' },
  { id: 'teal', color: '#14b8a6' },
  { id: 'orange', color: '#f97316' },
  { id: 'emerald', color: '#10b981' },
  { id: 'pink', color: '#ec4899' },
  { id: 'indigo', color: '#6366f1' },
  { id: 'slate', color: '#64748b' },
]

// 기본값
export const LIFECYCLE_DEFAULTS = {
  retirement: {
    icon: 'sparkles',
    color: '#6366f1',
    label: '은퇴',
  },
  lifeExpectancy: {
    icon: 'hourglass',
    color: '#3b82f6',
    label: '기대 수명',
  },
  spouseRetirement: {
    icon: 'sparkles',
    color: '#ec4899',
    label: '배우자 은퇴',
  },
  spouseLifeExpectancy: {
    icon: 'hourglass',
    color: '#f43f5e',
    label: '배우자 기대 수명',
  },
} as const

// 아이콘 ID → 컴포넌트 조회
export function getLifecycleIcon(iconId?: string): LucideIcon {
  const found = LIFECYCLE_ICONS.find(i => i.id === iconId)
  return found?.icon || Landmark
}

export type LifeCycleMilestoneType = 'retirement' | 'lifeExpectancy'

// 아이콘 ID → 인라인 SVG HTML (툴팁 등 HTML 문자열에서 사용)
const ICON_SVG_PATHS: Record<string, string> = {
  landmark: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
  sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  sunset: '<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  heart: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  clock: '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  'calendar-check': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  'circle-alert': '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
}

export function getLifecycleIconSvg(iconId: string, color: string, size: number = 12): string {
  const paths = ICON_SVG_PATHS[iconId] || ICON_SVG_PATHS.landmark
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
}
