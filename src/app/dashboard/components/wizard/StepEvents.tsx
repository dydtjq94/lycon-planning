"use client";

import { X, Plus } from "lucide-react";
import type { StepProps, WizardData } from "./types";
import styles from "./StepEvents.module.css";

type EventItem = WizardData["events"]["items"][number];

const EVENT_TYPES: { value: EventItem["type"]; label: string }[] = [
  { value: "housing", label: "주택" },
  { value: "car", label: "자동차" },
  { value: "education", label: "교육" },
  { value: "wedding", label: "결혼" },
  { value: "travel", label: "여행" },
  { value: "medical", label: "의료" },
  { value: "other", label: "기타" },
];

const EVENT_PRESETS: {
  type: EventItem["type"];
  title: string;
  defaultAmount: number;
  description: string;
}[] = [
  { type: "housing", title: "주택 매수", defaultAmount: 50000, description: "5억원 기준" },
  { type: "car", title: "자동차 구매", defaultAmount: 5000, description: "5천만원 기준" },
  { type: "wedding", title: "결혼 비용", defaultAmount: 5000, description: "5천만원 기준" },
  { type: "travel", title: "해외 여행", defaultAmount: 500, description: "500만원 기준" },
  { type: "medical", title: "부모 요양비", defaultAmount: 3000, description: "3천만원/년 기준" },
  { type: "other", title: "사업/창업", defaultAmount: 10000, description: "1억원 기준" },
];

interface AutoItem {
  key: "medical-self" | "medical-spouse" | string;
  label: string;
  group: "medical" | "education";
}

function getAutoItems(data: WizardData, profileBirthDate: string): AutoItem[] {
  const items: AutoItem[] = [];

  if (profileBirthDate) items.push({ key: "medical-self", label: "본인 의료비", group: "medical" });
  if (data.family.hasSpouse && data.family.spouseBirthDate) items.push({ key: "medical-spouse", label: "배우자 의료비", group: "medical" });

  for (const child of data.family.children) {
    if (child.birthDate) items.push({ key: `edu-${child.name}`, label: `${child.name || "자녀"} 양육비`, group: "education" });
  }
  data.family.plannedChildren.forEach((pc, idx) => {
    if (pc.birthYear) items.push({ key: `edu-planned-${idx}`, label: `예정 자녀 ${idx + 1} 양육비`, group: "education" });
  });

  return items;
}

interface StepEventsProps extends StepProps {
  profileBirthDate: string;
}

export function StepEvents({ data, onChange, profileBirthDate }: StepEventsProps) {
  const events = data.events?.items ? data.events : { items: [] as EventItem[] };
  const autoItems = getAutoItems(data, profileBirthDate);
  const hasMedicalItems = autoItems.some(i => i.group === "medical");
  const hasEducationItems = autoItems.some(i => i.group === "education");

  const updateExpense = (updates: Partial<WizardData["expense"]>) => {
    onChange({ expense: { ...data.expense, ...updates } });
  };

  const handleAdd = () => {
    onChange({
      events: {
        items: [
          ...events.items,
          { type: "other", title: "", year: null, amount: null },
        ],
      },
    });
  };

  const handlePresetAdd = (preset: typeof EVENT_PRESETS[number]) => {
    onChange({
      events: {
        items: [
          ...events.items,
          { type: preset.type, title: preset.title, year: null, amount: preset.defaultAmount },
        ],
      },
    });
  };

  const handleRemove = (index: number) => {
    onChange({
      events: {
        items: events.items.filter((_, i) => i !== index),
      },
    });
  };

  const handleChange = (index: number, updates: Partial<EventItem>) => {
    onChange({
      events: {
        items: events.items.map((item, i) =>
          i === index ? { ...item, ...updates } : item
        ),
      },
    });
  };

  return (
    <div className={styles.root}>
      {autoItems.length > 0 && (
        <div className={styles.autoSection}>
          <div className={styles.autoSectionLabel}>자동 반영</div>
          {hasMedicalItems && (
            <label className={styles.autoItem}>
              <input
                type="checkbox"
                className={styles.autoCheckbox}
                checked={data.expense.autoMedical}
                onChange={(e) => updateExpense({ autoMedical: e.target.checked })}
              />
              <div className={styles.autoItemText}>
                <span className={styles.autoItemName}>의료비</span>
                <span className={styles.autoItemDesc}>
                  {autoItems.filter(i => i.group === "medical").map(i => i.label).join(", ")}
                </span>
              </div>
            </label>
          )}
          {hasEducationItems && (
            <label className={styles.autoItem}>
              <input
                type="checkbox"
                className={styles.autoCheckbox}
                checked={data.expense.autoEducation}
                onChange={(e) => updateExpense({ autoEducation: e.target.checked })}
              />
              <div className={styles.autoItemText}>
                <span className={styles.autoItemName}>양육비</span>
                <span className={styles.autoItemDesc}>
                  {autoItems.filter(i => i.group === "education").map(i => i.label).join(", ")}
                </span>
              </div>
              {data.expense.autoEducation && (
                <div className={styles.tierToggle}>
                  <button
                    type="button"
                    className={`${styles.tierBtn} ${data.expense.educationTier === 'normal' ? styles.tierBtnActive : ''}`}
                    onClick={() => updateExpense({ educationTier: 'normal' })}
                  >
                    보통
                  </button>
                  <button
                    type="button"
                    className={`${styles.tierBtn} ${data.expense.educationTier === 'premium' ? styles.tierBtnActive : ''}`}
                    onClick={() => updateExpense({ educationTier: 'premium' })}
                  >
                    여유
                  </button>
                </div>
              )}
            </label>
          )}
        </div>
      )}
      <div className={styles.presetSection}>
        <div className={styles.presetLabel}>빠른 추가</div>
        <div className={styles.pillGroup}>
          {EVENT_PRESETS.map((preset) => (
            <button
              key={preset.title}
              type="button"
              className={styles.pill}
              onClick={() => handlePresetAdd(preset)}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>
      {events.items.length > 0 && (
        <div className={styles.list}>
          {events.items.map((item, index) => (
            <div key={index} className={styles.eventCard}>
              <div className={styles.pillGroup}>
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={
                      item.type === t.value
                        ? `${styles.pill} ${styles.pillActive}`
                        : styles.pill
                    }
                    onClick={() => handleChange(index, { type: t.value })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className={styles.titleInput}
                placeholder="이벤트 이름"
                value={item.title}
                onChange={(e) => handleChange(index, { title: e.target.value })}
              />
              <div className={styles.detailRow}>
                <input
                  type="number"
                  className={styles.yearInput}
                  placeholder="연도"
                  value={item.year ?? ""}
                  onChange={(e) =>
                    handleChange(index, {
                      year: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>년</span>
                <input
                  type="number"
                  className={styles.amountInput}
                  placeholder="금액"
                  value={item.amount ?? ""}
                  onChange={(e) =>
                    handleChange(index, {
                      amount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleRemove(index)}
                  aria-label="삭제"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" className={styles.addBtn} onClick={handleAdd}>
        <Plus size={14} />
        직접 추가
      </button>
    </div>
  );
}
