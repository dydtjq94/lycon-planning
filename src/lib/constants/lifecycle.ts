/**
 * 생애 주기 마일스톤 아이콘 & 색상 상수
 * 차트 annotation, 타임라인 마커 등에서 재사용
 */
import {
  Landmark, Briefcase, Sunset, Flag, Coffee,
  Heart, Clock, Hourglass, CalendarCheck, Sparkles,
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
    icon: 'landmark',
    color: '#f59e0b',
    label: '은퇴',
  },
  lifeExpectancy: {
    icon: 'hourglass',
    color: '#8b5cf6',
    label: '기대 수명',
  },
  spouseRetirement: {
    icon: 'landmark',
    color: '#f97316',
    label: '배우자 은퇴',
  },
  spouseLifeExpectancy: {
    icon: 'hourglass',
    color: '#6366f1',
    label: '배우자 기대 수명',
  },
} as const

// 아이콘 ID → 컴포넌트 조회
export function getLifecycleIcon(iconId?: string): LucideIcon {
  const found = LIFECYCLE_ICONS.find(i => i.id === iconId)
  return found?.icon || Landmark
}

export type LifeCycleMilestoneType = 'retirement' | 'lifeExpectancy'
