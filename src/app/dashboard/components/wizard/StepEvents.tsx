"use client";

import { useState } from "react";
import {
  Plus,
  Home,
  Car,
  GraduationCap,
  Heart,
  Plane,
  HeartPulse,
  CircleDot,
} from "lucide-react";
import { formatMoney } from "@/lib/utils";
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

const EVENT_TYPE_ICONS: Record<EventItem["type"], { icon: typeof Home; color: string }> = {
  housing: { icon: Home, color: "#3b82f6" },
  car: { icon: Car, color: "#f59e0b" },
  education: { icon: GraduationCap, color: "#8b5cf6" },
  wedding: { icon: Heart, color: "#ec4899" },
  travel: { icon: Plane, color: "#14b8a6" },
  medical: { icon: HeartPulse, color: "#06b6d4" },
  other: { icon: CircleDot, color: "#64748b" },
};

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

interface StepEventsProps extends StepProps {
  profileBirthDate: string;
}

export function StepEvents({ data, onChange }: StepEventsProps) {
  const events = data.events?.items ? data.events : { items: [] as EventItem[] };

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<EventItem[] | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);

  const handleAdd = () => {
    const newItems = [...events.items, { type: "other" as const, title: "", year: null, amount: null }];
    onChange({ events: { items: newItems } });
    setSnapshot([...events.items]);
    setEditingIndex(newItems.length - 1);
    setIsNewItem(true);
  };

  const handlePresetAdd = (preset: typeof EVENT_PRESETS[number]) => {
    const newItems = [
      ...events.items,
      { type: preset.type, title: preset.title, year: null, amount: preset.defaultAmount },
    ];
    onChange({ events: { items: newItems } });
    setSnapshot([...events.items]);
    setEditingIndex(newItems.length - 1);
    setIsNewItem(true);
  };

  const startEdit = (index: number) => {
    setSnapshot([...events.items.map((i) => ({ ...i }))]);
    setEditingIndex(index);
    setIsNewItem(false);
  };

  const cancelEdit = () => {
    if (snapshot) {
      onChange({ events: { items: snapshot } });
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

  const handleChange = (index: number, updates: Partial<EventItem>) => {
    onChange({
      events: {
        items: events.items.map((item, i) =>
          i === index ? { ...item, ...updates } : item
        ),
      },
    });
  };

  const handleRemove = (index: number) => {
    onChange({
      events: { items: events.items.filter((_, i) => i !== index) },
    });
    setEditingIndex(null);
    setSnapshot(null);
    setIsNewItem(false);
  };

  const getTypeLabel = (type: EventItem["type"]) =>
    EVENT_TYPES.find((t) => t.value === type)?.label ?? "기타";

  return (
    <div className={styles.root}>
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
          {events.items.map((item, index) => {
            const iconInfo = EVENT_TYPE_ICONS[item.type];
            const Icon = iconInfo.icon;
            const color = iconInfo.color;

            if (editingIndex === index) {
              return (
                <div key={index} className={styles.card}>
                  <div className={styles.editForm}>
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
                      autoFocus
                    />
                    <div className={styles.editRow}>
                      <div className={styles.amountWrapper}>
                        <input
                          type="number"
                          className={styles.yearInput}
                          placeholder="연도"
                          value={item.year ?? ""}
                          max={9999}
                          onChange={(e) => {
                            if (e.target.value.length > 4) return;
                            handleChange(index, {
                              year: e.target.value === "" ? null : Number(e.target.value),
                            });
                          }}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.unit}>년</span>
                      </div>
                      <div className={styles.amountWrapper}>
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
                      </div>
                    </div>
                    <div className={styles.editActions}>
                      {!isNewItem && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => handleRemove(index)}
                        >
                          삭제
                        </button>
                      )}
                      <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                      <button type="button" className={styles.doneBtn} onClick={finishEdit}>완료</button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={index} className={styles.card} onClick={() => startEdit(index)}>
                <div className={styles.iconBtn} style={{ background: `${color}18` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>
                    {item.title || getTypeLabel(item.type)}
                  </span>
                  <span className={styles.cardMeta}>
                    {getTypeLabel(item.type)}{item.year ? ` · ${item.year}년` : ""}
                  </span>
                </div>
                <div className={styles.cardRight}>
                  <span className={styles.cardAmount}>
                    {item.amount != null ? formatMoney(item.amount) : "금액 미입력"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" className={styles.addBtn} onClick={handleAdd}>
        <Plus size={14} />
        직접 추가
      </button>
    </div>
  );
}
