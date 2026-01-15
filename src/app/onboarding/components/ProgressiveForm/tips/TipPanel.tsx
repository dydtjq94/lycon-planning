'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import type { StepId, PartId } from '../types'
import { purposeEmpathy } from '../types'
import {
  LifeNavigationChart,
  SavingsRateChart,
} from './charts'
import styles from './TipPanel.module.css'

interface TipPanelProps {
  activeStep: StepId
  currentPart: PartId
  data: OnboardingData
}

// 스텝별 공감 메시지
function getEmpathyMessage(step: StepId, data: OnboardingData): { title: string; description: string } | null {
  const { name, birth_date, target_retirement_age, laborIncome, livingExpenses, isMarried, hasChildren, purposes } = data

  switch (step) {
    // Part 1: 목적
    case 'purpose':
      return null // 선택 전에는 공감 메시지 없음

    case 'purpose_empathy':
      // 선택한 목적들의 공감 메시지
      if (purposes && purposes.length > 0) {
        const firstPurpose = purposes[0]
        return {
          title: '',
          description: purposeEmpathy[firstPurpose],
        }
      }
      return null

    // Part 2: 알아가기
    case 'name':
      if (name) {
        return {
          title: `반가워요, ${name}님`,
          description: `앞으로 ${name}님의 은퇴 준비를 함께할게요.`,
        }
      }
      return null

    case 'birth':
      if (birth_date) {
        const age = calculateAge(birth_date)
        return {
          title: `${name || ''}님은 지금 ${age}세시네요`,
          description: '은퇴는 언제쯤 생각하고 계세요?',
        }
      }
      return null

    case 'retirement_age':
      if (target_retirement_age && birth_date) {
        const age = calculateAge(birth_date)
        const yearsLeft = target_retirement_age - age
        if (yearsLeft > 10) {
          return {
            title: `${target_retirement_age}세면 앞으로 ${yearsLeft}년 남았네요`,
            description: '충분한 시간이에요. 차근차근 준비해봐요.',
          }
        } else if (yearsLeft > 0) {
          return {
            title: `${target_retirement_age}세면 앞으로 ${yearsLeft}년 남았네요`,
            description: '시간이 많지 않지만, 지금 시작하면 충분해요.\n같이 최선의 방법을 찾아볼게요.',
          }
        }
      }
      return null

    // Part 3: 가족
    case 'spouse':
      if (isMarried === true) {
        return {
          title: '둘이 함께 준비하면 더 든든하죠',
          description: '배우자분 정보도 조금 알려주실래요?',
        }
      } else if (isMarried === false) {
        return {
          title: '혼자서도 충분히 잘 준비할 수 있어요',
          description: 'Lycon이 든든하게 도와드릴게요.',
        }
      }
      return null

    case 'children':
      if (hasChildren === false) {
        return {
          title: '알겠어요',
          description: isMarried ? `${name}님과 배우자분의 은퇴에 집중해볼게요.` : `${name}님의 은퇴에 집중해볼게요.`,
        }
      } else if (hasChildren === true && data.children.length > 0) {
        const childCount = data.children.length
        return {
          title: `${childCount}명의 자녀가 있으시군요`,
          description: '아이들 교육비와 양육비, 꼼꼼히 계획해볼게요.',
        }
      }
      return null

    // Part 4: 재무
    case 'income':
      if (laborIncome !== null) {
        const totalIncome = (laborIncome || 0) + (data.spouseLaborIncome || 0)
        if (totalIncome > 0) {
          return {
            title: `월 ${totalIncome.toLocaleString()}만원이시군요`,
            description: '이 소득으로 어떻게 은퇴를 준비할 수 있을지 보여드릴게요.',
          }
        } else {
          return {
            title: '현재 소득이 없으시군요',
            description: '자산과 연금 중심으로 은퇴 계획을 세워볼게요.',
          }
        }
      }
      return null

    case 'expense':
      if (livingExpenses !== null && laborIncome !== null) {
        const totalIncome = (laborIncome || 0) + (data.spouseLaborIncome || 0)
        const savings = totalIncome - (livingExpenses || 0)
        if (savings > 0) {
          return {
            title: `매달 약 ${savings.toLocaleString()}만원 여유가 있네요`,
            description: '좋은 출발점이에요!',
          }
        } else if (savings === 0) {
          return {
            title: '빠듯하시네요',
            description: '작은 조정으로도 변화를 만들 수 있어요.',
          }
        } else {
          return {
            title: '지금은 조금 부족하시네요',
            description: '함께 방법을 찾아볼게요.',
          }
        }
      }
      return null

    // 하위 호환성
    case 'basic_info':
      return null

    default:
      return null
  }
}

function calculateAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 스텝별 차트 맵
type ChartMapValue = React.ComponentType<{ data: OnboardingData }> | null

const stepChartMap: Partial<Record<StepId, ChartMapValue>> = {
  retirement_age: LifeNavigationChart,
  expense: SavingsRateChart,
}

export function TipPanel({ activeStep, data }: TipPanelProps) {
  const empathy = getEmpathyMessage(activeStep, data)
  const ChartComponent = stepChartMap[activeStep]

  // 공감 메시지가 없으면 빈 상태
  if (!empathy) {
    return (
      <div className={styles.tipPanel}>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>입력을 완료하면 여기에 공감 메시지가 나타나요</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.tipPanel}>
      {/* 공감 메시지 */}
      <div key={`empathy-${activeStep}`} className={styles.empathyArea}>
        {empathy.title && <h3 className={styles.empathyTitle}>{empathy.title}</h3>}
        <p className={styles.empathyDescription}>{empathy.description}</p>
      </div>

      {/* 차트 영역 */}
      {ChartComponent && (
        <div key={`chart-${activeStep}`} className={styles.chartArea}>
          <ChartComponent data={data} />
        </div>
      )}
    </div>
  )
}
