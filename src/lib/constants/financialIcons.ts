/**
 * 재무 데이터 아이템별 기본 아이콘 & 색상 매핑
 * 각 카테고리/타입 조합에 대한 기본 아이콘과 색상을 정의
 * DB의 icon/color 필드가 null이면 이 기본값 사용
 */
import {
  Briefcase, Building2, Key, Landmark, TrendingUp, Zap, Coins,
  ShoppingCart, Home, GraduationCap, Shield, Heart, Car, Percent,
  Banknote, Users, Plane, Gem, Receipt,
  Wallet, PiggyBank, Lock, BarChart3, Globe, PieChart, FileText, Layers,
  CreditCard, MapPin, Palette, Package, Clock, Baby, Activity,
  type LucideIcon,
} from 'lucide-react'

// ============================================
// 아이콘 ID → 컴포넌트 매핑 (커스텀 아이콘용)
// ============================================

export const FINANCIAL_ICON_MAP: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  building2: Building2,
  key: Key,
  landmark: Landmark,
  'trending-up': TrendingUp,
  zap: Zap,
  coins: Coins,
  'shopping-cart': ShoppingCart,
  home: Home,
  'graduation-cap': GraduationCap,
  shield: Shield,
  heart: Heart,
  car: Car,
  percent: Percent,
  banknote: Banknote,
  users: Users,
  plane: Plane,
  gem: Gem,
  receipt: Receipt,
  wallet: Wallet,
  'piggy-bank': PiggyBank,
  lock: Lock,
  'bar-chart': BarChart3,
  globe: Globe,
  'pie-chart': PieChart,
  'file-text': FileText,
  layers: Layers,
  'credit-card': CreditCard,
  'map-pin': MapPin,
  palette: Palette,
  package: Package,
  clock: Clock,
  baby: Baby,
  activity: Activity,
}

export function getFinancialIconById(iconId: string): LucideIcon {
  return FINANCIAL_ICON_MAP[iconId] || Coins
}

// ============================================
// 카테고리별 기본 색상
// ============================================

const CATEGORY_COLORS: Record<string, string> = {
  income: '#10b981',         // emerald
  expense: '#f43f5e',        // rose
  savings: '#3b82f6',        // blue
  debt: '#f59e0b',           // amber
  realEstate: '#14b8a6',     // teal
  physicalAsset: '#8b5cf6',  // purple
  nationalPension: '#6366f1', // indigo
  retirementPension: '#6366f1',
  personalPension: '#6366f1',
  insurance: '#ec4899',      // pink
}

// ============================================
// 타입별 기본 아이콘 매핑
// ============================================

const TYPE_ICONS: Record<string, Record<string, LucideIcon>> = {
  income: {
    labor: Briefcase,
    business: Building2,
    rental: Key,
    pension: Landmark,
    dividend: TrendingUp,
    side: Zap,
    other: Coins,
  },
  expense: {
    living: ShoppingCart,
    housing: Home,
    education: GraduationCap,
    insurance: Shield,
    medical: Activity,
    transport: Car,
    interest: Percent,
    principal: Banknote,
    child: Baby,
    parents: Users,
    travel: Plane,
    wedding: Gem,
    other: Receipt,
  },
  savings: {
    checking: Wallet,
    savings: PiggyBank,
    deposit: Lock,
    housing: Home,
    domestic_stock: BarChart3,
    foreign_stock: Globe,
    fund: PieChart,
    bond: FileText,
    crypto: Coins,
    other: Layers,
  },
  debt: {
    mortgage: Home,
    jeonse: Key,
    credit: CreditCard,
    car: Car,
    student: GraduationCap,
    card: CreditCard,
    other: Banknote,
  },
  realEstate: {
    residence: Home,
    investment: Building2,
    rental: Key,
    land: MapPin,
  },
  physicalAsset: {
    car: Car,
    precious_metal: Gem,
    art: Palette,
    other: Package,
  },
  nationalPension: {
    national: Landmark,
    government: Shield,
    military: Shield,
    private_school: GraduationCap,
  },
  retirementPension: {
    db: Building2,
    dc: BarChart3,
    corporate_irp: Briefcase,
    severance: Banknote,
  },
  personalPension: {
    pension_savings: PiggyBank,
    irp: Briefcase,
    isa: Shield,
  },
  insurance: {
    life: Heart,
    term: Clock,
    health: Activity,
    savings: PiggyBank,
    car: Car,
    pension: Landmark,
    other: Shield,
  },
}

// 카테고리 폴백 아이콘
const CATEGORY_FALLBACK_ICONS: Record<string, LucideIcon> = {
  income: Coins,
  expense: Receipt,
  savings: Wallet,
  debt: Banknote,
  realEstate: Home,
  physicalAsset: Package,
  nationalPension: Landmark,
  retirementPension: Landmark,
  personalPension: PiggyBank,
  insurance: Shield,
}

// ============================================
// 피커용 아이콘 프리셋 (선택 가능한 아이콘 목록)
// ============================================

export const FINANCIAL_ICON_PRESETS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'briefcase', icon: Briefcase, label: '업무' },
  { id: 'building2', icon: Building2, label: '건물' },
  { id: 'home', icon: Home, label: '집' },
  { id: 'key', icon: Key, label: '열쇠' },
  { id: 'wallet', icon: Wallet, label: '지갑' },
  { id: 'piggy-bank', icon: PiggyBank, label: '저금' },
  { id: 'coins', icon: Coins, label: '동전' },
  { id: 'banknote', icon: Banknote, label: '지폐' },
  { id: 'credit-card', icon: CreditCard, label: '카드' },
  { id: 'trending-up', icon: TrendingUp, label: '상승' },
  { id: 'bar-chart', icon: BarChart3, label: '차트' },
  { id: 'pie-chart', icon: PieChart, label: '파이' },
  { id: 'globe', icon: Globe, label: '글로벌' },
  { id: 'landmark', icon: Landmark, label: '관공서' },
  { id: 'shield', icon: Shield, label: '보호' },
  { id: 'heart', icon: Heart, label: '건강' },
  { id: 'activity', icon: Activity, label: '활동' },
  { id: 'graduation-cap', icon: GraduationCap, label: '교육' },
  { id: 'baby', icon: Baby, label: '자녀' },
  { id: 'users', icon: Users, label: '가족' },
  { id: 'car', icon: Car, label: '자동차' },
  { id: 'plane', icon: Plane, label: '여행' },
  { id: 'shopping-cart', icon: ShoppingCart, label: '쇼핑' },
  { id: 'receipt', icon: Receipt, label: '영수증' },
  { id: 'gem', icon: Gem, label: '보석' },
  { id: 'palette', icon: Palette, label: '예술' },
  { id: 'lock', icon: Lock, label: '보안' },
  { id: 'clock', icon: Clock, label: '시간' },
  { id: 'zap', icon: Zap, label: '번개' },
  { id: 'layers', icon: Layers, label: '기타' },
]

// 피커용 색상 프리셋
export const FINANCIAL_COLOR_PRESETS: { id: string; color: string }[] = [
  { id: 'emerald', color: '#10b981' },
  { id: 'blue', color: '#3b82f6' },
  { id: 'indigo', color: '#6366f1' },
  { id: 'purple', color: '#8b5cf6' },
  { id: 'pink', color: '#ec4899' },
  { id: 'rose', color: '#f43f5e' },
  { id: 'amber', color: '#f59e0b' },
  { id: 'orange', color: '#f97316' },
  { id: 'teal', color: '#14b8a6' },
  { id: 'slate', color: '#64748b' },
]

// ============================================
// 유틸리티 함수
// ============================================

export function getFinancialIcon(category: string, type: string): LucideIcon {
  return TYPE_ICONS[category]?.[type] || CATEGORY_FALLBACK_ICONS[category] || Coins
}

export function getFinancialColor(category: string): string {
  return CATEGORY_COLORS[category] || '#64748b'
}

// 아이콘 ID로 기본 아이콘인지 확인 (기본값이면 null 반환해서 DB에 저장하지 않음)
export function getDefaultIconId(category: string, type: string): string | null {
  const icon = TYPE_ICONS[category]?.[type]
  if (!icon) return null
  const entry = Object.entries(FINANCIAL_ICON_MAP).find(([, v]) => v === icon)
  return entry?.[0] || null
}
