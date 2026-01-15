// 설문 질문 타입 정의
export type QuestionType = 'single' | 'multi' | 'number' | 'amount'

export interface QuestionOption {
  value: string
  label: string
}

export interface Question {
  id: string
  text: string
  type: QuestionType
  options?: QuestionOption[]
  unit?: string  // 숫자/금액 입력시 단위
  placeholder?: string
  min?: number
  max?: number
}

export interface MissionQuestions {
  missionId: string
  questions: Question[]
}

// 각 미션별 설문 질문 정의
export const surveyQuestions: MissionQuestions[] = [
  // ========== 1단계: 나를 알기 ==========
  {
    missionId: 'family-composition',
    questions: [
      {
        id: 'has-spouse',
        text: '배우자가 있으신가요?',
        type: 'single',
        options: [
          { value: 'yes', label: '예, 있습니다' },
          { value: 'no', label: '아니요' },
        ],
      },
      {
        id: 'spouse-age',
        text: '배우자 나이는 어떻게 되시나요?',
        type: 'number',
        unit: '세',
        placeholder: '40',
        min: 20,
        max: 100,
      },
      {
        id: 'children-count',
        text: '자녀가 몇 명인가요?',
        type: 'single',
        options: [
          { value: '0', label: '없음' },
          { value: '1', label: '1명' },
          { value: '2', label: '2명' },
          { value: '3+', label: '3명 이상' },
        ],
      },
      {
        id: 'dependents',
        text: '부양하는 부모님이 계신가요?',
        type: 'single',
        options: [
          { value: 'none', label: '없음' },
          { value: 'one', label: '1분' },
          { value: 'both', label: '2분 이상' },
        ],
      },
    ],
  },
  {
    missionId: 'retirement-goal',
    questions: [
      {
        id: 'target-retirement-age',
        text: '몇 세에 은퇴하고 싶으세요?',
        type: 'number',
        unit: '세',
        placeholder: '60',
        min: 40,
        max: 80,
      },
      {
        id: 'retirement-lifestyle',
        text: '은퇴 후 어떤 삶을 살고 싶으세요?',
        type: 'single',
        options: [
          { value: '60', label: '검소하게 살래요' },
          { value: '80', label: '지금처럼 살고 싶어요' },
          { value: '100', label: '더 여유롭게 살고 싶어요' },
        ],
      },
    ],
  },
  {
    missionId: 'investment-style',
    questions: [
      {
        id: 'investment-experience',
        text: '투자 경험이 어느 정도인가요?',
        type: 'single',
        options: [
          { value: 'none', label: '거의 없음' },
          { value: 'beginner', label: '예적금/펀드 정도' },
          { value: 'intermediate', label: '주식/ETF 투자 중' },
          { value: 'advanced', label: '다양한 자산에 투자 중' },
        ],
      },
      {
        id: 'max-loss-tolerance',
        text: '투자 원금의 최대 몇 %까지 손실을 감수할 수 있나요?',
        type: 'single',
        options: [
          { value: '0', label: '손실은 안 돼요' },
          { value: '10', label: '10%까지' },
          { value: '20', label: '20%까지' },
          { value: '30', label: '30% 이상도 괜찮아요' },
        ],
      },
      {
        id: 'market-crash-reaction',
        text: '투자 자산이 20% 하락하면 어떻게 하시겠어요?',
        type: 'single',
        options: [
          { value: 'sell', label: '손절하고 안전자산으로' },
          { value: 'hold', label: '그대로 보유' },
          { value: 'buy', label: '추가 매수 기회로 봄' },
        ],
      },
      {
        id: 'investment-preference',
        text: '선호하는 투자 스타일은?',
        type: 'single',
        options: [
          { value: 'safe', label: '안정형 (예금/채권 중심)' },
          { value: 'balanced', label: '균형형 (주식+채권 혼합)' },
          { value: 'growth', label: '성장형 (주식/ETF 중심)' },
        ],
      },
      {
        id: 'investment-goal',
        text: '투자의 주된 목적은 무엇인가요?',
        type: 'single',
        options: [
          { value: 'retirement', label: '은퇴 자금 마련' },
          { value: 'wealth', label: '자산 증식' },
          { value: 'income', label: '정기적인 수익 (배당 등)' },
          { value: 'preserve', label: '자산 보존 (물가 방어)' },
        ],
      },
      {
        id: 'investment-horizon',
        text: '투자 기간은 어느 정도로 생각하세요?',
        type: 'single',
        options: [
          { value: 'short', label: '3년 이내' },
          { value: 'medium', label: '3~10년' },
          { value: 'long', label: '10년 이상' },
        ],
      },
    ],
  },
  {
    missionId: 'concerns',
    questions: [
      {
        id: 'considerations',
        text: '요즘 이런 것들 생각하고 계세요?',
        type: 'multi',
        options: [
          { value: 'retirement-expense', label: '은퇴 후 생활비' },
          { value: 'health', label: '건강/의료비' },
          { value: 'children-education', label: '자녀 교육비' },
          { value: 'children-wedding', label: '자녀 결혼' },
          { value: 'children-housing', label: '자녀 주거 지원' },
          { value: 'parents-support', label: '부모님 부양' },
          { value: 'real-estate-rebuild', label: '부동산 재건축' },
          { value: 'real-estate-sell', label: '부동산 매도' },
          { value: 'real-estate-buy', label: '부동산 매입' },
          { value: 'housing-downsize', label: '주택 다운사이징' },
          { value: 'travel-hobby', label: '여행/취미' },
          { value: 'side-business', label: '창업/부업' },
          { value: 'relocation', label: '귀농/귀촌' },
          { value: 'gift', label: '사전 증여' },
          { value: 'inheritance', label: '상속 계획' },
          { value: 'long-term-care', label: '장기요양 대비' },
        ],
      },
      {
        id: 'current-stage',
        text: '지금 은퇴 준비는 어느 정도 하고 계세요?',
        type: 'single',
        options: [
          { value: 'thinking', label: '아직 생각만' },
          { value: 'starting', label: '조금씩 시작하는 중' },
          { value: 'ongoing', label: '꾸준히 하는 중' },
        ],
      },
    ],
  },

  // ========== 2단계: 자산 파악 ==========
  {
    missionId: 'realestate-residence',
    questions: [
      {
        id: 'residence-type',
        text: '현재 거주 형태는 어떻게 되시나요?',
        type: 'single',
        options: [
          { value: 'own', label: '자가' },
          { value: 'jeonse', label: '전세' },
          { value: 'monthly', label: '월세' },
          { value: 'other', label: '기타 (부모님 집 등)' },
        ],
      },
      {
        id: 'residence-property-type',
        text: '어떤 유형의 부동산인가요?',
        type: 'single',
        options: [
          { value: 'apt', label: '아파트' },
          { value: 'villa', label: '빌라/연립' },
          { value: 'house', label: '단독주택' },
          { value: 'officetel', label: '오피스텔' },
        ],
      },
      {
        id: 'residence-value',
        text: '현재 시세는 얼마 정도인가요?',
        type: 'amount',
        unit: '만원',
        placeholder: '50000',
      },
      {
        id: 'residence-deposit',
        text: '보증금/전세금은 얼마인가요? (자가면 0)',
        type: 'amount',
        unit: '만원',
        placeholder: '30000',
      },
    ],
  },
  {
    missionId: 'realestate-investment',
    questions: [
      {
        id: 'has-investment-property',
        text: '거주용 외에 보유한 부동산이 있나요?',
        type: 'single',
        options: [
          { value: 'yes', label: '예, 있습니다' },
          { value: 'no', label: '아니요, 없습니다' },
        ],
      },
      {
        id: 'investment-property-count',
        text: '몇 채를 보유하고 계신가요?',
        type: 'number',
        unit: '채',
        placeholder: '1',
        min: 1,
        max: 10,
      },
      {
        id: 'investment-property-value',
        text: '총 시세는 얼마 정도인가요?',
        type: 'amount',
        unit: '만원',
        placeholder: '30000',
      },
      {
        id: 'has-rental-income',
        text: '임대 수익이 있나요?',
        type: 'single',
        options: [
          { value: 'yes', label: '예, 있습니다' },
          { value: 'no', label: '아니요 (공실/투자용)' },
        ],
      },
      {
        id: 'monthly-rental-income',
        text: '월 임대 수익은 얼마인가요?',
        type: 'amount',
        unit: '만원',
        placeholder: '100',
      },
    ],
  },

  // ========== 4단계: 미래 계획 ==========
  {
    missionId: 'plan-children-education',
    questions: [
      {
        id: 'education-support',
        text: '자녀 교육비를 지원할 계획인가요?',
        type: 'single',
        options: [
          { value: 'no', label: '해당 없음' },
          { value: 'partial', label: '일부만 지원' },
          { value: 'full', label: '전액 지원' },
        ],
      },
      {
        id: 'education-level',
        text: '어디까지 지원할 예정인가요?',
        type: 'single',
        options: [
          { value: 'high', label: '고등학교까지' },
          { value: 'university', label: '대학교까지' },
          { value: 'graduate', label: '대학원/유학까지' },
        ],
      },
      {
        id: 'education-budget',
        text: '예상 교육비 총액은?',
        type: 'amount',
        unit: '만원',
        placeholder: '5000',
      },
    ],
  },
  {
    missionId: 'plan-children-wedding',
    questions: [
      {
        id: 'wedding-support',
        text: '자녀 결혼 비용을 지원할 계획인가요?',
        type: 'single',
        options: [
          { value: 'no', label: '해당 없음' },
          { value: 'partial', label: '일부만 지원' },
          { value: 'full', label: '전액 지원' },
        ],
      },
      {
        id: 'wedding-budget',
        text: '자녀 1인당 예상 지원금은?',
        type: 'amount',
        unit: '만원',
        placeholder: '3000',
      },
    ],
  },
  {
    missionId: 'plan-children-housing',
    questions: [
      {
        id: 'housing-support',
        text: '자녀 주거 마련을 도울 계획인가요?',
        type: 'single',
        options: [
          { value: 'no', label: '해당 없음' },
          { value: 'rent', label: '전세 자금 지원' },
          { value: 'buy', label: '내 집 마련 지원' },
        ],
      },
      {
        id: 'housing-budget',
        text: '자녀 1인당 예상 지원금은?',
        type: 'amount',
        unit: '만원',
        placeholder: '10000',
      },
    ],
  },
  {
    missionId: 'plan-parents',
    questions: [
      {
        id: 'parents-support',
        text: '부모님 부양 비용이 필요한가요?',
        type: 'single',
        options: [
          { value: 'no', label: '해당 없음' },
          { value: 'partial', label: '형제와 분담' },
          { value: 'full', label: '전액 부담' },
        ],
      },
      {
        id: 'parents-monthly',
        text: '월 부양 비용은 얼마 정도인가요?',
        type: 'amount',
        unit: '만원',
        placeholder: '50',
      },
      {
        id: 'parents-years',
        text: '몇 년 정도 예상하시나요?',
        type: 'number',
        unit: '년',
        placeholder: '15',
        min: 1,
        max: 40,
      },
    ],
  },
  {
    missionId: 'plan-housing',
    questions: [
      {
        id: 'housing-plan',
        text: '향후 주택 계획이 있으신가요?',
        type: 'single',
        options: [
          { value: 'none', label: '현재 유지' },
          { value: 'downsize', label: '규모 축소 (다운사이징)' },
          { value: 'move', label: '이사 계획 있음' },
          { value: 'buy', label: '추가 매입 계획' },
        ],
      },
      {
        id: 'housing-timeline',
        text: '언제쯤 실행할 계획인가요?',
        type: 'single',
        options: [
          { value: 'soon', label: '3년 이내' },
          { value: 'medium', label: '3~10년' },
          { value: 'retirement', label: '은퇴 후' },
        ],
      },
    ],
  },
  {
    missionId: 'plan-retirement-expense',
    questions: [
      {
        id: 'retirement-monthly',
        text: '은퇴 후 월 생활비는 얼마가 필요할까요?',
        type: 'amount',
        unit: '만원',
        placeholder: '300',
      },
      {
        id: 'expense-change',
        text: '현재 지출 대비 어느 정도로 예상하세요?',
        type: 'single',
        options: [
          { value: '60', label: '60% (크게 줄임)' },
          { value: '70', label: '70%' },
          { value: '80', label: '80%' },
          { value: '100', label: '100% (현재와 동일)' },
        ],
      },
    ],
  },
  {
    missionId: 'plan-bucket-list',
    questions: [
      {
        id: 'bucket-items',
        text: '은퇴 후 하고 싶은 것들은?',
        type: 'multi',
        options: [
          { value: 'travel', label: '여행' },
          { value: 'hobby', label: '취미 활동' },
          { value: 'volunteer', label: '봉사 활동' },
          { value: 'business', label: '창업/부업' },
          { value: 'study', label: '공부/자기계발' },
        ],
      },
      {
        id: 'bucket-budget',
        text: '이를 위한 예산은 얼마나 생각하세요?',
        type: 'amount',
        unit: '만원',
        placeholder: '5000',
      },
    ],
  },
  {
    missionId: 'plan-inheritance',
    questions: [
      {
        id: 'inheritance-plan',
        text: '자녀에게 자산을 물려줄 계획인가요?',
        type: 'single',
        options: [
          { value: 'no', label: '없음 (다 쓸 예정)' },
          { value: 'some', label: '일부만' },
          { value: 'most', label: '대부분' },
        ],
      },
      {
        id: 'inheritance-timing',
        text: '언제 물려줄 생각이신가요?',
        type: 'single',
        options: [
          { value: 'early', label: '사전 증여' },
          { value: 'death', label: '사후 상속' },
          { value: 'both', label: '둘 다 활용' },
        ],
      },
    ],
  },
  {
    missionId: 'final-review',
    questions: [
      {
        id: 'confirm-info',
        text: '입력하신 정보가 정확한가요?',
        type: 'single',
        options: [
          { value: 'yes', label: '예, 정확합니다' },
          { value: 'modify', label: '수정이 필요합니다' },
        ],
      },
      {
        id: 'additional-info',
        text: '전문가에게 추가로 전달할 내용이 있나요?',
        type: 'single',
        options: [
          { value: 'no', label: '없습니다' },
          { value: 'yes', label: '있습니다 (메시지로 전달)' },
        ],
      },
    ],
  },
]

// 미션 ID로 질문 가져오기
export function getQuestionsForMission(missionId: string): Question[] {
  const mission = surveyQuestions.find(m => m.missionId === missionId)
  return mission?.questions || []
}
