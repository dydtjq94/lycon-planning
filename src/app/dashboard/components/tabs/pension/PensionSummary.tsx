'use client'

import type { GlobalSettings } from '@/types'
import { formatMoney } from '@/lib/utils'
import type {
  RetirementPensionProjection,
  PersonalPensionProjection,
  TotalPensionProjection,
} from './usePensionCalculations'
import styles from '../PensionTab.module.css'

interface PensionSummaryProps {
  settings: GlobalSettings
  retirementPensionProjection: RetirementPensionProjection | null
  spouseRetirementPensionProjection: RetirementPensionProjection | null
  personalPensionProjection: PersonalPensionProjection
  spousePersonalPensionProjection: PersonalPensionProjection | null
  totalPensionProjection: TotalPensionProjection
  nationalPensionData: {
    self: { monthly: number; startAge: number }
    spouse: { monthly: number; startAge: number } | null
  }
  isMarried: boolean
}

export function PensionSummary({
  settings,
  retirementPensionProjection,
  spouseRetirementPensionProjection,
  personalPensionProjection,
  spousePersonalPensionProjection,
  totalPensionProjection,
  nationalPensionData,
  isMarried,
}: PensionSummaryProps) {
  return (
    <div className={styles.summaryPanel}>
      {/* 예상 월 수령액 */}
      <div className={styles.summaryCard}>
        <div className={styles.totalPension}>
          <span className={styles.totalLabel}>예상 월 연금 수령액 {isMarried ? '(합산)' : ''}</span>
          <span className={styles.totalValue}>
            {formatMoney(
              totalPensionProjection.nationalPension.monthly +
              totalPensionProjection.retirement.monthlyPMT +
              totalPensionProjection.personal.monthlyPMT
            )}/월
          </span>
        </div>
        <div className={styles.subValues}>
          <div className={styles.subValueItem}>
            <span className={styles.subLabel}>국민연금</span>
            <span className={styles.subValue}>{formatMoney(totalPensionProjection.nationalPension.monthly)}/월</span>
          </div>
          {totalPensionProjection.retirement.isAnnuity && (
            <div className={styles.subValueItem}>
              <span className={styles.subLabel}>퇴직연금</span>
              <span className={styles.subValue}>{formatMoney(totalPensionProjection.retirement.monthlyPMT)}/월</span>
            </div>
          )}
          <div className={styles.subValueItem}>
            <span className={styles.subLabel}>개인연금</span>
            <span className={styles.subValue}>{formatMoney(totalPensionProjection.personal.monthlyPMT)}/월</span>
          </div>
        </div>
      </div>

      {/* 연금 상세 */}
      <div className={styles.breakdownCard}>
        <h4 className={styles.cardTitle}>연금 상세</h4>
        <div className={styles.breakdownList}>
          {/* 본인 국민연금 */}
          {nationalPensionData.self.monthly > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#5856d6' }}></span>
                  <span className={styles.breakdownLabel}>본인 국민연금</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(nationalPensionData.self.monthly)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {nationalPensionData.self.startAge}세부터 수령
              </div>
            </>
          )}

          {/* 배우자 국민연금 */}
          {nationalPensionData.spouse && nationalPensionData.spouse.monthly > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#8e8ee5' }}></span>
                  <span className={styles.breakdownLabel}>배우자 국민연금</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(nationalPensionData.spouse.monthly)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {nationalPensionData.spouse.startAge}세부터 수령
              </div>
            </>
          )}

          {/* 본인 퇴직연금 */}
          {retirementPensionProjection && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#007aff' }}></span>
                  <span className={styles.breakdownLabel}>본인 퇴직연금</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>
                    {retirementPensionProjection.receiveType === 'annuity' && retirementPensionProjection.monthlyPMT
                      ? `${formatMoney(retirementPensionProjection.monthlyPMT)}/월`
                      : formatMoney(retirementPensionProjection.totalAmount)
                    }
                  </span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {retirementPensionProjection.receiveType === 'annuity'
                  ? `${retirementPensionProjection.startAge}세부터 ${retirementPensionProjection.receivingYears}년간 (적립액 ${formatMoney(retirementPensionProjection.totalAmount)})`
                  : '퇴직 시 일시금 수령'
                }
              </div>
            </>
          )}

          {/* 배우자 퇴직연금 */}
          {spouseRetirementPensionProjection && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#5ac8fa' }}></span>
                  <span className={styles.breakdownLabel}>배우자 퇴직연금</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>
                    {spouseRetirementPensionProjection.receiveType === 'annuity' && spouseRetirementPensionProjection.monthlyPMT
                      ? `${formatMoney(spouseRetirementPensionProjection.monthlyPMT)}/월`
                      : formatMoney(spouseRetirementPensionProjection.totalAmount)
                    }
                  </span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {spouseRetirementPensionProjection.receiveType === 'annuity'
                  ? `${spouseRetirementPensionProjection.startAge}세부터 ${spouseRetirementPensionProjection.receivingYears}년간`
                  : '퇴직 시 일시금 수령'
                }
              </div>
            </>
          )}

          {/* 본인 연금저축 */}
          {personalPensionProjection.pensionSavings.futureAtStart > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#34c759' }}></span>
                  <span className={styles.breakdownLabel}>본인 연금저축</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(personalPensionProjection.pensionSavings.monthlyPMT)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {personalPensionProjection.pensionSavings.startAge}세부터 {personalPensionProjection.pensionSavings.receivingYears}년간
                (적립액 {formatMoney(personalPensionProjection.pensionSavings.futureAtStart)})
              </div>
            </>
          )}

          {/* 배우자 연금저축 */}
          {spousePersonalPensionProjection && spousePersonalPensionProjection.pensionSavings.futureAtStart > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#86d993' }}></span>
                  <span className={styles.breakdownLabel}>배우자 연금저축</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(spousePersonalPensionProjection.pensionSavings.monthlyPMT)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {spousePersonalPensionProjection.pensionSavings.startAge}세부터 {spousePersonalPensionProjection.pensionSavings.receivingYears}년간
              </div>
            </>
          )}

          {/* 본인 IRP */}
          {personalPensionProjection.irp.futureAtStart > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#ff9500' }}></span>
                  <span className={styles.breakdownLabel}>본인 IRP</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(personalPensionProjection.irp.monthlyPMT)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {personalPensionProjection.irp.startAge}세부터 {personalPensionProjection.irp.receivingYears}년간
                (적립액 {formatMoney(personalPensionProjection.irp.futureAtStart)})
              </div>
            </>
          )}

          {/* 배우자 IRP */}
          {spousePersonalPensionProjection && spousePersonalPensionProjection.irp.futureAtStart > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#ffb84d' }}></span>
                  <span className={styles.breakdownLabel}>배우자 IRP</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(spousePersonalPensionProjection.irp.monthlyPMT)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {spousePersonalPensionProjection.irp.startAge}세부터 {spousePersonalPensionProjection.irp.receivingYears}년간
              </div>
            </>
          )}

          {/* ISA (본인만) */}
          {personalPensionProjection.isa.current > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#af52de' }}></span>
                  <span className={styles.breakdownLabel}>ISA</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(personalPensionProjection.isa.atMaturity)}</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {personalPensionProjection.isa.maturityYear}년 만기 → {personalPensionProjection.isa.transferTo} 전환
              </div>
            </>
          )}
        </div>
      </div>

      {/* 가정 안내 */}
      <div className={styles.assumptionsCard}>
        <h4 className={styles.cardTitle}>계산 가정</h4>
        <ul className={styles.assumptionsList}>
          <li>시나리오: {
            settings.scenarioMode === 'optimistic' ? '낙관적' :
            settings.scenarioMode === 'average' ? '평균' :
            settings.scenarioMode === 'pessimistic' ? '비관적' :
            settings.scenarioMode === 'custom' ? '커스텀' : '개별'
          }</li>
          <li>임금상승률: 연 {settings.incomeGrowthRate}%</li>
          <li>투자수익률: 연 {settings.investmentReturnRate}%</li>
          <li>예상 수명: {settings.lifeExpectancy}세</li>
          <li>PMT 방식: 수령 중에도 잔액에 수익률 적용</li>
        </ul>
      </div>
    </div>
  )
}
