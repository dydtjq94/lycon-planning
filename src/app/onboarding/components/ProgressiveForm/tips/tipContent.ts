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
    title: "가계 정보",
    description: "가족 구성 정보는 세금 혜택과 보험 설계의 기초 자료입니다.",
  },
  goals: {
    title: "은퇴 목표",
    description: "목표 나이와 필요 자금을 설정하세요.",
  },
  income: {
    title: "소득",
    description: "세전 금액으로 입력해주세요.",
  },
  expense: {
    title: "지출",
    description: "저축/투자 금액은 제외하고 입력하세요.",
  },
  realEstate: {
    title: "부동산",
    description: "주거비는 소득의 25-30% 이하가 적정합니다.",
  },
  asset: {
    title: "현금 보유",
    description: "비상금은 최소 3~6개월 생활비를 권장해요.",
  },
  debt: {
    title: "부채",
    description: "고금리 대출부터 상환하세요.",
  },
  pension: {
    title: "연금",
    description: "3층 연금으로 노후 소득을 확보하세요.",
  },
};

// 행별 TIP (상세 버전)
export const rowTips: Partial<Record<RowId, TipContentRaw>> = {
  // 1. 이름
  name: {
    title: "미래가 선명해지는 순간",
    description:
      "재무 계획이 있는 사람은 미래에 대한 자신감이 3배 높다고 해요. 지금부터 5분이면, 당신의 은퇴 준비 상태를 정확히 알 수 있습니다.",
  },

  // 2. 생년월일
  birth_date: {
    title: (data) => {
      if (!data.birth_date) return "남은 인생을 계획합니다";
      const age = calculateAge(data.birth_date);
      const lifeExpectancy = 100;
      const retireAge = data.target_retirement_age || 60;
      const remainingYears = Math.max(0, lifeExpectancy - age);
      const yearsAfterRetirement = Math.max(0, lifeExpectancy - retireAge);
      return `앞으로 ${remainingYears}년, 은퇴 후 ${yearsAfterRetirement}년`;
    },
    description: (data) => {
      const base = "100세 시대, Lycon은 돈이 아닌 인생을 설계합니다. 은퇴, 자녀 독립, 노후까지 — 당신의 인생 여정을 함께 계획해 드릴게요.";
      if (data.isMarried && data.spouse?.birth_date) {
        const spouseAge = calculateAge(data.spouse.birth_date);
        return `${base} 배우자(${spouseAge}세)와 함께하는 노후도 설계해요.`;
      }
      return base;
    },
  },

  // 3. 자녀
  children: {
    title: "아이 한 명, 꿈 하나",
    description:
      "첫 울음부터 결혼식장까지. 부모의 사랑은 숫자로 다 담을 수 없지만, 미리 준비하면 더 많은 것을 해줄 수 있어요.",
  },

  // 4. 은퇴 나이
  retirement_age: {
    title: (data) => {
      if (data.isMarried && data.spouse?.retirement_age) {
        return "부부의 은퇴 시기";
      }
      return "정답은 없어요";
    },
    description: (data) => {
      const base = "대략적으로 생각하시는 나이면 충분해요. 한국인 평균 희망 은퇴 나이는 60세예요.";
      if (data.isMarried && data.spouse) {
        return `${base} 배우자의 은퇴 나이도 설정하면 부부 합산 소득을 계산해요.`;
      }
      return base;
    },
  },

  // 5. 은퇴 자금
  retirement_fund: {
    title: "잘 모르겠다면?",
    description:
      "10억으로 목표를 잡아도 괜찮아요. 나중에 결과를 보고 조정하면 돼요.",
  },

  // 6. 근로소득
  labor_income: {
    title: (data) => {
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      if (hasWorkingSpouse) return "부부 근로소득";
      return "간단하게만 입력하세요";
    },
    description: (data) => {
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      if (hasWorkingSpouse) {
        return "본인과 배우자의 근로소득을 각각 입력해주세요. 부부 합산 소득으로 저축률과 은퇴 준비 상태를 계산해요.";
      }
      return "지금은 대략적인 금액만 입력하면 돼요. 상여금, 성과급 등 상세 소득은 나중에 수정할 수 있어요.";
    },
  },

  // 7. 사업소득
  business_income: {
    title: (data) => {
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      if (hasWorkingSpouse) return "부부 사업소득";
      return "없으면 0 입력하세요";
    },
    description: (data) => {
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      if (hasWorkingSpouse) {
        return "프리랜서, 자영업 등 사업소득이에요. 본인과 배우자 모두 없으면 각각 0으로 입력하세요.";
      }
      return "프리랜서, 자영업 등 사업으로 버는 수입이에요. 직장인이라면 0으로 넘어가세요.";
    },
  },

  // 8. 생활비
  living_expenses: {
    title: "대략적인 금액이면 충분해요",
    description:
      "토스, 뱅크샐러드 등 가계부 앱에서 월평균 지출을 확인할 수 있어요. 저축/투자 금액은 빼고 입력하세요.",
  },

  // 9. 부동산
  realEstate: {
    title: (data) => {
      if (data.housingType === "자가") return "내 집의 현재 가치";
      if (data.housingType === "전세") return "보증금도 자산이에요";
      if (data.housingType === "월세") return "월세도 기록해두세요";
      return "거주 형태를 선택해주세요";
    },
    description: (data) => {
      if (data.housingType === "자가")
        return "KB부동산, 네이버부동산에서 시세를 확인할 수 있어요. 주택담보대출이 있다면 함께 입력해주세요.";
      if (data.housingType === "전세")
        return "전세보증금은 나중에 돌려받는 자산이에요. 전세대출이 있다면 함께 입력해주세요.";
      if (data.housingType === "월세")
        return "보증금과 월세를 입력해주세요. 월세는 매월 나가는 고정 지출로 계산됩니다.";
      return "자가, 전세, 월세 중 현재 거주 형태를 선택해주세요.";
    },
  },

  // 10. 현금 보유
  asset: {
    title: "비상금 체크",
    description:
      "입출금통장, 파킹통장 등 즉시 사용할 수 있는 현금이에요. 투자, 예금, 연금은 나중에 입력해요.",
  },

  // 11. 부채
  debt: {
    title: "생각나는 것만 적어도 돼요",
    description:
      "신용대출, 마이너스통장, 카드론, 학자금대출, 자동차할부 등이 있어요. 주택 관련 대출은 앞에서 입력했으니 제외하세요.",
  },

  // 12. 국민연금
  national_pension: {
    title: (data) => {
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      if (hasWorkingSpouse) return "부부 국민연금";
      return "모르면 나중에 수정해도 돼요";
    },
    description: (data) => {
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      if (hasWorkingSpouse) {
        return "본인과 배우자의 예상 수령액을 각각 입력해주세요. 부부 합산 연금으로 노후 소득을 계산해요.";
      }
      return "예상 수령액은 국민연금공단에서 확인할 수 있어요.";
    },
  },

  // 13. 퇴직연금
  retirement_pension: {
    title: (data) => {
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      if (hasWorkingSpouse) return "부부 퇴직연금";
      const isDCType = data.retirementPensionType === "DC" || data.retirementPensionType === "corporate_irp";
      const isDBType = data.retirementPensionType === "DB" || data.retirementPensionType === "severance";
      if (isDCType) return "DC형/기업IRP";
      if (isDBType) return "DB형/퇴직금";
      return "퇴직연금 유형을 선택하세요";
    },
    description: (data) => {
      const isDCType = data.retirementPensionType === "DC" || data.retirementPensionType === "corporate_irp";
      const isDBType = data.retirementPensionType === "DB" || data.retirementPensionType === "severance";
      if (isDCType) {
        return "본인이 직접 운용하고, 수익에 따라 수령액이 달라져요. 현재 적립된 금액을 입력하세요.";
      }
      if (isDBType) {
        return "회사가 운용하고, 퇴직 시 급여x근속연수로 계산돼요. 현재 근속년수를 입력하면 예상 퇴직금을 계산해드려요.";
      }
      return "급여명세서나 사내 인트라넷에서 유형을 확인할 수 있어요.";
    },
  },

  // 14. 개인연금
  personal_pension: {
    title: "개인연금 유형 알아보기",
    description:
      "IRP와 연금저축은 55세 이후 연금으로 받는 노후 준비 상품이에요. ISA는 절세 투자계좌라 저축/투자에서 관리합니다.",
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
