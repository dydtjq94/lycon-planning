/**
 * 가족 구성원 아이콘 & 색상 상수
 */
import {
  User, UserRound, Baby, Heart, Shield,
  Crown, Star, Flower2, Smile, Users,
  type LucideIcon,
} from 'lucide-react'

// 아이콘 프리셋
export const FAMILY_ICONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'user', icon: User, label: '사람' },
  { id: 'user-round', icon: UserRound, label: '사람(둥근)' },
  { id: 'baby', icon: Baby, label: '아기' },
  { id: 'heart', icon: Heart, label: '하트' },
  { id: 'shield', icon: Shield, label: '보호' },
  { id: 'crown', icon: Crown, label: '왕관' },
  { id: 'star', icon: Star, label: '별' },
  { id: 'flower', icon: Flower2, label: '꽃' },
  { id: 'smile', icon: Smile, label: '웃음' },
  { id: 'users', icon: Users, label: '가족' },
]

// 색상 프리셋 (lifecycle과 동일)
export const FAMILY_COLORS: { id: string; color: string }[] = [
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

// 관계별 기본값
export const FAMILY_DEFAULTS: Record<string, { icon: string; color: string }> = {
  self: { icon: 'user', color: '#3b82f6' },
  spouse: { icon: 'heart', color: '#f43f5e' },
  child: { icon: 'baby', color: '#14b8a6' },
  child_male: { icon: 'baby', color: '#14b8a6' },
  child_female: { icon: 'baby', color: '#ec4899' },
  parent: { icon: 'shield', color: '#f59e0b' },
}

// 아이콘 ID → 컴포넌트 조회
export function getFamilyIcon(iconId?: string): LucideIcon {
  const found = FAMILY_ICONS.find(i => i.id === iconId)
  return found?.icon || User
}
