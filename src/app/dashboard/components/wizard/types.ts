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
    retirementAge: number | null;
    lifeExpectancy: number | null;
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
    fixedExpense: number | null; // 고정비 합계 (만원/월)
    postRetirementRate: number; // 은퇴 후 생활비 비율 (0.5~1.0, 기본 0.7)
    autoMedical: boolean; // 의료비 자동 반영
    autoEducation: boolean; // 양육비 자동 반영
    educationTier: 'normal' | 'premium'; // 양육비 수준
  };
  // Step 5: 연금
  pension: {
    selfType: "national" | "government" | "military" | "private_school";
    selfExpectedAmount: number | null; // 만원/월
    selfStartAge: number; // 수령 시작 나이
    spouseType: "national" | "government" | "military" | "private_school";
    spouseExpectedAmount: number | null; // 만원/월
    spouseStartAge: number | null; // 수령 시작 나이
  };
  // Step 6: 라이프 이벤트
  events: {
    items: {
      type: "housing" | "car" | "education" | "wedding" | "travel" | "medical" | "other";
      title: string;
      year: number | null;
      amount: number | null; // 만원
    }[];
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
  { key: "income", label: "소득/연금" },
  { key: "expense", label: "지출" },
  { key: "events", label: "라이프 이벤트" },
  { key: "assets", label: "자산 확인" },
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
    retirementAge: null,
    lifeExpectancy: null,
    spouseIsWorking: false,
    spouseRetirementAge: null,
    spouseLifeExpectancy: null,
  },
  income: { items: [] },
  expense: { livingExpense: null, fixedExpense: null, postRetirementRate: 0.7, autoMedical: true, autoEducation: true, educationTier: 'normal' },
  pension: {
    selfType: "national",
    selfExpectedAmount: null,
    selfStartAge: 65,
    spouseType: "national",
    spouseExpectedAmount: null,
    spouseStartAge: null,
  },
  events: { items: [] },
};
