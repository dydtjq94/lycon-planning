// 준비사항 데이터 타입

export interface FamilyMember {
  relationship: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
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
}

export interface AssetItem {
  id?: string;
  type: string;
  title: string;
  amount: number;
}

export interface DebtItem {
  id?: string;
  type: string;
  title: string;
  principal: number;
  interest_rate: number;
  monthly_payment?: number;
}

export interface PensionItem {
  id?: string;
  type: "national" | "retirement" | "personal";
  owner: "self" | "spouse";
  expected_amount?: number;
  current_balance?: number;
}

// 각 준비사항의 완료 상태
export interface PrepCompleted {
  family: boolean;
  income: boolean;
  expense: boolean;
  asset: boolean;
  debt: boolean;
  pension: boolean;
}

// 전체 준비사항 데이터
export interface PrepData {
  family: FamilyMember[];
  income: IncomeItem[];
  expense: ExpenseItem[];
  asset: AssetItem[];
  debt: DebtItem[];
  pension: PensionItem[];
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
