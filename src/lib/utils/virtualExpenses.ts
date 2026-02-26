/**
 * Virtual Expense Generator
 *
 * 시뮬레이션 엔진에 교육비/의료비를 자동 반영하기 위한 가상 지출 생성
 * DB에 저장하지 않고, 엔진 호출 전에 expenses 배열에 주입
 */

import type { Expense, ExpenseType, OwnerWithCommon } from "@/types/tables";
import {
  MEDICAL_EXPENSE_BY_AGE,
  EDUCATION_EXPENSE_BY_AGE,
} from "@/types";

interface ChildInfo {
  name: string;
  birthYear: number;
}

export interface VirtualExpenseParams {
  selfBirthYear: number;
  spouseBirthYear?: number | null;
  children: ChildInfo[];
  selfLifeExpectancy: number;
  spouseLifeExpectancy?: number | null;
  simulationId: string;
  educationTier?: 'normal' | 'premium';
  includeMedical?: boolean;
  includeEducation?: boolean;
}

function makeVirtualExpense(params: {
  id: string;
  simulationId: string;
  type: ExpenseType;
  title: string;
  amount: number;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  owner: OwnerWithCommon;
  amountBaseYear: number;
}): Expense {
  const now = new Date().toISOString();
  return {
    id: params.id,
    simulation_id: params.simulationId,
    type: params.type,
    title: params.title,
    amount: params.amount,
    frequency: "yearly",
    start_year: params.startYear,
    start_month: params.startMonth,
    end_year: params.endYear,
    end_month: params.endMonth,
    is_fixed_to_retirement: false,
    retirement_link: null,
    growth_rate: 0,
    rate_category: "inflation",
    amount_base_year: params.amountBaseYear,
    owner: params.owner,
    source_type: null,
    source_id: null,
    icon: null,
    color: null,
    memo: null,
    sort_order: 9999,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export function generateVirtualExpenses(params: VirtualExpenseParams): Expense[] {
  const {
    selfBirthYear,
    spouseBirthYear,
    children,
    selfLifeExpectancy,
    spouseLifeExpectancy,
    simulationId,
    educationTier = 'normal',
    includeMedical = true,
    includeEducation = true,
  } = params;
  const currentYear = new Date().getFullYear();
  const expenses: Expense[] = [];

  // 교육비: 자녀별, 단계별 (EDUCATION_EXPENSE_BY_AGE 사용)
  if (includeEducation) {
    const ageKeys = Object.keys(EDUCATION_EXPENSE_BY_AGE).map(Number).sort((a, b) => a - b);

    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci];

      for (let si = 0; si < ageKeys.length; si++) {
        const startAge = ageKeys[si];
        const entry = EDUCATION_EXPENSE_BY_AGE[startAge];
        const amount = entry[educationTier];
        const childAge = currentYear - child.birthYear;

        if (entry.isOneTime) {
          // 결혼자금 등 일시금: start_year === end_year
          const oneTimeYear = child.birthYear + startAge;
          if (oneTimeYear < currentYear) continue;

          expenses.push(
            makeVirtualExpense({
              id: `virtual-edu-${ci}-${si}`,
              simulationId,
              type: "education",
              title: `${child.name} ${entry.label}`,
              amount,
              startYear: oneTimeYear,
              startMonth: 1,
              endYear: oneTimeYear,
              endMonth: 1,
              owner: "common",
              amountBaseYear: currentYear,
            }),
          );
        } else {
          // 기간 교육비: endAge가 명시되어 있으면 사용, 없으면 다음 단계 시작 나이 - 1
          const effectiveEndAge = entry.endAge
            ?? (si < ageKeys.length - 1 ? ageKeys[si + 1] - 1 : startAge);

          if (childAge > effectiveEndAge) continue;

          const startYear = child.birthYear + Math.max(childAge, startAge);
          const endYear = child.birthYear + effectiveEndAge;
          if (startYear > endYear) continue;

          expenses.push(
            makeVirtualExpense({
              id: `virtual-edu-${ci}-${si}`,
              simulationId,
              type: "education",
              title: `${child.name} ${entry.label}`,
              amount,
              startYear,
              startMonth: 1,
              endYear,
              endMonth: 12,
              owner: "common",
              amountBaseYear: currentYear,
            }),
          );
        }
      }
    }
  }

  // 의료비 (MEDICAL_EXPENSE_BY_AGE 사용)
  if (includeMedical) {
    const medicalAgeKeys = Object.keys(MEDICAL_EXPENSE_BY_AGE)
      .map(Number)
      .sort((a, b) => a - b);

    const generateMedical = (
      personBirthYear: number,
      personLifeExpectancy: number,
      ownerLabel: string,
      owner: OwnerWithCommon,
      idPrefix: string,
    ) => {
      for (let bi = 0; bi < medicalAgeKeys.length; bi++) {
        const startAge = medicalAgeKeys[bi];
        const annualCost = MEDICAL_EXPENSE_BY_AGE[startAge];
        const personAge = currentYear - personBirthYear;
        if (personAge > (bi < medicalAgeKeys.length - 1 ? medicalAgeKeys[bi + 1] - 1 : 100)) continue;

        const effectiveStartAge = Math.max(personAge, startAge);
        const rawEndAge = bi < medicalAgeKeys.length - 1 ? medicalAgeKeys[bi + 1] - 1 : 100;
        const effectiveEndAge = Math.min(personLifeExpectancy - 1, rawEndAge);
        if (effectiveStartAge > effectiveEndAge) continue;

        expenses.push(
          makeVirtualExpense({
            id: `${idPrefix}-${bi}`,
            simulationId,
            type: "medical",
            title: `${ownerLabel} 의료비`,
            amount: annualCost,
            startYear: personBirthYear + effectiveStartAge,
            startMonth: 1,
            endYear: personBirthYear + effectiveEndAge,
            endMonth: 12,
            owner,
            amountBaseYear: currentYear,
          }),
        );
      }
    };

    // 본인 의료비
    generateMedical(selfBirthYear, selfLifeExpectancy, "본인", "self", "virtual-med-self");

    // 배우자 의료비
    if (spouseBirthYear) {
      const spouseLifeExp = spouseLifeExpectancy ?? selfLifeExpectancy;
      generateMedical(spouseBirthYear, spouseLifeExp, "배우자", "spouse", "virtual-med-spouse");
    }
  }

  return expenses;
}
