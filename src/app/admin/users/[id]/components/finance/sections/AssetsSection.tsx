"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import type {
  RealEstate,
  Savings,
  NationalPension,
  RetirementPension,
  PersonalPension,
  Debt,
  Owner,
} from "@/types/tables";
import {
  RealEstateInput,
  SavingsInput,
  PensionInput,
  DebtInput,
} from "./InlineAssetInput";
import styles from "./AssetsSection.module.css";

interface AssetsSectionProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
  realEstates: RealEstate[];
  savings: Savings[];
  nationalPensions: NationalPension[];
  retirementPensions: RetirementPension[];
  personalPensions: PersonalPension[];
  debts: Debt[];
  onUpdate: () => void;
}

export interface AssetsData {
  totalAssets: number;
  totalDebts: number;
  netWorth: number;
  realEstates: RealEstate[];
  financialAssets: Savings[];
  pensions: {
    national: NationalPension[];
    retirement: RetirementPension[];
    personal: PersonalPension[];
  };
  debts: Debt[];
}

type AddingType =
  | "residenceRealEstate"
  | "investmentRealEstate"
  | "savingsAccount"
  | "investmentAccount"
  | "pension"
  | "debt"
  | null;

export function AssetsSection({
  userId,
  simulationId,
  birthYear,
  retirementAge,
  realEstates,
  savings,
  nationalPensions,
  retirementPensions,
  personalPensions,
  debts,
  onUpdate,
}: AssetsSectionProps) {
  const [addingType, setAddingType] = useState<AddingType>(null);

  // 부동산 분류
  const residenceRealEstates = realEstates.filter((re) => re.type === "residence");
  const investmentRealEstates = realEstates.filter((re) => re.type !== "residence");

  // 금융자산 분류
  const savingsAccounts = savings.filter((s) =>
    ["checking", "savings", "deposit"].includes(s.type)
  );
  const investmentAccounts = savings.filter(
    (s) => !["checking", "savings", "deposit"].includes(s.type)
  );

  // 총 부동산 자산
  const totalResidenceValue = residenceRealEstates.reduce((sum, re) => sum + re.current_value, 0);
  const totalResidenceLoan = residenceRealEstates.reduce((sum, re) => sum + (re.loan_amount || 0), 0);
  const netResidence = totalResidenceValue - totalResidenceLoan;

  const totalInvestmentREValue = investmentRealEstates.reduce((sum, re) => sum + re.current_value, 0);
  const totalInvestmentRELoan = investmentRealEstates.reduce((sum, re) => sum + (re.loan_amount || 0), 0);
  const netInvestmentRE = totalInvestmentREValue - totalInvestmentRELoan;

  // 총 금융자산
  const totalSavingsAccounts = savingsAccounts.reduce((sum, s) => sum + s.current_balance, 0);
  const totalInvestmentAccounts = investmentAccounts.reduce((sum, s) => sum + s.current_balance, 0);

  // 총 연금 (예상 월 수령액 합계)
  const totalPensionMonthly = nationalPensions.reduce((sum, np) => sum + np.expected_monthly_amount, 0);

  // 총 부채
  const totalDebts = debts.reduce((sum, d) => sum + (d.current_balance || d.principal), 0);

  // 순자산
  const totalAssets = totalResidenceValue + totalInvestmentREValue + totalSavingsAccounts + totalInvestmentAccounts;
  const totalLoans = totalResidenceLoan + totalInvestmentRELoan + totalDebts;
  const netWorth = totalAssets - totalLoans;

  // 부동산 저장
  const handleSaveRealEstate = async (
    data: { type: string; title: string; value: number; loan: number; owner: string },
    defaultType: "residence" | "investment"
  ) => {
    const { createRealEstate } = await import("@/lib/services/realEstateService");
    await createRealEstate({
      simulation_id: simulationId,
      type: (data.type || defaultType) as RealEstate["type"],
      title: data.title,
      current_value: data.value,
      loan_amount: data.loan || null,
      owner: data.owner as Owner,
    });
    setAddingType(null);
    onUpdate();
  };

  const handleDeleteRealEstate = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { deleteRealEstate } = await import("@/lib/services/realEstateService");
    await deleteRealEstate(id);
    onUpdate();
  };

  // 금융자산 저장
  const handleSaveSavings = async (
    data: { type: string; title: string; balance: number; owner: string },
    defaultType: "savings" | "domestic_stock"
  ) => {
    const { createSavings } = await import("@/lib/services/savingsService");
    await createSavings({
      simulation_id: simulationId,
      type: (data.type || defaultType) as Savings["type"],
      title: data.title,
      current_balance: data.balance,
      owner: data.owner as Owner,
    });
    setAddingType(null);
    onUpdate();
  };

  const handleDeleteSavings = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { deleteSavings } = await import("@/lib/services/savingsService");
    await deleteSavings(id);
    onUpdate();
  };

  // 연금 저장
  const handleSavePension = async (data: {
    category: "national" | "retirement" | "personal";
    type: string;
    amount: number;
    owner: string;
    startAge?: number;
  }) => {
    if (data.category === "national") {
      const { createNationalPension } = await import("@/lib/services/nationalPensionService");
      await createNationalPension(
        {
          simulation_id: simulationId,
          owner: data.owner as Owner,
          pension_type: data.type as NationalPension["pension_type"],
          expected_monthly_amount: data.amount,
          start_age: data.startAge || 65,
          end_age: null,
        },
        birthYear
      );
    } else if (data.category === "retirement") {
      const { createRetirementPension } = await import("@/lib/services/retirementPensionService");
      await createRetirementPension(
        {
          simulation_id: simulationId,
          owner: data.owner as Owner,
          pension_type: data.type as RetirementPension["pension_type"],
          current_balance: data.amount,
          receive_type: "lump_sum",
        },
        birthYear,
        retirementAge
      );
    } else {
      const { createPersonalPension } = await import("@/lib/services/personalPensionService");
      await createPersonalPension(
        {
          simulation_id: simulationId,
          owner: data.owner as Owner,
          pension_type: data.type as PersonalPension["pension_type"],
          current_balance: data.amount,
        },
        birthYear,
        retirementAge
      );
    }
    setAddingType(null);
    onUpdate();
  };

  const handleDeleteNationalPension = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { deleteNationalPension } = await import("@/lib/services/nationalPensionService");
    await deleteNationalPension(id);
    onUpdate();
  };

  const handleDeleteRetirementPension = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { deleteRetirementPension } = await import("@/lib/services/retirementPensionService");
    await deleteRetirementPension(id);
    onUpdate();
  };

  const handleDeletePersonalPension = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { deletePersonalPension } = await import("@/lib/services/personalPensionService");
    await deletePersonalPension(id);
    onUpdate();
  };

  // 부채 저장
  const handleSaveDebt = async (data: {
    type: string;
    title: string;
    balance: number;
    rate: number;
  }) => {
    const { createDebt, getDefaultMaturity } = await import("@/lib/services/debtService");
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const maturity = getDefaultMaturity();

    await createDebt({
      simulation_id: simulationId,
      type: data.type as Debt["type"],
      title: data.title,
      principal: data.balance,
      current_balance: data.balance,
      interest_rate: data.rate,
      repayment_type: "원리금균등상환",
      start_year: currentYear,
      start_month: currentMonth,
      maturity_year: maturity.year,
      maturity_month: maturity.month,
    });
    setAddingType(null);
    onUpdate();
  };

  const handleDeleteDebt = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { deleteDebt } = await import("@/lib/services/debtService");
    await deleteDebt(id);
    onUpdate();
  };

  const getTypeLabel = (type: string, category: string) => {
    const labels: Record<string, Record<string, string>> = {
      realEstate: {
        residence: "거주",
        investment: "투자",
        rental: "임대",
        land: "토지",
      },
      savings: {
        checking: "입출금",
        savings: "적금",
        deposit: "예금",
      },
      investment: {
        domestic_stock: "국내주식",
        foreign_stock: "해외주식",
        fund: "펀드",
        bond: "채권",
        crypto: "암호화폐",
        other: "기타",
      },
      nationalPension: {
        national: "국민연금",
        government: "공무원연금",
        military: "군인연금",
        private_school: "사학연금",
      },
      retirementPension: {
        severance: "퇴직금",
        db: "DB형",
        dc: "DC형",
        corporate_irp: "기업IRP",
      },
      personalPension: {
        pension_savings: "연금저축",
        irp: "개인IRP",
        isa: "ISA",
      },
      debt: {
        mortgage: "주택담보",
        jeonse: "전세자금",
        credit: "신용대출",
        car: "자동차",
        student: "학자금",
        card: "카드",
        other: "기타",
      },
    };
    return labels[category]?.[type] || type;
  };

  return (
    <div className={styles.container}>
      {/* 요약 */}
      <div className={styles.summarySection}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>총 자산</span>
          <span className={styles.summaryValue}>{formatMoney(totalAssets)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>총 부채</span>
          <span className={styles.summaryValueDebt}>{formatMoney(totalLoans)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>순자산</span>
          <span className={styles.summaryValueNet}>{formatMoney(netWorth)}</span>
        </div>
      </div>

      {/* 거주용 부동산 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>거주용 부동산</h4>
          {residenceRealEstates.length > 0 && (
            <span className={styles.sectionSummary}>
              {formatMoney(totalResidenceValue)}
              {totalResidenceLoan > 0 && ` (대출 ${formatMoney(totalResidenceLoan)})`}
            </span>
          )}
        </div>
        <div className={styles.itemList}>
          {residenceRealEstates.map((re) => (
            <div key={re.id} className={styles.item}>
              <span className={styles.itemTitle}>{re.title}</span>
              <span className={styles.itemValue}>{formatMoney(re.current_value)}</span>
              {re.loan_amount && re.loan_amount > 0 && (
                <span className={styles.itemSub}>대출 {formatMoney(re.loan_amount)}</span>
              )}
              <span className={styles.itemOwner}>
                {re.owner === "self" ? "본인" : re.owner === "spouse" ? "배우자" : "공동"}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteRealEstate(re.id)}
                className={styles.deleteBtn}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {residenceRealEstates.length === 0 && addingType !== "residenceRealEstate" && (
            <span className={styles.emptyText}>없음</span>
          )}
        </div>
        {addingType === "residenceRealEstate" ? (
          <RealEstateInput
            onSave={(data) => handleSaveRealEstate(data, "residence")}
            onCancel={() => setAddingType(null)}
            defaultType="residence"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingType("residenceRealEstate")}
            className={styles.addBtn}
          >
            <Plus size={14} />
            추가
          </button>
        )}
      </div>

      {/* 투자용 부동산 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>투자용 부동산</h4>
          {investmentRealEstates.length > 0 && (
            <span className={styles.sectionSummary}>
              {formatMoney(totalInvestmentREValue)}
              {totalInvestmentRELoan > 0 && ` (대출 ${formatMoney(totalInvestmentRELoan)})`}
            </span>
          )}
        </div>
        <div className={styles.itemList}>
          {investmentRealEstates.map((re) => (
            <div key={re.id} className={styles.item}>
              <span className={styles.itemType}>{getTypeLabel(re.type, "realEstate")}</span>
              <span className={styles.itemTitle}>{re.title}</span>
              <span className={styles.itemValue}>{formatMoney(re.current_value)}</span>
              {re.loan_amount && re.loan_amount > 0 && (
                <span className={styles.itemSub}>대출 {formatMoney(re.loan_amount)}</span>
              )}
              <span className={styles.itemOwner}>
                {re.owner === "self" ? "본인" : re.owner === "spouse" ? "배우자" : "공동"}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteRealEstate(re.id)}
                className={styles.deleteBtn}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {investmentRealEstates.length === 0 && addingType !== "investmentRealEstate" && (
            <span className={styles.emptyText}>없음</span>
          )}
        </div>
        {addingType === "investmentRealEstate" ? (
          <RealEstateInput
            onSave={(data) => handleSaveRealEstate(data, "investment")}
            onCancel={() => setAddingType(null)}
            defaultType="investment"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingType("investmentRealEstate")}
            className={styles.addBtn}
          >
            <Plus size={14} />
            추가
          </button>
        )}
      </div>

      {/* 저축 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>저축</h4>
          {savingsAccounts.length > 0 && (
            <span className={styles.sectionSummary}>{formatMoney(totalSavingsAccounts)}</span>
          )}
        </div>
        <div className={styles.itemList}>
          {savingsAccounts.map((s) => (
            <div key={s.id} className={styles.item}>
              <span className={styles.itemType}>{getTypeLabel(s.type, "savings")}</span>
              <span className={styles.itemTitle}>{s.title}</span>
              <span className={styles.itemValue}>{formatMoney(s.current_balance)}</span>
              <span className={styles.itemOwner}>
                {s.owner === "self" ? "본인" : "배우자"}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteSavings(s.id)}
                className={styles.deleteBtn}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {savingsAccounts.length === 0 && addingType !== "savingsAccount" && (
            <span className={styles.emptyText}>없음</span>
          )}
        </div>
        {addingType === "savingsAccount" ? (
          <SavingsInput
            onSave={(data) => handleSaveSavings(data, "savings")}
            onCancel={() => setAddingType(null)}
            category="savings"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingType("savingsAccount")}
            className={styles.addBtn}
          >
            <Plus size={14} />
            추가
          </button>
        )}
      </div>

      {/* 투자 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>투자</h4>
          {investmentAccounts.length > 0 && (
            <span className={styles.sectionSummary}>{formatMoney(totalInvestmentAccounts)}</span>
          )}
        </div>
        <div className={styles.itemList}>
          {investmentAccounts.map((s) => (
            <div key={s.id} className={styles.item}>
              <span className={styles.itemType}>{getTypeLabel(s.type, "investment")}</span>
              <span className={styles.itemTitle}>{s.title}</span>
              <span className={styles.itemValue}>{formatMoney(s.current_balance)}</span>
              <span className={styles.itemOwner}>
                {s.owner === "self" ? "본인" : "배우자"}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteSavings(s.id)}
                className={styles.deleteBtn}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {investmentAccounts.length === 0 && addingType !== "investmentAccount" && (
            <span className={styles.emptyText}>없음</span>
          )}
        </div>
        {addingType === "investmentAccount" ? (
          <SavingsInput
            onSave={(data) => handleSaveSavings(data, "domestic_stock")}
            onCancel={() => setAddingType(null)}
            category="investment"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingType("investmentAccount")}
            className={styles.addBtn}
          >
            <Plus size={14} />
            추가
          </button>
        )}
      </div>

      {/* 연금 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>연금</h4>
          {totalPensionMonthly > 0 && (
            <span className={styles.sectionSummary}>예상 월 {formatMoney(totalPensionMonthly)}</span>
          )}
        </div>
        <div className={styles.itemList}>
          {nationalPensions.map((np) => (
            <div key={np.id} className={styles.item}>
              <span className={styles.itemType}>
                {getTypeLabel(np.pension_type || "national", "nationalPension")}
              </span>
              <span className={styles.itemTitle}>{np.start_age}세부터</span>
              <span className={styles.itemValue}>월 {formatMoney(np.expected_monthly_amount)}</span>
              <span className={styles.itemOwner}>
                {np.owner === "self" ? "본인" : "배우자"}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteNationalPension(np.id)}
                className={styles.deleteBtn}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {retirementPensions.map((rp) => (
            <div key={rp.id} className={styles.item}>
              <span className={styles.itemType}>
                {getTypeLabel(rp.pension_type, "retirementPension")}
              </span>
              <span className={styles.itemTitle}>
                {rp.receive_type === "lump_sum" ? "일시금" : "연금"}
              </span>
              <span className={styles.itemValue}>
                {rp.current_balance ? formatMoney(rp.current_balance) : `${rp.years_of_service}년`}
              </span>
              <span className={styles.itemOwner}>
                {rp.owner === "self" ? "본인" : "배우자"}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteRetirementPension(rp.id)}
                className={styles.deleteBtn}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {personalPensions.map((pp) => (
            <div key={pp.id} className={styles.item}>
              <span className={styles.itemType}>
                {getTypeLabel(pp.pension_type, "personalPension")}
              </span>
              <span className={styles.itemTitle}>{formatMoney(pp.current_balance)}</span>
              <span className={styles.itemOwner}>
                {pp.owner === "self" ? "본인" : "배우자"}
              </span>
              <button
                type="button"
                onClick={() => handleDeletePersonalPension(pp.id)}
                className={styles.deleteBtn}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {nationalPensions.length + retirementPensions.length + personalPensions.length === 0 &&
            addingType !== "pension" && <span className={styles.emptyText}>없음</span>}
        </div>
        {addingType === "pension" ? (
          <PensionInput
            onSave={handleSavePension}
            onCancel={() => setAddingType(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingType("pension")}
            className={styles.addBtn}
          >
            <Plus size={14} />
            추가
          </button>
        )}
      </div>

      {/* 부채 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>부채</h4>
          {debts.length > 0 && (
            <span className={styles.sectionSummary}>{formatMoney(totalDebts)}</span>
          )}
        </div>
        <div className={styles.itemList}>
          {debts.map((d) => (
            <div key={d.id} className={styles.item}>
              <span className={styles.itemType}>{getTypeLabel(d.type, "debt")}</span>
              <span className={styles.itemTitle}>{d.title}</span>
              <span className={styles.itemValue}>
                {formatMoney(d.current_balance || d.principal)}
              </span>
              <span className={styles.itemSub}>{d.interest_rate}%</span>
              <button
                type="button"
                onClick={() => handleDeleteDebt(d.id)}
                className={styles.deleteBtn}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {debts.length === 0 && addingType !== "debt" && (
            <span className={styles.emptyText}>없음</span>
          )}
        </div>
        {addingType === "debt" ? (
          <DebtInput onSave={handleSaveDebt} onCancel={() => setAddingType(null)} />
        ) : (
          <button
            type="button"
            onClick={() => setAddingType("debt")}
            className={styles.addBtn}
          >
            <Plus size={14} />
            추가
          </button>
        )}
      </div>
    </div>
  );
}
