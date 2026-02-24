"use client";

import { useState, useRef, useEffect } from "react";
import { ShoppingCart, Receipt, Sunset, HeartPulse, GraduationCap } from "lucide-react";
import {
  LIFECYCLE_ICONS,
  LIFECYCLE_COLORS,
  getLifecycleIcon,
} from "@/lib/constants/lifecycle";
import { useChartTheme } from "@/hooks/useChartTheme";
import { calculateAge, formatMoney } from "@/lib/utils";
import type { StepProps, WizardData } from "./types";
import styles from "./StepExpense.module.css";

interface StepExpenseProps extends StepProps {
  profileBirthDate: string | null;
}

type ExpenseCard = "living" | "fixed" | "rate";

const DEFAULT_EXPENSE_COLOR = "#f43f5e";

export function StepExpense({ data, onChange, profileBirthDate }: StepExpenseProps) {
  const { isDark } = useChartTheme();
  const { expense } = data;

  const [editing, setEditing] = useState<ExpenseCard | null>(null);
  const [expenseSnapshot, setExpenseSnapshot] = useState<typeof expense | null>(null);

  const [pickerTarget, setPickerTarget] = useState<"living" | "fixed" | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const iconBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const updateExpense = (updates: Partial<typeof expense>) => {
    onChange({ expense: { ...expense, ...updates } });
  };

  const startEdit = (card: ExpenseCard) => {
    setExpenseSnapshot({ ...expense });
    setEditing(card);
  };

  const cancelEdit = () => {
    if (expenseSnapshot) {
      onChange({ expense: expenseSnapshot });
    }
    setEditing(null);
    setExpenseSnapshot(null);
  };

  const finishEdit = () => {
    setEditing(null);
    setExpenseSnapshot(null);
  };

  // Picker logic
  useEffect(() => {
    if (!pickerTarget) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      for (const btn of Object.values(iconBtnRefs.current)) {
        if (btn?.contains(target)) return;
      }
      setPickerTarget(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerTarget]);

  useEffect(() => {
    if (!pickerTarget) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerTarget(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [pickerTarget]);

  const getIcon = (card: "living" | "fixed") =>
    card === "living" ? (expense.livingExpenseIcon || "shopping-cart") : (expense.fixedExpenseIcon || "receipt");
  const getColor = (card: "living" | "fixed") =>
    card === "living" ? (expense.livingExpenseColor || DEFAULT_EXPENSE_COLOR) : (expense.fixedExpenseColor || DEFAULT_EXPENSE_COLOR);

  const togglePicker = (card: "living" | "fixed") => {
    setPickerTarget(pickerTarget === card ? null : card);
  };

  const handleIconSelect = (iconId: string) => {
    if (!pickerTarget) return;
    const key = pickerTarget === "living" ? "livingExpenseIcon" : "fixedExpenseIcon";
    updateExpense({ [key]: iconId });
  };

  const handleColorSelect = (color: string) => {
    if (!pickerTarget) return;
    const key = pickerTarget === "living" ? "livingExpenseColor" : "fixedExpenseColor";
    updateExpense({ [key]: color });
  };

  const renderIconButton = (card: "living" | "fixed") => {
    const iconId = getIcon(card);
    const color = getColor(card);
    const Icon = getLifecycleIcon(iconId);
    return (
      <button
        ref={(el) => { iconBtnRefs.current[card] = el; }}
        type="button"
        className={styles.iconBtn}
        style={{ background: `${color}18` }}
        onClick={(e) => {
          e.stopPropagation();
          togglePicker(card);
        }}
      >
        <Icon size={15} style={{ color }} />
      </button>
    );
  };

  const renderPicker = (card: "living" | "fixed") => {
    if (pickerTarget !== card) return null;
    const currentIcon = getIcon(card);
    const currentColor = getColor(card);
    return (
      <div
        ref={pickerRef}
        className={styles.picker}
        style={{
          background: isDark ? "rgba(34, 37, 41, 0.5)" : "rgba(255, 255, 255, 0.5)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
        }}
      >
        <div className={styles.pickerSection}>
          <div className={styles.pickerGrid}>
            {LIFECYCLE_ICONS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.pickerIconItem} ${currentIcon === item.id ? styles.pickerItemActive : ""}`}
                  style={currentIcon === item.id ? { color: currentColor } : undefined}
                  onClick={() => handleIconSelect(item.id)}
                  title={item.label}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.pickerDivider} />
        <div className={styles.pickerSection}>
          <div className={styles.colorGrid}>
            {LIFECYCLE_COLORS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.colorItem} ${currentColor === item.color ? styles.colorItemActive : ""}`}
                style={{ backgroundColor: item.color }}
                onClick={() => handleColorSelect(item.color)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Preview calculation
  const livingExpense = expense.livingExpense;
  const postRetirementRate = expense.postRetirementRate;
  const retirementAge = data.retirement.retirementAge;
  const lifeExpectancy = data.retirement.lifeExpectancy;

  let yearsToRetirement = 0;
  let selfRetEndYear: number | null = null;
  let selfRetEndMonth: number | null = null;
  let selfRetStartYear: number | null = null;
  let selfRetStartMonth: number | null = null;
  let selfLifeExpEndYear: number | null = null;
  let selfLifeExpEndMonth: number | null = null;
  if (profileBirthDate) {
    const currentAge = calculateAge(profileBirthDate);
    yearsToRetirement = Math.max(0, (retirementAge ?? 65) - currentAge);
    const d = new Date(profileBirthDate);
    const birthYear = d.getFullYear();
    const birthMonth = d.getMonth() + 1; // 1-12
    const retYear = birthYear + (retirementAge ?? 65);
    // Last working month (before turning retirement age)
    if (birthMonth === 1) {
      selfRetEndYear = retYear - 1;
      selfRetEndMonth = 12;
    } else {
      selfRetEndYear = retYear;
      selfRetEndMonth = birthMonth - 1;
    }
    // First retirement month
    selfRetStartYear = retYear;
    selfRetStartMonth = birthMonth;
    // Life expectancy end
    const lifeYear = birthYear + (lifeExpectancy ?? 100);
    if (birthMonth === 1) {
      selfLifeExpEndYear = lifeYear - 1;
      selfLifeExpEndMonth = 12;
    } else {
      selfLifeExpEndYear = lifeYear;
      selfLifeExpEndMonth = birthMonth - 1;
    }
  }

  const showPreview = livingExpense !== null && livingExpense > 0;
  const inflationRate = 0.025;
  const preRetirementExpense = showPreview
    ? Math.round(livingExpense * Math.pow(1 + inflationRate, yearsToRetirement))
    : 0;
  const postRetirementExpense = showPreview
    ? Math.round(preRetirementExpense * postRetirementRate)
    : 0;

  // Auto items
  const currentYear = new Date().getFullYear();
  const hasSelf = profileBirthDate != null;
  const hasSpouse = data.family.hasSpouse && data.family.spouseBirthDate;
  const hasMedicalItems = hasSelf || hasSpouse;

  const allChildren: { name: string; age: number }[] = [];
  for (const child of data.family.children) {
    if (child.birthDate) {
      allChildren.push({ name: child.name || "자녀", age: calculateAge(child.birthDate) });
    }
  }
  data.family.plannedChildren.forEach((pc, idx) => {
    if (pc.birthYear) {
      allChildren.push({ name: `예정 자녀 ${idx + 1}`, age: currentYear - pc.birthYear });
    }
  });
  const hasEducationItems = allChildren.length > 0;


  return (
    <div className={styles.root}>
      <div className={styles.list}>
        {/* 생활비 */}
        {editing === "living" ? (
          <div className={styles.card}>
            <div className={styles.editForm}>
              <span className={styles.editLabel}>은퇴 전 생활비</span>
              <div className={styles.editRow}>
                <div className={styles.amountWrapper}>
                  <input
                    type="number"
                    className={styles.amountInput}
                    value={expense.livingExpense ?? ""}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateExpense({ livingExpense: raw === "" ? null : parseInt(raw, 10) });
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    autoFocus
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              </div>
              <div className={styles.editActions}>
                <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                <button type="button" className={styles.doneBtn} onClick={finishEdit}>완료</button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className={styles.card} onClick={() => startEdit("living")}>
              {renderIconButton("living")}
              <div className={styles.cardInfo}>
                <span className={styles.cardName}>은퇴 전 생활비</span>
                <span className={styles.cardMeta}>
                  {selfRetEndYear ? `현재 ~ ${selfRetEndYear}.${String(selfRetEndMonth).padStart(2, "0")} (은퇴)` : retirementAge ? `현재 ~ ${retirementAge}세 은퇴` : "현재 ~ 은퇴"} · 식비, 교통, 쇼핑, 여가 등
                </span>
              </div>
              <div className={styles.cardRight}>
                <span className={styles.cardAmount}>
                  {expense.livingExpense != null ? `${formatMoney(expense.livingExpense)}/월` : "금액 미입력"}
                </span>
              </div>
            </div>
            {renderPicker("living")}
          </div>
        )}

        {/* 고정비 */}
        {editing === "fixed" ? (
          <div className={styles.card}>
            <div className={styles.editForm}>
              <span className={styles.editLabel}>고정비</span>
              <div className={styles.editRow}>
                <div className={styles.amountWrapper}>
                  <input
                    type="number"
                    className={styles.amountInput}
                    value={expense.fixedExpense ?? ""}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateExpense({ fixedExpense: raw === "" ? null : parseInt(raw, 10) });
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    autoFocus
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              </div>
              <div className={styles.editActions}>
                <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                <button type="button" className={styles.doneBtn} onClick={finishEdit}>완료</button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className={styles.card} onClick={() => startEdit("fixed")}>
              {renderIconButton("fixed")}
              <div className={styles.cardInfo}>
                <span className={styles.cardName}>고정비</span>
                <span className={styles.cardMeta}>
                  매월 고정 · 보험, 통신, 구독, 관리비 등
                </span>
              </div>
              <div className={styles.cardRight}>
                <span className={styles.cardAmount}>
                  {expense.fixedExpense != null ? `${formatMoney(expense.fixedExpense)}/월` : "금액 미입력"}
                </span>
              </div>
            </div>
            {renderPicker("fixed")}
          </div>
        )}

        {/* 은퇴 후 생활비 */}
        {editing === "rate" ? (
          <div className={styles.card}>
            <div className={styles.editForm}>
              <span className={styles.editLabel}>은퇴 후 생활비 비율</span>
              <div className={styles.editRow}>
                <div className={styles.amountWrapper}>
                  <input
                    type="number"
                    className={styles.rateInput}
                    value={Math.round(postRetirementRate * 100)}
                    min={50}
                    max={100}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") return;
                      const pct = Math.min(100, Math.max(50, parseInt(raw, 10)));
                      updateExpense({ postRetirementRate: pct / 100 });
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    autoFocus
                  />
                  <span className={styles.unit}>%</span>
                </div>
              </div>
              {showPreview && yearsToRetirement > 0 && (
                <div className={styles.previewGrid}>
                  <div className={styles.previewRow}>
                    <span className={styles.previewLabel}>은퇴 전 예상</span>
                    <span className={styles.previewValue}>약 {formatMoney(preRetirementExpense)}/월</span>
                  </div>
                  <div className={styles.previewRow}>
                    <span className={styles.previewLabel}>은퇴 후 예상</span>
                    <span className={styles.previewValue}>약 {formatMoney(postRetirementExpense)}/월</span>
                  </div>
                  <span className={styles.previewHint}>(물가 2.5% 반영, {yearsToRetirement}년 후 기준)</span>
                </div>
              )}
              <div className={styles.editActions}>
                <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                <button type="button" className={styles.doneBtn} onClick={finishEdit}>완료</button>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={styles.card}
            onClick={() => startEdit("rate")}
          >
            <div
              className={styles.iconBtn}
              style={{ background: "#f59e0b18" }}
            >
              <Sunset size={15} style={{ color: "#f59e0b" }} />
            </div>
            <div className={styles.cardInfo}>
              <span className={styles.cardName}>은퇴 후 생활비</span>
              <span className={styles.cardMeta}>
                {selfRetStartYear ? `${selfRetStartYear}.${String(selfRetStartMonth).padStart(2, "0")}` : retirementAge ? `${retirementAge}세` : "은퇴"} ~ {selfLifeExpEndYear ? `${selfLifeExpEndYear}.${String(selfLifeExpEndMonth).padStart(2, "0")}` : lifeExpectancy ? `${lifeExpectancy}세` : "기대수명"} · 현재의 {Math.round(postRetirementRate * 100)}%
              </span>
            </div>
            <div className={styles.cardRight}>
              <span className={styles.cardAmount}>
                {showPreview && yearsToRetirement > 0
                  ? `약 ${formatMoney(postRetirementExpense)}/월`
                  : `${Math.round(postRetirementRate * 100)}%`}
              </span>
            </div>
          </div>
        )}

        {/* 자동 반영 섹션 */}
        {(hasMedicalItems || hasEducationItems) && (
          <>
            <div className={styles.sectionDivider}>
              <span className={styles.sectionLabel}>자동 반영</span>
            </div>

            {/* 의료비 */}
            {hasMedicalItems && (
              <div
                className={styles.card}
                onClick={() => updateExpense({ autoMedical: !expense.autoMedical })}
              >
                <div className={styles.iconBtn} style={{ background: "#06b6d418" }}>
                  <HeartPulse size={15} style={{ color: "#06b6d4" }} />
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>의료비</span>
                  <span className={styles.cardMeta}>
                    건강보험통계연보 기준 · {[hasSelf && "본인", hasSpouse && "배우자"].filter(Boolean).join(", ")}
                  </span>
                </div>
                <div className={styles.cardRight}>
                  <input
                    type="checkbox"
                    className={styles.autoCheckbox}
                    checked={expense.autoMedical}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateExpense({ autoMedical: e.target.checked });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            {/* 양육비 */}
            {hasEducationItems && (
              <div
                className={styles.card}
                onClick={() => updateExpense({ autoEducation: !expense.autoEducation })}
              >
                <div className={styles.iconBtn} style={{ background: "#8b5cf618" }}>
                  <GraduationCap size={15} style={{ color: "#8b5cf6" }} />
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>양육비</span>
                  <span className={styles.cardMeta}>
                    통계청 가계동향조사 기준 · {allChildren.map((c) => c.name).join(", ")}
                  </span>
                </div>
                <div className={styles.cardRight}>
                  <div className={`${styles.tierToggle} ${!expense.autoEducation ? styles.tierToggleDisabled : ""}`}>
                    <button
                      type="button"
                      className={`${styles.tierBtn} ${expense.educationTier === "normal" ? styles.tierBtnActive : ""}`}
                      onClick={(e) => { e.stopPropagation(); updateExpense({ educationTier: "normal" }); }}
                    >
                      보통
                    </button>
                    <button
                      type="button"
                      className={`${styles.tierBtn} ${expense.educationTier === "premium" ? styles.tierBtnActive : ""}`}
                      onClick={(e) => { e.stopPropagation(); updateExpense({ educationTier: "premium" }); }}
                    >
                      여유
                    </button>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.autoCheckbox}
                    checked={expense.autoEducation}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateExpense({ autoEducation: e.target.checked });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
