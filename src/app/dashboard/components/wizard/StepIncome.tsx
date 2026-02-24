"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Briefcase, Building2, Zap, Coins, Landmark } from "lucide-react";
import {
  LIFECYCLE_ICONS,
  LIFECYCLE_COLORS,
  getLifecycleIcon,
} from "@/lib/constants/lifecycle";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatMoney } from "@/lib/utils";
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

const DEFAULT_INCOME_ICONS: Record<IncomeItem["type"], string> = {
  labor: "briefcase",
  business: "building2",
  side: "sparkles",
  other: "coins",
};

const PENSION_TYPES: { value: PensionType; label: string }[] = [
  { value: "national", label: "국민" },
  { value: "government", label: "공무원" },
  { value: "military", label: "군인" },
  { value: "private_school", label: "사학" },
];

const DEFAULT_INCOME_COLOR = "#10b981";
const DEFAULT_PENSION_COLOR = "#6366f1";

const PENSION_TYPE_LABELS: Record<PensionType, string> = {
  national: "국민연금",
  government: "공무원연금",
  military: "군인연금",
  private_school: "사학연금",
};

type PensionOwner = "self" | "spouse";
type PensionData = WizardData["pension"];
type PickerTarget = { kind: "income"; index: number } | { kind: "pension"; owner: PensionOwner } | null;

export function StepIncome({ data, onChange }: StepProps) {
  const { isDark } = useChartTheme();
  const { income, family } = data;
  const hasSpouse = family.hasSpouse;
  const pension = data.pension?.selfType
    ? data.pension
    : { selfType: "national" as const, selfExpectedAmount: null, selfStartAge: 65, spouseType: "national" as const, spouseExpectedAmount: null, spouseStartAge: null };

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<IncomeItem | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);

  const [editingPension, setEditingPension] = useState<PensionOwner | null>(null);
  const [pensionSnapshot, setPensionSnapshot] = useState<PensionData | null>(null);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const iconBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Close picker on outside click
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

  const startEdit = (index: number) => {
    setSnapshot({ ...income.items[index] });
    setIsNewItem(false);
    setEditingIndex(index);
  };

  const cancelEdit = () => {
    if (editingIndex === null) return;
    if (isNewItem) {
      updateItems(income.items.filter((_, i) => i !== editingIndex));
    } else if (snapshot) {
      updateItems(
        income.items.map((item, i) => (i === editingIndex ? snapshot : item))
      );
    }
    setEditingIndex(null);
    setSnapshot(null);
    setIsNewItem(false);
  };

  const finishEdit = () => {
    setEditingIndex(null);
    setSnapshot(null);
    setIsNewItem(false);
  };

  const updatePension = (updates: Partial<typeof pension>) => {
    onChange({ pension: { ...pension, ...updates } });
  };

  const startPensionEdit = (owner: PensionOwner) => {
    setPensionSnapshot({ ...pension });
    setEditingPension(owner);
  };

  const cancelPensionEdit = () => {
    if (pensionSnapshot) {
      onChange({ pension: pensionSnapshot });
    }
    setEditingPension(null);
    setPensionSnapshot(null);
  };

  const finishPensionEdit = () => {
    setEditingPension(null);
    setPensionSnapshot(null);
  };

  const updateItems = (items: IncomeItem[]) => {
    onChange({ income: { items } });
  };

  const handleAdd = () => {
    const newItems = [
      ...income.items,
      {
        title: "",
        type: "labor" as const,
        owner: "self" as const,
        amount: null,
        frequency: "monthly" as const,
        retirementLinked: true,
      },
    ];
    updateItems(newItems);
    setIsNewItem(true);
    setSnapshot(null);
    setEditingIndex(newItems.length - 1);
  };

  const handleChange = (index: number, updates: Partial<IncomeItem>) => {
    updateItems(
      income.items.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const getTypeLabel = (type: IncomeItem["type"]) =>
    INCOME_TYPES.find((t) => t.value === type)?.label ?? type;

  const formatAmount = (item: IncomeItem) => {
    if (item.amount == null) return "금액 미입력";
    return `${formatMoney(item.amount)}/${item.frequency === "monthly" ? "월" : "년"}`;
  };

  const getMetaText = (item: IncomeItem) => {
    const owner = item.owner === "spouse" ? "배우자" : "본인";
    const linked = item.retirementLinked ? `${owner} 은퇴까지` : "";
    return linked || owner;
  };

  // Icon helpers
  const getItemIcon = (item: IncomeItem) => item.icon || DEFAULT_INCOME_ICONS[item.type];
  const getItemColor = (item: IncomeItem) => item.color || DEFAULT_INCOME_COLOR;
  const getPensionIcon = (owner: PensionOwner) =>
    (owner === "self" ? pension.selfIcon : pension.spouseIcon) || "landmark";
  const getPensionColor = (owner: PensionOwner) =>
    (owner === "self" ? pension.selfColor : pension.spouseColor) || DEFAULT_PENSION_COLOR;

  const togglePicker = (target: PickerTarget) => {
    if (!target) return;
    const isSame =
      pickerTarget &&
      target &&
      ((target.kind === "income" && pickerTarget.kind === "income" && target.index === pickerTarget.index) ||
        (target.kind === "pension" && pickerTarget.kind === "pension" && target.owner === pickerTarget.owner));
    setPickerTarget(isSame ? null : target);
  };

  const handleIconSelect = (iconId: string) => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === "income") {
      handleChange(pickerTarget.index, { icon: iconId });
    } else {
      const key = pickerTarget.owner === "self" ? "selfIcon" : "spouseIcon";
      updatePension({ [key]: iconId });
    }
  };

  const handleColorSelect = (color: string) => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === "income") {
      handleChange(pickerTarget.index, { color });
    } else {
      const key = pickerTarget.owner === "self" ? "selfColor" : "spouseColor";
      updatePension({ [key]: color });
    }
  };

  const getCurrentPickerValues = () => {
    if (!pickerTarget) return { icon: "", color: "" };
    if (pickerTarget.kind === "income") {
      const item = income.items[pickerTarget.index];
      return { icon: getItemIcon(item), color: getItemColor(item) };
    }
    return { icon: getPensionIcon(pickerTarget.owner), color: getPensionColor(pickerTarget.owner) };
  };

  const renderIconButton = (target: NonNullable<PickerTarget>, iconId: string, color: string, refKey: string) => {
    const Icon = getLifecycleIcon(iconId);
    return (
      <button
        ref={(el) => { iconBtnRefs.current[refKey] = el; }}
        type="button"
        className={styles.iconBtn}
        style={{ background: `${color}18` }}
        onClick={(e) => {
          e.stopPropagation();
          togglePicker(target);
        }}
      >
        <Icon size={15} style={{ color }} />
      </button>
    );
  };

  const renderPicker = (target: NonNullable<PickerTarget>, refKey: string) => {
    if (!pickerTarget) return null;
    const isCurrent =
      (target.kind === "income" && pickerTarget.kind === "income" && target.index === pickerTarget.index) ||
      (target.kind === "pension" && pickerTarget.kind === "pension" && target.owner === pickerTarget.owner);
    if (!isCurrent) return null;

    const current = getCurrentPickerValues();
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
                  className={`${styles.pickerIconItem} ${current.icon === item.id ? styles.pickerItemActive : ""}`}
                  style={current.icon === item.id ? { color: current.color } : undefined}
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
                className={`${styles.colorItem} ${current.color === item.color ? styles.colorItemActive : ""}`}
                style={{ backgroundColor: item.color }}
                onClick={() => handleColorSelect(item.color)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCard = (item: IncomeItem, index: number) => {
    const isEditing = editingIndex === index;
    const iconId = getItemIcon(item);
    const color = getItemColor(item);

    if (isEditing) {
      return (
        <div key={index} className={styles.card}>
          <div className={styles.editForm}>
            <div className={styles.editRow}>
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
              <input
                type="text"
                className={styles.titleInput}
                value={item.title}
                onChange={(e) => handleChange(index, { title: e.target.value })}
                placeholder="항목명"
                autoFocus
              />
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
            </div>
            <div className={styles.editRow}>
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
            <div className={styles.editActions}>
              <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>
                취소
              </button>
              <button type="button" className={styles.doneBtn} onClick={finishEdit}>
                완료
              </button>
            </div>
          </div>
        </div>
      );
    }

    const refKey = `income-${index}`;
    return (
      <div key={index}>
        <div className={styles.card} onClick={() => startEdit(index)}>
          {renderIconButton({ kind: "income", index }, iconId, color, refKey)}
          <div className={styles.cardInfo}>
            <span className={styles.cardName}>
              {item.title || getTypeLabel(item.type) + " 소득"}
              {hasSpouse && (
                <span className={styles.ownerTag}>
                  {item.owner === "spouse" ? "배우자" : "본인"}
                </span>
              )}
            </span>
            <span className={styles.cardMeta}>{getMetaText(item)}</span>
          </div>
          <div className={styles.cardRight}>
            <span className={styles.cardAmount}>{formatAmount(item)}</span>
          </div>
        </div>
        {renderPicker({ kind: "income", index }, refKey)}
      </div>
    );
  };

  return (
    <div className={styles.root}>
      {income.items.length === 0 ? (
        <p className={styles.emptyText}>등록된 소득이 없습니다</p>
      ) : (
        <div className={styles.list}>
          {income.items.map((item, index) => renderCard(item, index))}
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

        <div className={styles.list}>
          {/* 본인 */}
          {editingPension === "self" ? (
            <div className={styles.card}>
              <div className={styles.editForm}>
                <div className={styles.editRow}>
                  <span className={styles.editOwnerLabel}>본인</span>
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
                </div>
                <div className={styles.editRow}>
                  <div className={styles.amountWrapper}>
                    <input
                      type="number"
                      className={styles.amountInput}
                      value={pension.selfExpectedAmount ?? ""}
                      onChange={(e) =>
                        updatePension({ selfExpectedAmount: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder="0"
                      autoFocus
                    />
                    <span className={styles.unit}>만원/월</span>
                  </div>
                  <div className={styles.amountWrapper}>
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
                </div>
                <div className={styles.editActions}>
                  <button type="button" className={styles.cancelBtn} onClick={cancelPensionEdit}>
                    취소
                  </button>
                  <button type="button" className={styles.doneBtn} onClick={finishPensionEdit}>
                    완료
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className={styles.card} onClick={() => startPensionEdit("self")}>
                {renderIconButton({ kind: "pension", owner: "self" }, getPensionIcon("self"), getPensionColor("self"), "pension-self")}
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>
                    {PENSION_TYPE_LABELS[pension.selfType]}
                    <span className={styles.ownerTag}>본인</span>
                  </span>
                  <span className={styles.cardMeta}>{pension.selfStartAge || 65}세부터</span>
                </div>
                <div className={styles.cardRight}>
                  <span className={styles.cardAmount}>
                    {pension.selfExpectedAmount != null ? `${formatMoney(pension.selfExpectedAmount)}/월` : "금액 미입력"}
                  </span>
                </div>
              </div>
              {renderPicker({ kind: "pension", owner: "self" }, "pension-self")}
            </div>
          )}

          {/* 배우자 */}
          {hasSpouse && (
            editingPension === "spouse" ? (
              <div className={styles.card}>
                <div className={styles.editForm}>
                  <div className={styles.editRow}>
                    <span className={styles.editOwnerLabel}>배우자</span>
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
                  </div>
                  <div className={styles.editRow}>
                    <div className={styles.amountWrapper}>
                      <input
                        type="number"
                        className={styles.amountInput}
                        value={pension.spouseExpectedAmount ?? ""}
                        onChange={(e) =>
                          updatePension({ spouseExpectedAmount: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        placeholder="0"
                        autoFocus
                      />
                      <span className={styles.unit}>만원/월</span>
                    </div>
                    <div className={styles.amountWrapper}>
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
                  </div>
                  <div className={styles.editActions}>
                    <button type="button" className={styles.cancelBtn} onClick={cancelPensionEdit}>
                      취소
                    </button>
                    <button type="button" className={styles.doneBtn} onClick={finishPensionEdit}>
                      완료
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className={styles.card} onClick={() => startPensionEdit("spouse")}>
                  {renderIconButton({ kind: "pension", owner: "spouse" }, getPensionIcon("spouse"), getPensionColor("spouse"), "pension-spouse")}
                  <div className={styles.cardInfo}>
                    <span className={styles.cardName}>
                      {PENSION_TYPE_LABELS[pension.spouseType]}
                      <span className={styles.ownerTag}>배우자</span>
                    </span>
                    <span className={styles.cardMeta}>{pension.spouseStartAge || 65}세부터</span>
                  </div>
                  <div className={styles.cardRight}>
                    <span className={styles.cardAmount}>
                      {pension.spouseExpectedAmount != null ? `${formatMoney(pension.spouseExpectedAmount)}/월` : "금액 미입력"}
                    </span>
                  </div>
                </div>
                {renderPicker({ kind: "pension", owner: "spouse" }, "pension-spouse")}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
