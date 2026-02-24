"use client";

import { X, Plus } from "lucide-react";
import type { StepProps, WizardData } from "./types";
import styles from "./StepIncome.module.css";

type IncomeItem = WizardData["income"]["items"][number];
type PensionType = WizardData["pension"]["selfType"];

const INCOME_TYPES: { value: IncomeItem["type"]; label: string }[] = [
  { value: "labor", label: "근로" },
  { value: "business", label: "사업" },
  { value: "side", label: "부업" },
  { value: "other", label: "기타" },
];

const PENSION_TYPES: { value: PensionType; label: string }[] = [
  { value: "national", label: "국민" },
  { value: "government", label: "공무원" },
  { value: "military", label: "군인" },
  { value: "private_school", label: "사학" },
];

export function StepIncome({ data, onChange }: StepProps) {
  const { income, family } = data;
  const hasSpouse = family.hasSpouse;
  const pension = data.pension?.selfType
    ? data.pension
    : { selfType: "national" as const, selfExpectedAmount: null, selfStartAge: 65, spouseType: "national" as const, spouseExpectedAmount: null, spouseStartAge: null };

  const updatePension = (updates: Partial<typeof pension>) => {
    onChange({ pension: { ...pension, ...updates } });
  };

  const updateItems = (items: IncomeItem[]) => {
    onChange({ income: { items } });
  };

  const handleAdd = () => {
    updateItems([
      ...income.items,
      {
        title: "",
        type: "labor",
        owner: "self",
        amount: null,
        frequency: "monthly",
        retirementLinked: true,
      },
    ]);
  };

  const handleRemove = (index: number) => {
    updateItems(income.items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, updates: Partial<IncomeItem>) => {
    updateItems(
      income.items.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  return (
    <div className={styles.root}>
      {income.items.length === 0 ? (
        <p className={styles.emptyText}>등록된 소득이 없습니다</p>
      ) : (
        <div className={styles.list}>
          {income.items.map((item, index) => (
            <div key={index} className={styles.row}>
              <div className={styles.rowTop}>
                {/* Type */}
                <select
                  className={styles.typeSelect}
                  value={item.type}
                  onChange={(e) =>
                    handleChange(index, { type: e.target.value as IncomeItem["type"] })
                  }
                >
                  {INCOME_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                {/* Title */}
                <input
                  type="text"
                  className={styles.titleInput}
                  value={item.title}
                  onChange={(e) => handleChange(index, { title: e.target.value })}
                  placeholder="항목명"
                />

                {/* Owner pill (only if spouse exists) */}
                {hasSpouse && (
                  <div className={styles.pillGroup}>
                    <button
                      type="button"
                      className={`${styles.pill} ${item.owner === "self" ? styles.pillActive : ""}`}
                      onClick={() => handleChange(index, { owner: "self" })}
                    >
                      본인
                    </button>
                    <button
                      type="button"
                      className={`${styles.pill} ${item.owner === "spouse" ? styles.pillActive : ""}`}
                      onClick={() => handleChange(index, { owner: "spouse" })}
                    >
                      배우자
                    </button>
                  </div>
                )}

                {/* Delete */}
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleRemove(index)}
                  aria-label="소득 삭제"
                >
                  <X size={14} />
                </button>
              </div>

              <div className={styles.rowBottom}>
                {/* Amount */}
                <div className={styles.amountWrapper}>
                  <input
                    type="number"
                    className={styles.amountInput}
                    value={item.amount ?? ""}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = e.target.value;
                      handleChange(index, {
                        amount: raw === "" ? null : parseInt(raw, 10),
                      });
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원</span>
                </div>

                {/* Frequency */}
                <div className={styles.pillGroup}>
                  <button
                    type="button"
                    className={`${styles.pillSmall} ${item.frequency === "monthly" ? styles.pillSmallActive : ""}`}
                    onClick={() => handleChange(index, { frequency: "monthly" })}
                  >
                    월
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillSmall} ${item.frequency === "yearly" ? styles.pillSmallActive : ""}`}
                    onClick={() => handleChange(index, { frequency: "yearly" })}
                  >
                    년
                  </button>
                </div>

                {/* Retirement linked */}
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={item.retirementLinked}
                    onChange={(e) =>
                      handleChange(index, { retirementLinked: e.target.checked })
                    }
                  />
                  <span className={styles.checkText}>은퇴까지</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className={styles.addBtn} onClick={handleAdd}>
        <Plus size={14} />
        소득 추가
      </button>

      <hr className={styles.divider} />

      {/* 공적연금 */}
      <div className={styles.pensionSection}>
        <span className={styles.pensionLabel}>공적연금</span>

        <div className={styles.pensionRow}>
          <span className={styles.pensionOwner}>본인</span>
          <div className={styles.pillGroup}>
            {PENSION_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`${styles.pillSmall} ${pension.selfType === value ? styles.pillSmallActive : ""}`}
                onClick={() => updatePension({ selfType: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="number"
            className={styles.amountInput}
            value={pension.selfExpectedAmount ?? ""}
            onChange={(e) =>
              updatePension({ selfExpectedAmount: e.target.value === "" ? null : Number(e.target.value) })
            }
            onWheel={(e) => (e.target as HTMLElement).blur()}
            placeholder="0"
          />
          <span className={styles.unit}>만원/월</span>
          <input
            type="number"
            className={styles.ageInput}
            value={pension.selfStartAge ?? ""}
            onChange={(e) =>
              updatePension({ selfStartAge: e.target.value === "" ? 65 : Number(e.target.value) })
            }
            onWheel={(e) => (e.target as HTMLElement).blur()}
            placeholder="65"
          />
          <span className={styles.unit}>세부터</span>
        </div>

        {hasSpouse && (
          <div className={styles.pensionRow}>
            <span className={styles.pensionOwner}>배우자</span>
            <div className={styles.pillGroup}>
              {PENSION_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.pillSmall} ${pension.spouseType === value ? styles.pillSmallActive : ""}`}
                  onClick={() => updatePension({ spouseType: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="number"
              className={styles.amountInput}
              value={pension.spouseExpectedAmount ?? ""}
              onChange={(e) =>
                updatePension({ spouseExpectedAmount: e.target.value === "" ? null : Number(e.target.value) })
              }
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.unit}>만원/월</span>
            <input
              type="number"
              className={styles.ageInput}
              value={pension.spouseStartAge ?? ""}
              onChange={(e) =>
                updatePension({ spouseStartAge: e.target.value === "" ? null : Number(e.target.value) })
              }
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="65"
            />
            <span className={styles.unit}>세부터</span>
          </div>
        )}
      </div>
    </div>
  );
}
