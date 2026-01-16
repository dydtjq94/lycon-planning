// 준비사항 데이터 타입

export interface FamilyMember {
  relationship: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
}

// 거주 부동산
export interface HousingData {
  housingType: "자가" | "전세" | "월세" | "무상";
  // 자가
  currentValue?: number; // 시세 (만원)
  // 전세/월세
  deposit?: number; // 보증금 (만원)
  monthlyRent?: number; // 월세 (만원)
  // 공통
  maintenanceFee?: number; // 관리비 (만원)
  // 대출 정보
  hasLoan: boolean;
  loanType?: "mortgage" | "jeonse"; // 주담대 / 전세대출
  loanAmount?: number; // 대출 잔액 (만원)
  loanRate?: number; // 금리 (%)
  loanRateType?: "fixed" | "floating"; // 고정/변동
  loanMaturityYear?: number;
  loanMaturityMonth?: number;
  loanRepaymentType?: string; // 상환방식 (원리금균등, 원금균등, 거치식, 만기일시)
  // 거치식 - 거치 종료 시점
  graceEndYear?: number;
  graceEndMonth?: number;
}

// 금융 자산 - 저축 계좌
export interface FinancialAssetItem {
  id?: string;
  category: "savings" | "investment"; // 저축 계좌 / 투자 계좌
  type: string; // checking, savings, deposit, domestic_stock, foreign_stock, fund, bond, crypto, other
  title: string;
  owner: "self" | "spouse";
  currentBalance: number; // 잔액 (만원)
  monthlyDeposit?: number; // 월 납입금 - 적금 (만원)
  maturityYear?: number; // 만기 년도
  maturityMonth?: number; // 만기 월 (1-12)
  expectedReturn?: number; // 예상 수익률/금리 (%)
}

// 투자 계좌 데이터
export interface InvestmentAccountData {
  // 증권 계좌 (선택)
  securities?: {
    balance: number; // 평가금액 (만원)
    investmentTypes: string[]; // 투자 유형 (domestic_stock, foreign_stock, domestic_etf, foreign_etf, fund, bond)
  };
  // 코인 거래소 (선택)
  crypto?: {
    balance: number;
  };
  // 금 현물 (선택)
  gold?: {
    balance: number;
  };
}

export interface IncomeItem {
  id?: string;
  owner: "self" | "spouse";
  type: string;
  title: string;
  amount: number;
  frequency: "monthly" | "yearly";
}

export interface ExpenseItem {
  id?: string;
  type: string;
  title: string;
  amount: number;
  frequency: "monthly" | "yearly";
  sourceType?: string; // 자동 생성된 경우 출처
  sourceId?: string;
}

export interface DebtItem {
  id?: string;
  type: string;
  title: string;
  principal: number;
  currentBalance?: number;
  interestRate: number;
  monthlyPayment?: number;
  sourceType?: string; // housing 연동인 경우
  sourceId?: string;
}

export interface PensionItem {
  id?: string;
  type: "national" | "retirement" | "personal";
  owner: "self" | "spouse";
  expectedAmount?: number;
  currentBalance?: number;
}

// 각 준비사항의 완료 상태
export interface PrepCompleted {
  family: boolean;
  housing: boolean;
  savings: boolean;      // 저축 계좌
  investment: boolean;   // 투자 계좌
  debt: boolean;
  income: boolean;
  pension: boolean;
  expense: boolean;
}

// 전체 준비사항 데이터
export interface PrepData {
  family: FamilyMember[];
  housing: HousingData | null;
  savings: FinancialAssetItem[];           // 저축 계좌
  investment: InvestmentAccountData | null; // 투자 계좌
  debt: DebtItem[];
  income: IncomeItem[];
  pension: PensionItem[];
  expense: ExpenseItem[];
  completed: PrepCompleted;
}

// 준비사항 ID 타입
export type PrepTaskId = keyof PrepCompleted;

// 공통 입력 폼 Props
export interface InputFormProps<T> {
  taskId: PrepTaskId;
  initialData: T[];
  isCompleted: boolean;
  onClose: (saved?: boolean) => void;
  onSave: (taskId: PrepTaskId, data: T[]) => void;
}
