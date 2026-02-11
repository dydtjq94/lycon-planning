"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatWon, formatMoney, calculateAge } from "@/lib/utils";
import { EXPENSE_TYPE_LABELS } from "@/lib/services/expenseService";
import { DEBT_TYPE_LABELS, REPAYMENT_TYPE_LABELS } from "@/lib/services/debtService";
import { ALL_SAVINGS_TYPE_LABELS } from "@/lib/services/savingsService";
import { REAL_ESTATE_TYPE_LABELS, HOUSING_TYPE_LABELS } from "@/lib/services/realEstateService";
import { ASSET_TYPE_LABELS, FINANCING_TYPE_LABELS } from "@/lib/services/physicalAssetService";
import { INSURANCE_TYPE_LABELS } from "@/lib/services/insuranceService";
import { PENSION_TYPE_LABELS } from "@/lib/services/personalPensionService";
import { RATE_CATEGORY_LABELS } from "@/types";
import styles from "./AllDataSection.module.css";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================
// Label maps
// ============================================================

const OWNER_LABELS: Record<string, string> = { self: "본인", spouse: "배우자" };
const FREQUENCY_LABELS: Record<string, string> = { monthly: "월", yearly: "연" };
const GENDER_LABELS: Record<string, string> = { male: "남", female: "여" };
const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: "배우자",
  son: "아들",
  daughter: "딸",
  father: "아버지",
  mother: "어머니",
};
const BOOKING_STATUS_LABELS: Record<string, string> = {
  confirmed: "확정",
  pending: "대기",
  cancelled: "취소",
  completed: "완료",
};
const CONSULTATION_STATUS_LABELS: Record<string, string> = {
  scheduled: "예정",
  completed: "완료",
  cancelled: "취소",
  no_show: "불참",
};
const CONSULTATION_TYPE_LABELS: Record<string, string> = {
  "retirement-diagnosis": "은퇴 진단",
  "budget-consultation": "가계부 상담",
  "asset-review": "자산 점검",
  "investment-strategy": "투자 전략",
  "pension-planning": "연금 설계",
  "tax-planning": "세금 상담",
  "initial": "초기 상담",
  "followup": "후속 상담",
  "general": "일반 상담",
};
const INCOME_TYPE_LABELS: Record<string, string> = {
  salary: "급여",
  business: "사업",
  freelance: "프리랜서",
  side: "부업",
  allowance: "용돈",
  rental: "임대",
  pension: "연금",
  dividend: "배당",
  other: "기타",
};
const PAYMENT_TYPE_LABELS: Record<string, string> = { debit: "체크", credit: "신용" };
const BUDGET_TYPE_LABELS: Record<string, string> = { income: "수입", expense: "지출" };
const TRADE_TYPE_LABELS: Record<string, string> = { buy: "매수", sell: "매도" };
const INTEREST_TYPE_LABELS: Record<string, string> = { fixed: "고정", variable: "변동", simple: "단리", compound: "복리" };
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "입출금", general: "종합", savings: "적금", deposit: "정기예금",
  free_savings: "자유적금", housing: "주택청약", isa: "ISA", pension_savings: "연금저축",
  dc: "DC(확정기여)", irp: "IRP(개인형)",
};
const CURRENCY_LABELS: Record<string, string> = { KRW: "원", USD: "달러", EUR: "유로", JPY: "엔" };
const PENSION_PAYOUT_LABELS: Record<string, string> = { lump_sum: "일시금", annuity: "연금" };
const CUSTOMER_STAGE_LABELS: Record<string, string> = {
  new: "신규",
  onboarding: "온보딩 중",
  diagnosis: "진단 중",
  report_writing: "리포트 작성 중",
  report_delivered: "리포트 전달 완료",
  consulting: "상담 진행 중",
  active: "활성 고객",
  inactive: "비활성",
};
const ONBOARDING_STEP_LABELS: Record<string, string> = {
  welcome: "시작 전",
  basicInfo: "기본 정보 입력",
  transition1: "설문 진행 중",
  program: "프로그램 안내",
  booking: "상담 예약",
  completed: "완료",
};

// 온보딩 설문 정의 (SimpleOnboarding.tsx에서 동기화)
const SURVEY_SECTIONS: { title: string; questions: { id: string; question: string; type: "single" | "multiple"; options: { value: string; label: string }[] }[] }[] = [
  {
    title: "방문 목적",
    questions: [
      { id: "visit_purpose", question: "어떤 고민으로 찾아오셨나요?", type: "multiple", options: [
        { value: "retirement_worry", label: "은퇴 후 생활이 걱정돼요" },
        { value: "financial_checkup", label: "내 재정 상태를 점검받고 싶어요" },
        { value: "asset_management", label: "자산 관리 방법을 알고 싶어요" },
        { value: "strategy", label: "연금/투자 전략이 궁금해요" },
        { value: "expert_advice", label: "전문가 조언이 필요해요" },
        { value: "curious", label: "그냥 한번 써보려고요" },
      ]},
    ],
  },
  {
    title: "돈에 대한 생각",
    questions: [
      { id: "money_feeling", question: "돈 생각하면 어떤 기분이 드세요?", type: "single", options: [
        { value: "confident", label: "든든하고 여유롭다" },
        { value: "varies", label: "그때그때 다르다" },
        { value: "anxious", label: "왠지 불안하다" },
        { value: "avoid", label: "생각하기 싫다" },
      ]},
      { id: "money_importance", question: "행복하려면 돈이 얼마나 중요할까요?", type: "single", options: [
        { value: "very", label: "아주 중요하다" },
        { value: "important", label: "중요한 편이다" },
        { value: "moderate", label: "보통이다" },
        { value: "not_much", label: "별로 안 중요하다" },
      ]},
      { id: "financial_goal", question: "지금 가장 중요한 목표는요?", type: "single", options: [
        { value: "retirement", label: "편안한 노후" },
        { value: "house", label: "내 집 마련" },
        { value: "children", label: "자녀 교육/결혼" },
        { value: "freedom", label: "경제적 자유" },
        { value: "debt", label: "빚 갚기" },
      ]},
      { id: "today_vs_tomorrow", question: "지금 쓰는 것 vs 미래를 위해 모으는 것, 어느 쪽이세요?", type: "single", options: [
        { value: "today", label: "오늘을 즐기는 편" },
        { value: "tomorrow", label: "미래를 위해 아끼는 편" },
        { value: "balance", label: "반반" },
      ]},
    ],
  },
  {
    title: "현재 상황",
    questions: [
      { id: "marital_status", question: "결혼하셨나요?", type: "single", options: [
        { value: "single", label: "미혼" },
        { value: "married", label: "기혼" },
        { value: "divorced", label: "이혼/사별" },
      ]},
      { id: "children", question: "자녀가 있으신가요?", type: "single", options: [
        { value: "none", label: "없어요" },
        { value: "one", label: "1명" },
        { value: "two", label: "2명" },
        { value: "three_plus", label: "3명 이상" },
      ]},
      { id: "income_range", question: "연 소득이 어느 정도 되시나요?", type: "single", options: [
        { value: "under_1200", label: "1,200만원 이하" },
        { value: "1200_4600", label: "1,200~4,600만원" },
        { value: "4600_8800", label: "4,600~8,800만원" },
        { value: "8800_15000", label: "8,800만원~1.5억" },
        { value: "over_15000", label: "1.5억 초과" },
      ]},
      { id: "monthly_expense", question: "한 달 생활비는 보통 얼마나 쓰시나요?", type: "single", options: [
        { value: "under_200", label: "200만원 미만" },
        { value: "200_300", label: "200~300만원" },
        { value: "300_500", label: "300~500만원" },
        { value: "over_500", label: "500만원 이상" },
      ]},
      { id: "monthly_investment", question: "한 달에 저축이나 투자는 얼마나 하세요?", type: "single", options: [
        { value: "none", label: "거의 못 하고 있어요" },
        { value: "under_50", label: "50만원 미만" },
        { value: "50_100", label: "50~100만원" },
        { value: "100_300", label: "100~300만원" },
        { value: "over_300", label: "300만원 이상" },
      ]},
    ],
  },
  {
    title: "재무 습관",
    questions: [
      { id: "saving_style", question: "저축이나 투자, 어떤 스타일이세요?", type: "single", options: [
        { value: "aggressive", label: "적극적으로 투자하는 편" },
        { value: "balanced", label: "저축과 투자 반반" },
        { value: "conservative", label: "안전하게 저축하는 편" },
        { value: "passive", label: "딱히 안 하는 편" },
      ]},
      { id: "budget_tracking", question: "가계부 쓰시나요?", type: "single", options: [
        { value: "always", label: "꾸준히 쓴다" },
        { value: "sometimes", label: "가끔 쓴다" },
        { value: "tried", label: "해봤는데 안 맞더라" },
        { value: "never", label: "안 쓴다" },
      ]},
      { id: "investment_exp", question: "지금 하고 계신 투자가 있나요?", type: "multiple", options: [
        { value: "stock_domestic", label: "국내 주식/ETF" },
        { value: "stock_foreign", label: "해외 주식/ETF" },
        { value: "fund", label: "펀드" },
        { value: "bond", label: "채권" },
        { value: "realestate", label: "부동산" },
        { value: "crypto", label: "가상자산" },
        { value: "gold", label: "금/원자재" },
        { value: "none", label: "없어요" },
      ]},
    ],
  },
  {
    title: "은퇴 준비",
    questions: [
      { id: "retirement_worry", question: "은퇴 후 생활, 얼마나 걱정되세요?", type: "single", options: [
        { value: "none", label: "전혀 걱정되지 않는다" },
        { value: "little", label: "별로 걱정되지 않는다" },
        { value: "somewhat", label: "좀 걱정된다" },
        { value: "very", label: "많이 걱정된다" },
      ]},
      { id: "pension_awareness", question: "국민연금 예상 수령액을 알고 계세요?", type: "single", options: [
        { value: "exact", label: "정확히 알아요" },
        { value: "roughly", label: "대충은 알아요" },
        { value: "unknown", label: "잘 몰라요" },
      ]},
      { id: "retirement_concern", question: "은퇴 준비에서 가장 걱정되는 건요?", type: "single", options: [
        { value: "pension_shortage", label: "연금만으론 부족할 것 같다" },
        { value: "medical", label: "의료비/간병비가 걱정된다" },
        { value: "children_balance", label: "자녀 지원과 노후 준비 사이 균형" },
        { value: "dont_know", label: "뭐부터 해야 할지 모르겠다" },
        { value: "no_worry", label: "딱히 걱정 없다" },
      ]},
    ],
  },
];

// ============================================================
// Interfaces
// ============================================================

interface AllDataSectionProps {
  userId: string;
  profile: {
    id: string;
    name: string;
    birth_date: string | null;
    gender: string | null;
    target_retirement_age: number;
    created_at: string;
    onboarding_step: string | null;
    phone_number: string | null;
    customer_stage: string;
    survey_responses?: any;
    guide_clicks?: any;
    prep_data?: any;
  };
}

interface AllData {
  fullProfile: Record<string, any> | null;
  familyMembers: any[];
  accounts: any[];
  paymentMethods: any[];
  budgetCategories: any[];
  budgetTransactions: any[];
  portfolioTransactions: any[];
  financialSnapshots: any[];
  snapshotItems: Record<string, any[]>;
  simulations: any[];
  simulationData: Record<string, Record<string, any[]>>;
  bookings: any[];
  consultationRecords: any[];
  customerNotes: any[];
  conversations: any[];
}

// ============================================================
// Utility helpers
// ============================================================

function formatDateValue(v: string): string {
  if (!v) return "-";
  if (v.includes("T")) {
    const [datePart, timePart] = v.split("T");
    const time = timePart?.substring(0, 5) || "";
    return datePart.replace(/-/g, ".") + " " + time;
  }
  return v.replace(/-/g, ".");
}

function isDateString(v: any): boolean {
  if (typeof v !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}(T|\s)/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function formatNumber(v: number): string {
  return v.toLocaleString("ko-KR");
}

function formatCellValue(v: any): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return formatNumber(v);
  if (typeof v === "string") {
    if (isDateString(v)) return formatDateValue(v);
    return v || "-";
  }
  if (typeof v === "object") {
    return JSON.stringify(v, null, 2);
  }
  return String(v);
}

function isJsonObject(v: any): boolean {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isSmallObject(v: any): boolean {
  return isJsonObject(v) && Object.keys(v).length < 6;
}

function formatPeriod(year?: number | null, month?: number | null): string {
  if (!year) return "-";
  if (!month) return `${year}`;
  return `${year}.${String(month).padStart(2, "0")}`;
}

function formatBirthWithAge(birthDate: string | null): string {
  if (!birthDate) return "-";
  const formatted = formatDateValue(birthDate);
  const age = calculateAge(birthDate);
  return `${formatted} (만 ${age}세)`;
}

function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "-";
  return map[key] || key;
}

// ============================================================
// Sub-components
// ============================================================

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button
        className={styles.sectionHeader}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <div className={styles.sectionHeaderLeft}>
          <ChevronRight
            size={14}
            className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          />
          <span className={styles.sectionTitle}>{title}</span>
          {count !== undefined && (
            <span className={styles.sectionCount}>({count})</span>
          )}
        </div>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

function CollapsibleSubSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.subSection}>
      <button
        className={styles.subSectionHeader}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <div className={styles.sectionHeaderLeft}>
          <ChevronRight
            size={12}
            className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          />
          <span className={styles.subSectionTitle}>{title}</span>
          {count !== undefined && (
            <span className={styles.subSectionCount}>({count})</span>
          )}
        </div>
      </button>
      {open && <div className={styles.subSectionBody}>{children}</div>}
    </div>
  );
}

/** KVRow: display a single key-value row with type-based formatting */
function KVRow({
  label,
  value,
  type,
}: {
  label: string;
  value: any;
  type?: "won" | "rate" | "bool" | "age" | "period";
}) {
  if (value === null || value === undefined || value === "") {
    return (
      <div className={styles.kvRow}>
        <span className={styles.kvLabel}>{label}</span>
        <span className={`${styles.kvValue} ${styles.kvValueNull}`}>-</span>
      </div>
    );
  }

  let displayValue: React.ReactNode;

  switch (type) {
    case "won":
      displayValue = typeof value === "number" ? formatWon(value) : String(value);
      break;
    case "rate":
      displayValue = `${value}%`;
      break;
    case "bool":
      displayValue = (
        <span className={value ? styles.badgeTrue : styles.badgeFalse}>
          {value ? "Y" : "N"}
        </span>
      );
      break;
    case "age":
      displayValue = `${value}세`;
      break;
    default:
      if (typeof value === "boolean") {
        displayValue = (
          <span className={value ? styles.badgeTrue : styles.badgeFalse}>
            {value ? "Y" : "N"}
          </span>
        );
      } else if (typeof value === "number") {
        displayValue = formatNumber(value);
      } else if (typeof value === "object") {
        displayValue = <JsonValue value={value} />;
      } else {
        displayValue = String(value);
      }
  }

  return (
    <div className={styles.kvRow}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={styles.kvValue}>{displayValue}</span>
    </div>
  );
}

/** Render key-value pairs from a flat record */
function KVList({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className={styles.emptyText}>-</p>;
  }

  return (
    <div className={styles.kvList}>
      {entries.map(([key, val]) => (
        <div className={styles.kvRow} key={key}>
          <span className={styles.kvLabel}>{key}</span>
          {val === null || val === undefined ? (
            <span className={`${styles.kvValue} ${styles.kvValueNull}`}>-</span>
          ) : isJsonObject(val) || Array.isArray(val) ? (
            <JsonValue value={val} />
          ) : (
            <span className={styles.kvValue}>{formatCellValue(val)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Render JSON/object/array value with optional collapse */
function JsonValue({ value }: { value: any }) {
  const [expanded, setExpanded] = useState(false);

  if (isSmallObject(value)) {
    return (
      <div className={styles.kvValue}>
        <div className={styles.kvList}>
          {Object.entries(value).map(([k, v]) => (
            <div className={styles.kvRow} key={k} style={{ gap: 6 }}>
              <span className={styles.kvLabel} style={{ width: 120 }}>
                {k}
              </span>
              <span className={styles.kvValue}>{formatCellValue(v)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const json = JSON.stringify(value, null, 2);
  if (json.length < 200) {
    return <div className={styles.jsonBlock}>{json}</div>;
  }

  return (
    <div className={styles.kvValue}>
      {expanded ? (
        <>
          <div className={styles.jsonBlock}>{json}</div>
          <button
            className={styles.jsonToggle}
            onClick={() => setExpanded(false)}
            type="button"
          >
            접기
          </button>
        </>
      ) : (
        <>
          <div className={styles.jsonBlock}>
            {json.substring(0, 150)}...
          </div>
          <button
            className={styles.jsonToggle}
            onClick={() => setExpanded(true)}
            type="button"
          >
            펼치기
          </button>
        </>
      )}
    </div>
  );
}

/** Render array of objects as table */
function DataTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return <p className={styles.emptyText}>데이터 없음</p>;
  }

  const keySet = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((k) => keySet.add(k)));
  const columns = Array.from(keySet);

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map((col) => (
                <td key={col} title={String(row[col] ?? "")}>
                  {row[col] !== null &&
                  row[col] !== undefined &&
                  typeof row[col] === "object"
                    ? JSON.stringify(row[col])
                    : formatCellValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render array of objects as a list of KV cards (for smaller datasets) */
function ItemList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <p className={styles.emptyText}>데이터 없음</p>;
  }

  return (
    <div>
      {items.map((item, i) => (
        <div className={styles.itemCard} key={item.id || i}>
          <KVList data={item} />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Loading skeleton
// ============================================================

function LoadingSkeleton() {
  return (
    <div className={styles.skeletonGrid}>
      {Array.from({ length: 16 }).map((_, i) => (
        <div className={styles.skeletonCard} key={i}>
          <div className={`${styles.bone} ${styles.skeletonCardTitle}`} />
          <div className={`${styles.bone} ${styles.skeletonCardSummary}`} />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Prep data renderer
// ============================================================

const PREP_LABELS: Record<string, string> = {
  family: "가족",
  income: "소득",
  expense: "지출",
  savings: "저축",
  investment: "투자",
  housing: "주거",
  debt: "부채",
  nationalPension: "국민연금",
  retirementPension: "퇴직연금",
  personalPension: "개인연금",
};

const PREP_HOUSING_TYPE_LABELS: Record<string, string> = {
  "자가": "자가", "전세": "전세", "월세": "월세", "무상": "무상 거주",
};
const PREP_LOAN_TYPE_LABELS: Record<string, string> = {
  mortgage: "주택담보대출", jeonse: "전세자금대출", credit: "신용대출", other: "기타",
};
const PREP_PENSION_TYPE_LABELS: Record<string, string> = {
  national: "국민연금", government: "공무원연금", military: "군인연금", teacher: "사학연금", none: "해당없음",
};
const PREP_RETIREMENT_TYPE_LABELS: Record<string, string> = {
  db: "확정급여(DB)", dc: "확정기여(DC)", irp: "개인형 IRP", none: "해당없음",
};
const PREP_SAVINGS_TYPE_LABELS: Record<string, string> = {
  checking: "입출금통장", savings: "적금", deposit: "정기예금", housing: "주택청약",
};
const PREP_INVESTMENT_TYPE_LABELS: Record<string, string> = {
  domestic_stock: "국내주식/ETF", foreign_stock: "해외주식/ETF", fund: "펀드",
  bond: "채권", crypto: "가상자산", gold: "금/원자재", realestate: "부동산", other: "기타",
};
const PREP_EXPENSE_TYPE_LABELS: Record<string, string> = {
  insurance: "보험료", education: "교육비", subscription: "구독료", other: "기타",
};

function PrepDataSection({ data }: { data: any }) {
  if (!data || typeof data !== "object") {
    return <p className={styles.emptyText}>데이터 없음</p>;
  }

  const hasCategory = (key: string) => data[key] !== undefined && data[key] !== null;

  return (
    <div className={styles.prepContainer}>
      {/* 가족 */}
      {hasCategory("family") && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>가족</div>
          {Array.isArray(data.family) && data.family.length > 0 ? (
            data.family.map((m: any, i: number) => (
              <div className={styles.itemCard} key={i}>
                <div className={styles.kvList}>
                  <KVRow label="관계" value={labelOf(RELATIONSHIP_LABELS, m.relationship)} />
                  <KVRow label="이름" value={m.name} />
                  <KVRow label="생년월일" value={formatBirthWithAge(m.birth_date)} />
                  <KVRow label="성별" value={labelOf(GENDER_LABELS, m.gender)} />
                </div>
              </div>
            ))
          ) : (
            <p className={styles.emptyText}>-</p>
          )}
        </div>
      )}

      {/* 소득 */}
      {hasCategory("income") && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>소득</div>
          <div className={styles.kvList}>
            <KVRow label="본인 근로소득" value={data.income.selfLaborIncome != null ? `${formatMoney(data.income.selfLaborIncome)} / ${labelOf(FREQUENCY_LABELS, data.income.selfLaborFrequency)}` : null} />
            <KVRow label="배우자 근로소득" value={data.income.spouseLaborIncome != null ? `${formatMoney(data.income.spouseLaborIncome)} / ${labelOf(FREQUENCY_LABELS, data.income.spouseLaborFrequency)}` : null} />
            {Array.isArray(data.income.additionalIncomes) && data.income.additionalIncomes.length > 0 && (
              <>
                {data.income.additionalIncomes.map((inc: any, i: number) => (
                  <KVRow key={i} label={`추가소득 ${i + 1}`} value={inc.title ? `${inc.title} ${formatMoney(inc.amount)}` : formatMoney(inc.amount)} />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* 지출 */}
      {hasCategory("expense") && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>지출</div>
          <div className={styles.kvList}>
            <KVRow label="생활비 합계" value={data.expense.livingExpense != null ? formatMoney(data.expense.livingExpense) : null} />
            {data.expense.livingExpenseDetails && (
              <>
                {data.expense.livingExpenseDetails.food != null && <KVRow label="  식비" value={formatMoney(data.expense.livingExpenseDetails.food)} />}
                {data.expense.livingExpenseDetails.transport != null && <KVRow label="  교통비" value={formatMoney(data.expense.livingExpenseDetails.transport)} />}
                {data.expense.livingExpenseDetails.shopping != null && <KVRow label="  쇼핑" value={formatMoney(data.expense.livingExpenseDetails.shopping)} />}
                {data.expense.livingExpenseDetails.leisure != null && <KVRow label="  여가" value={formatMoney(data.expense.livingExpenseDetails.leisure)} />}
                {data.expense.livingExpenseDetails.other != null && data.expense.livingExpenseDetails.other > 0 && <KVRow label="  기타" value={formatMoney(data.expense.livingExpenseDetails.other)} />}
              </>
            )}
            {Array.isArray(data.expense.fixedExpenses) && data.expense.fixedExpenses.length > 0 && (
              <>
                {data.expense.fixedExpenses.map((exp: any, i: number) => (
                  <KVRow key={i} label={`고정지출: ${exp.title || labelOf(PREP_EXPENSE_TYPE_LABELS, exp.type)}`} value={`${formatMoney(exp.amount)} / ${labelOf(FREQUENCY_LABELS, exp.frequency)}`} />
                ))}
              </>
            )}
            {Array.isArray(data.expense.variableExpenses) && data.expense.variableExpenses.length > 0 && (
              <>
                {data.expense.variableExpenses.map((exp: any, i: number) => (
                  <KVRow key={i} label={`변동지출: ${exp.title || labelOf(PREP_EXPENSE_TYPE_LABELS, exp.type)}`} value={`${formatMoney(exp.amount)} / ${labelOf(FREQUENCY_LABELS, exp.frequency)}`} />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* 주거 */}
      {hasCategory("housing") && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>주거</div>
          <div className={styles.kvList}>
            <KVRow label="주거유형" value={labelOf(PREP_HOUSING_TYPE_LABELS, data.housing.housingType)} />
            {data.housing.currentValue != null && <KVRow label="현재 시세" value={formatMoney(data.housing.currentValue)} />}
            {data.housing.deposit != null && <KVRow label="보증금" value={formatMoney(data.housing.deposit)} />}
            {data.housing.monthlyRent != null && <KVRow label="월세" value={formatMoney(data.housing.monthlyRent)} />}
            {data.housing.maintenanceFee != null && <KVRow label="관리비" value={formatMoney(data.housing.maintenanceFee)} />}
            <KVRow label="대출 여부" value={data.housing.hasLoan} type="bool" />
            {data.housing.hasLoan && (
              <>
                <KVRow label="대출 유형" value={labelOf(PREP_LOAN_TYPE_LABELS, data.housing.loanType)} />
                <KVRow label="대출금" value={data.housing.loanAmount != null ? formatMoney(data.housing.loanAmount) : null} />
              </>
            )}
          </div>
        </div>
      )}

      {/* 저축 */}
      {hasCategory("savings") && Array.isArray(data.savings) && data.savings.length > 0 && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>저축</div>
          {data.savings.map((s: any, i: number) => (
            <div className={styles.itemCard} key={s.id || i}>
              <div className={styles.kvList}>
                <KVRow label="항목명" value={s.title} />
                <KVRow label="유형" value={labelOf(PREP_SAVINGS_TYPE_LABELS, s.type)} />
                <KVRow label="소유자" value={labelOf(OWNER_LABELS, s.owner)} />
                <KVRow label="현재잔액" value={s.currentBalance != null ? formatMoney(s.currentBalance) : null} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 투자 */}
      {hasCategory("investment") && Array.isArray(data.investment) && data.investment.length > 0 && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>투자</div>
          {data.investment.map((inv: any, i: number) => (
            <div className={styles.itemCard} key={inv.id || i}>
              <div className={styles.kvList}>
                <KVRow label="항목명" value={inv.title} />
                <KVRow label="유형" value={labelOf(PREP_INVESTMENT_TYPE_LABELS, inv.type)} />
                <KVRow label="소유자" value={labelOf(OWNER_LABELS, inv.owner)} />
                <KVRow label="현재잔액" value={inv.currentBalance != null ? formatMoney(inv.currentBalance) : null} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 국민연금 */}
      {hasCategory("nationalPension") && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>국민연금</div>
          <div className={styles.kvList}>
            <KVRow label="본인 유형" value={labelOf(PREP_PENSION_TYPE_LABELS, data.nationalPension.selfType)} />
            <KVRow label="본인 예상 수령액" value={data.nationalPension.selfExpectedAmount != null ? `${formatMoney(data.nationalPension.selfExpectedAmount)} / 월` : null} />
            <KVRow label="배우자 유형" value={labelOf(PREP_PENSION_TYPE_LABELS, data.nationalPension.spouseType)} />
            <KVRow label="배우자 예상 수령액" value={data.nationalPension.spouseExpectedAmount != null ? `${formatMoney(data.nationalPension.spouseExpectedAmount)} / 월` : null} />
          </div>
        </div>
      )}

      {/* 퇴직연금 */}
      {hasCategory("retirementPension") && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>퇴직연금</div>
          <div className={styles.kvList}>
            <KVRow label="본인 유형" value={labelOf(PREP_RETIREMENT_TYPE_LABELS, data.retirementPension.selfType)} />
            <KVRow label="본인 잔액" value={data.retirementPension.selfBalance != null ? formatMoney(data.retirementPension.selfBalance) : null} />
            {data.retirementPension.selfYearsWorked != null && <KVRow label="본인 근속년수" value={`${data.retirementPension.selfYearsWorked}년`} />}
            <KVRow label="배우자 유형" value={labelOf(PREP_RETIREMENT_TYPE_LABELS, data.retirementPension.spouseType)} />
            <KVRow label="배우자 잔액" value={data.retirementPension.spouseBalance != null ? formatMoney(data.retirementPension.spouseBalance) : null} />
            {data.retirementPension.spouseYearsWorked != null && <KVRow label="배우자 근속년수" value={`${data.retirementPension.spouseYearsWorked}년`} />}
          </div>
        </div>
      )}

      {/* 은퇴 목표 */}
      {hasCategory("retirementGoals") && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>은퇴 목표</div>
          <div className={styles.kvList}>
            <KVRow label="목표 은퇴 나이" value={data.retirementGoals.targetRetirementAge} type="age" />
            <KVRow label="목표 월 생활비" value={data.retirementGoals.targetMonthlyExpense != null ? formatMoney(data.retirementGoals.targetMonthlyExpense) : null} />
          </div>
        </div>
      )}

      {/* 부채 (있으면) */}
      {hasCategory("debt") && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>부채</div>
          {Array.isArray(data.debt) ? (
            data.debt.map((d: any, i: number) => (
              <div className={styles.itemCard} key={i}>
                <div className={styles.kvList}>
                  <KVRow label="항목명" value={d.title || d.name} />
                  <KVRow label="유형" value={labelOf(PREP_LOAN_TYPE_LABELS, d.type)} />
                  <KVRow label="잔액" value={d.amount != null ? formatMoney(d.amount) : null} />
                </div>
              </div>
            ))
          ) : isJsonObject(data.debt) ? (
            <KVList data={data.debt as Record<string, any>} />
          ) : null}
        </div>
      )}

      {/* 개인연금 (있으면) */}
      {hasCategory("personalPension") && (
        <div className={styles.prepCategory}>
          <div className={styles.prepCategoryTitle}>개인연금</div>
          {isJsonObject(data.personalPension) ? (
            <div className={styles.kvList}>
              {data.personalPension.selfType && <KVRow label="본인 유형" value={data.personalPension.selfType} />}
              {data.personalPension.selfBalance != null && <KVRow label="본인 잔액" value={formatMoney(data.personalPension.selfBalance)} />}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Guide clicks renderer
// ============================================================

function GuideClicksSection({ data }: { data: any }) {
  if (!data || typeof data !== "object") {
    return <p className={styles.emptyText}>데이터 없음</p>;
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className={styles.emptyText}>데이터 없음</p>;
  }

  return (
    <div className={styles.guideList}>
      {entries.map(([key, val]: [string, any]) => (
        <div className={styles.guideItem} key={key}>
          <span className={styles.guideName}>{key}</span>
          <span className={styles.guideClicks}>
            {val?.count ?? 0}회
            {val?.lastClickedAt
              ? ` / ${formatDateValue(val.lastClickedAt)}`
              : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Section renderers
// ============================================================

function renderSurvey(surveyData: any) {
  // survey_responses has shape: { onboarding: { question_id: value }, completed_at: ... }
  const responses = surveyData?.onboarding || surveyData;
  if (!responses || typeof responses !== "object") {
    return <p className={styles.emptyText}>설문 데이터 없음</p>;
  }

  return (
    <div className={styles.surveyContainer}>
      {SURVEY_SECTIONS.map((section) => (
        <div className={styles.surveySection} key={section.title}>
          <div className={styles.surveySectionTitle}>{section.title}</div>
          {section.questions.map((q) => {
            const answer = responses[q.id];
            const answered = answer !== undefined && answer !== null;

            return (
              <div className={styles.surveyQuestion} key={q.id}>
                <div className={styles.surveyQuestionText}>{q.question}</div>
                <div className={styles.surveyOptions}>
                  {q.options.map((opt) => {
                    const isSelected = q.type === "multiple"
                      ? Array.isArray(answer) && answer.includes(opt.value)
                      : answer === opt.value;

                    return (
                      <span
                        key={opt.value}
                        className={`${styles.surveyOption} ${isSelected ? styles.surveyOptionSelected : ""}`}
                      >
                        {opt.label}
                      </span>
                    );
                  })}
                  {!answered && (
                    <span className={styles.surveyUnanswered}>미응답</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {surveyData?.completed_at && (
        <div className={styles.surveyCompleted}>
          완료: {formatDateValue(surveyData.completed_at)}
        </div>
      )}
    </div>
  );
}

/** 1. Profile */
function renderProfile(p: Record<string, any>) {
  return (
    <div className={styles.kvList}>
      <KVRow label="이름" value={p.name} />
      <KVRow label="생년월일" value={formatBirthWithAge(p.birth_date)} />
      <KVRow label="성별" value={labelOf(GENDER_LABELS, p.gender)} />
      <KVRow label="전화번호" value={p.phone_number} />
      <KVRow label="목표 은퇴 나이" value={p.target_retirement_age} type="age" />
      <KVRow label="목표 은퇴 자금" value={p.target_retirement_fund} type="won" />
      <KVRow
        label="은퇴 생활비 비율"
        value={p.retirement_lifestyle_ratio != null ? `${p.retirement_lifestyle_ratio}%` : null}
      />
      <KVRow label="고객 단계" value={labelOf(CUSTOMER_STAGE_LABELS, p.customer_stage)} />
      <KVRow label="온보딩 단계" value={labelOf(ONBOARDING_STEP_LABELS, p.onboarding_step)} />
      <KVRow label="가입일" value={p.created_at ? formatDateValue(p.created_at) : null} />
      <KVRow label="진단 시작일" value={p.diagnosis_started_at ? formatDateValue(p.diagnosis_started_at) : null} />
      <KVRow label="초기 상담일" value={p.initial_assessment_date ? formatDateValue(p.initial_assessment_date) : null} />
      <KVRow label="마지막 연락일" value={p.last_contact_date ? formatDateValue(p.last_contact_date) : null} />
      <KVRow label="다음 팔로업" value={p.next_followup_date ? formatDateValue(p.next_followup_date) : null} />
      <KVRow label="리포트 발행일" value={p.report_published_at ? formatDateValue(p.report_published_at) : null} />
      <KVRow label="리포트 의견" value={p.report_opinion} />
    </div>
  );
}

/** 2. Family Members */
function renderFamilyMembers(members: any[]) {
  if (members.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div>
      {members.map((m, i) => (
        <div className={styles.itemCard} key={m.id || i}>
          <div className={styles.kvList}>
            <KVRow label="관계" value={labelOf(RELATIONSHIP_LABELS, m.relationship)} />
            <KVRow label="이름" value={m.name} />
            <KVRow label="생년월일" value={formatBirthWithAge(m.birth_date)} />
            <KVRow label="성별" value={labelOf(GENDER_LABELS, m.gender)} />
            <KVRow label="부양가족" value={m.is_dependent} type="bool" />
            <KVRow label="근무중" value={m.is_working} type="bool" />
            <KVRow label="은퇴 나이" value={m.retirement_age} type="age" />
            <KVRow label="월소득" value={m.monthly_income} type="won" />
            <KVRow label="메모" value={m.notes} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 6. Accounts */
function renderAccounts(accounts: any[]) {
  if (accounts.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>계좌명</th>
            <th>증권사/은행</th>
            <th>유형</th>
            <th>소유자</th>
            <th>잔액</th>
            <th>금리</th>
            <th>이자유형</th>
            <th>월납입</th>
            <th>통화</th>
            <th>시작</th>
            <th>만기</th>
            <th>기본</th>
            <th>활성</th>
            <th>비과세</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a, i) => (
            <tr key={a.id || i}>
              <td>{a.name || "-"}</td>
              <td>{a.broker_name || "-"}</td>
              <td>{labelOf(ACCOUNT_TYPE_LABELS, a.account_type)}</td>
              <td>{labelOf(OWNER_LABELS, a.owner)}</td>
              <td>{a.current_balance != null ? formatWon(a.current_balance) : "-"}</td>
              <td>{a.interest_rate != null ? `${a.interest_rate}%` : "-"}</td>
              <td>{labelOf(INTEREST_TYPE_LABELS, a.interest_type)}</td>
              <td>{a.monthly_contribution != null ? formatWon(a.monthly_contribution) : "-"}</td>
              <td>{labelOf(CURRENCY_LABELS, a.currency)}</td>
              <td>{formatPeriod(a.start_year, a.start_month)}</td>
              <td>{formatPeriod(a.maturity_year, a.maturity_month)}</td>
              <td><span className={a.is_default ? styles.badgeTrue : styles.badgeFalse}>{a.is_default ? "Y" : "N"}</span></td>
              <td><span className={a.is_active ? styles.badgeTrue : styles.badgeFalse}>{a.is_active ? "Y" : "N"}</span></td>
              <td><span className={a.is_tax_free ? styles.badgeTrue : styles.badgeFalse}>{a.is_tax_free ? "Y" : "N"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 7. Payment Methods */
function renderPaymentMethods(methods: any[]) {
  if (methods.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>이름</th>
            <th>유형</th>
            <th>카드사</th>
            <th>활성</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((m, i) => (
            <tr key={m.id || i}>
              <td>{m.name || "-"}</td>
              <td>{labelOf(PAYMENT_TYPE_LABELS, m.type)}</td>
              <td>{m.card_company || "-"}</td>
              <td>
                <span className={m.is_active ? styles.badgeTrue : styles.badgeFalse}>
                  {m.is_active ? "Y" : "N"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 8. Budget Categories */
function renderBudgetCategories(categories: any[]) {
  if (categories.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>이름</th>
            <th>유형</th>
            <th>아이콘</th>
            <th>색상</th>
            <th>기본</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c, i) => (
            <tr key={c.id || i}>
              <td>{c.name || "-"}</td>
              <td>{labelOf(BUDGET_TYPE_LABELS, c.type)}</td>
              <td>{c.icon || "-"}</td>
              <td>
                {c.color ? (
                  <span
                    className={styles.colorDot}
                    style={{ backgroundColor: c.color }}
                  />
                ) : (
                  "-"
                )}
              </td>
              <td>
                <span className={c.is_default ? styles.badgeTrue : styles.badgeFalse}>
                  {c.is_default ? "Y" : "N"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 9. Budget Transactions */
function renderBudgetTransactions(txns: any[]) {
  if (txns.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>날짜</th>
            <th>유형</th>
            <th>카테고리</th>
            <th>제목</th>
            <th>금액</th>
            <th>반복</th>
            <th>메모</th>
          </tr>
        </thead>
        <tbody>
          {txns.map((t, i) => (
            <tr key={t.id || i}>
              <td>{`${t.year}.${String(t.month).padStart(2, "0")}.${String(t.day).padStart(2, "0")}`}</td>
              <td>{labelOf(BUDGET_TYPE_LABELS, t.type)}</td>
              <td>{t.category_name || t.category || "-"}</td>
              <td>{t.title || "-"}</td>
              <td>{t.amount != null ? formatWon(t.amount) : "-"}</td>
              <td>
                {t.is_recurring != null ? (
                  <span className={t.is_recurring ? styles.badgeTrue : styles.badgeFalse}>
                    {t.is_recurring ? "Y" : "N"}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td>{t.memo || t.notes || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 10. Portfolio Transactions */
function renderPortfolioTransactions(txns: any[]) {
  if (txns.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>거래일</th>
            <th>유형</th>
            <th>종목</th>
            <th>수량</th>
            <th>단가</th>
            <th>총액</th>
            <th>통화</th>
            <th>수수료</th>
          </tr>
        </thead>
        <tbody>
          {txns.map((t, i) => (
            <tr key={t.id || i}>
              <td>{t.trade_date ? formatDateValue(t.trade_date) : "-"}</td>
              <td>{labelOf(TRADE_TYPE_LABELS, t.trade_type || t.type)}</td>
              <td>{[t.ticker, t.name].filter(Boolean).join(" ") || "-"}</td>
              <td>{t.quantity != null ? formatNumber(t.quantity) : "-"}</td>
              <td>{t.price != null ? formatNumber(t.price) : "-"}</td>
              <td>{t.total_amount != null ? formatWon(t.total_amount) : "-"}</td>
              <td>{t.currency || "-"}</td>
              <td>{t.fee != null ? formatWon(t.fee) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 11. Financial Snapshot summary */
const SNAPSHOT_TYPE_LABELS: Record<string, string> = {
  initial: "최초 기록", followup: "후속 기록", quarterly: "분기 기록", annual: "연간 기록",
};


/** 13. Bookings */
function renderBookings(bookings: any[]) {
  if (bookings.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div>
      {bookings.map((b, i) => (
        <div className={styles.itemCard} key={b.id || i}>
          <div className={styles.kvList}>
            <KVRow label="예약일" value={b.booking_date ? formatDateValue(b.booking_date) : null} />
            <KVRow label="시간" value={b.booking_time || b.time_slot} />
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>상태</span>
              <span className={styles.kvValue}>
                {b.status ? (
                  <span className={b.status === "confirmed" || b.status === "completed" ? styles.badgeTrue : styles.badgeFalse}>
                    {labelOf(BOOKING_STATUS_LABELS, b.status)}
                  </span>
                ) : "-"}
              </span>
            </div>
            <KVRow label="상담유형" value={labelOf(CONSULTATION_TYPE_LABELS, b.consultation_type)} />
            <KVRow label="메모" value={b.notes} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 14. Consultation Records */
function renderConsultationRecords(records: any[]) {
  if (records.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div>
      {records.map((r, i) => (
        <div className={styles.itemCard} key={r.id || i}>
          <div className={styles.kvList}>
            <KVRow label="상담유형" value={labelOf(CONSULTATION_TYPE_LABELS, r.consultation_type)} />
            <KVRow label="예정일" value={r.scheduled_date ? formatDateValue(r.scheduled_date) : null} />
            <KVRow label="시간" value={r.scheduled_time} />
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>상태</span>
              <span className={styles.kvValue}>
                {r.status ? (
                  <span className={r.status === "completed" ? styles.badgeTrue : styles.badgeFalse}>
                    {labelOf(CONSULTATION_STATUS_LABELS, r.status)}
                  </span>
                ) : "-"}
              </span>
            </div>
            <KVRow label="완료일" value={r.completed_date ? formatDateValue(r.completed_date) : null} />
            <KVRow label="요약" value={r.summary} />
            <KVRow label="메모" value={r.notes} />
            {r.action_items && (
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>실행항목</span>
                <span className={styles.kvValue}><JsonValue value={r.action_items} /></span>
              </div>
            )}
            <KVRow label="다음예정일" value={r.next_due_date ? formatDateValue(r.next_due_date) : null} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 15. Customer Notes */
function renderCustomerNotes(notes: any[]) {
  if (notes.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div>
      {notes.map((n, i) => (
        <div className={styles.itemCard} key={n.id || i}>
          <div className={styles.kvList}>
            <KVRow label="내용" value={n.content || n.note} />
            <KVRow label="고정" value={n.is_pinned} type="bool" />
            <KVRow label="작성일" value={n.created_at ? formatDateValue(n.created_at) : null} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 16. Conversations */
function renderConversations(conversations: any[]) {
  if (conversations.length === 0) return <p className={styles.emptyText}>데이터 없음</p>;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>기본대화</th>
            <th>마지막 메시지</th>
            <th>읽지않음</th>
            <th>총 메시지</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((c, i) => (
            <tr key={c.id || i}>
              <td>
                <span className={c.is_default ? styles.badgeTrue : styles.badgeFalse}>
                  {c.is_default ? "Y" : "N"}
                </span>
              </td>
              <td>{c.last_message_at ? formatDateValue(c.last_message_at) : "-"}</td>
              <td>{c.unread_count ?? 0}</td>
              <td>{c._message_count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Simulation sub-table renderers
// ============================================================

/** 12-1. Incomes */
function renderIncomes(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        <KVRow label="항목명" value={item.name} />
        <KVRow label="소유자" value={labelOf(OWNER_LABELS, item.owner)} />
        <KVRow label="유형" value={labelOf(INCOME_TYPE_LABELS, item.income_type || item.type)} />
        <KVRow label="금액" value={item.amount} type="won" />
        <KVRow label="주기" value={labelOf(FREQUENCY_LABELS, item.frequency)} />
        <KVRow
          label="기간"
          value={`${formatPeriod(item.start_year, item.start_month)} ~ ${formatPeriod(item.end_year, item.end_month)}`}
        />
        <KVRow
          label="상승률"
          value={
            item.growth_rate != null
              ? `${labelOf(RATE_CATEGORY_LABELS, item.rate_category)} ${item.growth_rate}%`
              : null
          }
        />
        <KVRow label="은퇴연동" value={item.retirement_linked} type="bool" />
        <KVRow label="활성" value={item.is_active} type="bool" />
      </div>
    </div>
  ));
}

/** 12-2. Expenses */
function renderExpenses(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        <KVRow label="항목명" value={item.name} />
        <KVRow label="유형" value={labelOf(EXPENSE_TYPE_LABELS, item.expense_type || item.type)} />
        <KVRow label="금액" value={item.amount} type="won" />
        <KVRow label="주기" value={labelOf(FREQUENCY_LABELS, item.frequency)} />
        <KVRow
          label="기간"
          value={`${formatPeriod(item.start_year, item.start_month)} ~ ${formatPeriod(item.end_year, item.end_month)}`}
        />
        <KVRow label="카테고리" value={item.category} />
        <KVRow
          label="상승률"
          value={
            item.growth_rate != null
              ? `${labelOf(RATE_CATEGORY_LABELS, item.rate_category)} ${item.growth_rate}%`
              : null
          }
        />
        <KVRow label="은퇴연동" value={item.retirement_linked} type="bool" />
        <KVRow label="활성" value={item.is_active} type="bool" />
      </div>
    </div>
  ));
}

/** 12-3. Savings */
function renderSavings(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        <KVRow label="항목명" value={item.name} />
        <KVRow label="유형" value={labelOf(ALL_SAVINGS_TYPE_LABELS, item.savings_type || item.type)} />
        <KVRow label="소유자" value={labelOf(OWNER_LABELS, item.owner)} />
        <KVRow label="현재잔액" value={item.current_balance} type="won" />
        <KVRow label="월 납입" value={item.monthly_contribution} type="won" />
        <KVRow label="금리/수익률" value={item.interest_rate ?? item.expected_return} type="rate" />
        <KVRow
          label="납입 기간"
          value={`${formatPeriod(item.contribution_start_year || item.start_year, item.contribution_start_month || item.start_month)} ~ ${formatPeriod(item.contribution_end_year || item.end_year, item.contribution_end_month || item.end_month)}`}
        />
        <KVRow label="만기" value={formatPeriod(item.maturity_year, item.maturity_month)} />
        <KVRow label="비과세" value={item.is_tax_free} type="bool" />
      </div>
    </div>
  ));
}

/** 12-4. Debts */
function renderDebts(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        <KVRow label="항목명" value={item.name} />
        <KVRow label="유형" value={labelOf(DEBT_TYPE_LABELS, item.debt_type || item.type)} />
        <KVRow label="소유자" value={labelOf(OWNER_LABELS, item.owner)} />
        <KVRow label="원금" value={item.principal} type="won" />
        <KVRow label="잔액" value={item.remaining_balance ?? item.current_balance} type="won" />
        <KVRow label="금리" value={item.interest_rate} type="rate" />
        <KVRow label="금리유형" value={labelOf(INTEREST_TYPE_LABELS, item.interest_type)} />
        <KVRow label="상환방식" value={labelOf(REPAYMENT_TYPE_LABELS, item.repayment_type)} />
        <KVRow label="거치기간" value={item.grace_period != null ? `${item.grace_period}개월` : null} />
        <KVRow
          label="기간"
          value={`${formatPeriod(item.start_year, item.start_month)} ~ ${formatPeriod(item.maturity_year, item.maturity_month)}`}
        />
        <KVRow label="월상환" value={item.monthly_payment} type="won" />
      </div>
    </div>
  ));
}

/** 12-5. Real Estates */
function renderRealEstates(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        {/* Basic */}
        <KVRow label="항목명" value={item.name} />
        <KVRow label="유형" value={labelOf(REAL_ESTATE_TYPE_LABELS, item.real_estate_type || item.type)} />
        <KVRow label="소유자" value={labelOf(OWNER_LABELS, item.owner)} />
        <KVRow label="현재가" value={item.current_value} type="won" />
        <KVRow label="매입가" value={item.purchase_price} type="won" />
        <KVRow label="매입시기" value={formatPeriod(item.purchase_year, item.purchase_month)} />
        <KVRow
          label="상승률"
          value={
            item.growth_rate != null
              ? `${labelOf(RATE_CATEGORY_LABELS, item.rate_category)} ${item.growth_rate}%`
              : null
          }
        />
        {/* Housing */}
        {item.housing_type && (
          <KVRow label="주거유형" value={labelOf(HOUSING_TYPE_LABELS, item.housing_type)} />
        )}
        {item.deposit != null && <KVRow label="보증금" value={item.deposit} type="won" />}
        {item.monthly_rent != null && <KVRow label="월세" value={item.monthly_rent} type="won" />}
        {item.maintenance_fee != null && <KVRow label="관리비" value={item.maintenance_fee} type="won" />}
        {/* Rental income */}
        {item.rental_deposit != null && <KVRow label="임대보증금" value={item.rental_deposit} type="won" />}
        {item.rental_income != null && <KVRow label="월임대료" value={item.rental_income} type="won" />}
        {(item.rental_start_year || item.rental_end_year) && (
          <KVRow
            label="임대기간"
            value={`${formatPeriod(item.rental_start_year, item.rental_start_month)} ~ ${formatPeriod(item.rental_end_year, item.rental_end_month)}`}
          />
        )}
        {/* Loan */}
        {item.loan_amount != null && item.loan_amount > 0 && (
          <>
            <KVRow label="대출금" value={item.loan_amount} type="won" />
            <KVRow label="대출금리" value={item.loan_interest_rate} type="rate" />
            <KVRow label="대출금리유형" value={labelOf(INTEREST_TYPE_LABELS, item.loan_interest_type)} />
            <KVRow label="대출상환방식" value={labelOf(REPAYMENT_TYPE_LABELS, item.loan_repayment_type)} />
            <KVRow
              label="대출기간"
              value={`${formatPeriod(item.loan_start_year, item.loan_start_month)} ~ ${formatPeriod(item.loan_maturity_year, item.loan_maturity_month)}`}
            />
          </>
        )}
        {/* Sale */}
        {(item.sale_year || item.planned_sale_year) && (
          <KVRow
            label="매도시기"
            value={formatPeriod(
              item.sale_year || item.planned_sale_year,
              item.sale_month || item.planned_sale_month,
            )}
          />
        )}
      </div>
    </div>
  ));
}

/** 12-6. Physical Assets */
function renderPhysicalAssets(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        <KVRow label="항목명" value={item.name} />
        <KVRow label="유형" value={labelOf(ASSET_TYPE_LABELS, item.asset_type || item.type)} />
        <KVRow label="소유자" value={labelOf(OWNER_LABELS, item.owner)} />
        <KVRow label="현재가" value={item.current_value} type="won" />
        <KVRow label="매입가" value={item.purchase_price} type="won" />
        <KVRow label="매입시기" value={formatPeriod(item.purchase_year, item.purchase_month)} />
        <KVRow
          label="상승률"
          value={
            item.growth_rate != null
              ? `${labelOf(RATE_CATEGORY_LABELS, item.rate_category)} ${item.growth_rate}%`
              : null
          }
        />
        <KVRow label="자금조달" value={labelOf(FINANCING_TYPE_LABELS, item.financing_type)} />
        {/* Loan info if present */}
        {item.loan_amount != null && item.loan_amount > 0 && (
          <>
            <KVRow label="대출금" value={item.loan_amount} type="won" />
            <KVRow label="대출금리" value={item.loan_interest_rate} type="rate" />
            <KVRow label="대출상환방식" value={labelOf(REPAYMENT_TYPE_LABELS, item.loan_repayment_type)} />
            <KVRow
              label="대출기간"
              value={`${formatPeriod(item.loan_start_year, item.loan_start_month)} ~ ${formatPeriod(item.loan_maturity_year, item.loan_maturity_month)}`}
            />
          </>
        )}
        {(item.sale_year || item.planned_sale_year) && (
          <KVRow
            label="매도시기"
            value={formatPeriod(
              item.sale_year || item.planned_sale_year,
              item.sale_month || item.planned_sale_month,
            )}
          />
        )}
      </div>
    </div>
  ));
}

/** 12-7. Insurances */
function renderInsurances(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        <KVRow label="항목명" value={item.name} />
        <KVRow label="유형" value={labelOf(INSURANCE_TYPE_LABELS, item.insurance_type || item.type)} />
        <KVRow label="소유자" value={labelOf(OWNER_LABELS, item.owner)} />
        <KVRow label="월보험료" value={item.monthly_premium} type="won" />
        <KVRow
          label="보험료기간"
          value={`${formatPeriod(item.premium_start_year || item.start_year, item.premium_start_month || item.start_month)} ~ ${formatPeriod(item.premium_end_year || item.end_year, item.premium_end_month || item.end_month)}`}
        />
        <KVRow label="보장금액" value={item.coverage_amount} type="won" />
        <KVRow label="보장종료" value={formatPeriod(item.coverage_end_year, item.coverage_end_month)} />
        <KVRow label="현재가치" value={item.current_value} type="won" />
        <KVRow label="만기환급" value={item.maturity_refund} type="won" />
        <KVRow label="수익률" value={item.return_rate ?? item.expected_return} type="rate" />
        {item.pension_start_age != null && (
          <KVRow label="연금시작나이" value={item.pension_start_age} type="age" />
        )}
        {item.pension_period != null && (
          <KVRow label="연금수령기간" value={`${item.pension_period}년`} />
        )}
      </div>
    </div>
  ));
}

/** 12-8. National Pensions */
function renderNationalPensions(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        <KVRow label="소유자" value={labelOf(OWNER_LABELS, item.owner)} />
        <KVRow label="유형" value={item.pension_type || item.type} />
        <KVRow label="예상월수령액" value={item.expected_monthly_amount} type="won" />
        <KVRow label="수급시작나이" value={item.start_age ?? item.payment_start_age} type="age" />
        <KVRow label="수급종료나이" value={item.end_age ?? item.payment_end_age} type="age" />
      </div>
    </div>
  ));
}

/** 12-9. Retirement Pensions */
function renderRetirementPensions(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        <KVRow label="소유자" value={labelOf(OWNER_LABELS, item.owner)} />
        <KVRow label="유형" value={item.pension_type || item.type} />
        <KVRow label="현재잔액" value={item.current_balance} type="won" />
        <KVRow label="근속년수" value={item.years_of_service != null ? `${item.years_of_service}년` : null} />
        <KVRow label="수령방식" value={labelOf(PENSION_PAYOUT_LABELS, item.payout_type)} />
        <KVRow label="수령시작나이" value={item.start_age ?? item.payment_start_age} type="age" />
        <KVRow label="수령기간" value={item.payment_period != null ? `${item.payment_period}년` : null} />
        <KVRow label="수익률" value={item.expected_return ?? item.return_rate} type="rate" />
      </div>
    </div>
  ));
}

/** 12-10. Personal Pensions */
function renderPersonalPensions(items: any[]) {
  return items.map((item, i) => (
    <div className={styles.itemCard} key={item.id || i}>
      <div className={styles.kvList}>
        <KVRow label="항목명" value={item.name} />
        <KVRow label="유형" value={labelOf(PENSION_TYPE_LABELS, item.pension_type || item.type)} />
        <KVRow label="소유자" value={labelOf(OWNER_LABELS, item.owner)} />
        <KVRow label="현재잔액" value={item.current_balance} type="won" />
        <KVRow label="월 납입" value={item.monthly_contribution} type="won" />
        <KVRow
          label="납입종료"
          value={formatPeriod(
            item.contribution_end_year || item.end_year,
            item.contribution_end_month || item.end_month,
          )}
        />
        <KVRow label="수령시작나이" value={item.start_age ?? item.payment_start_age} type="age" />
        <KVRow label="수령기간" value={item.payment_period != null ? `${item.payment_period}년` : null} />
        <KVRow label="수익률" value={item.expected_return ?? item.return_rate} type="rate" />
      </div>
    </div>
  ));
}

// ============================================================
// Simulation renderer map
// ============================================================

const SIM_RENDERERS: Record<string, (items: any[]) => React.ReactNode> = {
  incomes: (items) => renderIncomes(items),
  expenses: (items) => renderExpenses(items),
  savings: (items) => renderSavings(items),
  debts: (items) => renderDebts(items),
  real_estates: (items) => renderRealEstates(items),
  physical_assets: (items) => renderPhysicalAssets(items),
  insurances: (items) => renderInsurances(items),
  national_pensions: (items) => renderNationalPensions(items),
  retirement_pensions: (items) => renderRetirementPensions(items),
  personal_pensions: (items) => renderPersonalPensions(items),
};

// ============================================================
// Simulation sub-tables
// ============================================================

const SIM_SUB_TABLES = [
  { key: "incomes", label: "소득" },
  { key: "expenses", label: "지출" },
  { key: "savings", label: "저축" },
  { key: "debts", label: "부채" },
  { key: "real_estates", label: "부동산" },
  { key: "physical_assets", label: "실물자산" },
  { key: "insurances", label: "보험" },
  { key: "national_pensions", label: "국민연금" },
  { key: "retirement_pensions", label: "퇴직연금" },
  { key: "personal_pensions", label: "개인연금" },
];

function SimulationSection({
  simulation,
  subData,
}: {
  simulation: any;
  subData: Record<string, any[]>;
}) {
  return (
    <div>
      <div className={styles.simInfo}>
        <span className={styles.simInfoItem}>
          제목: <span>{simulation.title || "-"}</span>
        </span>
        <span className={styles.simInfoItem}>
          기본:{" "}
          <span className={simulation.is_default ? styles.badgeTrue : styles.badgeFalse}>
            {simulation.is_default ? "Y" : "N"}
          </span>
        </span>
        <span className={styles.simInfoItem}>
          생성: <span>{formatDateValue(simulation.created_at)}</span>
        </span>
      </div>

      {/* Investment assumptions */}
      {simulation.investment_assumptions && (
        <CollapsibleSubSection title="투자 가정" defaultOpen={false}>
          {isJsonObject(simulation.investment_assumptions) ? (
            <KVList data={simulation.investment_assumptions} />
          ) : (
            <div className={styles.jsonBlock}>
              {JSON.stringify(simulation.investment_assumptions, null, 2)}
            </div>
          )}
        </CollapsibleSubSection>
      )}

      {/* Cash flow priorities */}
      {simulation.cash_flow_priorities && (
        <CollapsibleSubSection title="현금 흐름 우선순위" defaultOpen={false}>
          <div className={styles.jsonBlock}>
            {JSON.stringify(simulation.cash_flow_priorities, null, 2)}
          </div>
        </CollapsibleSubSection>
      )}

      {/* Sub-tables */}
      {SIM_SUB_TABLES.map(({ key, label }) => {
        const items = subData[key] || [];
        const renderer = SIM_RENDERERS[key];
        return (
          <CollapsibleSubSection
            key={key}
            title={label}
            count={items.length}
            defaultOpen={false}
          >
            {items.length > 0 && renderer ? <div>{renderer(items)}</div> : null}
          </CollapsibleSubSection>
        );
      })}
    </div>
  );
}

// ============================================================
// Detail modal
// ============================================================

function DetailModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button className={styles.modalClose} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export function AllDataSection({ userId, profile }: AllDataSectionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AllData | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Phase 1: Parallel fetch of all top-level tables
      const [
        profileRes,
        familyRes,
        accountsRes,
        paymentMethodsRes,
        budgetCategoriesRes,
        budgetTransactionsRes,
        portfolioTransactionsRes,
        snapshotsRes,
        simulationsRes,
        bookingsRes,
        consultationRecordsRes,
        customerNotesRes,
        conversationsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("family_members").select("*").eq("user_id", userId),
        supabase.from("accounts").select("*").eq("profile_id", userId),
        supabase.from("payment_methods").select("*").eq("profile_id", userId),
        supabase.from("budget_categories").select("*").eq("profile_id", userId),
        supabase
          .from("budget_transactions")
          .select("*")
          .eq("profile_id", userId)
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .limit(50),
        supabase
          .from("portfolio_transactions")
          .select("*")
          .eq("profile_id", userId)
          .order("trade_date", { ascending: false })
          .limit(50),
        supabase
          .from("financial_snapshots")
          .select("*")
          .eq("profile_id", userId)
          .eq("is_active", true)
          .order("recorded_at", { ascending: false }),
        supabase.from("simulations").select("*").eq("profile_id", userId),
        supabase
          .from("bookings")
          .select("*")
          .eq("user_id", userId)
          .order("booking_date", { ascending: false }),
        supabase
          .from("consultation_records")
          .select("*")
          .eq("profile_id", userId)
          .order("scheduled_date", { ascending: false }),
        supabase
          .from("customer_notes")
          .select("*")
          .eq("profile_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("conversations").select("*").eq("user_id", userId),
      ]);

      // Phase 2: Fetch snapshot items for each snapshot
      const snapshots = snapshotsRes.data || [];
      const snapshotItemsMap: Record<string, any[]> = {};

      if (snapshots.length > 0) {
        const snapshotIds = snapshots.map((s: any) => s.id);
        const { data: allSnapshotItems } = await supabase
          .from("financial_snapshot_items")
          .select("*")
          .in("snapshot_id", snapshotIds);

        if (allSnapshotItems) {
          allSnapshotItems.forEach((item: any) => {
            if (!snapshotItemsMap[item.snapshot_id]) {
              snapshotItemsMap[item.snapshot_id] = [];
            }
            snapshotItemsMap[item.snapshot_id].push(item);
          });
        }
      }

      // Phase 3: Fetch simulation sub-tables for each simulation
      const simulations = simulationsRes.data || [];
      const simulationDataMap: Record<string, Record<string, any[]>> = {};

      if (simulations.length > 0) {
        const simIds = simulations.map((s: any) => s.id);

        const subTableNames = [
          "incomes",
          "expenses",
          "savings",
          "debts",
          "real_estates",
          "physical_assets",
          "insurances",
          "national_pensions",
          "retirement_pensions",
          "personal_pensions",
        ];

        const subResults = await Promise.all(
          subTableNames.map((table) =>
            supabase.from(table).select("*").in("simulation_id", simIds),
          ),
        );

        // Initialize map
        simIds.forEach((id: string) => {
          simulationDataMap[id] = {};
          subTableNames.forEach((t) => {
            simulationDataMap[id][t] = [];
          });
        });

        // Distribute items to their simulation
        subResults.forEach((res, idx) => {
          const tableName = subTableNames[idx];
          const items = res.data || [];
          items.forEach((item: any) => {
            if (simulationDataMap[item.simulation_id]) {
              simulationDataMap[item.simulation_id][tableName].push(item);
            }
          });
        });
      }

      // Phase 4: Count messages per conversation
      const conversations = conversationsRes.data || [];
      if (conversations.length > 0) {
        const convIds = conversations.map((c: any) => c.id);
        const { data: msgCounts } = await supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", convIds);

        const countMap: Record<string, number> = {};
        (msgCounts || []).forEach((m: any) => {
          countMap[m.conversation_id] =
            (countMap[m.conversation_id] || 0) + 1;
        });

        conversations.forEach((c: any) => {
          c._message_count = countMap[c.id] || 0;
        });
      }

      setData({
        fullProfile: profileRes.data || null,
        familyMembers: familyRes.data || [],
        accounts: accountsRes.data || [],
        paymentMethods: paymentMethodsRes.data || [],
        budgetCategories: budgetCategoriesRes.data || [],
        budgetTransactions: budgetTransactionsRes.data || [],
        portfolioTransactions: portfolioTransactionsRes.data || [],
        financialSnapshots: snapshots,
        snapshotItems: snapshotItemsMap,
        simulations,
        simulationData: simulationDataMap,
        bookings: bookingsRes.data || [],
        consultationRecords: consultationRecordsRes.data || [],
        customerNotes: customerNotesRes.data || [],
        conversations,
      });
    } catch (err: any) {
      setError(err?.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <p className={styles.errorText}>{error}</p>;
  }

  if (!data) {
    return <p className={styles.emptyText}>데이터 없음</p>;
  }

  // Summary helpers
  const familySummary = (() => {
    if (data.familyMembers.length === 0) return "데이터 없음";
    const grouped: Record<string, number> = {};
    data.familyMembers.forEach((m: any) => {
      const rel = RELATIONSHIP_LABELS[m.relationship] || m.relationship || "기타";
      grouped[rel] = (grouped[rel] || 0) + 1;
    });
    return Object.entries(grouped)
      .map(([rel, count]) => (count > 1 ? `${rel} ${count}명` : rel))
      .join(", ");
  })();

  const surveySummary = (() => {
    const sr = profile.survey_responses;
    if (!sr || typeof sr !== "object" || Object.keys(sr).length === 0) return "미완료";
    if (sr.completed_at) return `완료 (${formatDateValue(sr.completed_at)})`;
    return "진행중";
  })();

  const prepSummary = (() => {
    const pd = profile.prep_data;
    if (!pd || typeof pd !== "object") return "데이터 없음";
    const keys = Object.keys(pd).filter((k) => pd[k] !== null && pd[k] !== undefined);
    if (keys.length === 0) return "데이터 없음";
    return `${keys.length}개 항목 입력`;
  })();

  const guideSummary = (() => {
    const gc = profile.guide_clicks;
    if (!gc || typeof gc !== "object") return "데이터 없음";
    const entries = Object.entries(gc);
    if (entries.length === 0) return "데이터 없음";
    return `${entries.length}개 항목 열람`;
  })();

  const accountsSummary = (() => {
    if (data.accounts.length === 0) return "데이터 없음";
    const total = data.accounts.reduce(
      (sum: number, a: any) => sum + (a.current_balance || 0),
      0,
    );
    return `총 잔액 ${formatWon(total)}`;
  })();

  const paymentSummary = (() => {
    if (data.paymentMethods.length === 0) return "데이터 없음";
    const active = data.paymentMethods.filter((m: any) => m.is_active).length;
    return `활성 ${active} / 전체 ${data.paymentMethods.length}`;
  })();

  const budgetCatSummary = (() => {
    if (data.budgetCategories.length === 0) return "데이터 없음";
    const income = data.budgetCategories.filter((c: any) => c.type === "income").length;
    const expense = data.budgetCategories.filter((c: any) => c.type === "expense").length;
    return `수입 ${income} / 지출 ${expense}`;
  })();

  const budgetTxnSummary = (() => {
    if (data.budgetTransactions.length === 0) return "데이터 없음";
    const first = data.budgetTransactions[0];
    const dateStr = `${first.year}.${String(first.month).padStart(2, "0")}`;
    return `최근 ${dateStr} / ${data.budgetTransactions.length}건`;
  })();

  const portfolioTxnSummary = (() => {
    if (data.portfolioTransactions.length === 0) return "데이터 없음";
    const first = data.portfolioTransactions[0];
    const dateStr = first.trade_date ? formatDateValue(first.trade_date).split(" ")[0] : "-";
    return `최근 ${dateStr} / ${data.portfolioTransactions.length}건`;
  })();

  const snapshotSummary = (() => {
    if (data.financialSnapshots.length === 0) return "데이터 없음";
    const latest = data.financialSnapshots[0];
    if (latest.net_worth != null) return `순자산 ${formatWon(latest.net_worth)}`;
    return `${data.financialSnapshots.length}건`;
  })();

  const simulationSummary = (() => {
    if (data.simulations.length === 0) return "데이터 없음";
    const defaultSim = data.simulations.find((s: any) => s.is_default);
    if (defaultSim?.title) return defaultSim.title;
    return data.simulations[0]?.title || `${data.simulations.length}개`;
  })();

  const bookingSummary = (() => {
    if (data.bookings.length === 0) return "데이터 없음";
    const latest = data.bookings[0];
    const status = BOOKING_STATUS_LABELS[latest.status] || latest.status || "";
    const dateStr = latest.booking_date ? formatDateValue(latest.booking_date).split(" ")[0] : "";
    return `${status} ${dateStr}`;
  })();

  const consultationSummary = (() => {
    if (data.consultationRecords.length === 0) return "데이터 없음";
    return `${data.consultationRecords.length}건`;
  })();

  const notesSummary = (() => {
    if (data.customerNotes.length === 0) return "데이터 없음";
    return `${data.customerNotes.length}건`;
  })();

  const conversationSummary = (() => {
    if (data.conversations.length === 0) return "데이터 없음";
    const totalMsgs = data.conversations.reduce(
      (sum: number, c: any) => sum + (c._message_count || 0),
      0,
    );
    return `총 ${totalMsgs}개 메시지`;
  })();

  const profileSummary = (() => {
    if (!data.fullProfile) return "데이터 없음";
    const p = data.fullProfile;
    const parts: string[] = [];
    if (p.name) parts.push(p.name);
    if (p.customer_stage) parts.push(labelOf(CUSTOMER_STAGE_LABELS, p.customer_stage));
    if (p.onboarding_step) parts.push(labelOf(ONBOARDING_STEP_LABELS, p.onboarding_step));
    return parts.join(", ");
  })();

  // Card definitions
  const cards: { key: string; title: string; count?: number; summary: string }[] = [
    { key: "profile", title: "프로필 전체", summary: profileSummary },
    { key: "family", title: "가족 구성원", count: data.familyMembers.length, summary: familySummary },
    { key: "survey", title: "온보딩 설문", summary: surveySummary },
    { key: "prep", title: "입력해두기", summary: prepSummary },
    { key: "guide", title: "가이드 열람", summary: guideSummary },
    { key: "accounts", title: "계좌", count: data.accounts.length, summary: accountsSummary },
    { key: "payment", title: "결제 수단", count: data.paymentMethods.length, summary: paymentSummary },
    { key: "budgetCat", title: "가계부 카테고리", count: data.budgetCategories.length, summary: budgetCatSummary },
    { key: "budgetTxn", title: "가계부 거래", count: data.budgetTransactions.length, summary: budgetTxnSummary },
    { key: "portfolioTxn", title: "포트폴리오 거래", count: data.portfolioTransactions.length, summary: portfolioTxnSummary },
    { key: "snapshot", title: "재무 스냅샷", count: data.financialSnapshots.length, summary: snapshotSummary },
    { key: "simulation", title: "시뮬레이션", count: data.simulations.length, summary: simulationSummary },
    { key: "booking", title: "예약", count: data.bookings.length, summary: bookingSummary },
    { key: "consultation", title: "상담 기록", count: data.consultationRecords.length, summary: consultationSummary },
    { key: "notes", title: "고객 메모", count: data.customerNotes.length, summary: notesSummary },
    { key: "conversation", title: "대화", count: data.conversations.length, summary: conversationSummary },
  ];

  // Modal content renderer
  const renderModalContent = (key: string): React.ReactNode => {
    switch (key) {
      case "profile":
        return data.fullProfile ? renderProfile(data.fullProfile) : <p className={styles.emptyText}>프로필 데이터 없음</p>;
      case "family":
        return renderFamilyMembers(data.familyMembers);
      case "survey":
        return profile.survey_responses && typeof profile.survey_responses === "object" && Object.keys(profile.survey_responses).length > 0
          ? renderSurvey(profile.survey_responses)
          : <p className={styles.emptyText}>설문 데이터 없음</p>;
      case "prep":
        return profile.prep_data && typeof profile.prep_data === "object" && Object.keys(profile.prep_data).length > 0
          ? <PrepDataSection data={profile.prep_data} />
          : <p className={styles.emptyText}>데이터 없음</p>;
      case "guide":
        return profile.guide_clicks && typeof profile.guide_clicks === "object" && Object.keys(profile.guide_clicks).length > 0
          ? <GuideClicksSection data={profile.guide_clicks} />
          : <p className={styles.emptyText}>데이터 없음</p>;
      case "accounts":
        return renderAccounts(data.accounts);
      case "payment":
        return renderPaymentMethods(data.paymentMethods);
      case "budgetCat":
        return renderBudgetCategories(data.budgetCategories);
      case "budgetTxn":
        return renderBudgetTransactions(data.budgetTransactions);
      case "portfolioTxn":
        return renderPortfolioTransactions(data.portfolioTransactions);
      case "snapshot":
        return data.financialSnapshots.length === 0 ? (
          <p className={styles.emptyText}>데이터 없음</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>유형</th>
                  <th>순자산</th>
                  <th>총자산</th>
                  <th>총부채</th>
                  <th>저축</th>
                  <th>투자</th>
                  <th>부동산</th>
                  <th>실물자산</th>
                  <th>금융부채</th>
                </tr>
              </thead>
              <tbody>
                {data.financialSnapshots.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.recorded_at ? formatDateValue(s.recorded_at) : "-"}</td>
                    <td>{labelOf(SNAPSHOT_TYPE_LABELS, s.snapshot_type)}</td>
                    <td style={{ fontWeight: 600 }}>{s.net_worth != null ? formatWon(s.net_worth) : "-"}</td>
                    <td>{s.total_assets != null ? formatWon(s.total_assets) : "-"}</td>
                    <td>{s.total_debts != null ? formatWon(s.total_debts) : "-"}</td>
                    <td>{s.savings != null ? formatWon(s.savings) : "-"}</td>
                    <td>{s.investments != null ? formatWon(s.investments) : "-"}</td>
                    <td>{s.real_estate != null ? formatWon(s.real_estate) : "-"}</td>
                    <td>{s.real_assets != null ? formatWon(s.real_assets) : "-"}</td>
                    <td>{s.unsecured_debt != null ? formatWon(s.unsecured_debt) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "simulation":
        return data.simulations.length === 0 ? (
          <p className={styles.emptyText}>데이터 없음</p>
        ) : (
          data.simulations.map((sim: any) => (
            <CollapsibleSubSection key={sim.id} title={sim.title || sim.id} defaultOpen={false}>
              <SimulationSection simulation={sim} subData={data.simulationData[sim.id] || {}} />
            </CollapsibleSubSection>
          ))
        );
      case "booking":
        return renderBookings(data.bookings);
      case "consultation":
        return renderConsultationRecords(data.consultationRecords);
      case "notes":
        return renderCustomerNotes(data.customerNotes);
      case "conversation":
        return renderConversations(data.conversations);
      default:
        return null;
    }
  };

  const activeCard = cards.find((c) => c.key === activeModal);

  return (
    <div className={styles.container}>
      <div className={styles.cardGrid}>
        {cards.map((card) => (
          <div
            key={card.key}
            className={styles.summaryCard}
            onClick={() => setActiveModal(card.key)}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{card.title}</span>
              {card.count !== undefined && (
                <span className={styles.cardCount}>{card.count}</span>
              )}
            </div>
            <div className={styles.cardSummary}>{card.summary}</div>
          </div>
        ))}
      </div>

      {activeModal && activeCard && (
        <DetailModal
          title={activeCard.title}
          onClose={() => setActiveModal(null)}
        >
          {renderModalContent(activeModal)}
        </DetailModal>
      )}
    </div>
  );
}
