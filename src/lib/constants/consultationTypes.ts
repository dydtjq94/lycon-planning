// 8가지 상담 유형 공유 상수
export interface ConsultationTypeData {
  id: string;
  name: string;
  description: string;
  period: string;
  periodMonths: number | null;
  isRequired: boolean;
  color: string;
}

export const CONSULTATION_TYPES: ConsultationTypeData[] = [
  {
    id: "retirement-diagnosis",
    name: "기본형 종합 재무 검진",
    description: "은퇴 진단",
    period: "2년마다",
    periodMonths: 24,
    isRequired: true,
    color: "#007aff",
  },
  {
    id: "budget-consultation",
    name: "가계부 상담",
    description: "월별 수입/지출 점검",
    period: "매월",
    periodMonths: 1,
    isRequired: true,
    color: "#34c759",
  },
  {
    id: "investment-portfolio",
    name: "투자 포트폴리오 상담",
    description: "투자 전략, 리밸런싱",
    period: "분기마다",
    periodMonths: 3,
    isRequired: true,
    color: "#5856d6",
  },
  {
    id: "asset-review",
    name: "자산 현황 파악",
    description: "전체 자산 점검",
    period: "반기마다",
    periodMonths: 6,
    isRequired: true,
    color: "#ff9500",
  },
  {
    id: "pension-analysis",
    name: "연금 분석",
    description: "연금 수령 전략",
    period: "매년",
    periodMonths: 12,
    isRequired: true,
    color: "#af52de",
  },
  {
    id: "real-estate",
    name: "부동산 상담",
    description: "매매, 임대, 대출",
    period: "상시",
    periodMonths: null,
    isRequired: false,
    color: "#ff3b30",
  },
  {
    id: "tax-consultation",
    name: "세금 상담",
    description: "절세 전략, 신고",
    period: "상시",
    periodMonths: null,
    isRequired: false,
    color: "#00c7be",
  },
  {
    id: "financial-decision",
    name: "재무 의사결정 상담",
    description: "주요 재무 결정 지원",
    period: "상시",
    periodMonths: null,
    isRequired: false,
    color: "#8e8e93",
  },
];

// ID로 상담 유형 찾기 헬퍼
export function getConsultationType(id: string): ConsultationTypeData | undefined {
  return CONSULTATION_TYPES.find(t => t.id === id);
}
