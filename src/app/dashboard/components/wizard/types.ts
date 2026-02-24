export interface WizardData {
  // Step 0: 시뮬레이션 이름
  title: string;
  // Step 1: 가족
  family: {
    hasSpouse: boolean;
    spouseName: string;
    spouseBirthDate: string;
    spouseGender: "male" | "female" | null;
    children: {
      name: string;
      birthDate: string;
      gender: "male" | "female" | null;
    }[];
    plannedChildren: { birthYear: number | null }[];
    dependentParents: {
      relationship: "father" | "mother" | "father-in-law" | "mother-in-law";
      birthDate: string;
    }[];
  };
  // Step 2: 은퇴/기대수명
  retirement: {
    retirementAge: number;
    lifeExpectancy: number;
    spouseIsWorking: boolean;
    spouseRetirementAge: number | null;
    spouseLifeExpectancy: number | null;
  };
  // Step 3: 소득
  income: {
    items: {
      title: string;
      type: "labor" | "business" | "side" | "other";
      owner: "self" | "spouse";
      amount: number | null; // 만원
      frequency: "monthly" | "yearly";
      retirementLinked: boolean; // 은퇴 시 종료
    }[];
  };
  // Step 4: 지출
  expense: {
    livingExpense: number | null; // 생활비 합계 (만원/월)
    livingExpenseDetails: {
      food: number | null;
      transport: number | null;
      shopping: number | null;
      leisure: number | null;
    };
    fixedExpenses: {
      title: string;
      type: string;
      amount: number | null; // 만원
      frequency: "monthly" | "yearly";
    }[];
  };
  // Step 5: 연금
  pension: {
    // 추후 상세 정의
  };
  // Step 6: 라이프 이벤트
  events: {
    // 추후 상세 정의
  };
}

export interface StepProps {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

export const WIZARD_STEPS = [
  { key: "title", label: "시뮬레이션 이름" },
  { key: "family", label: "가족 관계" },
  { key: "retirement", label: "은퇴/기대수명" },
  { key: "income", label: "소득" },
  { key: "expense", label: "지출" },
  { key: "pension", label: "연금" },
  { key: "events", label: "라이프 이벤트" },
] as const;

export const INITIAL_WIZARD_DATA: WizardData = {
  title: "",
  family: {
    hasSpouse: false,
    spouseName: "",
    spouseBirthDate: "",
    spouseGender: null,
    children: [],
    plannedChildren: [],
    dependentParents: [],
  },
  retirement: {
    retirementAge: 65,
    lifeExpectancy: 100,
    spouseIsWorking: false,
    spouseRetirementAge: null,
    spouseLifeExpectancy: null,
  },
  income: { items: [] },
  expense: {
    livingExpense: null,
    livingExpenseDetails: { food: null, transport: null, shopping: null, leisure: null },
    fixedExpenses: [],
  },
  pension: {},
  events: {},
};
