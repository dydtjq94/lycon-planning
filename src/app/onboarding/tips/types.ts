// 제안 그룹 타입
export interface SuggestionGroup {
  label: string
  items: string[]
}

// 동적 팁 타입
export interface DynamicTip {
  title: string
  description: string
  stat?: string
  statLabel?: string
  insight?: string
  guides?: string[]
  suggestions?: string[]
  suggestionGroups?: SuggestionGroup[]
}
