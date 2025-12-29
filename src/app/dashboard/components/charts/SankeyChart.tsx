'use client'

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { SankeyController, Flow } from 'chartjs-chart-sankey'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, Tooltip, Legend, SankeyController, Flow)

interface SankeyChartProps {
  data: OnboardingData
}

export function SankeyChart({ data }: SankeyChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<ChartJS | null>(null)

  useEffect(() => {
    // 소득
    const laborIncome = data.laborIncome || 0
    const spouseLaborIncome = data.spouseLaborIncome || 0
    const businessIncome = data.businessIncome || 0
    const spouseBusinessIncome = data.spouseBusinessIncome || 0
    const totalIncome = laborIncome + spouseLaborIncome + businessIncome + spouseBusinessIncome

    // 지출
    const livingExpenses = data.livingExpenses || 0

    // 저축/투자 세부
    const cashSavings = (data.cashSavingsAccount || 0) > 0 ? Math.round(totalIncome * 0.1) : 0
    const investAmount = (data.investDomesticStock || 0) + (data.investForeignStock || 0) + (data.investFund || 0) > 0
      ? Math.round(totalIncome * 0.15) : 0
    const pensionAmount = (data.retirementPensionBalance || 0) > 0 ? Math.round(totalIncome * 0.05) : 0

    // 대출 상환
    const loanPayment = data.housingHasLoan ? Math.round((data.housingLoan || 0) / 360) : 0

    const savings = Math.max(0, totalIncome - livingExpenses)
    if (!chartRef.current) return

    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    const flows: { from: string; to: string; flow: number }[] = []

    // 소득 -> 총 수입
    if (laborIncome > 0) {
      flows.push({ from: '본인 근로', to: '총 수입', flow: laborIncome })
    }
    if (spouseLaborIncome > 0) {
      flows.push({ from: '배우자 근로', to: '총 수입', flow: spouseLaborIncome })
    }
    if (businessIncome > 0) {
      flows.push({ from: '본인 사업', to: '총 수입', flow: businessIncome })
    }
    if (spouseBusinessIncome > 0) {
      flows.push({ from: '배우자 사업', to: '총 수입', flow: spouseBusinessIncome })
    }

    // 총 수입 -> 지출
    if (livingExpenses > 0) {
      flows.push({ from: '총 수입', to: '생활비', flow: livingExpenses })
    }

    // 총 수입 -> 대출상환
    if (loanPayment > 0) {
      flows.push({ from: '총 수입', to: '대출상환', flow: loanPayment })
    }

    // 총 수입 -> 저축/투자 (세분화)
    const remainingSavings = savings - loanPayment
    if (remainingSavings > 0) {
      // 비율에 따라 분배
      const totalAllocated = cashSavings + investAmount + pensionAmount
      if (totalAllocated > 0 && totalAllocated <= remainingSavings) {
        if (cashSavings > 0) flows.push({ from: '총 수입', to: '예적금', flow: cashSavings })
        if (investAmount > 0) flows.push({ from: '총 수입', to: '투자', flow: investAmount })
        if (pensionAmount > 0) flows.push({ from: '총 수입', to: '연금', flow: pensionAmount })
        const misc = remainingSavings - totalAllocated
        if (misc > 0) flows.push({ from: '총 수입', to: '기타저축', flow: misc })
      } else {
        // 기본: 저축/투자 하나로
        flows.push({ from: '총 수입', to: '저축/투자', flow: remainingSavings })
      }
    }

    // 데이터가 없으면 기본 메시지 표시
    if (flows.length === 0) {
      return
    }

    const colorMap: Record<string, string> = {
      '본인 근로': '#007aff',
      '배우자 근로': '#5856d6',
      '본인 사업': '#34c759',
      '배우자 사업': '#30d158',
      '총 수입': '#78716c',
      '생활비': '#ff9500',
      '대출상환': '#ff3b30',
      '예적금': '#34c759',
      '투자': '#007aff',
      '연금': '#5856d6',
      '기타저축': '#a8a29e',
      '저축/투자': '#34c759',
    }

    chartInstance.current = new ChartJS(ctx, {
      type: 'sankey',
      data: {
        datasets: [{
          label: '현금 흐름',
          data: flows,
          colorFrom: (c) => colorMap[c.dataset.data[c.dataIndex].from] || '#78716c',
          colorTo: (c) => colorMap[c.dataset.data[c.dataIndex].to] || '#78716c',
          colorMode: 'gradient',
          borderWidth: 0,
          nodeWidth: 20,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const raw = context.raw as { from: string; to: string; flow: number }
                return `${raw.from} → ${raw.to}: ${raw.flow.toLocaleString()}만원`
              },
            },
          },
        },
      },
    })

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [data])

  const totalIncome = (data.laborIncome || 0) + (data.spouseLaborIncome || 0) +
    (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)

  if (totalIncome === 0) {
    return (
      <div className={styles.chartContainer}>
        <h3 className={styles.chartTitle}>현금 흐름</h3>
        <div className={styles.emptyState}>
          소득 데이터를 입력하면 현금 흐름을 확인할 수 있습니다
        </div>
      </div>
    )
  }

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>현금 흐름</h3>
      <div className={styles.chartWrapper}>
        <canvas ref={chartRef} />
      </div>
    </div>
  )
}
