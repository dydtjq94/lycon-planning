import { createClient } from '@/lib/supabase/client'
import type {
  FinancialItem,
  FinancialItemInput,
  RealEstateData,
  DebtData,
} from '@/types'
import { financialItemService } from './financialService'
import { DEFAULT_RATES } from './defaultItems'

/**
 * 부동산 ↔ 부채 연동 서비스
 *
 * 부동산에 대출이 있으면 자동으로 부채 항목 생성/동기화
 * - 부동산 생성 시 대출 있으면 → 부채 자동 생성
 * - 부동산 대출 정보 수정 → 부채 동기화
 * - 부채 수정 → 부동산 대출 정보 동기화
 * - 삭제 시 연동 항목도 처리
 */
export const linkedItemService = {
  /**
   * 부동산 항목 생성 (대출 있으면 부채도 생성)
   */
  async createRealEstateWithLoan(
    input: FinancialItemInput
  ): Promise<{ realEstate: FinancialItem; debt: FinancialItem | null }> {
    const data = input.data as RealEstateData

    // 부동산 먼저 생성
    const realEstate = await financialItemService.create(input)

    // 대출이 있으면 부채 항목도 생성
    if (data.hasLoan && data.loanAmount && data.loanAmount > 0) {
      const debt = await this.createLinkedDebt(realEstate)
      return { realEstate, debt }
    }

    return { realEstate, debt: null }
  },

  /**
   * 부동산에 연동된 부채 항목 생성
   */
  async createLinkedDebt(realEstate: FinancialItem): Promise<FinancialItem> {
    const realEstateData = realEstate.data as RealEstateData

    const debtInput: FinancialItemInput = {
      simulation_id: realEstate.simulation_id,
      category: 'debt',
      type: 'mortgage',
      title: `${realEstate.title} 대출`,
      owner: realEstate.owner,
      start_year: realEstate.start_year,
      start_month: realEstate.start_month,
      end_year: realEstateData.loanMaturityYear,
      end_month: realEstateData.loanMaturityMonth,
      linked_item_id: realEstate.id,
      data: {
        principal: realEstateData.loanAmount || 0,
        currentBalance: realEstateData.loanAmount || 0,
        interestRate: realEstateData.loanRate || DEFAULT_RATES.mortgageRate,
        repaymentType: realEstateData.loanRepaymentType || '원리금균등상환',
      } as DebtData,
      memo: `${realEstate.title}에 연동된 대출`,
    }

    const debt = await financialItemService.create(debtInput)

    // 부동산에도 연동 ID 업데이트
    await financialItemService.update(realEstate.id, {
      linked_item_id: debt.id,
    })

    return debt
  },

  /**
   * 부동산 대출 정보 업데이트 → 연동된 부채도 동기화
   */
  async updateRealEstateLoan(
    realEstateId: string,
    updates: Partial<RealEstateData>
  ): Promise<{ realEstate: FinancialItem; debt: FinancialItem | null }> {
    const supabase = createClient()

    // 현재 부동산 조회
    const realEstate = await financialItemService.get(realEstateId)
    const currentData = realEstate.data as RealEstateData
    const newData = { ...currentData, ...updates }

    // 부동산 업데이트
    const updatedRealEstate = await financialItemService.update(realEstateId, {
      data: newData,
    })

    // 연동된 부채 처리
    if (realEstate.linked_item_id) {
      // 기존 연동 부채가 있음
      if (newData.hasLoan && newData.loanAmount && newData.loanAmount > 0) {
        // 대출 정보 업데이트
        const updatedDebt = await financialItemService.update(realEstate.linked_item_id, {
          end_year: newData.loanMaturityYear,
          end_month: newData.loanMaturityMonth,
          data: {
            principal: newData.loanAmount,
            currentBalance: newData.loanAmount,
            interestRate: newData.loanRate || DEFAULT_RATES.mortgageRate,
            repaymentType: newData.loanRepaymentType || '원리금균등상환',
          } as DebtData,
        })
        return { realEstate: updatedRealEstate, debt: updatedDebt }
      } else {
        // 대출 없앰 → 부채 삭제
        await financialItemService.delete(realEstate.linked_item_id)
        await financialItemService.update(realEstateId, { linked_item_id: undefined })
        return { realEstate: updatedRealEstate, debt: null }
      }
    } else {
      // 기존 연동 부채가 없음
      if (newData.hasLoan && newData.loanAmount && newData.loanAmount > 0) {
        // 새로 대출 추가 → 부채 생성
        const debt = await this.createLinkedDebt(updatedRealEstate)
        return { realEstate: updatedRealEstate, debt }
      }
    }

    return { realEstate: updatedRealEstate, debt: null }
  },

  /**
   * 부채 업데이트 → 연동된 부동산 대출 정보도 동기화
   */
  async updateLinkedDebt(
    debtId: string,
    updates: Partial<DebtData & { end_year?: number; end_month?: number }>
  ): Promise<{ debt: FinancialItem; realEstate: FinancialItem | null }> {
    // 현재 부채 조회
    const debt = await financialItemService.get(debtId)

    // 부채 업데이트
    const debtData = debt.data as DebtData
    const newDebtData = { ...debtData, ...updates }

    const updatePayload: Partial<FinancialItemInput> = {
      data: newDebtData,
    }
    if (updates.end_year !== undefined) updatePayload.end_year = updates.end_year
    if (updates.end_month !== undefined) updatePayload.end_month = updates.end_month

    const updatedDebt = await financialItemService.update(debtId, updatePayload)

    // 연동된 부동산이 있으면 동기화
    if (debt.linked_item_id) {
      const realEstate = await financialItemService.get(debt.linked_item_id)
      const realEstateData = realEstate.data as RealEstateData

      const updatedRealEstate = await financialItemService.update(debt.linked_item_id, {
        data: {
          ...realEstateData,
          loanAmount: newDebtData.principal || newDebtData.currentBalance,
          loanRate: newDebtData.interestRate,
          loanRepaymentType: newDebtData.repaymentType,
          loanMaturityYear: updates.end_year ?? realEstateData.loanMaturityYear,
          loanMaturityMonth: updates.end_month ?? realEstateData.loanMaturityMonth,
        } as RealEstateData,
      })

      return { debt: updatedDebt, realEstate: updatedRealEstate }
    }

    return { debt: updatedDebt, realEstate: null }
  },

  /**
   * 부동산 삭제 → 연동된 부채도 삭제
   */
  async deleteRealEstateWithLoan(realEstateId: string): Promise<void> {
    const realEstate = await financialItemService.get(realEstateId)

    // 연동된 부채 먼저 삭제
    if (realEstate.linked_item_id) {
      await financialItemService.delete(realEstate.linked_item_id)
    }

    // 부동산 삭제
    await financialItemService.delete(realEstateId)
  },

  /**
   * 부채 삭제 → 연동된 부동산 대출 정보 초기화
   */
  async deleteLinkedDebt(debtId: string): Promise<void> {
    const debt = await financialItemService.get(debtId)

    // 연동된 부동산이 있으면 대출 정보 초기화
    if (debt.linked_item_id) {
      const realEstate = await financialItemService.get(debt.linked_item_id)
      const realEstateData = realEstate.data as RealEstateData

      await financialItemService.update(debt.linked_item_id, {
        linked_item_id: undefined,
        data: {
          ...realEstateData,
          hasLoan: false,
          loanAmount: undefined,
          loanRate: undefined,
          loanMaturityYear: undefined,
          loanMaturityMonth: undefined,
          loanRepaymentType: undefined,
        } as RealEstateData,
      })
    }

    // 부채 삭제
    await financialItemService.delete(debtId)
  },

  /**
   * 연동된 항목 조회
   */
  async getLinkedItem(itemId: string): Promise<FinancialItem | null> {
    const item = await financialItemService.get(itemId)
    if (!item.linked_item_id) return null

    try {
      return await financialItemService.get(item.linked_item_id)
    } catch {
      return null
    }
  },

  /**
   * 부동산인지 확인하고 연동된 부채 조회
   */
  async getRealEstateWithDebt(realEstateId: string): Promise<{
    realEstate: FinancialItem
    linkedDebt: FinancialItem | null
  }> {
    const realEstate = await financialItemService.get(realEstateId)
    const linkedDebt = realEstate.linked_item_id
      ? await financialItemService.get(realEstate.linked_item_id)
      : null

    return { realEstate, linkedDebt }
  },
}

export default linkedItemService
