# Lycon 프로젝트 구조 문서

> 이 문서는 Lycon 프로젝트의 전체 구조를 정의합니다.
> 랜딩 페이지, 온보딩, 대시보드의 모든 기능과 데이터 흐름을 포함합니다.

---

## 목차

1. [전체 아키텍처](#1-전체-아키텍처)
2. [기술 스택](#2-기술-스택)
3. [데이터 타입 정의](#3-데이터-타입-정의)
4. [랜딩 페이지](#4-랜딩-페이지)
5. [인증 (Auth)](#5-인증-auth)
6. [온보딩](#6-온보딩)
7. [대시보드](#7-대시보드)
8. [데이터 흐름 및 연동](#8-데이터-흐름-및-연동)
9. [시뮬레이션 엔진](#9-시뮬레이션-엔진)
10. [Supabase 스키마](#10-supabase-스키마)

---

## 1. 전체 아키텍처

### 1.1 사용자 여정 (User Flow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          LANDING PAGE (/)                           │
│                                                                      │
│  [Hero] → [Statistics] → [Features] → [Story] → [Pricing] → [CTA]  │
│                                                                      │
│  CTA 버튼: "무료로 시작하기" / "로그인"                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          ↓                                 ↓
┌─────────────────────┐          ┌─────────────────────┐
│   /auth/signup      │          │   /auth/login       │
│   (회원가입)        │          │   (로그인)          │
│                     │          │                     │
│  Supabase Auth      │          │  Supabase Auth      │
└─────────┬───────────┘          └─────────┬───────────┘
          │                                 │
          ↓                                 │
┌─────────────────────────────────┐         │
│        /onboarding              │         │
│                                 │         │
│  1. Welcome (시작 화면)         │         │
│  2. ProgressiveForm (8단계)     │         │
│     - 기본정보                  │         │
│     - 소득                      │         │
│     - 지출                      │         │
│     - 부동산                    │         │
│     - 금융자산                  │         │
│     - 부채                      │         │
│     - 연금                      │         │
│     - 목표                      │         │
│                                 │         │
│  저장: profiles.draft_data      │         │
└─────────────┬───────────────────┘         │
              │                             │
              └──────────────┬──────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        /dashboard                                    │
│                                                                      │
│  ┌─────────┐  ┌─────────────────────────────────────────────────┐  │
│  │ Sidebar │  │  Main Content (탭 기반)                         │  │
│  │         │  │                                                  │  │
│  │ - 프로필│  │  [Overview] [Income] [Expense] [RealEstate]     │  │
│  │ - 네비  │  │  [Asset] [Savings] [Debt] [Pension]             │  │
│  │ - 설정  │  │  [CashFlow] [NetWorth] [Tax]                    │  │
│  │         │  │                                                  │  │
│  │         │  │  각 탭: 데이터 표시 + 수정 + 차트 + 시뮬레이션 │  │
│  └─────────┘  └─────────────────────────────────────────────────┘  │
│                                                                      │
│  데이터: OnboardingData (profiles.draft_data에서 로드)              │
│  자동 저장: 변경 시 Supabase에 즉시 저장                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 폴더 구조

```
src/
├── app/
│   ├── page.tsx                    # 랜딩 페이지
│   ├── landing.module.css          # 랜딩 스타일
│   ├── layout.tsx                  # 루트 레이아웃
│   ├── globals.css                 # 전역 스타일
│   │
│   ├── auth/                       # 인증
│   │   ├── auth.module.css
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   └── LoginForm.tsx
│   │   ├── signup/
│   │   │   ├── page.tsx
│   │   │   └── SignupForm.tsx
│   │   └── callback/
│   │       └── route.ts            # OAuth 콜백
│   │
│   ├── onboarding/                 # 온보딩
│   │   ├── page.tsx
│   │   ├── onboarding.module.css
│   │   └── components/
│   │       ├── ProgressiveForm/
│   │       │   ├── ProgressiveForm.tsx
│   │       │   ├── ProgressiveForm.module.css
│   │       │   └── tips/           # TIP 차트들
│   │       └── GuideInput/
│   │           └── NumberInput.tsx
│   │
│   └── dashboard/                  # 대시보드
│       ├── page.tsx                # 서버 컴포넌트 (데이터 로드)
│       ├── DashboardContent.tsx    # 클라이언트 컴포넌트 (상태 관리)
│       ├── dashboard.module.css
│       └── components/
│           ├── tabs/               # 11개 탭
│           ├── charts/
│           ├── modals/
│           └── Sidebar.tsx
│
├── contexts/
│   └── FinancialContext.tsx        # 대시보드 전역 상태 (FinancialItem 기반)
│
├── hooks/
│   └── useFinancialItems.ts        # FinancialItem CRUD 훅
│
├── lib/
│   ├── services/
│   │   ├── financialService.ts     # FinancialItem CRUD 서비스
│   │   ├── simulationEngine.ts     # 시뮬레이션
│   │   ├── linkedItemService.ts    # 연동 항목 서비스
│   │   ├── onboardingConverter.ts  # 온보딩→FinancialItem 변환
│   │   ├── dataMigration.ts        # FinancialItem→OnboardingData 역변환
│   │   └── defaultItems.ts         # 기본값
│   ├── calculations/
│   │   └── retirement.ts           # 은퇴 계산
│   ├── supabase/
│   │   ├── client.ts               # 클라이언트
│   │   └── server.ts               # 서버
│   └── utils.ts                    # 유틸리티
│
├── types/
│   └── index.ts                    # 모든 타입 정의
│
└── components/
    └── ui/                         # 공용 UI
```

---

## 2. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| **프레임워크** | Next.js (App Router) | 16.0.10 |
| **언어** | TypeScript | 5.x |
| **데이터베이스** | Supabase (PostgreSQL) | - |
| **인증** | Supabase Auth | - |
| **스타일** | CSS Modules | - |
| **차트** | Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 |
| **폼** | React Hook Form + Zod | 7.68.0 / 4.2.1 |
| **애니메이션** | Framer Motion | 12.23.26 |
| **아이콘** | Lucide React | - |
| **UI** | Radix UI | - |

---

## 3. 데이터 타입 정의

### 3.1 핵심 타입 (기본)

```typescript
// 자산 카테고리 (FinancialItem용)
type FinancialCategory = 'income' | 'expense' | 'savings' | 'pension' | 'asset' | 'debt' | 'real_estate'

// 자산 타입 (카테고리별)
type IncomeType = 'labor' | 'business' | 'rental' | 'pension' | 'regular' | 'onetime'
type ExpenseType = 'fixed' | 'variable' | 'housing' | 'interest' | 'medical' | 'onetime'
type SavingsType = 'checking' | 'savings' | 'deposit' | 'stock' | 'fund' | 'bond' | 'crypto' | 'isa' | 'other'
type PensionType = 'national' | 'retirement' | 'personal' | 'irp'
type AssetType = 'deposit' | 'stock' | 'fund' | 'bond' | 'crypto' | 'vehicle' | 'other'
type DebtType = 'mortgage' | 'credit' | 'auto' | 'student' | 'asset' | 'other'
type RealEstateType = 'residence' | 'investment' | 'land' | 'other'

// 통합 타입
type FinancialItemType = IncomeType | ExpenseType | SavingsType | PensionType | AssetType | DebtType | RealEstateType

// 빈도
type Frequency = 'monthly' | 'yearly' | 'once'

// 가족 관계
type FamilyRelationship = 'spouse' | 'child' | 'parent'

// 성별
type Gender = 'male' | 'female'

// 소유자
type OwnerType = 'self' | 'spouse' | 'child' | 'common'

// 상승률 카테고리
type RateCategory = 'inflation' | 'income' | 'investment' | 'realEstate' | 'fixed'

// 시나리오 모드
type ScenarioMode = 'optimistic' | 'average' | 'pessimistic' | 'custom' | 'individual'
```

### 3.2 FinancialItem (통합 재무 데이터)

`simulations` + `financial_items` 테이블 기반의 핵심 데이터 구조입니다.

```typescript
// 시뮬레이션 (시나리오)
interface Simulation {
  id: string
  profile_id: string
  title: string
  description?: string
  is_default: boolean
  settings?: GlobalSettings
  created_at: string
  updated_at: string
}

// 통합 재무 항목
interface FinancialItem {
  id: string
  simulation_id: string
  category: FinancialCategory      // income, expense, savings, pension, asset, debt, real_estate
  type: FinancialItemType          // 카테고리별 세부 타입
  title: string
  owner: OwnerType                 // self, spouse, child, common
  data: FinancialItemData          // 카테고리별 JSONB 데이터
  linked_item_id?: string          // 연동된 원본 항목 ID
  sort_order: number
  is_active: boolean               // soft delete 플래그
  created_at: string
  updated_at: string
}

// 카테고리별 데이터 구조
interface IncomeData {
  amount: number                   // 만원
  frequency: Frequency
  startYear: number
  startMonth: number
  endType: 'self-retirement' | 'spouse-retirement' | 'custom'
  endYear?: number
  endMonth?: number
  growthRate: number
  rateCategory: RateCategory
  sourceType?: 'realEstate' | 'manual'
  sourceId?: string
}

interface ExpenseData {
  amount: number
  frequency: Frequency
  startYear: number
  startMonth: number
  endType: 'self-retirement' | 'spouse-retirement' | 'custom'
  endYear?: number
  endMonth?: number
  growthRate: number
  rateCategory: RateCategory
  sourceType?: 'debt' | 'housing' | 'manual'
  sourceId?: string
}

interface SavingsData {
  balance: number                  // 현재 잔액 (만원)
  interestRate?: number            // 금리 (%)
  expectedReturn?: number          // 예상 수익률 (%)
  maturityYear?: number
  maturityMonth?: number
  monthlyContribution?: number     // 월 납입액 (ISA)
  maturityStrategy?: 'pension_savings' | 'irp' | 'cash'  // ISA 만기 전략
}

interface PensionData {
  currentBalance?: number          // 현재 잔액
  monthlyContribution?: number     // 월 납입액
  estimatedMonthly?: number        // 예상 월 수령액 (국민연금)
  paymentStartAge?: number         // 수령 시작 나이
  paymentYears?: number            // 수령 기간 (년)
  pensionType?: 'DB' | 'DC' | 'corporate_irp' | 'severance' | 'unknown'
  receiveType?: 'lump_sum' | 'annuity'
}

interface AssetData {
  purchaseValue: number            // 매입가 (만원)
  currentValue?: number            // 현재 가치
  purchaseYear?: number
  purchaseMonth?: number
  financingType?: 'loan' | 'installment' | 'none'
  loanAmount?: number
  loanRate?: number
  loanMaturity?: string            // YYYY-MM
  loanRepaymentType?: '만기일시상환' | '원리금균등상환' | '원금균등상환'
}

interface DebtData {
  amount: number                   // 대출 원금 (만원)
  rate: number                     // 금리 (%)
  maturity: string                 // YYYY-MM
  repaymentType: '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환'
  sourceType?: 'physicalAsset' | 'housing' | 'realEstate' | 'manual'
  sourceId?: string
}

interface RealEstateData {
  usageType: 'residence' | 'investment' | 'rental' | 'land'
  marketValue: number              // 시세 (만원)
  purchaseYear?: number
  purchaseMonth?: number
  hasRentalIncome?: boolean
  monthlyRent?: number
  deposit?: number
  hasLoan?: boolean
  loanAmount?: number
  loanRate?: number
  loanMaturity?: string
  loanRepaymentType?: string
}

// 통합 데이터 타입
type FinancialItemData = IncomeData | ExpenseData | SavingsData | PensionData | AssetData | DebtData | RealEstateData
```

### 3.3 OnboardingData (레거시 호환용)

온보딩에서 수집한 데이터를 저장하는 구조입니다. 대시보드에서는 FinancialItem으로 변환하여 사용합니다.

```typescript
interface OnboardingData {
  // ═══════════════════════════════════════════════
  // SECTION 1: 기본 정보
  // ═══════════════════════════════════════════════
  name: string
  gender: Gender | null
  birth_date: string                    // YYYY-MM-DD
  target_retirement_age: number
  target_retirement_fund: number

  // ═══════════════════════════════════════════════
  // SECTION 2: 가족 구성
  // ═══════════════════════════════════════════════
  isMarried: boolean | null
  spouse: FamilyMemberInput | null
  hasChildren: boolean | null
  children: FamilyMemberInput[]
  parents: FamilyMemberInput[]

  // ═══════════════════════════════════════════════
  // SECTION 3: 소득
  // ═══════════════════════════════════════════════
  // 간편 입력 (온보딩)
  laborIncome: number | null
  laborIncomeFrequency: 'monthly' | 'yearly'
  spouseLaborIncome: number | null
  spouseLaborIncomeFrequency: 'monthly' | 'yearly'
  businessIncome: number | null
  businessIncomeFrequency: 'monthly' | 'yearly'
  spouseBusinessIncome: number | null
  spouseBusinessIncomeFrequency: 'monthly' | 'yearly'

  // 상세 입력 (대시보드)
  incomeItems?: DashboardIncomeItem[]

  // ═══════════════════════════════════════════════
  // SECTION 4: 지출
  // ═══════════════════════════════════════════════
  // 간편 입력 (온보딩)
  livingExpenses: number | null
  livingExpensesFrequency: 'monthly' | 'yearly'

  // 상세 입력 (대시보드)
  expenseItems?: DashboardExpenseItem[]

  // ═══════════════════════════════════════════════
  // SECTION 5: 거주용 부동산
  // ═══════════════════════════════════════════════
  housingType: '자가' | '전세' | '월세' | '해당없음' | null
  housingValue: number | null           // 시세 (자가) / 보증금 (전세/월세)
  housingRent: number | null            // 월세
  housingMaintenance: number | null     // 관리비
  housingHasLoan: boolean
  housingLoan: number | null
  housingLoanRate: number | null        // %
  housingLoanMaturity: string | null    // YYYY-MM
  housingLoanType: '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환' | null

  // ═══════════════════════════════════════════════
  // SECTION 6: 추가 부동산 (투자/임대/토지)
  // ═══════════════════════════════════════════════
  realEstateProperties: RealEstateProperty[]

  // ═══════════════════════════════════════════════
  // SECTION 7: 금융자산
  // ═══════════════════════════════════════════════
  // 저축 계좌 (입출금, 정기예금, 적금)
  savingsAccounts: SavingsAccount[]

  // 투자 계좌 (주식, 펀드, 암호화폐 등)
  investmentAccounts: InvestmentAccount[]

  // 실물 자산 (자동차, 귀금속 등)
  physicalAssets: PhysicalAsset[]

  // deprecated (하위 호환)
  cashCheckingAccount: number | null
  cashSavingsAccount: number | null
  investDomesticStock: number | null
  investForeignStock: number | null
  investFund: number | null
  investOther: number | null
  hasNoAsset: boolean | null

  // ═══════════════════════════════════════════════
  // SECTION 8: 부채
  // ═══════════════════════════════════════════════
  debts: DebtInput[]
  hasNoDebt: boolean | null

  // ═══════════════════════════════════════════════
  // SECTION 9: 연금 - 본인
  // ═══════════════════════════════════════════════
  // 국민연금
  nationalPension: number | null              // 예상 월 수령액
  nationalPensionStartAge: number | null      // 수령 시작 나이

  // 퇴직연금/퇴직금
  retirementPensionType: 'DB' | 'DC' | 'corporate_irp' | 'severance' | 'unknown' | null
  retirementPensionBalance: number | null     // 현재 잔액
  retirementPensionReceiveType: 'lump_sum' | 'annuity' | null
  retirementPensionStartAge: number | null
  retirementPensionReceivingYears: number | null
  yearsOfService: number | null               // 근속연수 (DB형)

  // 연금저축
  pensionSavingsBalance: number | null
  pensionSavingsMonthlyContribution: number | null
  pensionSavingsStartAge: number | null
  pensionSavingsReceivingYears: number | null

  // IRP
  irpBalance: number | null
  irpMonthlyContribution: number | null
  irpStartAge: number | null
  irpReceivingYears: number | null

  // ISA
  isaBalance: number | null
  isaMonthlyContribution: number | null
  isaMaturityYear: number | null
  isaMaturityMonth: number | null
  isaMaturityStrategy: 'pension_savings' | 'irp' | 'cash' | null

  // ═══════════════════════════════════════════════
  // SECTION 10: 연금 - 배우자
  // ═══════════════════════════════════════════════
  spouseNationalPension: number | null
  spouseNationalPensionStartAge: number | null
  spouseRetirementPensionType: 'DB' | 'DC' | 'corporate_irp' | 'severance' | 'unknown' | null
  spouseRetirementPensionBalance: number | null
  spouseRetirementPensionReceiveType: 'lump_sum' | 'annuity' | null
  spouseRetirementPensionStartAge: number | null
  spouseRetirementPensionReceivingYears: number | null
  spouseYearsOfService: number | null
  spousePensionSavingsBalance: number | null
  spousePensionSavingsMonthlyContribution: number | null
  spousePensionSavingsStartAge: number | null
  spousePensionSavingsReceivingYears: number | null
  spouseIrpBalance: number | null
  spouseIrpMonthlyContribution: number | null
  spouseIrpStartAge: number | null
  spouseIrpReceivingYears: number | null
  spouseIsaBalance: number | null
  spouseIsaMonthlyContribution: number | null
  spouseIsaMaturityYear: number | null
  spouseIsaMaturityMonth: number | null
  spouseIsaMaturityStrategy: 'pension_savings' | 'irp' | 'cash' | null

  // ═══════════════════════════════════════════════
  // SECTION 11: 설정
  // ═══════════════════════════════════════════════
  globalSettings?: GlobalSettings
  cashFlowRules: CashFlowRule[]

  // ═══════════════════════════════════════════════
  // SECTION 12: 레거시 (미사용, 호환용)
  // ═══════════════════════════════════════════════
  incomes: AssetInput[]
  expenses: AssetInput[]
  realEstates: AssetInput[]
  assets: AssetInput[]
  pensions: AssetInput[]
}
```

### 3.4 소득 항목 (DashboardIncomeItem)

```typescript
type DashboardIncomeType = 'labor' | 'business' | 'regular' | 'onetime' | 'rental' | 'pension'
type DashboardEndType = 'self-retirement' | 'spouse-retirement' | 'custom'

interface DashboardIncomeItem {
  id: string
  type: DashboardIncomeType
  label: string
  owner: 'self' | 'spouse'
  amount: number                        // 만원 (frequency에 따라 월/년)
  frequency: 'monthly' | 'yearly'

  // 기간 (년+월 구조)
  startYear: number
  startMonth: number                    // 1-12
  endType: DashboardEndType
  endYear: number | null                // custom일 때만
  endMonth: number | null               // custom일 때만

  // 성장률
  growthRate: number                    // % (연간)
  rateCategory: RateCategory

  // 연동 정보
  isSystem?: boolean                    // 시스템 생성 여부
  sourceType?: 'realEstate' | 'manual'
  sourceId?: string                     // 원본 ID
}
```

### 3.5 지출 항목 (DashboardExpenseItem)

```typescript
type DashboardExpenseType = 'fixed' | 'variable' | 'onetime' | 'medical' | 'interest' | 'housing'

interface DashboardExpenseItem {
  id: string
  type: DashboardExpenseType
  label: string
  amount: number                        // 만원
  frequency: 'monthly' | 'yearly'

  // 기간
  startYear: number
  startMonth: number
  endType: DashboardEndType
  endYear: number | null
  endMonth: number | null

  // 성장률
  growthRate: number
  rateCategory: RateCategory

  // 연동 정보
  sourceType?: 'debt' | 'housing' | 'manual'
  sourceId?: string
}
```

### 3.6 저축/투자 계좌

```typescript
// 저축 계좌
type SavingsAccountType = 'checking' | 'savings' | 'deposit'

interface SavingsAccount {
  id: string
  type: SavingsAccountType
  name: string
  balance: number                       // 만원
  interestRate?: number                 // %
  maturityYear?: number
  maturityMonth?: number
}

// 투자 계좌
type InvestmentAccountType = 'domestic_stock' | 'foreign_stock' | 'fund' | 'bond' | 'crypto' | 'other'

interface InvestmentAccount {
  id: string
  type: InvestmentAccountType
  name: string
  balance: number                       // 만원
  expectedReturn?: number               // %
}
```

### 3.7 부동산 (RealEstateProperty)

```typescript
type RealEstateUsageType = 'investment' | 'rental' | 'land'

interface RealEstateProperty {
  id: string
  usageType: RealEstateUsageType
  name: string

  // 가치
  marketValue: number                   // 만원
  purchaseYear?: number
  purchaseMonth?: number

  // 임대 수익
  hasRentalIncome?: boolean
  monthlyRent?: number                  // 만원
  deposit?: number                      // 보증금 (만원)

  // 대출
  hasLoan?: boolean
  loanAmount?: number                   // 만원
  loanRate?: number                     // %
  loanMaturity?: string                 // YYYY-MM
  loanRepaymentType?: '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환' | null
}
```

### 3.8 실물 자산 (PhysicalAsset)

```typescript
type PhysicalAssetType = 'car' | 'precious_metal' | 'custom'
type AssetFinancingType = 'loan' | 'installment' | 'none'

interface PhysicalAsset {
  id: string
  type: PhysicalAssetType
  name: string
  purchaseValue: number                 // 매입가 (만원)
  purchaseYear?: number
  purchaseMonth?: number

  // 대출/할부
  financingType?: AssetFinancingType
  loanAmount?: number
  loanRate?: number
  loanMaturity?: string                 // YYYY-MM
  loanRepaymentType?: '만기일시상환' | '원리금균등상환' | '원금균등상환' | null
}
```

### 3.9 부채 (DebtInput)

```typescript
type DebtSourceType = 'physicalAsset' | 'housing' | 'realEstate' | 'manual'

interface DebtInput {
  id: string
  name: string
  amount: number | null                 // 대출 금액 (만원)
  rate: number | null                   // 금리 (%)
  maturity: string | null               // YYYY-MM
  repaymentType: '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환' | null

  // 연동 정보
  sourceType?: DebtSourceType
  sourceId?: string
}
```

### 3.10 글로벌 설정 (GlobalSettings)

```typescript
interface GlobalSettings {
  scenarioMode: ScenarioMode

  // 상승률
  inflationRate: number                 // 물가 상승률 (%)
  incomeGrowthRate: number              // 소득 증가율 (%)
  investmentReturnRate: number          // 투자 수익률 (%)
  savingsGrowthRate: number             // 저축 증가율 (%)
  realEstateGrowthRate: number          // 부동산 상승률 (%)
  debtInterestRate: number              // 부채 기본 금리 (%)

  // 기타
  lifeExpectancy: number                // 예상 수명 (세)

  // 커스텀 모드 저장값
  customRates: ScenarioRates
}

// 기본값
const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  scenarioMode: 'custom',
  inflationRate: 2.5,
  incomeGrowthRate: 3.3,
  investmentReturnRate: 5,
  savingsGrowthRate: 2.5,
  realEstateGrowthRate: 2.4,
  debtInterestRate: 3.5,
  lifeExpectancy: 100,
  customRates: {
    inflationRate: 2.5,
    incomeGrowthRate: 3.3,
    investmentReturnRate: 5,
    realEstateGrowthRate: 2.4,
  },
}

// 시나리오 프리셋
const SCENARIO_PRESETS = {
  optimistic: {
    inflationRate: 2.0,
    incomeGrowthRate: 5.0,
    investmentReturnRate: 8.0,
    realEstateGrowthRate: 4.0,
  },
  average: {
    inflationRate: 2.5,
    incomeGrowthRate: 3.0,
    investmentReturnRate: 5.0,
    realEstateGrowthRate: 2.5,
  },
  pessimistic: {
    inflationRate: 4.0,
    incomeGrowthRate: 1.0,
    investmentReturnRate: 2.0,
    realEstateGrowthRate: 0.5,
  },
}
```

### 3.11 현금흐름 분배 규칙 (CashFlowRule)

```typescript
type CashFlowAccountType = 'pension_savings' | 'irp' | 'isa' | 'savings' | 'investment' | 'checking'

interface CashFlowRule {
  id: string
  accountType: CashFlowAccountType
  name: string
  priority: number                      // 1이 가장 높음
  allocationType: 'fixed' | 'percentage' | 'remainder'
  monthlyAmount?: number                // 고정액 (만원)
  percentage?: number                   // 비율 (%)
  annualLimit?: number                  // 연간 한도 (만원)
  isEnabled: boolean
}

// 기본 규칙
const DEFAULT_CASH_FLOW_RULES: CashFlowRule[] = [
  { id: '1', accountType: 'pension_savings', name: '연금저축', priority: 1, allocationType: 'fixed', monthlyAmount: 50, annualLimit: 600, isEnabled: true },
  { id: '2', accountType: 'irp', name: 'IRP', priority: 2, allocationType: 'fixed', monthlyAmount: 25, annualLimit: 300, isEnabled: true },
  { id: '3', accountType: 'isa', name: 'ISA', priority: 3, allocationType: 'fixed', monthlyAmount: 167, annualLimit: 2000, isEnabled: true },
  { id: '4', accountType: 'savings', name: '비상금', priority: 4, allocationType: 'fixed', monthlyAmount: 50, isEnabled: true },
  { id: '5', accountType: 'checking', name: '입출금통장', priority: 99, allocationType: 'remainder', isEnabled: true },
]
```

---

## 4. 랜딩 페이지

### 4.1 파일 위치

```
src/app/
├── page.tsx              # 메인 페이지 (1,268줄)
└── landing.module.css    # 스타일 (2,891줄)
```

### 4.2 섹션 구조

| # | 섹션 | CSS 클래스 | 설명 |
|---|------|-----------|------|
| 1 | Header | `.header` | 네비게이션 + 로고 + CTA |
| 2 | Hero | `.hero` | 타이핑 애니메이션 + 메인 CTA |
| 3 | Statistics | `.statsSection` | 77.8% vs 19.1% 통계 |
| 4 | Features | `.features` | 3개 기능 카드 |
| 5 | Misconceptions | `.misconceptionSection` | 3가지 오해 |
| 6 | Planning | `.planningSection` | 3단계 접근 방식 |
| 7 | Story | `.storySection` | 7장 비교 스토리 (지혁 vs 경표) |
| 8 | Case Studies | `.caseStudies` | 4개 고객 사례 |
| 9 | Brand Story | `.brandStory` | 회사 스토리 (모달) |
| 10 | Pricing | `.pricing` | 2가지 요금제 |
| 11 | Footer | `.footer` | 링크 + 저작권 |

### 4.3 Hero 섹션 상세

```
┌─────────────────────────────────────────────────────────┐
│  Badge: "간편한 은퇴 준비의 시작"                        │
│                                                          │
│  Title (타이핑 애니메이션):                              │
│  - "스마트하게 설계하세요"                               │
│  - "체계적으로 관리하세요"                               │
│  - "안전하게 준비하세요"                                 │
│  - "현명하게 계획하세요"                                 │
│                                                          │
│  Subtitle: 설명 텍스트                                   │
│                                                          │
│  [무료로 시작하기]  [서비스 알아보기]                    │
│      (Primary)          (Secondary)                      │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Story 섹션 (7장)

```
Timeline Progress Bar (Sticky)
─────────────────────────────────────────
│ 45세 │ 55세 │ 60세 │ 65세 │ 70세 │
─────────────────────────────────────────

CHAPTER 1 (45세): 시작점
├─ 지혁 & 경표: 동일 조건
│  순자산 5억원, 월소득 550만원
│  아파트 1채(대출 1억원), 60세 은퇴 목표

CHAPTER 2 (45세): 다른 선택
├─ 지혁: 구체적 목표 없음, 막연한 불안
├─ 경표: 목표 설정 + 전략 수립

CHAPTER 3 (55세): 조기 퇴직
├─ 지혁: 준비 부족, 당황
├─ 경표: 자격증 + 비상자금 확보

CHAPTER 4 (60세): 목표 은퇴시점
├─ 지혁: 2% 수익률, 1.34억
├─ 경표: 7% 수익률, 2.76억

CHAPTER 5 (65세): 현금 흐름
├─ 지혁: 월 150만원 + 부족
├─ 경표: 월 600만원 + 여유

CHAPTER 6 (65-70세): 삶의 질
├─ 지혁: 25% 만족도
├─ 경표: 85% 만족도

CHAPTER 7 (70세): 최종 결과
├─ 지혁: 2.9억원 (2.1억 감소)
├─ 경표: 20.5억원 (성공)
└─ 차이: 17.6억원
```

### 4.5 Calculator 모달

```
목표: 65세까지 10억원 달성

입력 (슬라이더):
├─ 초기 투자금: 0 ~ 1억원 (100만원 단위)
└─ 시작 나이: 30세 ~ 60세

가정 (고정):
├─ 목표 나이: 65세
└─ 연 수익률: 7%

결과:
┌─────────────────────────────────┐
│  필요 월 적립액                 │
│  XXX,XXX원                      │
├─────────────────────────────────┤
│ 초기 투자금   5,000만원         │
│ 월 적립 총액  XXX,XXX원         │
│ 예상 수익금   +XXX,XXX원        │
├─────────────────────────────────┤
│ 합계          10억원            │
└─────────────────────────────────┘
```

### 4.6 CTA 연결

| 위치 | 버튼 | 이동 경로 |
|------|------|----------|
| Header | 로그인 | `/auth/login` |
| Header | 무료로 시작하기 | `/auth/signup` |
| Hero | 무료로 시작하기 | Calculator 모달 |
| Hero | 서비스 알아보기 | `#stats-section` |
| Features | 무료로 진단받기 | Calculator 모달 |
| Misconceptions | 직접 계산해보기 | Calculator 모달 |
| Story | 지금 무료로 진단받기 | Calculator 모달 |
| Pricing | 무료로 시작하기 | `/auth/signup` |

---

## 5. 인증 (Auth)

### 5.1 파일 구조

```
src/app/auth/
├── auth.module.css
├── login/
│   ├── page.tsx          # Server Component
│   └── LoginForm.tsx     # Client Component
├── signup/
│   ├── page.tsx
│   └── SignupForm.tsx
└── callback/
    └── route.ts          # OAuth 콜백
```

### 5.2 인증 흐름

```
회원가입 (/auth/signup)
──────────────────────────────────────
1. SignupForm에서 이메일 + 비밀번호 입력
2. supabase.auth.signUp() 호출
3. 성공 시:
   - Supabase에 사용자 생성
   - profiles 테이블에 프로필 생성
   - /onboarding으로 리다이렉트
4. 실패 시: 에러 메시지 표시


로그인 (/auth/login)
──────────────────────────────────────
1. LoginForm에서 이메일 + 비밀번호 입력
2. supabase.auth.signInWithPassword() 호출
3. 성공 시:
   - 세션 생성
   - /dashboard로 리다이렉트
4. 실패 시: 에러 메시지 표시


OAuth 콜백 (/auth/callback)
──────────────────────────────────────
- 소셜 로그인 후 콜백 처리
- 세션 교환 및 리다이렉트
```

### 5.3 세션 관리

```typescript
// 클라이언트에서 세션 확인
const { data: { session } } = await supabase.auth.getSession()

// 서버에서 세션 확인
const supabase = createServerComponentClient({ cookies })
const { data: { session } } = await supabase.auth.getSession()

// 로그아웃
await supabase.auth.signOut()
```

---

## 6. 온보딩

### 6.1 파일 구조

```
src/app/onboarding/
├── page.tsx                        # 메인 페이지
├── onboarding.module.css
└── components/
    ├── ProgressiveForm/
    │   ├── ProgressiveForm.tsx     # TIP 패널 포함
    │   ├── ProgressiveForm.module.css
    │   ├── types.ts
    │   ├── utils.ts
    │   └── tips/
    │       ├── index.ts
    │       ├── formatUtils.ts
    │       ├── calculators.ts
    │       └── charts/             # 20+ 차트 컴포넌트
    │           ├── ProgressChart.tsx
    │           ├── IncomeChart.tsx
    │           ├── SavingsChart.tsx
    │           ├── RetirementCountdown.tsx
    │           ├── AssetPieChart.tsx
    │           ├── DebtChart.tsx
    │           ├── PensionStackChart.tsx
    │           └── ...
    ├── GuideInput/
    │   ├── NumberInput.tsx
    │   └── index.ts
    └── index.ts
```

### 6.2 온보딩 단계 (13개 행)

| # | Row ID | 입력 내용 | 필수 |
|---|--------|----------|------|
| 1 | `name` | 이름, 성별 | O |
| 2 | `birth_date` | 생년월일 (본인 + 배우자) | O |
| 3 | `children` | 자녀 정보 | - |
| 4 | `retirement_age` | 목표 은퇴 나이 | O |
| 5 | `retirement_fund` | 목표 은퇴 자금 | O |
| 6 | `labor_income` | 근로소득 | - |
| 7 | `business_income` | 사업소득 | - |
| 8 | `living_expenses` | 생활비 | - |
| 9 | `realEstate` | 거주용 부동산 | - |
| 10 | `asset` | 금융자산 | - |
| 11 | `debt` | 부채 | - |
| 12 | `national_pension` | 국민연금 | - |
| 13 | `retirement_pension` | 퇴직연금 | - |
| 14 | `personal_pension` | 개인연금 | - |

### 6.3 프로그레시브 폼 규칙

```
┌─────────────────────────────────────────────────────────────────┐
│                    프로그레시브 폼 구조                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  좌측: 입력 영역 (GuideInput)                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Progress Bar (완료율)                                   │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                         │    │
│  │ [ v ] 1. 이름: 홍길동                        (완료)    │    │
│  │ [ v ] 2. 생년월일: 1985-01-01               (완료)    │    │
│  │ [ v ] 3. 자녀: 없음                         (완료)    │    │
│  │ [>>>] 4. 목표 은퇴 나이: [    ]세           (현재)    │    │
│  │                          ↑ 주황색 강조                 │    │
│  │       5. 목표 은퇴 자금                     (숨김)    │    │
│  │       6. 근로소득                           (숨김)    │    │
│  │       ...                                              │    │
│  │                                                         │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ [이전] [완료 - sticky]                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  우측: TIP 패널 (ProgressiveForm)                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │  현재 입력 항목에 맞는 맞춤형 TIP                      │    │
│  │                                                         │    │
│  │  [차트 영역]                                           │    │
│  │  ┌─────────────────────────────────────────────┐       │    │
│  │  │                                             │       │    │
│  │  │    Chart.js 시각화                         │       │    │
│  │  │    (항목별 다른 차트 표시)                 │       │    │
│  │  │                                             │       │    │
│  │  └─────────────────────────────────────────────┘       │    │
│  │                                                         │    │
│  │  TIP 텍스트:                                           │    │
│  │  "한국인의 평균 은퇴 나이는 55세입니다."              │    │
│  │  "65세까지 일하면 연금 수령액이 42% 증가합니다."      │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

규칙:
1. 체크된 항목(완료) + 현재 항목 + 다음 1개만 표시
2. 현재 행 번호: 주황색 + 굵게
3. 새 행 등장: 아래→위 슬라이드업 (0.3s)
4. 완료 버튼: 좌측 하단 sticky
5. TIP 패널: 현재 항목에 맞게 실시간 업데이트
```

### 6.4 TIP 차트 목록

| 차트 | 표시 시점 | 설명 |
|------|----------|------|
| WelcomeChart | 시작 | 환영 메시지 |
| ProgressChart | 전체 | 진행률 표시 |
| IncomeChart | 소득 입력 | 소득 구성 분석 |
| SavingsChart | 소득/지출 | 저축률 분석 |
| SavingsRateChart | 지출 | 저축 트렌드 |
| ChildCostChart | 자녀 | 자녀 교육비 예측 |
| AssetPieChart | 자산 | 자산 구성 |
| AssetSummaryChart | 자산 | 자산 요약 |
| DebtChart | 부채 | 부채 현황 |
| LTVChart | 부동산 | 주택담보대출비율 |
| RetirementCountdown | 은퇴 나이 | 은퇴까지 남은 시간 |
| RetirementGapChart | 은퇴 자금 | 목표 vs 예상 자금 |
| IncomeRiskChart | 소득 | 소득 위험도 |
| IncomePositionChart | 소득 | 소득 분위 |
| NationalPensionChart | 국민연금 | 국민연금 예상 |
| RetirementPensionChart | 퇴직연금 | 퇴직연금 예상 |
| PersonalPensionChart | 개인연금 | 개인연금 예상 |
| PensionStackChart | 연금 전체 | 연금 3층 구조 |
| LifeNavigationChart | 완료 | 인생 네비게이션 |

### 6.5 데이터 저장

```typescript
// 온보딩 데이터 저장 위치
profiles.draft_data (JSONB)

// 저장 타이밍
1. 각 행 완료 시 자동 저장
2. "완료" 버튼 클릭 시 최종 저장
3. 페이지 이탈 시 자동 저장

// 저장 함수
async function saveOnboardingData(data: OnboardingData) {
  const { error } = await supabase
    .from('profiles')
    .update({ draft_data: data })
    .eq('id', userId)
}
```

---

## 7. 대시보드

### 7.1 파일 구조

```
src/app/dashboard/
├── page.tsx                        # 진입점
├── DashboardContent.tsx            # 메인 컨텐츠 (상태 관리)
├── dashboard.module.css
└── components/
    ├── Sidebar.tsx
    ├── DashboardTabs.tsx
    ├── tabs/
    │   ├── OverviewTab.tsx
    │   ├── IncomeTab.tsx
    │   ├── ExpenseTab.tsx
    │   ├── RealEstateTab.tsx
    │   ├── AssetTab.tsx
    │   ├── SavingsTab.tsx
    │   ├── DebtTab.tsx
    │   ├── PensionTab.tsx
    │   │   └── pension/
    │   │       ├── NationalPensionSection.tsx
    │   │       ├── RetirementPensionSection.tsx
    │   │       ├── PersonalPensionSection.tsx
    │   │       └── usePensionCalculations.ts
    │   ├── CashFlowTab.tsx
    │   ├── NetWorthTab.tsx
    │   └── TaxAnalyticsTab.tsx
    ├── charts/
    │   ├── AssetSimulationChart.tsx
    │   └── SankeyChart.tsx
    ├── modals/
    │   ├── FamilyModal.tsx
    │   ├── ScenarioModal.tsx
    │   └── CashFlowModal.tsx
    └── common/
        └── RateSelector.tsx
```

### 7.2 탭 구조 (11개)

| # | 탭 | 컴포넌트 | 주요 기능 |
|---|-----|---------|----------|
| 1 | Overview | `OverviewTab.tsx` | 재무 현황 요약, 주요 지표 |
| 2 | Income | `IncomeTab.tsx` | 소득 항목 CRUD, 차트 |
| 3 | Expense | `ExpenseTab.tsx` | 지출 항목 CRUD, 의료비 자동 |
| 4 | RealEstate | `RealEstateTab.tsx` | 부동산 관리 (거주/투자/임대) |
| 5 | Asset | `AssetTab.tsx` | 실물자산 (자동차, 귀금속) |
| 6 | Savings | `SavingsTab.tsx` | 저축/투자 계좌, ISA |
| 7 | Debt | `DebtTab.tsx` | 부채 관리, 상환액 계산 |
| 8 | Pension | `PensionTab.tsx` | 연금 관리 (국민/퇴직/개인) |
| 9 | CashFlow | `CashFlowTab.tsx` | 현금흐름 분석 |
| 10 | NetWorth | `NetWorthTab.tsx` | 순자산 추이 시뮬레이션 |
| 11 | Tax | `TaxAnalyticsTab.tsx` | 세금 분석 |

### 7.3 탭별 상세

#### 7.3.1 IncomeTab (소득)

```
┌─────────────────────────────────────────────────────────────────┐
│  소득 관리                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  항목 유형:                                                      │
│  ├─ labor: 근로소득                                             │
│  ├─ business: 사업소득                                          │
│  ├─ regular: 정기소득 (임대료 등)                               │
│  ├─ onetime: 일시소득                                           │
│  ├─ rental: 임대소득                                            │
│  └─ pension: 연금소득                                           │
│                                                                  │
│  테이블:                                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ 항목명      │ 소유자 │ 금액   │ 주기 │ 기간          │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 1 │ 본인 급여   │ 본인   │ 500만  │ 월   │ 2024~은퇴     │  │
│  │ 2 │ 배우자 급여 │ 배우자 │ 300만  │ 월   │ 2024~배우자은퇴│ │
│  │ 3 │ 임대수익    │ 본인   │ 100만  │ 월   │ 2024~계속     │  │
│  │   │ + 소득 추가 │        │        │      │               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  차트: 연간 소득 추이 (Bar Chart)                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │   █                                                        │  │
│  │   █   █                                                    │  │
│  │   █   █   █                                                │  │
│  │ 2024 2025 2026 ...                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**데이터 구조:**
```typescript
incomeItems: DashboardIncomeItem[]

// 항목 추가
const newItem: DashboardIncomeItem = {
  id: uuid(),
  type: 'labor',
  label: '본인 급여',
  owner: 'self',
  amount: 500,
  frequency: 'monthly',
  startYear: 2024,
  startMonth: 1,
  endType: 'self-retirement',
  endYear: null,
  endMonth: null,
  growthRate: 3.3,
  rateCategory: 'income',
}
```

#### 7.3.2 ExpenseTab (지출)

```
┌─────────────────────────────────────────────────────────────────┐
│  지출 관리                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  항목 유형:                                                      │
│  ├─ fixed: 고정지출 (생활비, 통신비 등)                         │
│  ├─ variable: 변동지출                                          │
│  ├─ onetime: 일시지출                                           │
│  ├─ medical: 의료비 (자동 계산)                                 │
│  ├─ interest: 이자지출 (부채 연동)                              │
│  └─ housing: 주거비                                             │
│                                                                  │
│  의료비 자동 설정 (나이대별):                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 20대: 5만/월  │ 30대: 10만/월 │ 40대: 15만/월              │  │
│  │ 50대: 25만/월 │ 60대: 35만/월 │ 70대: 60만/월              │  │
│  │ 80대: 130만/월│ 90대: 230만/월│ 100세+: 300만/월           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.3.3 RealEstateTab (부동산)

```
┌─────────────────────────────────────────────────────────────────┐
│  부동산 관리                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 거주용 부동산                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 거주 형태: [자가] [전세] [월세] [해당없음]                │  │
│  │                                                            │  │
│  │ 자가 선택 시:                                              │  │
│  │ ├─ 시세: [        ] 만원                                  │  │
│  │ ├─ 대출 있음: [체크]                                      │  │
│  │ │   ├─ 대출금액: [        ] 만원                          │  │
│  │ │   ├─ 금리: [    ]%                                      │  │
│  │ │   ├─ 만기: [YYYY-MM]                                    │  │
│  │ │   └─ 상환방식: [원리금균등 ▼]                          │  │
│  │ └─ 관리비: [        ] 만원/월                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  2. 추가 부동산                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ 용도   │ 이름        │ 시세    │ 임대수익 │ 대출      │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 1 │ 투자용 │ 강남 오피스텔│ 5억     │ -        │ 2억       │  │
│  │ 2 │ 임대용 │ 판교 상가   │ 3억     │ 200만/월 │ 1억       │  │
│  │ 3 │ 토지   │ 세종 땅     │ 1억     │ -        │ -         │  │
│  │   │        │ + 부동산 추가│         │          │           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  차트: 부동산 구성 (Doughnut)                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**데이터 연동:**
- 부동산 대출 → DebtTab에 자동 생성
- 임대 수익 → IncomeTab에 자동 생성

#### 7.3.4 SavingsTab (저축/투자)

```
┌─────────────────────────────────────────────────────────────────┐
│  저축/투자 관리                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 저축 계좌                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ 유형     │ 계좌명       │ 잔액   │ 금리 │ 만기        │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 1 │ 입출금   │ 신한 주거래  │ 1,000  │ 0.1% │ -           │  │
│  │ 2 │ 정기예금 │ 카카오 예금  │ 5,000  │ 3.5% │ 2025.06     │  │
│  │ 3 │ 적금     │ 토스 적금    │ 3,000  │ 4.0% │ 2025.12     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  2. 투자 계좌                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ 유형     │ 계좌명       │ 평가액 │ 예상수익률         │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 1 │ 국내주식 │ 삼성증권     │ 3,000  │ 8%                 │  │
│  │ 2 │ 해외주식 │ 키움 해외    │ 5,000  │ 10%                │  │
│  │ 3 │ 펀드     │ 미래에셋     │ 2,000  │ 6%                 │  │
│  │ 4 │ 암호화폐 │ 업비트       │ 1,000  │ -                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  3. ISA                                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 본인 ISA                                                   │  │
│  │ ├─ 잔액: [        ] 만원                                  │  │
│  │ ├─ 월 납입: [        ] 만원                               │  │
│  │ ├─ 만기: [2027] 년 [06] 월                                │  │
│  │ └─ 만기 후: [연금저축 전환 ▼]                            │  │
│  │                                                            │  │
│  │ 배우자 ISA (있는 경우)                                     │  │
│  │ ├─ 잔액: [        ] 만원                                  │  │
│  │ └─ ...                                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.3.5 DebtTab (부채)

```
┌─────────────────────────────────────────────────────────────────┐
│  부채 관리                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  부채 목록                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ 항목       │ 원금   │ 금리 │ 만기    │ 상환방식│ 월상환 │ │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 1 │ 주택담보   │ 2억    │ 4.0% │ 2044.06│ 원리금균│ 96만   │ │
│  │ 2 │ 자동차대출 │ 3,000  │ 5.5% │ 2027.12│ 원리금균│ 52만   │ │
│  │ 3 │ 신용대출   │ 1,000  │ 6.0% │ 2025.06│ 만기일시│ 5만    │ │
│  │   │ + 부채 추가│        │      │        │        │        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  연동 표시:                                                     │
│  - [주택] 거주용 부동산에서 자동 생성                          │
│  - [자동차] 실물자산에서 자동 생성                             │
│  - [부동산] 추가 부동산에서 자동 생성                          │
│                                                                  │
│  월 상환액 자동 계산:                                           │
│  원리금균등상환: PMT = P × [r(1+r)^n] / [(1+r)^n - 1]          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.3.6 PensionTab (연금)

```
┌─────────────────────────────────────────────────────────────────┐
│  연금 관리                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 국민연금 (NationalPensionSection)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 본인                                                       │  │
│  │ ├─ 예상 월 수령액: [        ] 만원                        │  │
│  │ └─ 수령 시작 나이: [    ]세                               │  │
│  │                                                            │  │
│  │ 배우자                                                     │  │
│  │ ├─ 예상 월 수령액: [        ] 만원                        │  │
│  │ └─ 수령 시작 나이: [    ]세                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  2. 퇴직연금/퇴직금 (RetirementPensionSection)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 본인                                                       │  │
│  │ ├─ 유형: [DB] [DC] [기업형IRP] [퇴직금] [모름]            │  │
│  │ │                                                         │  │
│  │ │ DB 선택 시:                                             │  │
│  │ │ └─ 현재 근속연수: [    ]년                              │  │
│  │ │                                                         │  │
│  │ │ DC/기업형IRP 선택 시:                                   │  │
│  │ │ └─ 현재 잔액: [        ] 만원                           │  │
│  │ │                                                         │  │
│  │ ├─ 수령 방식: [일시금] [연금]                             │  │
│  │ │                                                         │  │
│  │ │ 연금 선택 시:                                           │  │
│  │ │ ├─ 수령 시작 나이: [    ]세                             │  │
│  │ │ └─ 수령 기간: [    ]년                                  │  │
│  │                                                            │  │
│  │ 배우자 (동일 구조)                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  3. 개인연금 (PersonalPensionSection)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 연금저축 - 본인                                            │  │
│  │ ├─ 현재 잔액: [        ] 만원                             │  │
│  │ ├─ 월 납입액: [        ] 만원                             │  │
│  │ ├─ 수령 시작 나이: [    ]세                               │  │
│  │ └─ 수령 기간: [    ]년                                    │  │
│  │                                                            │  │
│  │ IRP - 본인                                                 │  │
│  │ ├─ 현재 잔액: [        ] 만원                             │  │
│  │ ├─ 월 납입액: [        ] 만원                             │  │
│  │ ├─ 수령 시작 나이: [    ]세                               │  │
│  │ └─ 수령 기간: [    ]년                                    │  │
│  │                                                            │  │
│  │ ISA - 본인                                                 │  │
│  │ ├─ 현재 잔액: [        ] 만원                             │  │
│  │ ├─ 월 납입액: [        ] 만원                             │  │
│  │ ├─ 만기: [    ]년 [  ]월                                  │  │
│  │ └─ 만기 후 전략: [연금저축] [IRP] [현금인출]              │  │
│  │                                                            │  │
│  │ 배우자 (동일 구조)                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  연금 계산 로직:                                                │
│  ├─ PMT: 현재가 → 월 수령액 계산                               │
│  └─ FV: 적립금의 미래가 계산                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 모달

| 모달 | 파일 | 기능 |
|------|------|------|
| FamilyModal | `FamilyModal.tsx` | 가족 구성 추가/수정 |
| ScenarioModal | `ScenarioModal.tsx` | 시나리오 선택, 상승률 조정 |
| CashFlowModal | `CashFlowModal.tsx` | 현금흐름 분배 규칙 설정 |

### 7.5 상태 관리 (FinancialItem 기반)

대시보드는 `FinancialProvider` 컨텍스트와 `useFinancialItems` 훅을 사용하여 상태를 관리합니다.

```typescript
// dashboard/page.tsx (서버 컴포넌트)
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 프로필 기본 정보 로드
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, birth_date, target_retirement_age, target_retirement_fund, settings')
    .eq('id', user.id)
    .single()

  // 기본 시뮬레이션 로드
  const { data: simulation } = await supabase
    .from('simulations')
    .select('*')
    .eq('profile_id', user.id)
    .eq('is_default', true)
    .single()

  // 재무 항목 로드
  const { data: items } = await supabase
    .from('financial_items')
    .select('*')
    .eq('simulation_id', simulation.id)
    .eq('is_active', true)
    .order('category')
    .order('sort_order')

  return (
    <FinancialProvider
      simulation={simulation}
      initialItems={items}
      profile={profile}
      initialGlobalSettings={globalSettings}
    >
      <DashboardContent />
    </FinancialProvider>
  )
}

// contexts/FinancialContext.tsx
interface FinancialContextValue {
  // 시뮬레이션
  simulation: Simulation

  // 프로필 기본 정보
  profile: ProfileBasics

  // 재무 항목 (카테고리별)
  items: FinancialItem[]
  incomes: FinancialItem[]
  expenses: FinancialItem[]
  savings: FinancialItem[]
  pensions: FinancialItem[]
  assets: FinancialItem[]
  debts: FinancialItem[]
  realEstates: FinancialItem[]

  // CRUD 함수
  addItem: (input: FinancialItemInput) => Promise<FinancialItem>
  updateItem: (id: string, updates: Partial<FinancialItemInput>) => Promise<FinancialItem>
  deleteItem: (id: string) => Promise<void>

  // 글로벌 설정
  globalSettings: GlobalSettings
  updateGlobalSettings: (updates: Partial<GlobalSettings>) => void

  // 계산된 값
  currentAge: number
  retirementYear: number
  currentYear: number
}

// hooks/useFinancialItems.ts
function useFinancialItems(simulationId: string, initialItems: FinancialItem[]) {
  const [items, setItems] = useState<FinancialItem[]>(initialItems)

  // 카테고리별 필터링
  const incomes = useMemo(() => items.filter(i => i.category === 'income'), [items])
  const expenses = useMemo(() => items.filter(i => i.category === 'expense'), [items])
  // ...

  // CRUD 함수
  const addItem = async (input) => {
    const created = await financialItemService.create({ ...input, simulation_id: simulationId })
    setItems(prev => [...prev, created])
    return created
  }

  const updateItem = async (id, updates) => {
    const updated = await financialItemService.update(id, updates)
    setItems(prev => prev.map(item => item.id === id ? updated : item))
    return updated
  }

  const deleteItem = async (id) => {
    await financialItemService.delete(id)  // soft delete
    setItems(prev => prev.filter(item => item.id !== id))
  }

  return { items, incomes, expenses, ..., addItem, updateItem, deleteItem }
}

// 각 탭에서 컨텍스트 사용
function IncomeTab() {
  const { incomes, addItem, updateItem, deleteItem, globalSettings } = useFinancialContext()

  return (
    // FinancialItem 기반으로 렌더링
  )
}
```

#### 레거시 호환 (OnboardingData 변환)

대시보드 탭들은 `FinancialItem[]`을 `OnboardingData`로 변환하여 기존 컴포넌트와 호환성을 유지합니다.

```typescript
// DashboardContent.tsx
const data = useMemo(() => {
  return convertItemsToLegacyData(items, profile)
}, [items, profile])

// lib/services/dataMigration.ts
function convertItemsToLegacyData(items: FinancialItem[], profile: ProfileBasics): OnboardingData {
  // FinancialItem[] → OnboardingData 변환
  // 각 탭에서 기존 형식으로 사용 가능
}
```

---

## 8. 데이터 흐름 및 연동

### 8.1 온보딩 → 대시보드 데이터 흐름

**변환 서비스**: `src/lib/services/onboardingConverter.ts`

온보딩에서 입력받은 데이터는 `FinancialItem[]`으로 변환되어 `financial_items` 테이블에 저장됩니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                        ONBOARDING                                │
│                                                                  │
│  간편 입력 (사용자가 입력):                                     │
│  ├─ laborIncome: 500 (만원/월)                                  │
│  ├─ spouseLaborIncome: 300                                      │
│  ├─ livingExpenses: 200                                         │
│  ├─ cashCheckingAccount: 1000                                   │
│  └─ ...                                                         │
│                                                                  │
│                    ↓ 완료 버튼 클릭                              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  1. 프로필 저장 (기본 정보만)                              │  │
│  │     profiles: { name, birth_date, target_retirement_age }  │  │
│  │                                                             │  │
│  │  2. 기본 시뮬레이션 생성                                   │  │
│  │     simulations: { title: '기본 시나리오', is_default }    │  │
│  │                                                             │  │
│  │  3. FinancialItem[]로 변환                                 │  │
│  │     convertOnboardingToFinancialItems(data, simulation.id) │  │
│  │     (onboardingConverter.ts)                               │  │
│  │                                                             │  │
│  │  4. 재무 항목 저장                                         │  │
│  │     financial_items: FinancialItem[]                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                        DASHBOARD                                 │
│                                                                  │
│  데이터 로드 (page.tsx - 서버 컴포넌트):                        │
│  ├─ profiles: 기본 정보 (name, birth_date, settings)           │
│  ├─ simulations: 기본 시뮬레이션                               │
│  └─ financial_items: 모든 재무 항목                            │
│                                                                  │
│  FinancialProvider로 전달:                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  <FinancialProvider                                        │  │
│  │    simulation={simulation}                                 │  │
│  │    initialItems={financialItems}                          │  │
│  │    profile={profile}                                       │  │
│  │    initialGlobalSettings={globalSettings}                  │  │
│  │  >                                                         │  │
│  │    <DashboardContent />                                    │  │
│  │  </FinancialProvider>                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  레거시 호환 (DashboardContent.tsx):                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  const data = useMemo(() => {                              │  │
│  │    return convertItemsToLegacyData(items, profile)         │  │
│  │  }, [items, profile])                                      │  │
│  │                                                             │  │
│  │  // FinancialItem[] → OnboardingData 변환                  │  │
│  │  // 기존 탭 컴포넌트와 호환                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.1.1 변환 규칙

| 간편 입력 | 변환 결과 | 자동 설정값 |
|----------|----------|------------|
| `laborIncome` | `incomeItems[type='labor']` | startYear=현재, endType='self-retirement', growthRate=3.3% |
| `spouseLaborIncome` | `incomeItems[type='labor', owner='spouse']` | endType='spouse-retirement' |
| `businessIncome` | `incomeItems[type='business']` | growthRate=3.3% |
| `livingExpenses` | `expenseItems[type='fixed']` | growthRate=2.5% (물가상승률) |
| `housingRent` | `expenseItems[type='housing']` | sourceType='housing' |
| `cashCheckingAccount` | `savingsAccounts[type='checking']` | interestRate=0.1% |
| `investDomesticStock` | `investmentAccounts[type='domestic_stock']` | expectedReturn=5% |
| `housingLoan` | `debts[sourceType='housing']` | 자동 생성 |
| `realEstateProperties[].monthlyRent` | `incomeItems[type='rental']` | sourceType='realEstate' |

### 8.1.2 변환 함수

```typescript
// src/lib/services/onboardingConverter.ts

// 전체 변환
finalizeOnboardingData(data: OnboardingData): OnboardingData

// 개별 변환
convertToIncomeItems(data): DashboardIncomeItem[]
convertToExpenseItems(data): DashboardExpenseItem[]
convertToSavingsAccounts(data): SavingsAccount[]
convertToInvestmentAccounts(data): InvestmentAccount[]
convertToDebts(data): DebtInput[]
```

### 8.2 섹션 간 데이터 연동

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           데이터 연동 관계도                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  RealEstateTab                                                           │
│  ┌─────────────────┐                                                     │
│  │ 거주용 부동산    │                                                     │
│  │ housingLoan     │ ──────────────────────→ DebtTab                    │
│  │                 │                          (sourceType: 'housing')    │
│  └─────────────────┘                                                     │
│  ┌─────────────────┐                                                     │
│  │ 추가 부동산      │                                                     │
│  │ realEstate      │ ──────────────────────→ DebtTab                    │
│  │ Properties      │                          (sourceType: 'realEstate') │
│  │   └─ loanAmount │                                                     │
│  │   └─ monthlyRent│ ──────────────────────→ IncomeTab                  │
│  │                 │                          (sourceType: 'realEstate') │
│  └─────────────────┘                                                     │
│                                                                          │
│  AssetTab                                                                │
│  ┌─────────────────┐                                                     │
│  │ 실물자산         │                                                     │
│  │ physicalAssets  │ ──────────────────────→ DebtTab                    │
│  │   └─ loanAmount │                          (sourceType: 'physicalAsset')│
│  └─────────────────┘                                                     │
│                                                                          │
│  DebtTab                                                                 │
│  ┌─────────────────┐                                                     │
│  │ 부채             │                                                     │
│  │ debts           │ ──────────────────────→ ExpenseTab                 │
│  │   └─ 월상환액    │                          (sourceType: 'debt')       │
│  │                 │                          (type: 'interest')         │
│  └─────────────────┘                                                     │
│                                                                          │
│  연동 규칙:                                                              │
│  1. 원본 데이터 수정 시 → 연동 항목 자동 업데이트                        │
│  2. 원본 삭제 시 → 연동 항목 자동 삭제                                   │
│  3. 연동 항목은 직접 수정 불가 (sourceType으로 구분)                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.3 시나리오 모드와 상승률 적용

```typescript
// 시나리오 모드에 따른 실제 상승률 결정
function getEffectiveRate(
  baseRate: number,           // 항목의 기본 상승률
  rateCategory: RateCategory, // 항목의 카테고리
  scenarioMode: ScenarioMode,
  globalSettings: GlobalSettings
): number {
  // 1. fixed 카테고리: 항상 기본값 사용
  if (rateCategory === 'fixed') {
    return baseRate
  }

  // 2. individual 모드: 항목별 기본값 사용
  if (scenarioMode === 'individual') {
    return baseRate
  }

  // 3. optimistic/average/pessimistic 모드: 프리셋 사용
  if (scenarioMode !== 'custom') {
    const preset = SCENARIO_PRESETS[scenarioMode]
    switch (rateCategory) {
      case 'inflation': return preset.inflationRate
      case 'income': return preset.incomeGrowthRate
      case 'investment': return preset.investmentReturnRate
      case 'realEstate': return preset.realEstateGrowthRate
    }
  }

  // 4. custom 모드: globalSettings 값 사용
  switch (rateCategory) {
    case 'inflation': return globalSettings.inflationRate
    case 'income': return globalSettings.incomeGrowthRate
    case 'investment': return globalSettings.investmentReturnRate
    case 'realEstate': return globalSettings.realEstateGrowthRate
    default: return baseRate
  }
}
```

### 8.4 상승률 카테고리 기본 매핑

```typescript
// 항목 유형별 기본 상승률 카테고리
const DEFAULT_RATE_CATEGORY: Record<string, RateCategory> = {
  // 소득
  labor: 'income',
  business: 'income',
  rental: 'realEstate',
  pension: 'inflation',

  // 지출
  fixed: 'inflation',
  variable: 'inflation',
  medical: 'inflation',
  housing: 'inflation',

  // 자산
  savings: 'investment',
  investment: 'investment',
  realEstate: 'realEstate',
}
```

---

## 9. 시뮬레이션 엔진

### 9.1 파일 위치

```
src/lib/
├── services/
│   ├── simulationEngine.ts     # 메인 엔진
│   └── defaultItems.ts         # 기본값
└── calculations/
    └── retirement.ts           # 은퇴 계산
```

### 9.2 핵심 함수

```typescript
// 시뮬레이션 실행
function runSimulation(
  data: OnboardingData,
  settings?: Partial<GlobalSettings>,
  yearsToSimulate?: number
): SimulationResult

// 결과 구조
interface SimulationResult {
  startYear: number
  endYear: number
  retirementYear: number
  snapshots: YearlySnapshot[]
  summary: {
    currentNetWorth: number
    retirementNetWorth: number
    peakNetWorth: number
    peakNetWorthYear: number
    yearsToFI: number | null
    fiTarget: number
  }
}

// 연간 스냅샷
interface YearlySnapshot {
  year: number
  age: number
  totalIncome: number
  totalExpense: number
  netCashFlow: number
  totalAssets: number
  realEstateValue: number
  financialAssets: number
  pensionAssets: number
  totalDebts: number
  netWorth: number
  incomeBreakdown: { title: string; amount: number }[]
  expenseBreakdown: { title: string; amount: number }[]
  assetBreakdown: { title: string; amount: number }[]
  debtBreakdown: { title: string; amount: number }[]
  pensionBreakdown: { title: string; amount: number }[]
}
```

### 9.3 연금 계산 함수

```typescript
// PMT (Payment): 현재가 → 월 수령액
function calculatePMT(
  presentValue: number,   // 현재 잔액 (만원)
  years: number,          // 수령 기간 (년)
  annualRate: number      // 연간 수익률 (소수, 예: 0.05)
): number {
  if (years <= 0 || presentValue <= 0) return 0
  if (annualRate === 0) return presentValue / years

  const r = annualRate
  const n = years
  const factor = Math.pow(1 + r, n)

  // 연간 수령액
  const annualPayment = presentValue * (r * factor) / (factor - 1)

  return annualPayment  // 월 수령액 = annualPayment / 12
}

// FV (Future Value): 적립금 → 미래가
function calculateFutureValue(
  currentBalance: number,   // 현재 잔액 (만원)
  monthlyAmount: number,    // 월 납입액 (만원)
  years: number,            // 기간 (년)
  annualRate: number        // 연간 수익률 (소수)
): number {
  let futureValue = currentBalance

  for (let i = 0; i < years; i++) {
    futureValue = (futureValue + monthlyAmount * 12) * (1 + annualRate)
  }

  return Math.round(futureValue)
}
```

### 9.4 월 상환액 계산 (원리금균등)

```typescript
// 월 상환액 계산 (원리금균등상환)
function calculateMonthlyPayment(
  principal: number,        // 대출 원금 (만원)
  annualRate: number,       // 연 금리 (%, 예: 4.0)
  remainingMonths: number   // 남은 기간 (개월)
): number {
  if (remainingMonths <= 0) return 0
  if (annualRate === 0) return principal / remainingMonths

  const monthlyRate = annualRate / 100 / 12
  const factor = Math.pow(1 + monthlyRate, remainingMonths)

  return principal * (monthlyRate * factor) / (factor - 1)
}
```

---

## 10. Supabase 스키마

### 10.1 테이블 구조

```sql
-- 프로필 테이블
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  birth_date DATE,                      -- YYYY-MM-DD
  target_retirement_age INTEGER DEFAULT 60,
  target_retirement_fund BIGINT,
  settings JSONB,                       -- GlobalSettings 저장
  draft_data JSONB,                     -- OnboardingData 저장 (레거시)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 시뮬레이션 테이블 (시나리오)
CREATE TABLE simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '기본 시나리오',
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  settings JSONB,                       -- 시나리오별 설정 (GlobalSettings)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 재무 항목 테이블 (핵심 데이터)
CREATE TABLE financial_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('income', 'expense', 'savings', 'pension', 'asset', 'debt', 'real_estate')),
  type TEXT NOT NULL,                   -- 카테고리별 세부 타입
  title TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'self' CHECK (owner IN ('self', 'spouse', 'child', 'common')),
  data JSONB NOT NULL DEFAULT '{}',     -- 카테고리별 상세 데이터
  linked_item_id UUID REFERENCES financial_items(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,  -- soft delete
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_simulations_profile_id ON simulations(profile_id);
CREATE INDEX idx_simulations_is_default ON simulations(profile_id, is_default);
CREATE INDEX idx_financial_items_simulation_id ON financial_items(simulation_id);
CREATE INDEX idx_financial_items_category ON financial_items(category);
CREATE INDEX idx_financial_items_is_active ON financial_items(simulation_id, is_active);
CREATE INDEX idx_financial_items_linked ON financial_items(linked_item_id);

-- 자산 테이블 (레거시, 현재 미사용)
CREATE TABLE assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('income', 'expense', 'real_estate', 'asset', 'debt', 'pension')),
  name TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'yearly', 'once')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 10.2 RLS 정책

```sql
-- profiles 테이블
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- simulations 테이블
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own simulations"
  ON simulations FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own simulations"
  ON simulations FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own simulations"
  ON simulations FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete own simulations"
  ON simulations FOR DELETE
  USING (auth.uid() = profile_id);

-- financial_items 테이블
ALTER TABLE financial_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own financial_items"
  ON financial_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM simulations
      WHERE simulations.id = financial_items.simulation_id
      AND simulations.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own financial_items"
  ON financial_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM simulations
      WHERE simulations.id = financial_items.simulation_id
      AND simulations.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own financial_items"
  ON financial_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM simulations
      WHERE simulations.id = financial_items.simulation_id
      AND simulations.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own financial_items"
  ON financial_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM simulations
      WHERE simulations.id = financial_items.simulation_id
      AND simulations.profile_id = auth.uid()
    )
  );

-- assets 테이블 (레거시)
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 부록

### A. 금액 단위 규칙

- **모든 금액 입력은 만원 단위**
- 사용자가 `10000` 입력 = 10000만원 = 1억원

```typescript
// 금액 포맷팅
formatMoney(5000)   // "5,000만원"
formatMoney(10000)  // "1억"
formatMoney(64724)  // "6억 4,724만"

// 원 단위 변환 (필요시)
const wonValue = inputValue * 10000
```

### B. 시간 단위 규칙

- **모든 재무 데이터는 년+월 구조**
- 년도만 저장하는 필드 금지
- 시작일 = 해당 월 1일, 종료일 = 해당 월 말일

```typescript
interface Period {
  startYear: number
  startMonth: number   // 1-12
  endYear: number
  endMonth: number     // 1-12
}

// 월 수 계산
const months = (endYear - startYear) * 12 + (endMonth - startMonth)

// 연간 → 월간 상승률 변환
const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1

// 표시 형식
const display = `${year}.${String(month).padStart(2, '0')}`  // "2025.06"
```

### C. 나이대별 의료비 (월, 만원)

| 나이 | 의료비 | 나이 | 의료비 |
|------|--------|------|--------|
| 20대 | 5 | 60-64세 | 35 |
| 30대 | 10 | 65-69세 | 45 |
| 40대 | 15 | 70-74세 | 60 |
| 50대 | 25 | 75-79세 | 85 |
| | | 80-84세 | 130 |
| | | 85-89세 | 180 |
| | | 90-94세 | 230 |
| | | 95-99세 | 280 |
| | | 100세+ | 300 |

### D. 기본 현금흐름 분배 규칙

| 우선순위 | 계좌 | 월 납입액 | 연간 한도 |
|---------|------|----------|----------|
| 1 | 연금저축 | 50만원 | 600만원 |
| 2 | IRP | 25만원 | 300만원 |
| 3 | ISA | 167만원 | 2000만원 |
| 4 | 비상금 | 50만원 | - |
| 99 | 입출금 | 나머지 | - |

### E. Deprecated 필드 (마이그레이션 예정)

온보딩에서 사용하던 간편 입력 필드들입니다. 현재는 `onboardingConverter.ts`에서 대시보드 형식으로 변환하여 사용합니다.

**주의**: 기존 사용자 데이터 호환을 위해 필드는 유지되지만, 새로운 기능 개발 시 사용하지 마세요.

| Deprecated 필드 | 대체 필드 | 비고 |
|----------------|----------|------|
| `cashCheckingAccount` | `savingsAccounts[type='checking']` | 입출금통장 |
| `cashSavingsAccount` | `savingsAccounts[type='deposit']` | 정기예금 |
| `investDomesticStock` | `investmentAccounts[type='domestic_stock']` | 국내주식 |
| `investForeignStock` | `investmentAccounts[type='foreign_stock']` | 해외주식 |
| `investFund` | `investmentAccounts[type='fund']` | 펀드 |
| `investOther` | `investmentAccounts[type='other']` | 기타 투자 |
| `personalPensionMonthly` | `pensionSavingsMonthlyContribution` | 연금저축 월납입 |
| `personalPensionBalance` | `pensionSavingsBalance` | 연금저축 잔액 |
| `personalPensionWithdrawYears` | `pensionSavingsReceivingYears` | 수령 기간 |

**변환 흐름**:
```
온보딩 입력 (deprecated 필드)
       ↓
finalizeOnboardingData() 호출
       ↓
대시보드 형식 (상세 배열) 으로 변환
       ↓
profiles.draft_data에 저장
```

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-01-02 | 2.0 | FinancialItem 기반 아키텍처로 전환 (simulations + financial_items 테이블) |
| 2026-01-02 | 2.0 | FinancialContext, useFinancialItems 훅 추가 |
| 2026-01-02 | 2.0 | 레거시 호환 레이어 (convertItemsToLegacyData) 추가 |
| 2025-01-02 | 1.1 | 데이터 변환 서비스 추가 (onboardingConverter.ts) |
| 2025-01-02 | 1.0 | 초기 문서 작성 |
