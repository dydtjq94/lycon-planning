import type { OnboardingData } from "@/types";
import type { SectionId } from "../../SectionForm";
import type { RowId } from "../types";

// TIP 콘텐츠 타입 (내부 저장용 - title/description이 함수일 수 있음)
export interface TipContentRaw {
  title: string | ((data: OnboardingData) => string);
  description: string | ((data: OnboardingData) => string);
}

// TIP 콘텐츠 타입 (렌더링용 - title이 항상 string)
export interface TipContent {
  title: string;
  description: string;
}

// 나이 계산 헬퍼 (birth_date 동적 타이틀용)
function calculateAge(birthDate: string): number {
  if (!birthDate) return 0;
  const birthYear = parseInt(birthDate.split("-")[0]);
  return new Date().getFullYear() - birthYear;
}

// 섹션별 TIP (폴백용)
export const sectionTips: Record<SectionId, TipContent> = {
  household: {
    title: "기본 정보",
    description: "생년월일과 은퇴 나이로 남은 시간을 계산합니다.",
  },
  goals: {
    title: "은퇴 목표",
    description: "목표 나이와 필요 자금을 설정하세요.",
  },
  income: {
    title: "소득",
    description: "세후 실수령액으로 입력해주세요.",
  },
  expense: {
    title: "지출",
    description: "저축/투자 금액은 제외하고 입력하세요.",
  },
  realEstate: {
    title: "부동산",
    description: "대시보드에서 상세히 입력할 수 있어요.",
  },
  asset: {
    title: "자산",
    description: "대시보드에서 상세히 입력할 수 있어요.",
  },
  debt: {
    title: "부채",
    description: "대시보드에서 상세히 입력할 수 있어요.",
  },
  pension: {
    title: "연금",
    description: "대시보드에서 상세히 입력할 수 있어요.",
  },
};

// 행별 TIP (3단계 Essential)
export const rowTips: Partial<Record<RowId, TipContentRaw>> = {
  // 1. 기본 정보 (생년월일 + 은퇴 나이)
  basic_info: {
    title: (data: OnboardingData) => {
      if (!data.birth_date) return "미래가 선명해지는 순간";
      const age = calculateAge(data.birth_date);
      const retireAge = data.target_retirement_age || 55;
      const yearsToRetire = Math.max(0, retireAge - age);
      if (yearsToRetire > 0) {
        return `은퇴까지 ${yearsToRetire}년`;
      }
      return "은퇴 후 인생 설계";
    },
    description: (data: OnboardingData) => {
      const base = "100세 시대, Lycon은 돈이 아닌 인생을 설계합니다.";
      if (data.isMarried && data.spouse?.birth_date) {
        const spouseAge = calculateAge(data.spouse.birth_date);
        return `${base} 배우자(${spouseAge}세)와 함께하는 노후도 설계해요.`;
      }
      return base;
    },
  },

  // 2. 소득
  income: {
    title: (data: OnboardingData) => {
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      if (hasWorkingSpouse) return "부부 합산 소득";
      return "월 소득 입력";
    },
    description: (data: OnboardingData) => {
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      if (hasWorkingSpouse) {
        return "본인과 배우자의 소득을 각각 입력해주세요. 사업소득, 기타소득은 대시보드에서 추가할 수 있어요.";
      }
      return "대략적인 금액이면 충분해요. 상여금, 사업소득 등은 대시보드에서 상세히 입력할 수 있어요.";
    },
  },

  // 3. 생활비
  expense: {
    title: "월 생활비",
    description:
      "토스, 뱅크샐러드 등 가계부 앱에서 월평균 지출을 확인할 수 있어요. 저축/투자 금액은 빼고 입력하세요.",
  },
};

// 현재 활성 행에 맞는 TIP 콘텐츠 가져오기
export function getTipContent(
  activeRow: RowId,
  activeSection: SectionId,
  data?: OnboardingData
): TipContent {
  const rawTip = rowTips[activeRow] || sectionTips[activeSection];

  // title이 함수인 경우 실행해서 문자열로 변환
  const title =
    typeof rawTip.title === "function" && data
      ? rawTip.title(data)
      : typeof rawTip.title === "string"
      ? rawTip.title
      : "정보 입력";

  // description이 함수인 경우 실행해서 문자열로 변환
  const description =
    typeof rawTip.description === "function" && data
      ? rawTip.description(data)
      : typeof rawTip.description === "string"
      ? rawTip.description
      : "";

  return {
    title,
    description,
  };
}
