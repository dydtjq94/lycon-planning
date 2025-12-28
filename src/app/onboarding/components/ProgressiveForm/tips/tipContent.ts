import type { OnboardingData } from "@/types";
import type { SectionId } from "../../SectionForm";
import type { RowId } from "../types";

// TIP 콘텐츠 타입 (내부 저장용 - title이 함수일 수 있음)
export interface TipContentRaw {
  title: string | ((data: OnboardingData) => string);
  description: string;
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
    title: "금융자산",
    description: "예금, 주식, 펀드 등 분산 투자가 중요합니다.",
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
    description:
      "100세 시대, Lycon은 돈이 아닌 인생을 설계합니다. 은퇴, 자녀 독립, 노후까지 — 당신의 인생 여정을 함께 계획해 드릴게요.",
  },

  // 3. 자녀
  children: {
    title: "아이 한 명, 꿈 하나",
    description:
      "첫 울음부터 결혼식장까지. 부모의 사랑은 숫자로 다 담을 수 없지만, 미리 준비하면 더 많은 것을 해줄 수 있어요.",
  },

  // 4. 은퇴 나이
  retirement_age: {
    title: "정답은 없어요",
    description:
      "대략적으로 생각하시는 나이면 충분해요. 한국인 평균 희망 은퇴 나이는 60세예요.",
  },

  // 5. 은퇴 자금
  retirement_fund: {
    title: "잘 모르겠다면?",
    description:
      "10억(100,000만원)으로 시작해도 괜찮아요. 나중에 결과를 보고 조정하면 돼요.",
  },

  // 6. 근로소득
  labor_income: {
    title: "세전 금액이에요",
    description:
      "급여명세서의 '지급총액'을 입력하세요. 상여금 포함해서 월평균으로 넣으면 돼요.",
  },

  // 7. 사업소득
  business_income: {
    title: "없으면 0 입력하세요",
    description:
      "프리랜서, 자영업 등 사업으로 버는 수입이에요. 직장인이라면 0으로 넘어가세요.",
  },

  // 8. 생활비
  living_expenses: {
    title: "대략적인 금액이면 충분해요",
    description:
      "토스, 뱅크샐러드 등 가계부 앱에서 월평균 지출을 확인할 수 있어요. 저축/투자 금액은 빼고 입력하세요.",
  },

  // 9. 부동산
  realEstate: {
    title: "현재 사는 곳 기준이에요",
    description:
      "자가라면 KB부동산이나 네이버부동산에서 시세를 확인할 수 있어요.",
  },

  // 10. 금융자산
  asset: {
    title: "통장 잔액 합계면 돼요",
    description:
      "토스, 뱅크샐러드에서 전체 자산을 한눈에 확인할 수 있어요. 연금 계좌는 따로 입력할 거예요.",
  },

  // 11. 부채
  debt: {
    title: "주담대 외 부채만 입력하세요",
    description:
      "주택담보대출은 앞에서 입력했어요. 신용대출, 카드론 등 다른 부채가 있다면 추가해주세요.",
  },

  // 12. 국민연금
  national_pension: {
    title: "모르면 나중에 수정해도 돼요",
    description:
      "국민연금공단(nps.or.kr) > '내 연금 알아보기'에서 예상 수령액을 확인할 수 있어요.",
  },

  // 13. 퇴직연금
  retirement_pension: {
    title: "회사 인사팀에 물어보세요",
    description:
      "급여명세서나 사내 인트라넷에서 확인할 수 있어요. DC형/DB형 유형과 현재 적립금을 입력해주세요.",
  },

  // 14. 개인연금
  personal_pension: {
    title: "거의 다 왔어요!",
    description:
      "IRP, 연금저축, ISA 등 개인적으로 가입한 연금 계좌가 있다면 입력해주세요. 없으면 0으로 넘어가세요.",
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

  return {
    title,
    description: rawTip.description,
  };
}
