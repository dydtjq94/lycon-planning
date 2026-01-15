import type { OnboardingData, OnboardingPurpose } from "@/types";
import type { StepId } from "./types";
import { calculateAge } from "./types";

// ============================================
// 담당자 메시지 타입
// ============================================

interface StepMessages {
  greeting: string | ((data: OnboardingData) => string);
  response: (data: OnboardingData) => string | null;
}

// ============================================
// 목적별 공감 메시지
// ============================================

const purposeResponses: Record<OnboardingPurpose, string> = {
  retirement_fund: "얼마가 필요한지, 함께 계산해봐요.",
  savings_check: "잘 하고 계신지, 같이 확인해봐요.",
  pension_calc: "연금 구조, 쉽게 정리해드릴게요.",
  asset_organize: "흩어진 자산, 한눈에 정리해드릴게요.",
  dont_know: "괜찮아요. 그래서 저희가 있는 거예요.",
};

// ============================================
// 스텝별 메시지 정의
// ============================================

export const stepMessages: Record<StepId, StepMessages> = {
  // 인트로
  welcome: {
    greeting: `안녕하세요, 은퇴 준비 어디서부터 시작해야 할지 막막하셨죠?

걱정 마세요.
저희가 처음부터 끝까지 함께할게요.`,
    response: () => null,
  },

  // 목적
  purpose: {
    greeting: `어떤 고민이 있으세요?

여러 개 선택해도 돼요.`,
    response: (data) => {
      const purposes = data.purposes || [];
      if (purposes.length === 0) return null;

      const firstPurpose = purposes[0];
      const empathy = purposeResponses[firstPurpose];

      return `좋아요.
${empathy}

먼저 몇 가지만 여쭤볼게요.
어렵지 않아요.`;
    },
  },

  // 이름
  name: {
    greeting: `이름이 어떻게 되세요?`,
    response: (data) => {
      if (!data.name) return null;
      return `${data.name}님, 반갑습니다.

오늘부터 저희가 함께할게요.`;
    },
  },

  // 생년월일
  birth: {
    greeting: `생년월일을 알려주세요.

나이에 따라 준비 방법이 달라져요.`,
    response: (data) => {
      if (!data.birth_date) return null;
      const age = calculateAge(data.birth_date);

      if (age < 35) {
        return `만 ${age}세시군요.

시간이 가장 큰 무기예요.
일찍 시작하신 거, 정말 잘하셨어요.`;
      } else if (age < 45) {
        return `만 ${age}세시군요.

지금이 가장 중요한 시기예요.
오늘 시작하시는 거, 잘하고 계세요.`;
      } else if (age < 55) {
        return `만 ${age}세시군요.

아직 늦지 않았어요.
지금부터 집중하면 충분해요.`;
      } else {
        return `만 ${age}세시군요.

늦었다고 생각하실 수 있지만,
지금이 가장 빠른 때예요.`;
      }
    },
  },

  // 은퇴 나이
  retirement_age: {
    greeting: `몇 살까지 일하고 싶으세요?

목표가 있어야 계획을 세울 수 있어요.`,
    response: (data) => {
      if (!data.target_retirement_age || !data.birth_date) return null;
      const age = calculateAge(data.birth_date);
      const yearsLeft = data.target_retirement_age - age;

      if (yearsLeft > 20) {
        return `${yearsLeft}년이나 있네요.

충분한 시간이에요.
차근차근 준비해봐요.`;
      } else if (yearsLeft > 10) {
        return `${yearsLeft}년 남았어요.

지금 시작하면
여유 있게 준비할 수 있어요.`;
      } else if (yearsLeft > 0) {
        return `${yearsLeft}년 남았네요.

짧다고 느끼실 수 있지만,
집중하면 많은 게 달라져요.`;
      } else {
        return `이미 지나셨지만 괜찮아요.

지금 상황에서 할 수 있는
최선을 함께 찾아봐요.`;
      }
    },
  },

  // 결혼 여부
  spouse: {
    greeting: `결혼하셨나요?

혼자인지, 둘인지에 따라
계획이 완전히 달라져요.`,
    response: (data) => {
      if (data.isMarried === null) return null;

      if (data.isMarried) {
        return `두 분이시군요.

함께 준비하면 더 든든해요.
배우자분 정보도 알려주세요.`;
      } else {
        return `알겠습니다.

${data.name}님 상황에 맞게
계획을 세워드릴게요.`;
      }
    },
  },

  // 배우자 정보
  spouse_info: {
    greeting: `배우자분은 어떻게 되세요?

두 분의 은퇴 시점이 다르면
준비 방법도 달라져요.`,
    response: (data) => {
      if (!data.spouse?.birth_date) return null;

      const spouseAge = calculateAge(data.spouse.birth_date);
      const hasSpouseIncome = data.spouse?.retirement_age !== undefined;

      if (hasSpouseIncome) {
        return `배우자분은 만 ${spouseAge}세,
${data.spouse.retirement_age}세에 은퇴 예정이시군요.

두 분 상황을 함께 고려할게요.`;
      } else {
        return `배우자분은 만 ${spouseAge}세시군요.

두 분 함께 고려해서 준비해드릴게요.`;
      }
    },
  },

  // 자녀 여부
  children: {
    greeting: `자녀가 있으신가요?

교육비와 은퇴 준비,
둘 다 챙겨야 하니까요.`,
    response: (data) => {
      if (data.hasChildren === null) return null;

      if (data.hasChildren) {
        return `그렇군요.

교육비도 큰 부분이죠.
둘 다 놓치지 않게 계획해드릴게요.`;
      } else {
        const target = data.isMarried ? "두 분" : data.name + "님";
        return `알겠습니다.

${target} 은퇴에 집중해서
준비해드릴게요.`;
      }
    },
  },

  // 자녀 정보
  children_info: {
    greeting: `자녀분들 생년월일을 알려주세요.

나이에 따라 교육비 시기가 달라져요.`,
    response: (data) => {
      if (data.children.length === 0) return null;

      const childCount = data.children.length;

      return `${childCount}명이시군요.

교육비 시기를 고려해서
은퇴 계획에 반영할게요.`;
    },
  },

  // 소득
  income: {
    greeting: `월 소득이 어느 정도 되세요?

정확하지 않아도 괜찮아요.
대략적인 금액이면 충분해요.`,
    response: (data) => {
      if (data.laborIncome === null) return null;

      const totalIncome =
        (data.laborIncome || 0) + (data.spouseLaborIncome || 0);

      if (totalIncome > 0) {
        return `월 ${totalIncome.toLocaleString()}만원이시군요.

이 소득으로 어떻게 준비할 수 있는지
보여드릴게요.`;
      } else {
        return `현재 소득이 없으시군요.

자산과 연금 중심으로
계획을 세워드릴게요.`;
      }
    },
  },

  // 지출
  expense: {
    greeting: `한 달 생활비는 얼마 정도 쓰세요?

주거비, 식비 등 다 포함해서요.
은퇴 후에도 이 정도는 필요하니까요.`,
    response: (data) => {
      if (data.livingExpenses === null) return null;

      const totalIncome =
        (data.laborIncome || 0) + (data.spouseLaborIncome || 0);
      const savings = totalIncome - (data.livingExpenses || 0);

      if (savings > 0) {
        return `매달 ${savings.toLocaleString()}만원 정도
저축이 가능하시네요.

이 돈으로 어떻게 준비할 수 있는지
보여드릴게요.`;
      } else if (savings === 0) {
        return `수입과 지출이 비슷하시네요.

저축 여력을 만드는 것부터
함께 고민해봐요.`;
      } else {
        return `지출이 좀 더 많으시네요.

괜찮아요.
현실적인 계획을 함께 세워봐요.`;
      }
    },
  },

  // 완료
  complete: {
    greeting: (data) => `${data.name}님, 감사합니다.

이제 ${data.name}님만의
은퇴 계획을 만들어드릴게요.

준비되셨으면 시작해볼까요?`,
    response: () => null,
  },
};

// ============================================
// 메시지 가져오기 헬퍼
// ============================================

export function getGreeting(stepId: StepId, data: OnboardingData): string {
  const messages = stepMessages[stepId];
  if (typeof messages.greeting === "function") {
    return messages.greeting(data);
  }
  return messages.greeting;
}

export function getResponse(
  stepId: StepId,
  data: OnboardingData
): string | null {
  const messages = stepMessages[stepId];
  return messages.response(data);
}
