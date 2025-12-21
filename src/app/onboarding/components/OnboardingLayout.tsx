'use client'

import { ReactNode } from 'react'
import { BarChart3 } from 'lucide-react'
import styles from '../onboarding.module.css'

interface OnboardingLayoutProps {
  children: ReactNode
  navigation?: ReactNode
  currentStepName: string
  currentStepId: string
  progress: number
  totalSteps: number
  currentStepIndex: number
}

// 스텝별 전문 인사이트
const stepInsights: Record<string, { title: string; description: string; stat?: string; statLabel?: string }> = {
  welcome: {
    title: '왜 은퇴 계획이 중요할까요?',
    description: '기대수명 90세 기준, 60세에 은퇴한다면 약 30년의 노후 생활을 준비해야 합니다. 하지만 국민연금만으로는 노후 생활비의 25%만 충당할 수 있습니다. 체계적인 재무 계획을 세운 사람은 그렇지 않은 사람보다 노후 자금을 2배 이상 더 모으는 것으로 나타났습니다.',
    stat: '90세',
    statLabel: '기대수명',
  },
  basic: {
    title: '복리의 마법, 시간이 돈입니다',
    description: '30세에 매월 100만원을 저축하면 60세에 약 12억원이 됩니다. 하지만 40세에 시작하면 같은 금액으로 약 5억원밖에 모으지 못합니다. 10년의 차이가 7억원의 차이를 만듭니다. 이것이 바로 복리의 힘입니다. 은퇴 계획에서 가장 중요한 것은 "언제 시작하느냐"입니다.',
    stat: '10년 = 7억',
    statLabel: '늦게 시작할수록 커지는 격차',
  },
  family: {
    title: '가족 구성이 은퇴 자금에 미치는 영향',
    description: '국민연금연구원에 따르면, 부부 2인 가구의 적정 노후 생활비는 월 277만원입니다. 여기에 부양가족이 있다면 추가 비용이 발생합니다. 자녀 1인당 대학 졸업까지 약 3억원, 부모님 부양 시 월 50~100만원의 추가 지출이 예상됩니다. 정확한 가족 정보 입력이 현실적인 은퇴 계획의 시작입니다.',
    stat: '월 277만원',
    statLabel: '부부 적정 노후 생활비',
  },
  category: {
    title: '맞춤형 계획을 세워보세요',
    description: '모든 사람의 재무 상황은 다릅니다. 어떤 분은 부동산 자산이 많고, 어떤 분은 금융자산 위주로 포트폴리오를 구성합니다. Lycon은 당신의 상황에 맞는 항목만 선택해서 입력할 수 있습니다. 지금 당장 모든 정보가 없어도 괜찮습니다. 나중에 언제든 추가하고 수정할 수 있습니다.',
    stat: '나만의 계획',
    statLabel: '필요한 것만 선택하세요',
  },
  income: {
    title: '소득 파악이 재무 계획의 시작입니다',
    description: '2025년 기준 대한민국 가구 평균 소득은 월 548만원입니다. 하지만 평균은 의미가 없습니다. 중요한 것은 "나의 소득"입니다. 급여 외에도 상여금, 부수입, 임대소득, 이자소득 등 모든 수입원을 파악해야 정확한 저축 가능 금액을 알 수 있습니다.',
    stat: '월 548만원',
    statLabel: '가구 평균 소득 (2025)',
  },
  expense: {
    title: '지출 관리가 부의 열쇠입니다',
    description: '연구에 따르면, 고소득자보다 지출을 잘 관리하는 사람이 더 많은 자산을 형성합니다. 월 지출을 10%만 줄여도 은퇴 시기를 5년 앞당길 수 있습니다. 특히 고정 지출(주거비, 보험료, 구독료 등)을 먼저 파악하고 최적화하는 것이 중요합니다. 라떼 한 잔이 아닌, 구조적인 지출 개선이 필요합니다.',
    stat: '-10% 지출',
    statLabel: '= 5년 빠른 은퇴',
  },
  realEstate: {
    title: '부동산, 한국인 자산의 핵심',
    description: '한국 가계 자산의 약 70%가 부동산입니다. 이는 미국(28%)이나 일본(37%)에 비해 매우 높은 수치입니다. 부동산은 거주 목적뿐 아니라 노후 자금원으로도 활용될 수 있습니다. 주택연금을 활용하면 9억원 주택 기준 월 약 200만원의 연금을 받을 수 있습니다.',
    stat: '70%',
    statLabel: '한국 가계자산 중 부동산 비중',
  },
  asset: {
    title: '금융자산 다변화의 중요성',
    description: '예금만으로는 인플레이션을 이기기 어렵습니다. 지난 10년간 예금 금리는 평균 2%인 반면, 인플레이션은 평균 2.5%였습니다. 실질적으로 돈의 가치가 줄어든 것입니다. 주식, 채권, 펀드, ETF 등 다양한 자산에 분산 투자해야 장기적으로 자산을 불릴 수 있습니다.',
    stat: '2% vs 2.5%',
    statLabel: '예금금리 vs 인플레이션',
  },
  debt: {
    title: '은퇴 전 부채 정리가 핵심입니다',
    description: '2025년 기준 한국 가구당 평균 부채는 9,480만원입니다. 특히 50대 가구의 부채가 가장 많습니다. 은퇴 후에는 소득이 급감하기 때문에, 은퇴 전에 부채를 정리하는 것이 매우 중요합니다. 주택담보대출의 경우, 은퇴 시점에 맞춰 상환 계획을 세우는 것을 권장합니다.',
    stat: '9,480만원',
    statLabel: '가구당 평균 부채',
  },
  pension: {
    title: '3층 연금 구조를 이해하세요',
    description: '안정적인 노후를 위해서는 국민연금(1층), 퇴직연금(2층), 개인연금(3층)의 3층 구조가 필요합니다. 국민연금만으로는 노후 생활비의 25%만 충당됩니다. 40년 가입 기준 월 평균 수령액은 약 180만원입니다. 나머지 75%는 퇴직연금과 개인연금, 그리고 금융자산으로 채워야 합니다.',
    stat: '25%',
    statLabel: '국민연금으로 충당 가능한 노후 생활비',
  },
  goals: {
    title: '명확한 목표가 성공을 만듭니다',
    description: '도미니칸 대학교 연구에 따르면, 목표를 글로 적은 사람은 그렇지 않은 사람보다 달성 확률이 42% 높았습니다. 은퇴 목표도 마찬가지입니다. "언제까지, 얼마를 모으겠다"는 구체적인 목표가 있어야 실행력이 생깁니다. Lycon이 당신의 목표 달성을 도와드리겠습니다.',
    stat: '+42%',
    statLabel: '목표를 적으면 높아지는 달성 확률',
  },
}

export function OnboardingLayout({
  children,
  navigation,
  currentStepName,
  currentStepId,
  progress,
  totalSteps,
  currentStepIndex
}: OnboardingLayoutProps) {
  const insight = stepInsights[currentStepId] || stepInsights.welcome

  return (
    <div className={styles.page}>
      {/* 프로그레스 바 - 최상단 */}
      <div className={styles.topProgressBar}>
        <div
          className={styles.topProgressFill}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerLogo}>
            <BarChart3 className={styles.headerIcon} />
          </div>
          <span className={styles.headerTitle}>Lycon</span>
        </div>
        <div className={styles.headerCenter}>
          <span className={styles.headerStepLabel}>{currentStepName}</span>
          <span className={styles.headerStepCount}>Step {currentStepIndex + 1}/{totalSteps}</span>
        </div>
        <div className={styles.headerRight} />
      </header>

      {/* 메인 영역 - 2단 레이아웃 */}
      <div className={styles.mainLayout}>
        {/* 왼쪽: 폼 영역 */}
        <div className={styles.leftPanel}>
          <div className={styles.leftPanelContent}>
            <div className={styles.content}>
              {children}
            </div>
          </div>
          {navigation}
        </div>

        {/* 오른쪽: 인사이트 영역 */}
        <div className={styles.rightPanel}>
          <div className={styles.insightContent}>
            {insight.stat && (
              <div className={styles.insightStatBox}>
                <span className={styles.insightStat}>{insight.stat}</span>
                <span className={styles.insightStatLabel}>{insight.statLabel}</span>
              </div>
            )}
            <h3 className={styles.insightTitle}>{insight.title}</h3>
            <p className={styles.insightDescription}>{insight.description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
