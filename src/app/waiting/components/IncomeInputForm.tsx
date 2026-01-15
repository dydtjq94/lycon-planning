"use client";

import { useState } from "react";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import {
  createIncome,
  INCOME_TYPE_LABELS,
  INCOME_TYPE_DEFAULTS,
} from "@/lib/services/incomeService";
import { simulationService } from "@/lib/services/simulationService";
import type { IncomeType, Owner, Frequency } from "@/types/tables";
import styles from "./IncomeInputForm.module.css";

// 온보딩 소득 구간 레이블
const INCOME_RANGE_LABELS: Record<string, string> = {
  under_3000: "3,000만원 이하",
  "3000_5000": "3,000~5,000만원",
  "5000_8000": "5,000~8,000만원",
  "8000_12000": "8,000만원~1.2억",
  over_12000: "1.2억 초과",
};

interface IncomeItem {
  type: IncomeType;
  title: string;
  amount: number;
  frequency: Frequency;
  owner: Owner;
}

interface IncomeInputFormProps {
  onClose: () => void;
  onComplete: () => void;
  surveyIncomeRange?: string;
}

export function IncomeInputForm({
  onClose,
  onComplete,
  surveyIncomeRange,
}: IncomeInputFormProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [incomes, setIncomes] = useState<IncomeItem[]>([
    {
      type: "labor",
      title: "본인 급여",
      amount: 0,
      frequency: "monthly",
      owner: "self",
    },
  ]);
  const [saving, setSaving] = useState(false);

  const addIncome = () => {
    setIncomes([
      ...incomes,
      {
        type: "labor",
        title: "",
        amount: 0,
        frequency: "monthly",
        owner: "self",
      },
    ]);
  };

  const removeIncome = (index: number) => {
    if (incomes.length > 1) {
      setIncomes(incomes.filter((_, i) => i !== index));
    }
  };

  const updateIncome = (
    index: number,
    field: keyof IncomeItem,
    value: string | number
  ) => {
    const updated = [...incomes];
    updated[index] = { ...updated[index], [field]: value };
    setIncomes(updated);
  };

  const handleSave = async () => {
    // 유효성 검사
    const validIncomes = incomes.filter(
      (inc) => inc.title.trim() && inc.amount > 0
    );
    if (validIncomes.length === 0) {
      alert("최소 1개의 소득 정보를 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      // 시뮬레이션 ID 가져오기
      const simulation = await simulationService.getDefault();
      if (!simulation) {
        throw new Error("시뮬레이션을 찾을 수 없습니다.");
      }

      // 각 소득 항목 저장
      for (const income of validIncomes) {
        const defaults = INCOME_TYPE_DEFAULTS[income.type];
        await createIncome({
          simulation_id: simulation.id,
          type: income.type,
          title: income.title,
          owner: income.owner,
          amount: income.amount,
          frequency: income.frequency,
          start_year: currentYear,
          start_month: currentMonth,
          is_fixed_to_retirement: true,
          growth_rate: defaults.growthRate,
          rate_category: defaults.rateCategory,
        });
      }

      onComplete();
    } catch (error) {
      console.error("소득 저장 실패:", error);
      alert("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const totalMonthly = incomes.reduce((sum, inc) => {
    if (inc.frequency === "monthly") return sum + inc.amount;
    return sum + Math.round(inc.amount / 12);
  }, 0);

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onClose}>
          <ArrowLeft size={24} />
        </button>
        <h1 className={styles.headerTitle}>소득 정보 입력</h1>
        <div className={styles.headerSpacer} />
      </header>

      {/* 메인 */}
      <main className={styles.main}>
        {/* 온보딩 힌트 */}
        {surveyIncomeRange && (
          <div className={styles.hintBox}>
            <span className={styles.hintLabel}>온보딩 응답</span>
            <span className={styles.hintValue}>
              연 소득{" "}
              {INCOME_RANGE_LABELS[surveyIncomeRange] || surveyIncomeRange}
            </span>
          </div>
        )}

        {/* 안내 */}
        <p className={styles.description}>
          현재 받고 있는 소득을 입력해주세요.
          <br />
          정확할수록 더 나은 진단이 가능합니다.
        </p>

        {/* 소득 항목 리스트 */}
        <div className={styles.incomeList}>
          {incomes.map((income, index) => (
            <div key={index} className={styles.incomeItem}>
              <div className={styles.itemHeader}>
                <span className={styles.itemNumber}>{index + 1}</span>
                {incomes.length > 1 && (
                  <button
                    className={styles.removeButton}
                    onClick={() => removeIncome(index)}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              {/* 소득 유형 */}
              <div className={styles.field}>
                <label className={styles.label}>소득 유형</label>
                <select
                  className={styles.select}
                  value={income.type}
                  onChange={(e) =>
                    updateIncome(index, "type", e.target.value as IncomeType)
                  }
                >
                  {Object.entries(INCOME_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 소득명 */}
              <div className={styles.field}>
                <label className={styles.label}>소득명</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="예: 본인 급여, 배우자 급여"
                  value={income.title}
                  onChange={(e) => updateIncome(index, "title", e.target.value)}
                />
              </div>

              {/* 금액 + 주기 */}
              <div className={styles.amountRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>금액</label>
                  <div className={styles.amountInput}>
                    <input
                      type="number"
                      className={styles.input}
                      placeholder="0"
                      value={income.amount || ""}
                      onChange={(e) =>
                        updateIncome(
                          index,
                          "amount",
                          parseInt(e.target.value) || 0
                        )
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                </div>
                <div className={styles.field} style={{ width: 100 }}>
                  <label className={styles.label}>주기</label>
                  <select
                    className={styles.select}
                    value={income.frequency}
                    onChange={(e) =>
                      updateIncome(
                        index,
                        "frequency",
                        e.target.value as Frequency
                      )
                    }
                  >
                    <option value="monthly">월</option>
                    <option value="yearly">연</option>
                  </select>
                </div>
              </div>

              {/* 소득자 */}
              <div className={styles.field}>
                <label className={styles.label}>소득자</label>
                <div className={styles.ownerButtons}>
                  <button
                    className={`${styles.ownerButton} ${
                      income.owner === "self" ? styles.active : ""
                    }`}
                    onClick={() => updateIncome(index, "owner", "self")}
                  >
                    본인
                  </button>
                  <button
                    className={`${styles.ownerButton} ${
                      income.owner === "spouse" ? styles.active : ""
                    }`}
                    onClick={() => updateIncome(index, "owner", "spouse")}
                  >
                    배우자
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 소득 추가 버튼 */}
          <button className={styles.addButton} onClick={addIncome}>
            <Plus size={20} />
            <span>소득 추가</span>
          </button>
        </div>

        {/* 합계 */}
        {totalMonthly > 0 && (
          <div className={styles.totalBox}>
            <span className={styles.totalLabel}>월 소득 합계</span>
            <span className={styles.totalValue}>
              {totalMonthly.toLocaleString()}만원
            </span>
          </div>
        )}
      </main>

      {/* 하단 버튼 */}
      <div className={styles.bottomArea}>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </div>
  );
}
