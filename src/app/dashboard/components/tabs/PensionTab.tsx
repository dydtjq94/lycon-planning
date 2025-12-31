'use client'

import { useEffect, useRef } from 'react'
import type { OnboardingData, GlobalSettings } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import {
  usePensionCalculations,
  NationalPensionSection,
  RetirementPensionSection,
  PersonalPensionSection,
  PensionSummary,
} from './pension'
import styles from './PensionTab.module.css'

interface PensionTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  globalSettings?: GlobalSettings
}

export function PensionTab({ data, onUpdateData, globalSettings }: PensionTabProps) {
  const settings = globalSettings || DEFAULT_GLOBAL_SETTINGS
  const prevIsMarried = useRef(data.isMarried)

  // 계산 로직 훅 사용
  const {
    monthlyIncome,
    spouseMonthlyIncome,
    yearsUntilRetirement,
    spouseYearsUntilRetirement,
    retirementPensionProjection,
    spouseRetirementPensionProjection,
    personalPensionProjection,
    spousePersonalPensionProjection,
    totalPensionProjection,
  } = usePensionCalculations({ data, globalSettings: settings })

  // 배우자 유무 변경 감지 및 자동 처리
  useEffect(() => {
    const wasMarried = prevIsMarried.current
    const isNowMarried = data.isMarried

    // 결혼 상태가 변경되었을 때
    if (wasMarried !== isNowMarried) {
      if (!isNowMarried && wasMarried) {
        // 배우자 삭제됨 → 배우자 연금 데이터 초기화
        onUpdateData({
          spouseNationalPension: null,
          spouseNationalPensionStartAge: null,
          spouseRetirementPensionType: null,
          spouseRetirementPensionBalance: null,
          spouseRetirementPensionReceiveType: null,
          spouseRetirementPensionStartAge: null,
          spouseRetirementPensionReceivingYears: null,
          spouseYearsOfService: null,
          spousePensionSavingsBalance: null,
          spousePensionSavingsMonthlyContribution: null,
          spousePensionSavingsStartAge: null,
          spousePensionSavingsReceivingYears: null,
          spouseIrpBalance: null,
          spouseIrpMonthlyContribution: null,
          spouseIrpStartAge: null,
          spouseIrpReceivingYears: null,
        })
      }
      prevIsMarried.current = isNowMarried
    }
  }, [data.isMarried, onUpdateData])

  const isMarried = data.isMarried === true

  // 국민연금 데이터 (요약 패널용)
  const nationalPensionData = {
    self: {
      monthly: data.nationalPension || 0,
      startAge: data.nationalPensionStartAge || 65,
    },
    spouse: isMarried ? {
      monthly: data.spouseNationalPension || 0,
      startAge: data.spouseNationalPensionStartAge || 65,
    } : null,
  }

  return (
    <div className={styles.container}>
      {/* 왼쪽: 연금 입력 */}
      <div className={styles.inputPanel}>

        {/* ========== 국민연금 ========== */}
        <section className={styles.pensionSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>국민연금</span>
          </div>
          <p className={styles.sectionDesc}>
            국민연금공단 예상연금 조회 서비스에서 확인한 금액을 입력하세요.
          </p>

          <div className={styles.itemList}>
            <NationalPensionSection
              data={data}
              onUpdateData={onUpdateData}
              owner="self"
              ownerLabel="본인"
            />
            {isMarried && (
              <NationalPensionSection
                data={data}
                onUpdateData={onUpdateData}
                owner="spouse"
                ownerLabel="배우자"
              />
            )}
          </div>
        </section>

        {/* ========== 퇴직연금 ========== */}
        <section className={styles.pensionSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>퇴직연금/퇴직금</span>
          </div>
          <p className={styles.sectionDesc}>
            유형을 선택하면 퇴직 시 예상 수령액을 자동으로 계산합니다.
          </p>

          <div className={styles.itemList}>
            <RetirementPensionSection
              data={data}
              onUpdateData={onUpdateData}
              owner="self"
              ownerLabel="본인"
              projection={retirementPensionProjection}
              monthlyIncome={monthlyIncome}
              yearsUntilRetirement={yearsUntilRetirement}
            />
            {isMarried && (
              <RetirementPensionSection
                data={data}
                onUpdateData={onUpdateData}
                owner="spouse"
                ownerLabel="배우자"
                projection={spouseRetirementPensionProjection}
                monthlyIncome={spouseMonthlyIncome}
                yearsUntilRetirement={spouseYearsUntilRetirement}
              />
            )}
          </div>
        </section>

        {/* ========== 개인연금 ========== */}
        <section className={styles.pensionSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>개인연금</span>
          </div>
          <p className={styles.sectionDesc}>
            현재 잔액, 월 납입액, 수령 계획을 입력하세요. (56세 이상부터 수령 가능)
          </p>

          <PersonalPensionSection
            data={data}
            onUpdateData={onUpdateData}
            owner="self"
            ownerLabel="본인"
          />

          {isMarried && (
            <>
              <div className={styles.sectionHeader} style={{ marginTop: 24 }}>
                <span className={styles.sectionTitle}>배우자 개인연금</span>
              </div>
              <PersonalPensionSection
                data={data}
                onUpdateData={onUpdateData}
                owner="spouse"
                ownerLabel="배우자"
              />
            </>
          )}
        </section>

      </div>

      {/* 오른쪽: 예측 요약 */}
      <PensionSummary
        settings={settings}
        retirementPensionProjection={retirementPensionProjection}
        spouseRetirementPensionProjection={spouseRetirementPensionProjection}
        personalPensionProjection={personalPensionProjection}
        spousePersonalPensionProjection={spousePersonalPensionProjection}
        totalPensionProjection={totalPensionProjection}
        nationalPensionData={nationalPensionData}
        isMarried={isMarried}
      />
    </div>
  )
}
