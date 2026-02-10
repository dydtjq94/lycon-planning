"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, Link2, User, Users, Baby, Target, Settings, X, ChevronRight,
  Building2, Home, Building, MapPin, Store, MoreHorizontal,
  Car, Gem, Palette, Package,
  CreditCard, GraduationCap, Wallet, ShoppingCart, Landmark,
  Coins, Briefcase, TrendingUp, CircleDollarSign
} from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import {
  useTodaySnapshot,
  useSnapshotItems,
  useCreateSnapshotItem,
  useUpdateSnapshotItem,
  useDeleteSnapshotItem,
  useUpdateSnapshot,
  usePortfolioTransactions,
  usePortfolioChartPriceData,
} from "@/hooks/useFinancialData";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { FinancialSnapshotItem, FinancialSnapshotItemInput, PortfolioAccount, Account, Profile, FamilyMember } from "@/types/tables";
import { formatMoney, formatWon, calculateAge } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getTermDepositAccounts, getBudgetTransactions } from "@/lib/services/budgetService";
import { calculatePortfolioAccountValuesDetailed, calculateAccountBalances, calculateTermDepositValue } from "@/lib/utils/accountValueCalculator";
import { BrokerLogo } from "./shared/BrokerLogo";
import styles from "./CurrentAssetTab.module.css";

ChartJS.register(ArcElement, Tooltip, Legend);

interface CurrentAssetTabProps {
  profileId: string;
  onNavigate?: (section: string) => void;
}

type TabType = "savings" | "investment" | "realEstate" | "realAsset" | "debt" | "profile";

const TABS: { id: TabType; label: string; color: string }[] = [
  { id: "savings", label: "저축", color: "#3b82f6" },
  { id: "investment", label: "투자", color: "#22c55e" },
  { id: "realEstate", label: "부동산", color: "#8b5cf6" },
  { id: "realAsset", label: "실물 자산", color: "#f59e0b" },
  { id: "debt", label: "금융 부채", color: "#94a3b8" },
  { id: "profile", label: "프로필", color: "#6b7280" },
];

// 거주 형태
type HousingType = "자가" | "전세" | "월세" | "무상";
const HOUSING_TYPES: { value: HousingType; label: string }[] = [
  { value: "자가", label: "자가" },
  { value: "전세", label: "전세" },
  { value: "월세", label: "월세 (반전세)" },
  { value: "무상", label: "무상 (부모집 거주)" },
];

// 상환 방식
type RepaymentType = "원리금균등상환" | "원금균등상환" | "만기일시상환" | "거치식상환";
const REPAYMENT_TYPES: { value: RepaymentType; label: string }[] = [
  { value: "원리금균등상환", label: "원리금균등" },
  { value: "원금균등상환", label: "원금균등" },
  { value: "만기일시상환", label: "만기일시" },
  { value: "거치식상환", label: "거치식" },
];

// 거주용 부동산 데이터 구조
interface ResidenceData {
  id: string;
  housingType: HousingType | null;
  currentValue: number; // 시세 or 보증금
  purchaseYear: number | null;
  purchaseMonth: number | null;
  purchasePrice: number | null; // 취득가 (자가만)
  monthlyRent: number | null; // 월세 (월세만)
  maintenanceFee: number | null; // 관리비
  hasLoan: boolean;
  loanAmount: number | null;
  loanRate: number | null;
  loanMaturityYear: number | null;
  loanMaturityMonth: number | null;
  loanRepaymentType: RepaymentType | null;
}

// 투자용 부동산 편집 데이터
interface InvestmentRealEstateData {
  id: string;
  itemType: string;
  title: string;
  purchasePrice: number | null; // 취득가
  currentValue: number; // 현재 시세
  purchaseYear: number | null;
  purchaseMonth: number | null;
  hasLoan: boolean;
  loanAmount: number | null;
  loanRate: number | null;
  loanMaturityYear: number | null;
  loanMaturityMonth: number | null;
  loanRepaymentType: RepaymentType | null;
}

// 실물 자산 편집 데이터
interface RealAssetData {
  id: string;
  itemType: string;
  title: string;
  purchasePrice: number | null; // 취득가
  currentValue: number; // 현재가
  hasLoan: boolean; // 담보대출 유무
  loanAmount: number | null; // 대출금액
  loanRate: number | null; // 금리
  loanMaturityYear: number | null; // 만기 연도
  loanMaturityMonth: number | null; // 만기 월
  loanRepaymentType: RepaymentType | null; // 상환방식
}

// 금융 부채 편집 데이터
interface DebtData {
  id: string;
  itemType: string;
  title: string;
  amount: number;
  loanRate: number | null;
  loanMaturityYear: number | null;
  loanMaturityMonth: number | null;
  loanRepaymentType: RepaymentType | null;
}

// 카테고리별 item_type 매핑
const ITEM_TYPES: Record<TabType, { value: string; label: string }[]> = {
  savings: [
    { value: "checking", label: "입출금통장" },
    { value: "savings", label: "적금" },
    { value: "deposit", label: "예금" },
    { value: "emergency", label: "비상금" },
  ],
  investment: [
    { value: "gold", label: "실물 금" },
    { value: "fund", label: "펀드" },
    { value: "bond", label: "채권" },
    { value: "crypto", label: "암호화폐" },
    { value: "other", label: "기타 투자" },
  ],
  realEstate: [
    { value: "apartment", label: "아파트" },
    { value: "house", label: "주택" },
    { value: "officetel", label: "오피스텔" },
    { value: "land", label: "토지" },
    { value: "commercial", label: "상가" },
    { value: "other", label: "기타" },
  ],
  realAsset: [
    { value: "car", label: "자동차" },
    { value: "precious_metal", label: "귀금속" },
    { value: "art", label: "미술품" },
    { value: "other", label: "기타" },
  ],
  debt: [
    { value: "credit", label: "신용대출" },
    { value: "student", label: "학자금대출" },
    { value: "card", label: "카드대출" },
    { value: "other", label: "기타" },
  ],
  profile: [],
};

// 모달용 아이템 설정 (아이콘 포함)
type ModalCategory = "investment" | "realEstate" | "realAsset" | "debt";

interface ModalItemConfig {
  value: string;
  label: string;
  icon: React.ReactNode;
}

const MODAL_ITEMS: Record<ModalCategory, { title: string; color: string; items: ModalItemConfig[] }> = {
  investment: {
    title: "투자",
    color: "#22c55e",
    items: [
      { value: "gold", label: "실물 금", icon: <Coins size={20} /> },
      { value: "fund", label: "펀드", icon: <TrendingUp size={20} /> },
      { value: "bond", label: "채권", icon: <Landmark size={20} /> },
      { value: "crypto", label: "암호화폐", icon: <CircleDollarSign size={20} /> },
      { value: "other", label: "기타", icon: <MoreHorizontal size={20} /> },
    ],
  },
  realEstate: {
    title: "투자용 부동산",
    color: "#8b5cf6",
    items: [
      { value: "apartment", label: "아파트", icon: <Building2 size={20} /> },
      { value: "house", label: "주택", icon: <Home size={20} /> },
      { value: "officetel", label: "오피스텔", icon: <Building size={20} /> },
      { value: "land", label: "토지", icon: <MapPin size={20} /> },
      { value: "commercial", label: "상가", icon: <Store size={20} /> },
      { value: "other", label: "기타", icon: <MoreHorizontal size={20} /> },
    ],
  },
  realAsset: {
    title: "실물 자산",
    color: "#f59e0b",
    items: [
      { value: "car", label: "자동차", icon: <Car size={20} /> },
      { value: "precious_metal", label: "귀금속", icon: <Gem size={20} /> },
      { value: "art", label: "미술품", icon: <Palette size={20} /> },
      { value: "other", label: "기타", icon: <Package size={20} /> },
    ],
  },
  debt: {
    title: "금융 부채",
    color: "#94a3b8",
    items: [
      { value: "credit", label: "신용대출", icon: <Wallet size={20} /> },
      { value: "student", label: "학자금대출", icon: <GraduationCap size={20} /> },
      { value: "card", label: "카드대출", icon: <CreditCard size={20} /> },
      { value: "other", label: "기타", icon: <MoreHorizontal size={20} /> },
    ],
  },
};

// 금융 부채 카드 컴포넌트
interface DebtCardProps {
  item: FinancialSnapshotItem;
  currentYear: number;
  isCouple: boolean;
  onUpdate: (id: string, updates: Partial<FinancialSnapshotItem>) => void;
  onDelete: (id: string) => void;
}

function DebtCard({ item, currentYear, isCouple, onUpdate, onDelete }: DebtCardProps) {
  const meta = (item.metadata || {}) as Record<string, unknown>;

  const getDefaultTitle = () => item.title || ITEM_TYPES.debt.find(t => t.value === item.item_type)?.label || "";

  const [title, setTitle] = useState(getDefaultTitle());
  const [amount, setAmount] = useState(String(item.amount || ""));
  const [loanRate, setLoanRate] = useState(String((meta?.loan_rate as number) || ""));
  const [maturityYear, setMaturityYear] = useState(String((meta?.loan_maturity_year as number) || ""));
  const [maturityMonth, setMaturityMonth] = useState(String((meta?.loan_maturity_month as number) || ""));
  const [repaymentType, setRepaymentType] = useState((meta?.loan_repayment_type as RepaymentType) || "원리금균등상환");

  // Enter 키로 저장 트리거
  const handleKeyDown = (e: React.KeyboardEvent, saveCallback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      saveCallback();
    }
  };

  return (
    <div className={styles.itemCard}>
      <button
        className={styles.itemCardDeleteBtn}
        onClick={() => onDelete(item.id)}
      >
        <Trash2 size={16} />
      </button>
      <div className={styles.itemCardHeader}>
        <div className={styles.itemCardHeaderGrid}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>이름</span>
            <input
              type="text"
              className={styles.itemCardFieldInput}
              value={title}
              placeholder="이름 입력"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                if (title !== item.title) onUpdate(item.id, { title });
              })}
              onBlur={() => {
                if (title !== item.title) onUpdate(item.id, { title });
              }}
            />
          </div>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>소유</span>
            <select
              className={styles.itemCardFieldSelect}
              value={item.owner || 'self'}
              onChange={(e) => onUpdate(item.id, { owner: e.target.value as 'self' | 'spouse' })}
            >
              <option value="self">본인</option>
              {isCouple && <option value="spouse">배우자</option>}
            </select>
          </div>
          <div />
        </div>
      </div>

      <div className={styles.itemCardGrid}>
        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>유형</span>
          <select
            className={styles.itemCardFieldSelect}
            value={item.item_type}
            onChange={(e) => onUpdate(item.id, { item_type: e.target.value })}
          >
            {ITEM_TYPES.debt.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>잔액</span>
          <div className={styles.itemCardFieldUnit}>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              value={amount}
              placeholder="0"
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = parseInt(amount) || 0;
                if (val !== item.amount) onUpdate(item.id, { amount: val });
              })}
              onBlur={() => {
                const val = parseInt(amount) || 0;
                if (val !== item.amount) onUpdate(item.id, { amount: val });
              }}
            />
            <span className={styles.itemCardFieldUnitLabel}>만원</span>
          </div>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>금리</span>
          <div className={styles.itemCardFieldUnit}>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              value={loanRate}
              placeholder="0"
              step="0.1"
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setLoanRate(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = parseFloat(loanRate) || 0;
                if (val !== (meta?.loan_rate as number)) {
                  onUpdate(item.id, { metadata: { ...meta, loan_rate: val } });
                }
              })}
              onBlur={() => {
                const val = parseFloat(loanRate) || 0;
                if (val !== (meta?.loan_rate as number)) {
                  onUpdate(item.id, { metadata: { ...meta, loan_rate: val } });
                }
              }}
            />
            <span className={styles.itemCardFieldUnitLabel}>%</span>
          </div>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>만기일</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              style={{ width: 80, paddingRight: 12 }}
              value={maturityYear}
              placeholder={String(currentYear + 3)}
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setMaturityYear(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = maturityYear ? parseInt(maturityYear) : null;
                if (val !== (meta?.loan_maturity_year as number | null)) {
                  onUpdate(item.id, { metadata: { ...meta, loan_maturity_year: val } });
                }
              })}
              onBlur={() => {
                const val = maturityYear ? parseInt(maturityYear) : null;
                if (val !== (meta?.loan_maturity_year as number | null)) {
                  onUpdate(item.id, { metadata: { ...meta, loan_maturity_year: val } });
                }
              }}
            />
            <span style={{ fontSize: 13, color: '#6b7280' }}>년</span>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              style={{ width: 60, paddingRight: 12 }}
              value={maturityMonth}
              placeholder="12"
              min={1}
              max={12}
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setMaturityMonth(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = maturityMonth ? parseInt(maturityMonth) : null;
                if (val !== (meta?.loan_maturity_month as number | null)) {
                  onUpdate(item.id, { metadata: { ...meta, loan_maturity_month: val } });
                }
              })}
              onBlur={() => {
                const val = maturityMonth ? parseInt(maturityMonth) : null;
                if (val !== (meta?.loan_maturity_month as number | null)) {
                  onUpdate(item.id, { metadata: { ...meta, loan_maturity_month: val } });
                }
              }}
            />
            <span style={{ fontSize: 13, color: '#6b7280' }}>월</span>
          </div>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>상환방식</span>
          <select
            className={styles.itemCardFieldSelect}
            value={repaymentType}
            onChange={(e) => {
              const val = e.target.value as RepaymentType;
              setRepaymentType(val);
              onUpdate(item.id, { metadata: { ...meta, loan_repayment_type: val } });
            }}
          >
            {REPAYMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// 기타 투자 카드 컴포넌트
interface OtherInvestmentCardProps {
  item: FinancialSnapshotItem;
  isCouple: boolean;
  onUpdate: (id: string, updates: Partial<FinancialSnapshotItem>) => void;
  onDelete: (id: string) => void;
}

function OtherInvestmentCard({ item, isCouple, onUpdate, onDelete }: OtherInvestmentCardProps) {
  const getDefaultTitle = () => item.title || ITEM_TYPES.investment.find(t => t.value === item.item_type)?.label || "";

  const [title, setTitle] = useState(getDefaultTitle());
  const [amount, setAmount] = useState(String(item.amount || ""));

  const handleKeyDown = (e: React.KeyboardEvent, saveCallback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      saveCallback();
    }
  };

  return (
    <div className={styles.itemCard}>
      <button
        className={styles.itemCardDeleteBtn}
        onClick={() => onDelete(item.id)}
      >
        <Trash2 size={16} />
      </button>
      <div className={styles.itemCardHeader}>
        <div className={styles.itemCardHeaderGrid}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>이름</span>
            <input
              type="text"
              className={styles.itemCardFieldInput}
              value={title}
              placeholder="이름 입력"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                if (title !== item.title) onUpdate(item.id, { title });
              })}
              onBlur={() => {
                if (title !== item.title) onUpdate(item.id, { title });
              }}
            />
          </div>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>소유</span>
            <select
              className={styles.itemCardFieldSelect}
              value={item.owner || 'self'}
              onChange={(e) => onUpdate(item.id, { owner: e.target.value as 'self' | 'spouse' })}
            >
              <option value="self">본인</option>
              {isCouple && <option value="spouse">배우자</option>}
            </select>
          </div>
          <div />
        </div>
      </div>

      <div className={styles.itemCardGrid}>
        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>유형</span>
          <select
            className={styles.itemCardFieldSelect}
            value={item.item_type}
            onChange={(e) => onUpdate(item.id, { item_type: e.target.value })}
          >
            {ITEM_TYPES.investment.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>평가금액</span>
          <div className={styles.itemCardFieldUnit}>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              value={amount}
              placeholder="0"
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = amount ? parseInt(amount) : 0;
                if (val !== item.amount) onUpdate(item.id, { amount: val });
              })}
              onBlur={() => {
                const val = amount ? parseInt(amount) : 0;
                if (val !== item.amount) onUpdate(item.id, { amount: val });
              }}
            />
            <span className={styles.itemCardFieldUnitLabel}>만원</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 실물 자산 카드 컴포넌트
interface RealAssetCardProps {
  item: FinancialSnapshotItem;
  isCouple: boolean;
  onUpdate: (id: string, updates: Partial<FinancialSnapshotItem>) => void;
  onDelete: (id: string) => void;
}

function RealAssetCard({ item, isCouple, onUpdate, onDelete }: RealAssetCardProps) {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const hasLoan = meta?.has_loan as boolean;
  const currentYear = new Date().getFullYear();

  const [title, setTitle] = useState(item.title || ITEM_TYPES.realAsset.find(t => t.value === item.item_type)?.label || "");
  const [purchasePrice, setPurchasePrice] = useState(String((meta?.purchase_price as number) || ""));
  const [amount, setAmount] = useState(String(item.amount || ""));
  const [loanAmount, setLoanAmount] = useState(String((meta?.loan_amount as number) || ""));
  const [loanRate, setLoanRate] = useState(String((meta?.loan_rate as number) || ""));
  const [loanMaturityYear, setLoanMaturityYear] = useState(String((meta?.loan_maturity_year as number) || currentYear + 10));
  const [loanMaturityMonth, setLoanMaturityMonth] = useState(String((meta?.loan_maturity_month as number) || 12));
  const [loanRepaymentType, setLoanRepaymentType] = useState((meta?.loan_repayment_type as RepaymentType) || "원리금균등상환");

  const handleKeyDown = (e: React.KeyboardEvent, saveCallback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      saveCallback();
    }
  };

  const updateMeta = (updates: Record<string, unknown>) => {
    onUpdate(item.id, { metadata: { ...meta, ...updates } });
  };

  return (
    <div className={styles.itemCard}>
      <button
        className={styles.itemCardDeleteBtn}
        onClick={() => onDelete(item.id)}
      >
        <Trash2 size={16} />
      </button>
      <div className={styles.itemCardHeader}>
        <div className={styles.itemCardHeaderGrid}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>이름</span>
            <input
              type="text"
              className={styles.itemCardFieldInput}
              value={title}
              placeholder="이름 입력"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                if (title !== item.title) onUpdate(item.id, { title });
              })}
              onBlur={() => {
                if (title !== item.title) onUpdate(item.id, { title });
              }}
            />
          </div>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>소유</span>
            <select
              className={styles.itemCardFieldSelect}
              value={item.owner || 'self'}
              onChange={(e) => onUpdate(item.id, { owner: e.target.value as 'self' | 'spouse' })}
            >
              <option value="self">본인</option>
              {isCouple && <option value="spouse">배우자</option>}
            </select>
          </div>
          <div />
        </div>
      </div>

      {/* Row 2: 유형, 현재가 */}
      <div className={styles.itemCardGrid}>
        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>유형</span>
          <select
            className={styles.itemCardFieldSelect}
            value={item.item_type}
            onChange={(e) => onUpdate(item.id, { item_type: e.target.value })}
          >
            {ITEM_TYPES.realAsset.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>현재가</span>
          <div className={styles.itemCardFieldUnit}>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              value={amount}
              placeholder="0"
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = parseInt(amount) || 0;
                if (val !== item.amount) onUpdate(item.id, { amount: val });
              })}
              onBlur={() => {
                const val = parseInt(amount) || 0;
                if (val !== item.amount) onUpdate(item.id, { amount: val });
              }}
            />
            <span className={styles.itemCardFieldUnitLabel}>만원</span>
          </div>
        </div>
        <div />
      </div>

      {/* Row 3: 취득가, 담보대출 */}
      <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>취득가</span>
          <div className={styles.itemCardFieldUnit}>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              value={purchasePrice}
              placeholder="0"
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setPurchasePrice(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = parseInt(purchasePrice) || 0;
                if (val !== (meta?.purchase_price as number)) {
                  updateMeta({ purchase_price: val });
                }
              })}
              onBlur={() => {
                const val = parseInt(purchasePrice) || 0;
                if (val !== (meta?.purchase_price as number)) {
                  updateMeta({ purchase_price: val });
                }
              }}
            />
            <span className={styles.itemCardFieldUnitLabel}>만원</span>
          </div>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>담보대출</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`${styles.typeBtn} ${!hasLoan ? styles.active : ""}`}
              onClick={() => updateMeta({ has_loan: false })}
            >
              없음
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${hasLoan ? styles.active : ""}`}
              onClick={() => updateMeta({ has_loan: true })}
            >
              있음
            </button>
          </div>
        </div>
        <div />
      </div>

      {hasLoan && (
        <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>대출잔액</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={loanAmount}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setLoanAmount(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = parseInt(loanAmount) || 0;
                  if (val !== (meta?.loan_amount as number)) {
                    updateMeta({ loan_amount: val });
                  }
                })}
                onBlur={() => {
                  const val = parseInt(loanAmount) || 0;
                  if (val !== (meta?.loan_amount as number)) {
                    updateMeta({ loan_amount: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>금리</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={loanRate}
                placeholder="0"
                step="0.1"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setLoanRate(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = parseFloat(loanRate) || 0;
                  if (val !== (meta?.loan_rate as number)) {
                    updateMeta({ loan_rate: val });
                  }
                })}
                onBlur={() => {
                  const val = parseFloat(loanRate) || 0;
                  if (val !== (meta?.loan_rate as number)) {
                    updateMeta({ loan_rate: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>%</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>만기일</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                style={{ width: 75, flexShrink: 0, paddingRight: 12 }}
                value={loanMaturityYear}
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setLoanMaturityYear(e.target.value)}
                onBlur={() => {
                  const val = parseInt(loanMaturityYear) || currentYear + 10;
                  if (val !== (meta?.loan_maturity_year as number)) {
                    updateMeta({ loan_maturity_year: val });
                  }
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>년</span>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                style={{ width: 55, flexShrink: 0, paddingRight: 12 }}
                value={loanMaturityMonth}
                min={1}
                max={12}
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setLoanMaturityMonth(e.target.value)}
                onBlur={() => {
                  const val = Math.min(12, Math.max(1, parseInt(loanMaturityMonth) || 12));
                  setLoanMaturityMonth(String(val));
                  if (val !== (meta?.loan_maturity_month as number)) {
                    updateMeta({ loan_maturity_month: val });
                  }
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>월</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>상환방식</span>
            <select
              className={styles.itemCardFieldSelect}
              value={loanRepaymentType}
              onChange={(e) => {
                const val = e.target.value as RepaymentType;
                setLoanRepaymentType(val);
                updateMeta({ loan_repayment_type: val });
              }}
            >
              {REPAYMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// 투자용 부동산 카드 컴포넌트
interface InvestmentRealEstateCardProps {
  item: FinancialSnapshotItem;
  currentYear: number;
  isCouple: boolean;
  onUpdate: (id: string, updates: Partial<FinancialSnapshotItem>) => void;
  onDelete: (id: string) => void;
}

function InvestmentRealEstateCard({ item, currentYear, isCouple, onUpdate, onDelete }: InvestmentRealEstateCardProps) {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const hasLoan = meta?.has_loan as boolean;

  const [title, setTitle] = useState(item.title || ITEM_TYPES.realEstate.find(t => t.value === item.item_type)?.label || "");
  const [amount, setAmount] = useState(String(item.amount || ""));
  const [purchasePrice, setPurchasePrice] = useState(String((meta?.purchase_price as number) || ""));
  const [purchaseYear, setPurchaseYear] = useState(String((meta?.purchase_year as number) || ""));
  const [purchaseMonth, setPurchaseMonth] = useState(String((meta?.purchase_month as number) || ""));
  const [loanAmount, setLoanAmount] = useState(String((meta?.loan_amount as number) || ""));
  const [loanRate, setLoanRate] = useState(String((meta?.loan_rate as number) || ""));
  const [maturityYear, setMaturityYear] = useState(String((meta?.loan_maturity_year as number) || ""));
  const [maturityMonth, setMaturityMonth] = useState(String((meta?.loan_maturity_month as number) || ""));

  const handleKeyDown = (e: React.KeyboardEvent, saveCallback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      saveCallback();
    }
  };

  return (
    <div className={styles.itemCard}>
      <button
        className={styles.itemCardDeleteBtn}
        onClick={() => onDelete(item.id)}
      >
        <Trash2 size={16} />
      </button>
      <div className={styles.itemCardHeader}>
        <div className={styles.itemCardHeaderGrid}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>이름</span>
            <input
              type="text"
              className={styles.itemCardFieldInput}
              value={title}
              placeholder="이름 입력"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                if (title !== item.title) onUpdate(item.id, { title });
              })}
              onBlur={() => {
                if (title !== item.title) onUpdate(item.id, { title });
              }}
            />
          </div>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>소유</span>
            <select
              className={styles.itemCardFieldSelect}
              value={item.owner || 'self'}
              onChange={(e) => onUpdate(item.id, { owner: e.target.value as 'self' | 'spouse' })}
            >
              <option value="self">본인</option>
              {isCouple && <option value="spouse">배우자</option>}
            </select>
          </div>
          <div />
        </div>
      </div>

      {/* Row 2: 유형, 현재 시세 */}
      <div className={styles.itemCardGrid}>
        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>유형</span>
          <select
            className={styles.itemCardFieldSelect}
            value={item.item_type}
            onChange={(e) => onUpdate(item.id, { item_type: e.target.value })}
          >
            {ITEM_TYPES.realEstate.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>현재 시세</span>
          <div className={styles.itemCardFieldUnit}>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              value={amount}
              placeholder="0"
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = parseInt(amount) || 0;
                if (val !== item.amount) onUpdate(item.id, { amount: val });
              })}
              onBlur={() => {
                const val = parseInt(amount) || 0;
                if (val !== item.amount) onUpdate(item.id, { amount: val });
              }}
            />
            <span className={styles.itemCardFieldUnitLabel}>만원</span>
          </div>
        </div>
        <div />
      </div>

      {/* Row 3: 취득일, 취득가, 담보대출 */}
      <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>취득일</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              style={{ width: 80, paddingRight: 12 }}
              value={purchaseYear}
              placeholder={String(currentYear)}
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setPurchaseYear(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = purchaseYear ? parseInt(purchaseYear) : null;
                if (val !== (meta?.purchase_year as number | null)) {
                  onUpdate(item.id, { metadata: { ...meta, purchase_year: val } });
                }
              })}
              onBlur={() => {
                const val = purchaseYear ? parseInt(purchaseYear) : null;
                if (val !== (meta?.purchase_year as number | null)) {
                  onUpdate(item.id, { metadata: { ...meta, purchase_year: val } });
                }
              }}
            />
            <span style={{ fontSize: 13, color: '#6b7280' }}>년</span>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              style={{ width: 60, paddingRight: 12 }}
              value={purchaseMonth}
              placeholder="1"
              min={1}
              max={12}
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setPurchaseMonth(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = purchaseMonth ? parseInt(purchaseMonth) : null;
                if (val !== (meta?.purchase_month as number | null)) {
                  onUpdate(item.id, { metadata: { ...meta, purchase_month: val } });
                }
              })}
              onBlur={() => {
                const val = purchaseMonth ? parseInt(purchaseMonth) : null;
                if (val !== (meta?.purchase_month as number | null)) {
                  onUpdate(item.id, { metadata: { ...meta, purchase_month: val } });
                }
              }}
            />
            <span style={{ fontSize: 13, color: '#6b7280' }}>월</span>
          </div>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>취득가</span>
          <div className={styles.itemCardFieldUnit}>
            <input
              type="number"
              className={styles.itemCardFieldInput}
              value={purchasePrice}
              placeholder="0"
              onWheel={e => (e.target as HTMLElement).blur()}
              onChange={(e) => setPurchasePrice(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => {
                const val = parseInt(purchasePrice) || 0;
                if (val !== (meta?.purchase_price as number)) {
                  onUpdate(item.id, { metadata: { ...meta, purchase_price: val } });
                }
              })}
              onBlur={() => {
                const val = parseInt(purchasePrice) || 0;
                if (val !== (meta?.purchase_price as number)) {
                  onUpdate(item.id, { metadata: { ...meta, purchase_price: val } });
                }
              }}
            />
            <span className={styles.itemCardFieldUnitLabel}>만원</span>
          </div>
        </div>

        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>담보대출</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`${styles.typeBtn} ${!hasLoan ? styles.active : ""}`}
              onClick={() => onUpdate(item.id, { metadata: { ...meta, has_loan: false } })}
            >
              없음
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${hasLoan ? styles.active : ""}`}
              onClick={() => onUpdate(item.id, { metadata: { ...meta, has_loan: true } })}
            >
              있음
            </button>
          </div>
        </div>
      </div>

      {hasLoan && (
        <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>대출잔액</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={loanAmount}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setLoanAmount(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = parseInt(loanAmount) || 0;
                  if (val !== (meta?.loan_amount as number)) {
                    onUpdate(item.id, { metadata: { ...meta, loan_amount: val } });
                  }
                })}
                onBlur={() => {
                  const val = parseInt(loanAmount) || 0;
                  if (val !== (meta?.loan_amount as number)) {
                    onUpdate(item.id, { metadata: { ...meta, loan_amount: val } });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>금리</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={loanRate}
                placeholder="3.5"
                step="0.1"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setLoanRate(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = parseFloat(loanRate) || 0;
                  if (val !== (meta?.loan_rate as number)) {
                    onUpdate(item.id, { metadata: { ...meta, loan_rate: val } });
                  }
                })}
                onBlur={() => {
                  const val = parseFloat(loanRate) || 0;
                  if (val !== (meta?.loan_rate as number)) {
                    onUpdate(item.id, { metadata: { ...meta, loan_rate: val } });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>%</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>만기일</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                style={{ width: 80, paddingRight: 12 }}
                value={maturityYear}
                placeholder={String(currentYear + 20)}
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setMaturityYear(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = maturityYear ? parseInt(maturityYear) : null;
                  if (val !== (meta?.loan_maturity_year as number | null)) {
                    onUpdate(item.id, { metadata: { ...meta, loan_maturity_year: val } });
                  }
                })}
                onBlur={() => {
                  const val = maturityYear ? parseInt(maturityYear) : null;
                  if (val !== (meta?.loan_maturity_year as number | null)) {
                    onUpdate(item.id, { metadata: { ...meta, loan_maturity_year: val } });
                  }
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>년</span>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                style={{ width: 60, paddingRight: 12 }}
                value={maturityMonth}
                placeholder="12"
                min={1}
                max={12}
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setMaturityMonth(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = maturityMonth ? parseInt(maturityMonth) : null;
                  if (val !== (meta?.loan_maturity_month as number | null)) {
                    onUpdate(item.id, { metadata: { ...meta, loan_maturity_month: val } });
                  }
                })}
                onBlur={() => {
                  const val = maturityMonth ? parseInt(maturityMonth) : null;
                  if (val !== (meta?.loan_maturity_month as number | null)) {
                    onUpdate(item.id, { metadata: { ...meta, loan_maturity_month: val } });
                  }
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>월</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>상환방식</span>
            <select
              className={styles.itemCardFieldSelect}
              value={(meta?.loan_repayment_type as string) || "원리금균등상환"}
              onChange={(e) => {
                onUpdate(item.id, { metadata: { ...meta, loan_repayment_type: e.target.value } });
              }}
            >
              {REPAYMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// 거주용 부동산 카드 컴포넌트
interface ResidenceCardProps {
  item: FinancialSnapshotItem | null;
  snapshotId: string;
  currentYear: number;
  isCouple: boolean;
  onUpdate: (id: string, updates: Partial<FinancialSnapshotItem>) => void;
  onCreate: (input: FinancialSnapshotItemInput) => Promise<FinancialSnapshotItem>;
  onDelete: (id: string) => void;
}

function ResidenceCard({ item, snapshotId, currentYear, isCouple, onUpdate, onCreate, onDelete }: ResidenceCardProps) {
  const meta = (item?.metadata || {}) as Record<string, unknown>;
  const currentMonth = new Date().getMonth() + 1;

  // 로컬 state
  const [housingType, setHousingType] = useState<string>((meta?.housing_type as string) || "");
  const [currentValue, setCurrentValue] = useState(String((meta?.current_value as number) || ""));
  const [purchaseYear, setPurchaseYear] = useState(String((meta?.purchase_year as number) || ""));
  const [purchaseMonth, setPurchaseMonth] = useState(String((meta?.purchase_month as number) || ""));
  const [purchasePrice, setPurchasePrice] = useState(String((meta?.purchase_price as number) || ""));
  const [hasLoan, setHasLoan] = useState((meta?.has_loan as boolean) || false);
  const [loanAmount, setLoanAmount] = useState(String((meta?.loan_amount as number) || ""));
  const [loanRate, setLoanRate] = useState(String((meta?.loan_rate as number) || ""));
  const [maturityYear, setMaturityYear] = useState(String((meta?.loan_maturity_year as number) || ""));
  const [maturityMonth, setMaturityMonth] = useState(String((meta?.loan_maturity_month as number) || ""));
  const [repaymentType, setRepaymentType] = useState<string>((meta?.loan_repayment_type as string) || "원리금균등상환");
  const [monthlyRent, setMonthlyRent] = useState(String((meta?.monthly_rent as number) || ""));
  const [maintenanceFee, setMaintenanceFee] = useState(String((meta?.maintenance_fee as number) || ""));

  const handleKeyDown = (e: React.KeyboardEvent, saveCallback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      saveCallback();
    }
  };

  // 메타데이터 업데이트 헬퍼
  const updateMeta = (updates: Record<string, unknown>) => {
    if (!item) return;
    const newMeta = { ...meta, ...updates };
    onUpdate(item.id, { metadata: newMeta });
  };

  // 아이템이 없으면 생성하고 업데이트
  const createOrUpdate = async (updates: Record<string, unknown>) => {
    if (item) {
      updateMeta(updates);
    } else if (housingType) {
      // 새 아이템 생성
      await onCreate({
        snapshot_id: snapshotId,
        category: "asset",
        item_type: "residence",
        title: `거주용 (${housingType})`,
        amount: parseInt(currentValue) || 0,
        owner: "self",
        metadata: {
          purpose: "residential",
          housing_type: housingType,
          ...updates,
        },
      });
    }
  };

  // 거주형태 변경 시 즉시 저장
  const handleHousingTypeChange = async (type: string) => {
    setHousingType(type);
    if (item) {
      updateMeta({ housing_type: type });
      onUpdate(item.id, { title: `거주용 (${type})` });
    } else {
      // 새로 생성
      await onCreate({
        snapshot_id: snapshotId,
        category: "asset",
        item_type: "residence",
        title: `거주용 (${type})`,
        amount: 0,
        owner: "self",
        metadata: {
          purpose: "residential",
          housing_type: type,
        },
      });
    }
  };

  // 대출 있음/없음 토글
  const handleLoanToggle = (hasLoanNew: boolean) => {
    setHasLoan(hasLoanNew);
    if (item) {
      updateMeta({ has_loan: hasLoanNew });
    }
  };

  // 상환방식 변경
  const handleRepaymentTypeChange = (type: string) => {
    setRepaymentType(type);
    if (item) {
      updateMeta({ loan_repayment_type: type });
    }
  };

  if (!housingType && !item) {
    // 거주형태 선택 전
    return (
      <div className={styles.itemCard}>
        <div className={styles.itemCardHeaderSimple}>
          <span className={styles.itemCardTitle} style={{ fontWeight: 600 }}>거주 정보</span>
        </div>
        <div className={styles.itemCardGrid}>
          <div className={styles.itemCardField} style={{ gridColumn: '1 / -1' }}>
            <span className={styles.itemCardFieldLabel}>거주형태</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {HOUSING_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  className={styles.typeBtn}
                  onClick={() => handleHousingTypeChange(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.itemCard}>
      {item && (
        <button
          className={styles.itemCardDeleteBtn}
          onClick={() => onDelete(item.id)}
        >
          <Trash2 size={16} />
        </button>
      )}
      <div className={styles.itemCardHeader}>
        <div className={styles.itemCardHeaderGrid}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>이름</span>
            <input
              type="text"
              className={styles.itemCardFieldInput}
              value="거주용 부동산"
              readOnly
              style={{ background: '#f9fafb' }}
            />
          </div>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>소유</span>
            <select
              className={styles.itemCardFieldSelect}
              value={item?.owner || 'self'}
              onChange={(e) => item && onUpdate(item.id, { owner: e.target.value as 'self' | 'spouse' })}
            >
              <option value="self">본인</option>
              {isCouple && <option value="spouse">배우자</option>}
            </select>
          </div>
          <div />
        </div>
      </div>

      {/* Row 1: 거주형태, 보증금/시세, 전월세대출 */}
      <div className={styles.itemCardGrid}>
        <div className={styles.itemCardField}>
          <span className={styles.itemCardFieldLabel}>거주형태</span>
          <select
            className={styles.itemCardFieldSelect}
            value={housingType}
            onChange={(e) => handleHousingTypeChange(e.target.value)}
          >
            {HOUSING_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        {housingType !== "무상" && (
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>
              {housingType === "자가" ? "시세" : "보증금"}
            </span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={currentValue}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setCurrentValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = parseInt(currentValue) || 0;
                  if (item) {
                    onUpdate(item.id, { amount: val });
                    updateMeta({ current_value: val });
                  }
                })}
                onBlur={() => {
                  const val = parseInt(currentValue) || 0;
                  if (item) {
                    onUpdate(item.id, { amount: val });
                    updateMeta({ current_value: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원</span>
            </div>
          </div>
        )}

        {housingType !== "무상" && housingType !== "자가" && (
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>전월세대출</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`${styles.typeBtn} ${!hasLoan ? styles.active : ""}`}
                onClick={() => handleLoanToggle(false)}
              >
                없음
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${hasLoan ? styles.active : ""}`}
                onClick={() => handleLoanToggle(true)}
              >
                있음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Row 2 (월세): 월세, 관리비 */}
      {housingType === "월세" && (
        <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>월세</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={monthlyRent}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setMonthlyRent(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = monthlyRent ? parseInt(monthlyRent) : null;
                  if (item && val !== (meta?.monthly_rent as number | null)) {
                    updateMeta({ monthly_rent: val });
                  }
                })}
                onBlur={() => {
                  const val = monthlyRent ? parseInt(monthlyRent) : null;
                  if (item && val !== (meta?.monthly_rent as number | null)) {
                    updateMeta({ monthly_rent: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원/월</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>관리비</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={maintenanceFee}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setMaintenanceFee(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = maintenanceFee ? parseInt(maintenanceFee) : null;
                  if (item && val !== (meta?.maintenance_fee as number | null)) {
                    updateMeta({ maintenance_fee: val });
                  }
                })}
                onBlur={() => {
                  const val = maintenanceFee ? parseInt(maintenanceFee) : null;
                  if (item && val !== (meta?.maintenance_fee as number | null)) {
                    updateMeta({ maintenance_fee: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원/월</span>
            </div>
          </div>
          <div />
        </div>
      )}

      {/* Row 2 (전세): 관리비 */}
      {housingType === "전세" && (
        <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>관리비</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={maintenanceFee}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setMaintenanceFee(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = maintenanceFee ? parseInt(maintenanceFee) : null;
                  if (item && val !== (meta?.maintenance_fee as number | null)) {
                    updateMeta({ maintenance_fee: val });
                  }
                })}
                onBlur={() => {
                  const val = maintenanceFee ? parseInt(maintenanceFee) : null;
                  if (item && val !== (meta?.maintenance_fee as number | null)) {
                    updateMeta({ maintenance_fee: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원/월</span>
            </div>
          </div>
          <div />
          <div />
        </div>
      )}

      {/* Row 2 (무상): 관리비 */}
      {housingType === "무상" && (
        <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>관리비</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={maintenanceFee}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setMaintenanceFee(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = maintenanceFee ? parseInt(maintenanceFee) : null;
                  if (item && val !== (meta?.maintenance_fee as number | null)) {
                    updateMeta({ maintenance_fee: val });
                  }
                })}
                onBlur={() => {
                  const val = maintenanceFee ? parseInt(maintenanceFee) : null;
                  if (item && val !== (meta?.maintenance_fee as number | null)) {
                    updateMeta({ maintenance_fee: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원/월</span>
            </div>
          </div>
          <div />
          <div />
        </div>
      )}

      {/* Row 2 (자가): 취득일, 취득가, 주담대 */}
      {housingType === "자가" && (
        <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>취득일</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                style={{ width: 80, paddingRight: 12 }}
                value={purchaseYear}
                placeholder={String(currentYear)}
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setPurchaseYear(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = purchaseYear ? parseInt(purchaseYear) : null;
                  if (item && val !== (meta?.purchase_year as number | null)) {
                    updateMeta({ purchase_year: val });
                  }
                })}
                onBlur={() => {
                  const val = purchaseYear ? parseInt(purchaseYear) : null;
                  if (item && val !== (meta?.purchase_year as number | null)) {
                    updateMeta({ purchase_year: val });
                  }
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>년</span>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                style={{ width: 60, paddingRight: 12 }}
                value={purchaseMonth}
                placeholder={String(currentMonth)}
                min={1}
                max={12}
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setPurchaseMonth(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = purchaseMonth ? parseInt(purchaseMonth) : null;
                  if (item && val !== (meta?.purchase_month as number | null)) {
                    updateMeta({ purchase_month: val });
                  }
                })}
                onBlur={() => {
                  const val = purchaseMonth ? parseInt(purchaseMonth) : null;
                  if (item && val !== (meta?.purchase_month as number | null)) {
                    updateMeta({ purchase_month: val });
                  }
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>월</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>취득가</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={purchasePrice}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setPurchasePrice(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = purchasePrice ? parseInt(purchasePrice) : null;
                  if (item && val !== (meta?.purchase_price as number | null)) {
                    updateMeta({ purchase_price: val });
                  }
                })}
                onBlur={() => {
                  const val = purchasePrice ? parseInt(purchasePrice) : null;
                  if (item && val !== (meta?.purchase_price as number | null)) {
                    updateMeta({ purchase_price: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>주담대</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`${styles.typeBtn} ${!hasLoan ? styles.active : ""}`}
                onClick={() => handleLoanToggle(false)}
              >
                없음
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${hasLoan ? styles.active : ""}`}
                onClick={() => handleLoanToggle(true)}
              >
                있음
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 3 (자가): 관리비 */}
      {housingType === "자가" && (
        <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>관리비</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={maintenanceFee}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setMaintenanceFee(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = maintenanceFee ? parseInt(maintenanceFee) : null;
                  if (item && val !== (meta?.maintenance_fee as number | null)) {
                    updateMeta({ maintenance_fee: val });
                  }
                })}
                onBlur={() => {
                  const val = maintenanceFee ? parseInt(maintenanceFee) : null;
                  if (item && val !== (meta?.maintenance_fee as number | null)) {
                    updateMeta({ maintenance_fee: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원/월</span>
            </div>
          </div>
          <div />
          <div />
        </div>
      )}

      {/* Row 4: 대출금액, 금리, 만기일 */}
      {housingType !== "무상" && hasLoan && (
        <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>대출금액</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={loanAmount}
                placeholder="0"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setLoanAmount(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = loanAmount ? parseInt(loanAmount) : null;
                  if (item && val !== (meta?.loan_amount as number | null)) {
                    updateMeta({ loan_amount: val });
                  }
                })}
                onBlur={() => {
                  const val = loanAmount ? parseInt(loanAmount) : null;
                  if (item && val !== (meta?.loan_amount as number | null)) {
                    updateMeta({ loan_amount: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>만원</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>금리</span>
            <div className={styles.itemCardFieldUnit}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                value={loanRate}
                placeholder="3.5"
                step="0.1"
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setLoanRate(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = loanRate ? parseFloat(loanRate) : null;
                  if (item && val !== (meta?.loan_rate as number | null)) {
                    updateMeta({ loan_rate: val });
                  }
                })}
                onBlur={() => {
                  const val = loanRate ? parseFloat(loanRate) : null;
                  if (item && val !== (meta?.loan_rate as number | null)) {
                    updateMeta({ loan_rate: val });
                  }
                }}
              />
              <span className={styles.itemCardFieldUnitLabel}>%</span>
            </div>
          </div>

          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>만기일</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                style={{ width: 80, paddingRight: 12 }}
                value={maturityYear}
                placeholder={String(currentYear + 20)}
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setMaturityYear(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = maturityYear ? parseInt(maturityYear) : null;
                  if (item && val !== (meta?.loan_maturity_year as number | null)) {
                    updateMeta({ loan_maturity_year: val });
                  }
                })}
                onBlur={() => {
                  const val = maturityYear ? parseInt(maturityYear) : null;
                  if (item && val !== (meta?.loan_maturity_year as number | null)) {
                    updateMeta({ loan_maturity_year: val });
                  }
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>년</span>
              <input
                type="number"
                className={styles.itemCardFieldInput}
                style={{ width: 60, paddingRight: 12 }}
                value={maturityMonth}
                placeholder="12"
                min={1}
                max={12}
                onWheel={e => (e.target as HTMLElement).blur()}
                onChange={(e) => setMaturityMonth(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  const val = maturityMonth ? parseInt(maturityMonth) : null;
                  if (item && val !== (meta?.loan_maturity_month as number | null)) {
                    updateMeta({ loan_maturity_month: val });
                  }
                })}
                onBlur={() => {
                  const val = maturityMonth ? parseInt(maturityMonth) : null;
                  if (item && val !== (meta?.loan_maturity_month as number | null)) {
                    updateMeta({ loan_maturity_month: val });
                  }
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>월</span>
            </div>
          </div>
        </div>
      )}

      {/* Row 4: 상환방식 */}
      {housingType !== "무상" && hasLoan && (
        <div className={styles.itemCardGrid} style={{ marginTop: 8 }}>
          <div className={styles.itemCardField}>
            <span className={styles.itemCardFieldLabel}>상환방식</span>
            <select
              className={styles.itemCardFieldSelect}
              value={repaymentType}
              onChange={(e) => handleRepaymentTypeChange(e.target.value)}
            >
              {REPAYMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export function CurrentAssetTab({ profileId, onNavigate }: CurrentAssetTabProps) {
  const [activeTab, setActiveTab] = useState<TabType>("savings");
  const supabase = createClient();
  const { categoryColors, categoryShades, chartScaleColors } = useChartTheme();

  // 스냅샷 데이터 (항상 오늘)
  const { data: todaySnapshot, isLoading: isSnapshotLoading } = useTodaySnapshot(profileId);
  const currentSnapshot = todaySnapshot;

  const { data: dbItems = [], isLoading: isItemsLoading } = useSnapshotItems(currentSnapshot?.id);

  // 거주용 부동산 편집 상태 - 더 이상 사용 안 함 (카드로 대체)
  const [isEditingResidence, setIsEditingResidence] = useState(false);
  const [editResidence, setEditResidence] = useState<Partial<ResidenceData>>({});

  // 투자용 부동산 편집 상태
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(null);
  const [editInvestment, setEditInvestment] = useState<Partial<InvestmentRealEstateData>>({});

  // 실물 자산 편집 상태
  const [editingRealAssetId, setEditingRealAssetId] = useState<string | null>(null);
  const [editRealAsset, setEditRealAsset] = useState<Partial<RealAssetData>>({});

  // 금융 부채 편집 상태
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editDebt, setEditDebt] = useState<Partial<DebtData>>({});

  // 추가 모달 상태
  const [addModalCategory, setAddModalCategory] = useState<ModalCategory | null>(null);

  // 실제 사용할 items (DB에서 직접)
  const items = dbItems;

  // Mutation 훅
  const createMutation = useCreateSnapshotItem(profileId);
  const updateMutation = useUpdateSnapshotItem(profileId, currentSnapshot?.id || '');
  const deleteMutation = useDeleteSnapshotItem(profileId, currentSnapshot?.id || '');
  const updateSnapshotMutation = useUpdateSnapshot(profileId);

  // 포트폴리오 거래 + 계좌 데이터
  const { data: portfolioTransactions = [], isLoading: isTransactionsLoading } = usePortfolioTransactions(profileId);
  const { data: priceCache, isLoading: isPriceLoading } = usePortfolioChartPriceData(profileId, portfolioTransactions, portfolioTransactions.length > 0);
  const [accounts, setAccounts] = useState<PortfolioAccount[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);

  // 프로필 + 가족 정보
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // 프로필 편집 상태
  const [editingProfileField, setEditingProfileField] = useState<string | null>(null);
  const [editProfileData, setEditProfileData] = useState<{
    name?: string;
    birthYear?: string;
    birthMonth?: string;
    birthDay?: string;
    targetRetirementAge?: string;
  }>({});
  const [editSpouseData, setEditSpouseData] = useState<{
    name?: string;
    birthYear?: string;
    birthMonth?: string;
    birthDay?: string;
  }>({});

  // 프로필 + 가족 정보 로드
  useEffect(() => {
    const loadProfileData = async () => {
      setIsProfileLoading(true);

      // 프로필 데이터
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, name, birth_date, gender, target_retirement_age, target_retirement_fund, settings, created_at, updated_at")
        .eq("id", profileId)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // 가족 구성원 데이터
      const { data: familyData } = await supabase
        .from("family_members")
        .select("*")
        .eq("user_id", profileId)
        .order("relationship", { ascending: true });

      if (familyData) {
        setFamilyMembers(familyData as FamilyMember[]);
      }

      setIsProfileLoading(false);
    };

    loadProfileData();
  }, [profileId, supabase]);

  // 가계 단위 여부 (배우자 존재 여부)
  const isCouple = familyMembers.some(m => m.relationship === "spouse");
  const spouse = familyMembers.find(m => m.relationship === "spouse");

  // 가계/개인 모드 전환 모달
  const [showPlanningModeModal, setShowPlanningModeModal] = useState(false);

  // 가계/개인 모드 전환 실행
  const confirmPlanningModeChange = async () => {
    // 모달 먼저 닫기
    setShowPlanningModeModal(false);

    if (isCouple) {
      // 배우자 삭제 - optimistic update
      const spouseId = spouse?.id;
      setFamilyMembers(prev => prev.filter(m => m.id !== spouseId));
      // 백그라운드에서 DB 업데이트
      if (spouseId) {
        supabase.from("family_members").delete().eq("id", spouseId);
      }
    } else {
      // 배우자 추가 - optimistic update
      const tempId = `temp-${Date.now()}`;
      const newSpouse = {
        id: tempId,
        user_id: profileId,
        relationship: "spouse" as const,
        name: "배우자",
        gender: "female" as const,
        birth_date: null,
        is_dependent: false,
        is_working: true,
        retirement_age: null,
        monthly_income: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as FamilyMember;
      setFamilyMembers(prev => [...prev, newSpouse]);
      // 백그라운드에서 DB 업데이트
      const { data } = await supabase
        .from("family_members")
        .insert({
          user_id: profileId,
          relationship: "spouse",
          name: "배우자",
          gender: "female",
        })
        .select()
        .single();
      // 실제 ID로 교체
      if (data) {
        setFamilyMembers(prev => prev.map(m => m.id === tempId ? data as FamilyMember : m));
      }
    }
  };

  // 본인 정보 수정 시작
  const startEditProfile = () => {
    const bd = profile?.birth_date ? new Date(profile.birth_date) : null;
    setEditProfileData({
      name: profile?.name || "",
      birthYear: bd ? String(bd.getFullYear()) : "",
      birthMonth: bd ? String(bd.getMonth() + 1) : "",
      birthDay: bd ? String(bd.getDate()) : "",
      targetRetirementAge: String(profile?.target_retirement_age || 60),
    });
    setEditingProfileField("profile");
  };

  // 본인 정보 저장
  const saveProfile = async () => {
    if (!profile) return;
    const birthDate = editProfileData.birthYear && editProfileData.birthMonth && editProfileData.birthDay
      ? `${editProfileData.birthYear}-${String(editProfileData.birthMonth).padStart(2, '0')}-${String(editProfileData.birthDay).padStart(2, '0')}`
      : null;

    const { data } = await supabase
      .from("profiles")
      .update({
        name: editProfileData.name || null,
        birth_date: birthDate,
        target_retirement_age: parseInt(editProfileData.targetRetirementAge || "60"),
      })
      .eq("id", profileId)
      .select()
      .single();

    if (data) {
      setProfile(data as Profile);
    }
    setEditingProfileField(null);
  };

  // 배우자 정보 수정 시작
  const startEditSpouse = () => {
    const bd = spouse?.birth_date ? new Date(spouse.birth_date) : null;
    setEditSpouseData({
      name: spouse?.name || "",
      birthYear: bd ? String(bd.getFullYear()) : "",
      birthMonth: bd ? String(bd.getMonth() + 1) : "",
      birthDay: bd ? String(bd.getDate()) : "",
    });
    setEditingProfileField("spouse");
  };

  // 배우자 정보 저장
  const saveSpouse = async () => {
    if (!spouse) return;
    const birthDate = editSpouseData.birthYear && editSpouseData.birthMonth && editSpouseData.birthDay
      ? `${editSpouseData.birthYear}-${String(editSpouseData.birthMonth).padStart(2, '0')}-${String(editSpouseData.birthDay).padStart(2, '0')}`
      : null;

    const { data } = await supabase
      .from("family_members")
      .update({
        name: editSpouseData.name || null,
        birth_date: birthDate,
      })
      .eq("id", spouse.id)
      .select()
      .single();

    if (data) {
      setFamilyMembers(prev => prev.map(m => m.id === spouse.id ? data as FamilyMember : m));
    }
    setEditingProfileField(null);
  };

  // 증권 계좌 로드
  useEffect(() => {
    const loadAccounts = async () => {
      setIsAccountsLoading(true);
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .order("is_default", { ascending: false });
      if (data) setAccounts(data);
      setIsAccountsLoading(false);
    };
    loadAccounts();
  }, [profileId, supabase]);

  // 저축 연동: 입출금 계좌 + 정기 예금/적금 계좌 + 거래 내역
  const [checkingAccounts, setCheckingAccounts] = useState<Account[]>([]);
  const [termDepositAccounts, setTermDepositAccounts] = useState<Account[]>([]);
  const [budgetTransactions, setBudgetTransactions] = useState<{ account_id: string | null; type: string; amount: number }[]>([]);
  const [isSavingsAccountsLoading, setIsSavingsAccountsLoading] = useState(true);

  // 현재 연/월
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    const loadSavingsAccounts = async () => {
      setIsSavingsAccountsLoading(true);
      try {
        // 입출금 계좌 (checking만)
        const { data: checkingData } = await supabase
          .from("accounts")
          .select("*")
          .eq("profile_id", profileId)
          .eq("is_active", true)
          .eq("account_type", "checking")
          .order("is_default", { ascending: false });
        if (checkingData) setCheckingAccounts(checkingData);

        // 정기 예금/적금 계좌
        const termData = await getTermDepositAccounts(profileId);
        setTermDepositAccounts(termData);

        // 잔액 계산용 거래 로드 (balance_updated_at 이후 모든 거래)
        const balanceDates = (checkingData || [])
          .filter((a: Account) => a.balance_updated_at)
          .map((a: Account) => new Date(a.balance_updated_at!));

        let txData: any[] = [];
        if (balanceDates.length === 0) {
          // No balance_updated_at, load all transactions
          const { data } = await supabase
            .from("budget_transactions")
            .select("*")
            .eq("profile_id", profileId)
            .order("year", { ascending: true })
            .order("month", { ascending: true });
          txData = data || [];
        } else {
          const oldestDate = new Date(Math.min(...balanceDates.map((d: Date) => d.getTime())));
          const oldestYear = oldestDate.getFullYear();
          const oldestMonth = oldestDate.getMonth() + 1;
          const { data } = await supabase
            .from("budget_transactions")
            .select("*")
            .eq("profile_id", profileId)
            .or(`year.gt.${oldestYear},and(year.eq.${oldestYear},month.gte.${oldestMonth})`)
            .order("year", { ascending: true })
            .order("month", { ascending: true });
          txData = data || [];
        }
        setBudgetTransactions(txData.map((tx: any) => ({
          account_id: tx.account_id,
          type: tx.type,
          amount: tx.amount,
          year: tx.year,
          month: tx.month,
          day: tx.day,
        })));
      } catch (error) {
        console.error("Failed to load savings accounts:", error);
      } finally {
        setIsSavingsAccountsLoading(false);
      }
    };
    loadSavingsAccounts();
  }, [profileId, supabase]);

  // 계좌별 누적 잔액 계산 (유틸리티 함수 사용)
  const accountBalanceInfo = useMemo(() => {
    return calculateAccountBalances(checkingAccounts, budgetTransactions);
  }, [checkingAccounts, budgetTransactions]);

  // 저축 계좌별 데이터 계산 (원 단위, 거래 반영한 예상 잔액)
  const savingsAccountValues = useMemo(() => {
    const values: { id: string; type: string; name: string; broker: string; value: number }[] = [];

    // 입출금 계좌 (원 단위) - 유틸리티 함수 사용
    checkingAccounts.forEach(acc => {
      values.push({
        id: acc.id,
        type: "checking",
        name: acc.name,
        broker: acc.broker_name,
        value: accountBalanceInfo[acc.id]?.expectedBalance ?? (acc.current_balance || 0),
      });
    });

    // 정기 예금/적금 (원 단위)
    termDepositAccounts.forEach(acc => {
      values.push({
        id: acc.id,
        type: acc.account_type,
        name: acc.name,
        broker: acc.broker_name,
        value: calculateTermDepositValue(acc),
      });
    });

    return values;
  }, [checkingAccounts, termDepositAccounts, accountBalanceInfo]);

  // 저축 총액 (연동) - 원 단위
  const linkedSavingsTotalWon = useMemo(() => {
    return savingsAccountValues.reduce((sum, acc) => sum + acc.value, 0);
  }, [savingsAccountValues]);

  // 저축 총액 (만원 단위 - 다른 섹션과 일관성 유지)
  const linkedSavingsTotal = useMemo(() => {
    return Math.round(linkedSavingsTotalWon / 10000);
  }, [linkedSavingsTotalWon]);


  const isLoading = isSnapshotLoading || isItemsLoading;
  const isInvestmentDataReady = !isTransactionsLoading && !isPriceLoading && !isAccountsLoading;
  const isSavingsDataReady = !isSavingsAccountsLoading;

  // 증권 계좌별 평가금액 계산 (유틸리티 함수 사용)
  const accountValues = useMemo(() => {
    return calculatePortfolioAccountValuesDetailed(portfolioTransactions, priceCache, accounts);
  }, [portfolioTransactions, accounts, priceCache]);

  // 기타 투자 항목 (실물 금, 채권 등)
  const otherInvestmentItems = useMemo(() => {
    const investmentTypes = ITEM_TYPES.investment.map(t => t.value);
    return items.filter(i => i.category === "asset" && investmentTypes.includes(i.item_type));
  }, [items]);

  // 기타 투자 합계 (원 단위) - DB는 만원 단위이므로 x10000
  const otherInvestmentTotalWon = useMemo(() => {
    return otherInvestmentItems.reduce((sum, item) => sum + item.amount * 10000, 0);
  }, [otherInvestmentItems]);

  // 투자 총액 (원 단위) = 포트폴리오 + 기타 투자
  const investmentTotalWon = useMemo(() => {
    let total = 0;
    accountValues.forEach(v => {
      total += v.value;
    });
    return Math.round(total) + otherInvestmentTotalWon;
  }, [accountValues, otherInvestmentTotalWon]);

  // 카테고리별 합계 계산
  const totals = useMemo(() => {
    // 저축: 연동된 계좌 데이터 사용 (입출금 + 정기예금/적금)
    const savings = linkedSavingsTotal;

    // 투자: 포트폴리오 + 기타 투자 합계 (만원 단위로 변환)
    let portfolioTotal = 0;
    accountValues.forEach(v => {
      portfolioTotal += v.value; // 평가금액 사용
    });
    const otherInvestment = otherInvestmentItems.reduce((sum, item) => sum + item.amount, 0);
    const investment = Math.round(portfolioTotal / 10000) + otherInvestment;

    // 부동산: 거주용 + 투자용
    // 거주용: 자가(시세), 전세/월세(보증금) - 무상 제외
    const residenceItems = items
      .filter(i => i.category === "asset" &&
              (i.metadata as Record<string, unknown>)?.purpose === "residential" &&
              (i.metadata as Record<string, unknown>)?.housing_type !== "무상");

    const residenceGross = residenceItems.reduce((sum, i) => sum + i.amount, 0);
    const residenceLoan = residenceItems.reduce((sum, i) => {
      const meta = i.metadata as Record<string, unknown>;
      return sum + ((meta?.has_loan && meta?.loan_amount) ? (meta.loan_amount as number) : 0);
    }, 0);

    // 투자용 부동산
    const investmentItems = items
      .filter(i => i.category === "asset" &&
              ((i.metadata as Record<string, unknown>)?.purpose === "investment" ||
               ["real_estate", "apartment", "house", "officetel", "land", "commercial"].includes(i.item_type)))
      .filter(i => (i.metadata as Record<string, unknown>)?.purpose !== "residential"); // 거주용 제외

    const investmentRealEstateGross = investmentItems.reduce((sum, i) => sum + i.amount, 0);
    const investmentRealEstateLoan = investmentItems.reduce((sum, i) => {
      const meta = i.metadata as Record<string, unknown>;
      return sum + ((meta?.has_loan && meta?.loan_amount) ? (meta.loan_amount as number) : 0);
    }, 0);

    const realEstateGross = residenceGross + investmentRealEstateGross;
    const realEstateLoan = residenceLoan + investmentRealEstateLoan;
    const realEstate = realEstateGross - realEstateLoan; // 순자산

    // 실물 자산: 자동차, 귀금속, 미술품 등
    const realAssetItems = items.filter(i => i.category === "asset" && ["car", "precious_metal", "art", "other"].includes(i.item_type));

    const realAssetGross = realAssetItems.reduce((sum, i) => sum + i.amount, 0);
    const realAssetInstallment = realAssetItems.reduce((sum, i) => {
      const meta = i.metadata as Record<string, unknown>;
      return sum + ((meta?.has_installment && meta?.installment_balance) ? (meta.installment_balance as number) : 0);
    }, 0);
    const realAsset = realAssetGross - realAssetInstallment; // 순자산

    // 금융 부채: 담보대출/할부 제외 (자산에 연결된 부채 제외)
    const debt = items
      .filter(i => i.category === "debt")
      .filter(i => {
        const meta = i.metadata as Record<string, unknown>;
        // source가 있으면 자산에 연결된 부채 (담보대출/할부)
        return !meta?.source;
      })
      .reduce((sum, i) => sum + i.amount, 0);

    const totalAssets = savings + investment + realEstate + realAsset;
    const netWorth = totalAssets - debt;

    return {
      savings, investment,
      realEstate, realEstateGross, realEstateLoan,
      realAsset, realAssetGross, realAssetInstallment,
      debt, totalAssets, netWorth
    };
  }, [items, accountValues, linkedSavingsTotal]);

  // 스냅샷 합계 자동 저장 (totals가 변경될 때마다)
  // 모든 데이터가 로드된 후에만 저장 (로딩 중에 0 값으로 저장되는 것 방지)
  const lastSavedTotalsRef = useRef<string>("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingItemsRef = useRef<boolean>(false); // 아이템 저장 중 플래그
  const isDataReady = !isLoading && isInvestmentDataReady && isSavingsDataReady;

  // 스냅샷 totals 저장 함수 (명시적 호출용)
  const saveSnapshotTotals = useCallback(() => {
    if (!currentSnapshot || !isDataReady) return;

    updateSnapshotMutation.mutate({
      id: currentSnapshot.id,
      updates: {
        savings: totals.savings,
        investments: totals.investment,
        real_estate: totals.realEstate,
        real_assets: totals.realAsset,
        total_assets: totals.totalAssets,
        total_debts: totals.debt,
        unsecured_debt: totals.debt,
        net_worth: totals.netWorth,
      },
    });
    lastSavedTotalsRef.current = `${totals.savings}-${totals.investment}-${totals.realEstate}-${totals.realAsset}-${totals.debt}`;
  }, [currentSnapshot, totals, updateSnapshotMutation, isDataReady]);

  useEffect(() => {
    if (!currentSnapshot) return;
    if (!isDataReady) return; // 데이터 로딩 중에는 저장하지 않음
    if (isSavingItemsRef.current) return; // 아이템 저장 중에는 자동 저장 스킵

    const totalsKey = `${totals.savings}-${totals.investment}-${totals.realEstate}-${totals.realAsset}-${totals.debt}`;
    if (totalsKey === lastSavedTotalsRef.current) return;

    // 이전 저장 타이머 취소 (debounce)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 500ms 후에 저장 (모든 mutation이 완료된 후 저장)
    saveTimeoutRef.current = setTimeout(() => {
      if (isSavingItemsRef.current) return; // 다시 한번 체크
      saveSnapshotTotals();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentSnapshot, totals, isDataReady, saveSnapshotTotals]);

  // 현재 탭의 항목들
  const currentItems = useMemo(() => {
    if (activeTab === "profile") return [];
    const typeValues = ITEM_TYPES[activeTab].map(t => t.value);
    // realEstate는 기존 real_estate도 포함
    const additionalTypes = activeTab === "realEstate" ? ["real_estate"] : [];
    const allTypes = [...typeValues, ...additionalTypes];
    const category = activeTab === "debt" ? "debt" : "asset";

    let filtered = items.filter(i => i.category === category && allTypes.includes(i.item_type));

    // 부채 탭에서는 자산에 연결된 부채 제외 (금융 부채만 표시)
    if (activeTab === "debt") {
      filtered = filtered.filter(i => {
        const meta = i.metadata as Record<string, unknown>;
        return !meta?.source; // source가 없는 것만 (금융 부채)
      });
    }

    return filtered;
  }, [items, activeTab]);

  // 차트 데이터 - 순자산 (메인) - 부채 포함
  const hasData = totals.savings > 0 || totals.investment > 0 || totals.realEstate > 0 || totals.realAsset > 0 || totals.debt > 0;
  const chartData = {
    labels: hasData ? ["저축", "투자", "부동산", "실물 자산", "금융 부채"] : ["데이터 없음"],
    datasets: [{
      data: hasData
        ? [totals.savings || 0.01, totals.investment || 0.01, totals.realEstate || 0.01, totals.realAsset || 0.01, totals.debt || 0.01]
        : [1],
      backgroundColor: hasData
        ? [categoryColors.savings, categoryColors.investment, categoryColors.realEstate, categoryColors.realAsset, categoryColors.debt]
        : [chartScaleColors.emptyState],
      borderWidth: 3,
      borderColor: chartScaleColors.doughnutBorder,
    }],
  };

  // 부동산 유형별 데이터
  const realEstateBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>();
    items
      .filter(i => i.category === "asset" && ["real_estate", "apartment", "house", "officetel", "land", "commercial"].includes(i.item_type))
      .forEach(item => {
        const current = breakdown.get(item.item_type) || 0;
        breakdown.set(item.item_type, current + item.amount);
      });
    return breakdown;
  }, [items]);

  const realEstateChartData = useMemo(() => {
    const hasRealEstate = totals.realEstate > 0;
    const entries = Array.from(realEstateBreakdown.entries()).filter(([, amount]) => amount > 0);

    return {
      labels: hasRealEstate ? entries.map(([type]) => ITEM_TYPES.realEstate.find(t => t.value === type)?.label || type) : ["데이터 없음"],
      datasets: [{
        data: hasRealEstate ? entries.map(([, amount]) => amount) : [1],
        backgroundColor: hasRealEstate ? categoryShades.realEstate.slice(0, entries.length) : [chartScaleColors.emptyState],
        borderWidth: 0,
      }],
    };
  }, [realEstateBreakdown, totals.realEstate, categoryShades.realEstate]);

  // 실물 자산 유형별 데이터 (부동산 제외)
  const realAssetBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>();
    items
      .filter(i => i.category === "asset" && ["car", "precious_metal", "art", "other"].includes(i.item_type))
      .forEach(item => {
        const current = breakdown.get(item.item_type) || 0;
        breakdown.set(item.item_type, current + item.amount);
      });
    return breakdown;
  }, [items]);

  const realAssetChartData = useMemo(() => {
    const hasRealAsset = totals.realAsset > 0;
    const entries = Array.from(realAssetBreakdown.entries()).filter(([, amount]) => amount > 0);

    return {
      labels: hasRealAsset ? entries.map(([type]) => ITEM_TYPES.realAsset.find(t => t.value === type)?.label || type) : ["데이터 없음"],
      datasets: [{
        data: hasRealAsset ? entries.map(([, amount]) => amount) : [1],
        backgroundColor: hasRealAsset ? categoryShades.realAsset.slice(0, entries.length) : [chartScaleColors.emptyState],
        borderWidth: 0,
      }],
    };
  }, [realAssetBreakdown, totals.realAsset, categoryShades.realAsset]);

  // 부채 유형별 데이터
  const debtBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>();
    items
      .filter(i => i.category === "debt")
      .forEach(item => {
        const current = breakdown.get(item.item_type) || 0;
        breakdown.set(item.item_type, current + item.amount);
      });
    return breakdown;
  }, [items]);

  const debtChartData = useMemo(() => {
    const hasDebt = totals.debt > 0;
    const entries = Array.from(debtBreakdown.entries()).filter(([, amount]) => amount > 0);

    return {
      labels: hasDebt ? entries.map(([type]) => ITEM_TYPES.debt.find(t => t.value === type)?.label || type) : ["데이터 없음"],
      datasets: [{
        data: hasDebt ? entries.map(([, amount]) => amount) : [1],
        backgroundColor: hasDebt ? categoryShades.debt.slice(0, entries.length) : [chartScaleColors.emptyState],
        borderWidth: 2,
        borderColor: chartScaleColors.doughnutBorder,
      }],
    };
  }, [debtBreakdown, totals.debt, categoryShades.debt]);

  // 금융 자산 차트 (저축 계좌들 + 투자 계좌들 세부)
  const cashAssetChartData = useMemo(() => {
    const cashItems: { label: string; value: number; color: string }[] = [];

    // 저축 계좌들
    savingsAccountValues.forEach((acc, idx) => {
      if (acc.value > 0) {
        cashItems.push({
          label: acc.name,
          value: Math.round(acc.value / 10000), // 원 -> 만원
          color: categoryShades.savings[idx % categoryShades.savings.length],
        });
      }
    });

    // 투자 계좌들
    Array.from(accountValues.entries()).forEach(([, data], idx) => {
      if (data.value > 0) {
        cashItems.push({
          label: data.accountName,
          value: Math.round(data.value / 10000), // 원 -> 만원
          color: categoryShades.investment[idx % categoryShades.investment.length],
        });
      }
    });

    const total = totals.savings + totals.investment;
    const hasData = cashItems.length > 0;

    return {
      labels: hasData ? cashItems.map(i => i.label) : ["데이터 없음"],
      datasets: [{
        data: hasData ? cashItems.map(i => i.value) : [1],
        backgroundColor: hasData ? cashItems.map(i => i.color) : [chartScaleColors.emptyState],
        borderWidth: 2,
        borderColor: chartScaleColors.doughnutBorder,
      }],
      total,
    };
  }, [savingsAccountValues, accountValues, totals.savings, totals.investment, categoryShades.savings, categoryShades.investment, chartScaleColors]);

  // 실물 자산 차트 (부동산 + 실물 자산 세부 항목)
  const realAssetTotalChartData = useMemo(() => {
    const realItems: { label: string; value: number; color: string }[] = [];

    // 부동산 항목들
    items
      .filter(i => i.category === "asset" &&
        ((i.metadata as Record<string, unknown>)?.purpose === "residential" ||
         (i.metadata as Record<string, unknown>)?.purpose === "investment" ||
         ["apartment", "house", "officetel", "land", "commercial"].includes(i.item_type)))
      .forEach((item, idx) => {
        const meta = item.metadata as Record<string, unknown>;
        const loanAmount = (meta?.has_loan && meta?.loan_amount) ? (meta.loan_amount as number) : 0;
        const netValue = item.amount - loanAmount;
        if (netValue > 0) {
          const label = item.title || (meta?.housing_type as string) || ITEM_TYPES.realEstate.find(t => t.value === item.item_type)?.label || item.item_type;
          realItems.push({
            label,
            value: netValue,
            color: categoryShades.realEstate[idx % categoryShades.realEstate.length],
          });
        }
      });

    // 실물 자산 항목들
    items
      .filter(i => i.category === "asset" && ["car", "precious_metal", "art", "other"].includes(i.item_type))
      .forEach((item, idx) => {
        const meta = item.metadata as Record<string, unknown>;
        const installment = (meta?.has_installment && meta?.installment_balance) ? (meta.installment_balance as number) : 0;
        const netValue = item.amount - installment;
        if (netValue > 0) {
          const label = item.title || ITEM_TYPES.realAsset.find(t => t.value === item.item_type)?.label || item.item_type;
          realItems.push({
            label,
            value: netValue,
            color: categoryShades.realAsset[idx % categoryShades.realAsset.length],
          });
        }
      });

    const total = totals.realEstate + totals.realAsset;
    const hasData = realItems.length > 0;

    return {
      labels: hasData ? realItems.map(i => i.label) : ["데이터 없음"],
      datasets: [{
        data: hasData ? realItems.map(i => i.value) : [1],
        backgroundColor: hasData ? realItems.map(i => i.color) : [chartScaleColors.emptyState],
        borderWidth: 2,
        borderColor: chartScaleColors.doughnutBorder,
      }],
      total,
    };
  }, [items, totals.realEstate, totals.realAsset, categoryShades.realEstate, categoryShades.realAsset, chartScaleColors]);

  // 총 부채 차트 (모든 부채 세부 항목)
  const totalDebtChartData = useMemo(() => {
    const debtItems: { label: string; value: number; color: string }[] = [];

    // 모든 부채 항목
    items
      .filter(i => i.category === "debt")
      .forEach((item, idx) => {
        if (item.amount > 0) {
          const label = item.title || ITEM_TYPES.debt.find(t => t.value === item.item_type)?.label || item.item_type;
          debtItems.push({
            label,
            value: item.amount,
            color: categoryShades.debt[idx % categoryShades.debt.length],
          });
        }
      });

    const total = totals.debt + totals.realEstateLoan + totals.realAssetInstallment;
    const hasData = debtItems.length > 0;

    return {
      labels: hasData ? debtItems.map(i => i.label) : ["데이터 없음"],
      datasets: [{
        data: hasData ? debtItems.map(i => i.value) : [1],
        backgroundColor: hasData ? debtItems.map(i => i.color) : [chartScaleColors.emptyState],
        borderWidth: 2,
        borderColor: chartScaleColors.doughnutBorder,
      }],
      total,
    };
  }, [items, totals.debt, totals.realEstateLoan, totals.realAssetInstallment, categoryShades.debt, chartScaleColors]);

  // 서브 차트용 옵션 (커스텀 툴팁)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createSubChartOptions = (tooltipId: string): any => ({
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        external: (context: any) => {
          const { chart, tooltip } = context;

          // 차트 섹션 전체를 컨테이너로 사용 (overflow 문제 해결)
          const chartSection = chart.canvas.closest(`.${styles.chartSection}`) as HTMLElement;
          if (!chartSection) return;

          let tooltipEl = chartSection.querySelector(`#${tooltipId}`) as HTMLDivElement | null;

          if (!tooltipEl) {
            tooltipEl = document.createElement("div");
            tooltipEl.id = tooltipId;
            chartSection.style.position = "relative";
            chartSection.appendChild(tooltipEl);
          }

          if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = "0";
            tooltipEl.style.pointerEvents = "none";
            return;
          }

          // 인라인 스타일 직접 적용 (backdrop-filter 포함)
          Object.assign(tooltipEl.style, {
            position: "absolute",
            pointerEvents: "none",
            background: "rgba(255, 255, 255, 0.5)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: "1px solid rgba(255, 255, 255, 0.5)",
            borderRadius: "10px",
            padding: "12px 16px",
            fontSize: "13px",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            transition: "opacity 0.15s ease",
            zIndex: "1000",
          });

          // 내용 구성
          let html = "";
          if (tooltip.dataPoints && tooltip.dataPoints.length > 0) {
            const point = tooltip.dataPoints[0];
            const label = point.label;
            const value = point.raw as number;
            const bgColor = Array.isArray(point.dataset.backgroundColor)
              ? point.dataset.backgroundColor[point.dataIndex]
              : point.dataset.backgroundColor;

            html = `<div style="display:flex;align-items:center;gap:8px;">
              <span style="width:10px;height:10px;border-radius:50%;background:${bgColor};flex-shrink:0;"></span>
              <span style="color:#374151;font-weight:500;">${label}</span>
              <span style="color:#1a1a1a;font-weight:600;margin-left:4px;">${formatMoney(value)}</span>
            </div>`;
          }

          tooltipEl.innerHTML = html;
          tooltipEl.style.opacity = "1";

          // 마우스 위치 기반으로 툴팁 위치 계산
          const sectionRect = chartSection.getBoundingClientRect();
          const tooltipWidth = tooltipEl.offsetWidth;
          const tooltipHeight = tooltipEl.offsetHeight;

          // 마우스 이벤트에서 실제 커서 위치 가져오기
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mouseEvent = (chart as any)._lastEvent?.native as MouseEvent | undefined;

          let left: number;
          let top: number;

          if (mouseEvent) {
            // 마우스 위치 기준 (툴팁을 마우스 오른쪽 위에 표시)
            left = mouseEvent.clientX - sectionRect.left + 15;
            top = mouseEvent.clientY - sectionRect.top - tooltipHeight - 10;
          } else {
            // fallback: caret 위치 사용
            const canvasRect = chart.canvas.getBoundingClientRect();
            left = (canvasRect.left - sectionRect.left) + tooltip.caretX;
            top = (canvasRect.top - sectionRect.top) + tooltip.caretY - tooltipHeight - 10;
          }

          // 상단 오버플로우 체크
          if (top < 10) {
            top = (mouseEvent?.clientY ?? 0) - sectionRect.top + 15;
          }

          // 좌우 오버플로우 체크
          if (left + tooltipWidth > sectionRect.width - 10) {
            left = (mouseEvent?.clientX ?? sectionRect.width) - sectionRect.left - tooltipWidth - 15;
          }
          if (left < 10) {
            left = 10;
          }

          tooltipEl.style.left = left + "px";
          tooltipEl.style.top = top + "px";
        },
      },
    },
    maintainAspectRatio: false,
    cutout: "85%",
  });

  const cashChartOptions = createSubChartOptions("cash-asset-tooltip");
  const realChartOptions = createSubChartOptions("real-asset-tooltip");
  const debtChartOptions = createSubChartOptions("debt-tooltip");
  const chartOptions = createSubChartOptions("main-asset-tooltip");

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  // 항목 추가 (DB에 바로 저장)
  const handleAddItem = async () => {
    if (!currentSnapshot) return;
    if (activeTab === "profile" || activeTab === "savings" || activeTab === "investment") return;
    if (createMutation.isPending) return; // 중복 클릭 방지

    const category = activeTab === "debt" ? "debt" : "asset";
    const defaultType = ITEM_TYPES[activeTab][0].value;

    const newItem = await createMutation.mutateAsync({
      snapshot_id: currentSnapshot.id,
      category,
      item_type: defaultType,
      title: "",
      amount: 0,
      owner: "self",
    });

    // 부채 탭이면 새로 추가된 항목 바로 편집 모드로
    if (newItem && activeTab === "debt") {
      startEditDebt(newItem.id);
    }
  };

  // 항목 업데이트 (DB에 바로 저장)
  const handleUpdateItem = async (id: string, updates: Partial<FinancialSnapshotItem>) => {
    // undefined 값은 제외하고 실제 업데이트할 필드만 전달
    const cleanUpdates: Partial<FinancialSnapshotItem> = {};
    if (updates.item_type !== undefined) cleanUpdates.item_type = updates.item_type;
    if (updates.title !== undefined) cleanUpdates.title = updates.title;
    if (updates.amount !== undefined) cleanUpdates.amount = updates.amount;
    if (updates.metadata !== undefined) cleanUpdates.metadata = updates.metadata;

    await updateMutation.mutateAsync({
      id,
      updates: cleanUpdates,
    });
  };

  // 항목 삭제 (DB에서 바로 삭제)
  const handleDeleteItem = async (id: string) => {
    if (deleteMutation.isPending) return; // 중복 클릭 방지
    await deleteMutation.mutateAsync(id);
  };

  // 부동산 추가 (투자용) - DB에 바로 저장
  const handleAddInvestmentRealEstate = async (itemType: string) => {
    if (!currentSnapshot) return;
    if (createMutation.isPending) return;

    const typeConfig = MODAL_ITEMS.realEstate.items.find(i => i.value === itemType);
    const newItem = await createMutation.mutateAsync({
      snapshot_id: currentSnapshot.id,
      category: "asset",
      item_type: itemType,
      title: typeConfig?.label || "",
      amount: 0,
      owner: "self",
      metadata: { purpose: "investment" },
    });

    if (newItem) {
      startEditInvestment(newItem.id);
    }
  };

  // 투자용 부동산 편집 시작
  const startEditInvestment = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const meta = item.metadata as Record<string, unknown>;
    setEditInvestment({
      id: item.id,
      itemType: item.item_type,
      title: item.title,
      purchasePrice: (meta?.purchase_price as number) || null,
      currentValue: item.amount || 0,
      purchaseYear: (meta?.purchase_year as number) || null,
      purchaseMonth: (meta?.purchase_month as number) || null,
      hasLoan: (meta?.has_loan as boolean) || false,
      loanAmount: (meta?.loan_amount as number) || null,
      loanRate: (meta?.loan_rate as number) || null,
      loanMaturityYear: (meta?.loan_maturity_year as number) || null,
      loanMaturityMonth: (meta?.loan_maturity_month as number) || null,
      loanRepaymentType: (meta?.loan_repayment_type as RepaymentType) || null,
    });
    setEditingInvestmentId(id);
  };

  // 투자용 부동산 저장
  const saveInvestment = () => {
    if (!currentSnapshot || !editingInvestmentId) return;

    const itemId = editingInvestmentId;
    const editData = { ...editInvestment };

    // 폼 즉시 닫기 (optimistic update)
    setEditingInvestmentId(null);
    setEditInvestment({});

    // 아이템 저장 중 플래그 설정 (자동 저장 방지)
    isSavingItemsRef.current = true;

    const metadata = {
      purpose: "investment",
      purchase_price: editData.purchasePrice,
      purchase_year: editData.purchaseYear,
      purchase_month: editData.purchaseMonth,
      has_loan: editData.hasLoan,
      loan_amount: editData.hasLoan ? editData.loanAmount : null,
      loan_rate: editData.hasLoan ? editData.loanRate : null,
      loan_maturity_year: editData.hasLoan ? editData.loanMaturityYear : null,
      loan_maturity_month: editData.hasLoan ? editData.loanMaturityMonth : null,
      loan_repayment_type: editData.hasLoan ? editData.loanRepaymentType : null,
    };

    // 부동산 항목 업데이트 (백그라운드)
    updateMutation.mutate({
      id: itemId,
      updates: {
        item_type: editData.itemType,
        title: editData.title,
        amount: editData.currentValue || 0,
        metadata,
      },
    });

    // 대출이 있으면 부채에 추가/업데이트
    if (editData.hasLoan && editData.loanAmount) {
      const existingDebt = items.find(
        item => item.category === "debt" &&
                (item.metadata as Record<string, unknown>)?.source === `investment-${itemId}`
      );

      const debtMetadata = {
        source: `investment-${itemId}`,
        loan_rate: editData.loanRate,
        loan_maturity_year: editData.loanMaturityYear,
        loan_maturity_month: editData.loanMaturityMonth,
        loan_repayment_type: editData.loanRepaymentType,
      };

      if (existingDebt) {
        updateMutation.mutate({
          id: existingDebt.id,
          updates: {
            title: `${editData.title || '투자용 부동산'} 담보대출`,
            amount: editData.loanAmount,
            metadata: debtMetadata,
          },
        });
      } else {
        createMutation.mutate({
          snapshot_id: currentSnapshot.id,
          category: "debt",
          item_type: "mortgage",
          title: `${editData.title || '투자용 부동산'} 담보대출`,
          amount: editData.loanAmount,
          owner: "self",
          metadata: debtMetadata,
        });
      }
    } else {
      // 대출이 없으면 기존 연동 부채 삭제
      const existingDebt = items.find(
        item => item.category === "debt" &&
                (item.metadata as Record<string, unknown>)?.source === `investment-${itemId}`
      );
      if (existingDebt) {
        deleteMutation.mutate(existingDebt.id);
      }
    }

    // 모든 mutation 완료 후 스냅샷 totals 저장 (1초 대기)
    setTimeout(() => {
      isSavingItemsRef.current = false;
      saveSnapshotTotals();
    }, 1000);
  };

  // 투자용 부동산 편집 취소
  const cancelEditInvestment = () => {
    setEditingInvestmentId(null);
    setEditInvestment({});
  };

  // 실물 자산 추가 - DB에 바로 저장
  const handleAddRealAsset = async (itemType: string) => {
    if (!currentSnapshot) return;
    if (createMutation.isPending) return;

    const typeConfig = MODAL_ITEMS.realAsset.items.find(i => i.value === itemType);
    const newItem = await createMutation.mutateAsync({
      snapshot_id: currentSnapshot.id,
      category: "asset",
      item_type: itemType,
      title: typeConfig?.label || "",
      amount: 0,
      owner: "self",
    });

    if (newItem) {
      startEditRealAsset(newItem.id);
    }
  };

  // 실물 자산 편집 시작
  const startEditRealAsset = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const meta = item.metadata as Record<string, unknown>;
    setEditRealAsset({
      id: item.id,
      itemType: item.item_type,
      title: item.title,
      purchasePrice: (meta?.purchase_price as number) || null,
      currentValue: item.amount || 0,
      hasLoan: (meta?.has_loan as boolean) || false,
      loanAmount: (meta?.loan_amount as number) || null,
      loanRate: (meta?.loan_rate as number) || null,
      loanMaturityYear: (meta?.loan_maturity_year as number) || null,
      loanMaturityMonth: (meta?.loan_maturity_month as number) || null,
      loanRepaymentType: (meta?.loan_repayment_type as RepaymentType) || null,
    });
    setEditingRealAssetId(id);
  };

  // 실물 자산 저장
  const saveRealAsset = () => {
    if (!currentSnapshot || !editingRealAssetId) return;

    const itemId = editingRealAssetId;
    const editData = { ...editRealAsset };

    // 폼 즉시 닫기 (optimistic update)
    setEditingRealAssetId(null);
    setEditRealAsset({});

    // 아이템 저장 중 플래그 설정 (자동 저장 방지)
    isSavingItemsRef.current = true;

    const metadata = {
      purchase_price: editData.purchasePrice,
      has_loan: editData.hasLoan,
      loan_amount: editData.hasLoan ? editData.loanAmount : null,
      loan_rate: editData.hasLoan ? editData.loanRate : null,
      loan_maturity_year: editData.hasLoan ? editData.loanMaturityYear : null,
      loan_maturity_month: editData.hasLoan ? editData.loanMaturityMonth : null,
      loan_repayment_type: editData.hasLoan ? editData.loanRepaymentType : null,
    };

    // 실물 자산 항목 업데이트 (백그라운드)
    updateMutation.mutate({
      id: itemId,
      updates: {
        item_type: editData.itemType,
        title: editData.title,
        amount: editData.currentValue || 0,
        metadata,
      },
    });

    // 담보대출이 있으면 부채에 추가/업데이트
    if (editData.hasLoan && editData.loanAmount) {
      const existingDebt = items.find(
        item => item.category === "debt" &&
                (item.metadata as Record<string, unknown>)?.source === `realasset-${itemId}`
      );

      const debtMetadata = {
        source: `realasset-${itemId}`,
        loan_rate: editData.loanRate,
        loan_maturity_year: editData.loanMaturityYear,
        loan_maturity_month: editData.loanMaturityMonth,
        loan_repayment_type: editData.loanRepaymentType,
      };

      if (existingDebt) {
        updateMutation.mutate({
          id: existingDebt.id,
          updates: {
            title: `${editData.title || '실물 자산'} 담보대출`,
            amount: editData.loanAmount,
            metadata: debtMetadata,
          },
        });
      } else {
        createMutation.mutate({
          snapshot_id: currentSnapshot.id,
          category: "debt",
          item_type: "mortgage",
          title: `${editData.title || '실물 자산'} 담보대출`,
          amount: editData.loanAmount,
          owner: "self",
          metadata: debtMetadata,
        });
      }
    } else {
      // 담보대출이 없으면 기존 연동 부채 삭제
      const existingDebt = items.find(
        item => item.category === "debt" &&
                (item.metadata as Record<string, unknown>)?.source === `realasset-${itemId}`
      );
      if (existingDebt) {
        deleteMutation.mutate(existingDebt.id);
      }
    }

    // 모든 mutation 완료 후 스냅샷 totals 저장 (1초 대기)
    setTimeout(() => {
      isSavingItemsRef.current = false;
      saveSnapshotTotals();
    }, 1000);
  };

  // 실물 자산 편집 취소
  const cancelEditRealAsset = () => {
    setEditingRealAssetId(null);
    setEditRealAsset({});
  };

  // 금융 부채 추가 - DB에 바로 저장
  const handleAddDebt = async (itemType: string) => {
    if (!currentSnapshot) return;
    if (createMutation.isPending) return;

    const typeConfig = MODAL_ITEMS.debt.items.find(i => i.value === itemType);
    const newItem = await createMutation.mutateAsync({
      snapshot_id: currentSnapshot.id,
      category: "debt",
      item_type: itemType,
      title: typeConfig?.label || "",
      amount: 0,
      owner: "self",
    });

    if (newItem) {
      startEditDebt(newItem.id);
    }
  };

  // 금융 부채 편집 시작
  const startEditDebt = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const meta = item.metadata as Record<string, unknown>;
    setEditDebt({
      id: item.id,
      itemType: item.item_type,
      title: item.title,
      amount: item.amount || 0,
      loanRate: (meta?.loan_rate as number) || null,
      loanMaturityYear: (meta?.loan_maturity_year as number) || null,
      loanMaturityMonth: (meta?.loan_maturity_month as number) || null,
      loanRepaymentType: (meta?.loan_repayment_type as RepaymentType) || null,
    });
    setEditingDebtId(id);
  };

  // 기타 투자 추가
  const handleAddOtherInvestment = async (itemType: string) => {
    if (!currentSnapshot) return;

    const typeConfig = ITEM_TYPES.investment.find(t => t.value === itemType);
    await createMutation.mutateAsync({
      snapshot_id: currentSnapshot.id,
      category: "asset",
      item_type: itemType,
      title: typeConfig?.label || "",
      amount: 0,
      owner: "self",
    });
  };

  // 모달에서 항목 선택 시
  const handleModalSelect = async (itemType: string) => {
    if (!addModalCategory) return;

    setAddModalCategory(null); // 모달 먼저 닫기

    if (addModalCategory === "investment") {
      await handleAddOtherInvestment(itemType);
    } else if (addModalCategory === "realEstate") {
      await handleAddInvestmentRealEstate(itemType);
    } else if (addModalCategory === "realAsset") {
      await handleAddRealAsset(itemType);
    } else if (addModalCategory === "debt") {
      await handleAddDebt(itemType);
    }
  };

  // 금융 부채 저장
  const saveDebt = () => {
    if (!currentSnapshot || !editingDebtId) return;

    const itemId = editingDebtId;
    const editData = { ...editDebt };

    // 폼 즉시 닫기
    setEditingDebtId(null);
    setEditDebt({});

    // 아이템 저장 중 플래그 설정
    isSavingItemsRef.current = true;

    const metadata = {
      loan_rate: editData.loanRate,
      loan_maturity_year: editData.loanMaturityYear,
      loan_maturity_month: editData.loanMaturityMonth,
      loan_repayment_type: editData.loanRepaymentType,
    };

    // 부채 항목 업데이트
    updateMutation.mutate({
      id: itemId,
      updates: {
        item_type: editData.itemType,
        title: editData.title,
        amount: editData.amount || 0,
        metadata,
      },
    });

    // 스냅샷 totals 저장
    setTimeout(() => {
      isSavingItemsRef.current = false;
      saveSnapshotTotals();
    }, 1000);
  };

  // 금융 부채 편집 취소
  const cancelEditDebt = () => {
    setEditingDebtId(null);
    setEditDebt({});
  };

  // 거주용 부동산 편집 시작
  const startEditResidence = () => {
    // 기존 거주용 데이터가 있으면 로드
    const existingResidence = items.find(
      item => item.category === "asset" &&
              (item.metadata as Record<string, unknown>)?.purpose === "residential"
    );

    if (existingResidence) {
      const meta = existingResidence.metadata as Record<string, unknown>;
      setEditResidence({
        id: existingResidence.id,
        housingType: (meta?.housing_type as HousingType) || null,
        currentValue: (meta?.current_value as number) || existingResidence.amount || 0,
        purchaseYear: (meta?.purchase_year as number) || null,
        purchaseMonth: (meta?.purchase_month as number) || null,
        purchasePrice: (meta?.purchase_price as number) || null,
        monthlyRent: (meta?.monthly_rent as number) || null,
        maintenanceFee: (meta?.maintenance_fee as number) || null,
        hasLoan: (meta?.has_loan as boolean) || false,
        loanAmount: (meta?.loan_amount as number) || null,
        loanRate: (meta?.loan_rate as number) || null,
        loanMaturityYear: (meta?.loan_maturity_year as number) || null,
        loanMaturityMonth: (meta?.loan_maturity_month as number) || null,
        loanRepaymentType: (meta?.loan_repayment_type as RepaymentType) || null,
      });
    } else {
      setEditResidence({
        housingType: null,
        currentValue: 0,
        hasLoan: false,
      });
    }
    setIsEditingResidence(true);
  };

  // 거주용 부동산 저장 (DB에 바로 저장)
  const saveResidence = () => {
    if (!currentSnapshot || !editResidence.housingType) return;

    const editData = { ...editResidence };

    // 폼 즉시 닫기 (optimistic update)
    setIsEditingResidence(false);
    setEditResidence({});

    // 아이템 저장 중 플래그 설정 (자동 저장 방지)
    isSavingItemsRef.current = true;

    const existingResidence = items.find(
      item => item.category === "asset" &&
              (item.metadata as Record<string, unknown>)?.purpose === "residential"
    );

    const metadata = {
      purpose: "residential",
      housing_type: editData.housingType,
      current_value: editData.currentValue, // 시세 또는 보증금
      purchase_year: editData.purchaseYear,
      purchase_month: editData.purchaseMonth,
      purchase_price: editData.purchasePrice,
      monthly_rent: editData.monthlyRent,
      maintenance_fee: editData.maintenanceFee,
      has_loan: editData.hasLoan,
      loan_amount: editData.hasLoan ? editData.loanAmount : null,
      loan_rate: editData.hasLoan ? editData.loanRate : null,
      loan_maturity_year: editData.hasLoan ? editData.loanMaturityYear : null,
      loan_maturity_month: editData.hasLoan ? editData.loanMaturityMonth : null,
      loan_repayment_type: editData.hasLoan ? editData.loanRepaymentType : null,
    };

    // 자가/전세/월세는 자산으로 계산 (무상만 제외)
    // 자가: 시세, 전세/월세: 보증금 (돌려받을 돈이므로 자산)
    const amount = editData.housingType === "무상"
      ? 0
      : (editData.currentValue || 0);

    if (existingResidence) {
      // 기존 항목 수정
      updateMutation.mutate({
        id: existingResidence.id,
        updates: {
          amount,
          metadata,
          title: `거주용 (${editData.housingType})`,
        },
      });
    } else {
      // 새 항목 추가
      createMutation.mutate({
        snapshot_id: currentSnapshot.id,
        category: "asset",
        item_type: "residence",
        title: `거주용 (${editData.housingType})`,
        amount,
        owner: "self",
        metadata,
      });
    }

    // 대출이 있으면 부채에도 추가/업데이트
    if (editData.hasLoan && editData.loanAmount) {
      const debtType = editData.housingType === "자가" ? "mortgage" : "jeonse";
      const debtTitle = editData.housingType === "자가" ? "주택담보대출" : "전월세 보증금 대출";

      const existingDebt = items.find(
        item => item.category === "debt" &&
                (item.metadata as Record<string, unknown>)?.source === "residence"
      );

      const debtMetadata = {
        source: "residence",
        loan_rate: editData.loanRate,
        loan_maturity_year: editData.loanMaturityYear,
        loan_maturity_month: editData.loanMaturityMonth,
        loan_repayment_type: editData.loanRepaymentType,
      };

      if (existingDebt) {
        updateMutation.mutate({
          id: existingDebt.id,
          updates: {
            item_type: debtType,
            title: debtTitle,
            amount: editData.loanAmount,
            metadata: debtMetadata,
          },
        });
      } else {
        createMutation.mutate({
          snapshot_id: currentSnapshot.id,
          category: "debt",
          item_type: debtType,
          title: debtTitle,
          amount: editData.loanAmount,
          owner: "self",
          metadata: debtMetadata,
        });
      }
    } else {
      // 대출이 없으면 기존 거주 관련 부채 삭제
      const existingDebt = items.find(
        item => item.category === "debt" &&
                (item.metadata as Record<string, unknown>)?.source === "residence"
      );
      if (existingDebt) {
        deleteMutation.mutate(existingDebt.id);
      }
    }

    // 모든 mutation 완료 후 스냅샷 totals 저장 (1초 대기)
    setTimeout(() => {
      isSavingItemsRef.current = false;
      saveSnapshotTotals();
    }, 1000);
  };

  // 거주용 부동산 편집 취소
  const cancelEditResidence = () => {
    setIsEditingResidence(false);
    setEditResidence({});
  };

  // 거주용 부동산 데이터 가져오기
  const existingResidenceItem = useMemo(() => {
    return items.find(
      item => item.category === "asset" &&
              (item.metadata as Record<string, unknown>)?.purpose === "residential"
    );
  }, [items]);

  // 투자용 부동산 목록
  const investmentItems = useMemo(() => {
    return items.filter(
      item => item.category === "asset" &&
              (item.metadata as Record<string, unknown>)?.purpose === "investment"
    );
  }, [items]);

  // 탭별 금액
  const getTabAmount = (tabId: TabType): number => {
    switch (tabId) {
      case "savings": return totals.savings;
      case "investment": return totals.investment;
      case "realEstate": return totals.realEstate;
      case "realAsset": return totals.realAsset;
      case "debt": return totals.debt;
      case "profile": return 0;
    }
  };

  // 스냅샷, 투자, 저축 데이터 로딩 중일 때 전체 스켈레톤 표시
  if (isLoading || !isInvestmentDataReady || !isSavingsDataReady) {
    return (
      <div className={styles.container}>
        {/* 차트 섹션 스켈레톤 */}
        <div className={styles.chartSection}>
          <div className={styles.chartWrapper}>
            <div className={styles.chartBoxMain}>
              <div className={styles.skeletonChartMain} />
              <div className={styles.chartCenter}>
                <span className={`${styles.skeleton} ${styles.skeletonChartLabel}`} />
                <span className={`${styles.skeleton} ${styles.skeletonChartAmount}`} />
              </div>
            </div>
          </div>
          <div className={styles.subChartsGroup}>
            {[1, 2, 3].map(i => (
              <div key={i} className={styles.chartCardSmall}>
                <div className={styles.chartBoxSmall}>
                  <div className={styles.skeletonChartSmall} />
                  <div className={styles.chartCenter}>
                    <span className={`${styles.skeleton} ${styles.skeletonChartLabelSmall}`} />
                    <span className={`${styles.skeleton} ${styles.skeletonChartAmountSmall}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 탭 스켈레톤 */}
        <div className={styles.tabsSection}>
          {TABS.map((tab) => (
            <div key={tab.id} className={`${styles.skeleton} ${styles.skeletonTab}`} />
          ))}
        </div>

        {/* 콘텐츠 스켈레톤 */}
        <div className={styles.contentSection}>
          <div className={styles.simpleSection}>
            <div className={styles.simpleSectionHeader}>
              <span className={`${styles.skeleton} ${styles.skeletonSectionTitle}`} />
              <span className={`${styles.skeleton} ${styles.skeletonTotal}`} />
            </div>
            <div className={styles.skeletonContentList}>
              {[1, 2, 3].map(i => (
                <div key={i} className={styles.skeletonContentItem}>
                  <span className={`${styles.skeleton} ${styles.skeletonName}`} />
                  <span className={`${styles.skeleton} ${styles.skeletonAmount}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 차트 섹션 */}
      <div className={styles.chartSection}>
        {/* 메인: 순자산 차트 + 범례 */}
        <div className={styles.chartWrapper}>
          <div className={styles.chartBoxMain}>
            <Doughnut data={chartData} options={chartOptions} />
            <div className={styles.chartCenter}>
              <span className={styles.chartLabel}>순자산</span>
              <span className={styles.chartAmount}>{formatMoney(totals.netWorth)}</span>
            </div>
          </div>
        </div>

        {/* 서브 차트들 */}
        <div className={styles.subChartsGroup}>
          <div className={styles.chartCardSmall}>
            <div className={styles.chartBoxSmall}>
              <Doughnut data={cashAssetChartData} options={cashChartOptions} />
              <div className={styles.chartCenter}>
                <span className={styles.chartLabelSmall}>금융 자산</span>
                <span className={styles.chartAmountSmall}>{formatMoney(cashAssetChartData.total)}</span>
              </div>
            </div>
          </div>

          <div className={styles.chartCardSmall}>
            <div className={styles.chartBoxSmall}>
              <Doughnut data={realAssetTotalChartData} options={realChartOptions} />
              <div className={styles.chartCenter}>
                <span className={styles.chartLabelSmall}>실물 자산</span>
                <span className={styles.chartAmountSmall}>{formatMoney(realAssetTotalChartData.total)}</span>
              </div>
            </div>
          </div>

          <div className={styles.chartCardSmall}>
            <div className={styles.chartBoxSmall}>
              <Doughnut data={totalDebtChartData} options={debtChartOptions} />
              <div className={styles.chartCenter}>
                <span className={styles.chartLabelSmall}>부채</span>
                <span className={styles.chartAmountSmall} style={{ color: "#64748b" }}>
                  {formatMoney(totalDebtChartData.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 카테고리 탭 - 레퍼런스 스타일 */}
      <div className={styles.tabsSection}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const amount = getTabAmount(tab.id);
          return (
            <button
              key={tab.id}
              className={`${styles.tabButton} ${isActive ? styles.active : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.id === "profile" ? (
                <User className={styles.tabIcon} size={24} />
              ) : (
                <span className={styles.tabAmount}>{formatMoney(amount)}</span>
              )}
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 섹션 */}
      <div key={activeTab} className={styles.contentSection}>
        {activeTab === "savings" ? (
          /* 저축 탭 - 가계부 + 정기예금/적금 연동 */
          <div className={styles.investmentSection}>
            {savingsAccountValues.length > 0 ? (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        <div className={styles.tableHeaderWithBadge}>
                          계좌
                          <span className={styles.linkedBadgeSmall}>
                            <Link2 size={10} />
                            가계부 / 정기 예금적금에서 연동됨
                          </span>
                        </div>
                      </th>
                      <th className={styles.amountHeader}>평가금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savingsAccountValues.map(data => {
                      return (
                        <tr key={data.id}>
                          <td>
                            <div className={styles.accountCellWithLogo}>
                              <BrokerLogo brokerName={data.broker} fallback={data.name || "?"} size="md" />
                              <div className={styles.accountInfo}>
                                <span className={styles.accountName}>{data.name}</span>
                                <span className={styles.accountTypeLabel}>
                                  {data.type === "checking" ? "입출금통장" :
                                   data.type === "deposit" ? "예금" :
                                   data.type === "housing" ? "주택청약" :
                                   data.type === "free_savings" ? "자유적금" : "적금"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className={styles.amountCell}>
                            {formatWon(data.value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p>등록된 저축 계좌가 없습니다</p>
              </div>
            )}

            {/* 하단: 관리 버튼 + 합계 */}
            <div className={styles.sectionFooterWithButtons}>
              <div className={styles.footerButtons}>
                <button className={styles.footerLinkButton} onClick={() => onNavigate?.("household-budget")}>
                  가계부 관리
                </button>
                <button className={styles.footerLinkButton} onClick={() => onNavigate?.("savings-deposits")}>
                  예금/적금 관리
                </button>
              </div>
              <div className={styles.footerTotalGroup}>
                <span className={styles.footerTotalLabel}>합계</span>
                <span className={styles.footerTotalValue}>{formatWon(linkedSavingsTotalWon)}</span>
              </div>
            </div>
          </div>
        ) : activeTab === "investment" ? (
          /* 투자 탭 - 포트폴리오 연동 + 기타 투자 */
          <div className={styles.investmentSection}>
            {/* 포트폴리오 연동 섹션 */}
            {accountValues.size > 0 && (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        <div className={styles.tableHeaderWithBadge}>
                          계좌
                          <span className={styles.linkedBadgeSmall}>
                            <Link2 size={10} />
                            투자 포트폴리오에서 연동됨
                          </span>
                        </div>
                      </th>
                      <th className={styles.amountHeader}>평가금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(accountValues.entries()).map(([id, data]) => {
                      const accountTypeLabel = {
                        general: "증권계좌",
                        isa: "ISA",
                        pension_savings: "연금저축",
                        irp: "IRP",
                        dc: "DC형 퇴직연금",
                      }[data.accountType] || "증권계좌";
                      return (
                        <tr key={id}>
                          <td>
                            <div className={styles.accountCellWithLogo}>
                              <BrokerLogo brokerName={data.broker} fallback={data.accountName || "?"} size="md" />
                              <div className={styles.accountInfo}>
                                <span className={styles.accountName}>{data.accountName}</span>
                                <span className={styles.accountTypeLabel}>{accountTypeLabel}</span>
                              </div>
                            </div>
                          </td>
                          <td className={styles.amountCell}>
                            {formatWon(Math.round(data.value))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 기타 투자 섹션 */}
            <div className={styles.otherInvestmentSection}>
              <div className={styles.otherInvestmentHeader}>
                <span className={styles.otherInvestmentTitle}>투자</span>
                <span className={styles.otherInvestmentDesc}>실물 금, 채권 등</span>
              </div>

              {otherInvestmentItems.length > 0 && (
                <div className={styles.itemCardList}>
                  {otherInvestmentItems.map(item => (
                    <OtherInvestmentCard
                      key={item.id}
                      item={item}
                      isCouple={isCouple}
                      onUpdate={handleUpdateItem}
                      onDelete={handleDeleteItem}
                    />
                  ))}
                </div>
              )}

              <div style={{ padding: '16px 20px' }}>
                <button
                  className={styles.addButtonSmall}
                  onClick={() => setAddModalCategory("investment")}
                >
                  <Plus size={14} />
                  투자 추가
                </button>
              </div>
            </div>

            {/* 하단: 관리 버튼 + 합계 */}
            <div className={styles.sectionFooterWithButtons}>
              <div className={styles.footerButtons}>
                <button className={styles.footerLinkButton} onClick={() => onNavigate?.("portfolio")}>
                  투자 포트폴리오 관리
                </button>
              </div>
              <div className={styles.footerTotalGroup}>
                <span className={styles.footerTotalLabel}>합계</span>
                <span className={styles.footerTotalValue}>{formatWon(investmentTotalWon)}</span>
              </div>
            </div>
          </div>
        ) : activeTab === "realEstate" ? (
          /* 부동산 탭 - 거주용/투자용 구분 */
          <div className={styles.realEstateSection}>
            {/* 거주용 부동산 */}
            <div className={styles.realEstateGroup}>
              <div className={styles.realEstateGroupHeader}>
                <span className={styles.realEstateGroupTitle}>거주용</span>
                <span className={styles.realEstateGroupDesc}>현재 거주 중인 주거 형태</span>
              </div>

              <ResidenceCard
                item={existingResidenceItem || null}
                snapshotId={currentSnapshot?.id || ''}
                currentYear={currentYear}
                isCouple={isCouple}
                onUpdate={handleUpdateItem}
                onCreate={async (input) => {
                  const item = await createMutation.mutateAsync(input);
                  return item;
                }}
                onDelete={handleDeleteItem}
              />
            </div>

            {/* 투자/임대 부동산 */}
            <div className={styles.realEstateGroup}>
              <div className={styles.realEstateGroupHeader}>
                <span className={styles.realEstateGroupTitle}>투자/임대</span>
                <span className={styles.realEstateGroupDesc}>투자 또는 임대 수익 목적 부동산</span>
              </div>

              {investmentItems.map(item => (
                <InvestmentRealEstateCard
                  key={item.id}
                  item={item}
                  currentYear={currentYear}
                  isCouple={isCouple}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                />
              ))}

              <div style={{ padding: '16px 20px' }}>
                <button
                  className={styles.addButtonSmall}
                  onClick={() => setAddModalCategory("realEstate")}
                >
                  <Plus size={14} />
                  투자용 추가
                </button>
              </div>
            </div>

            {/* 하단 합계 */}
            {totals.realEstateGross > 0 && (
              <div className={styles.sectionFooterExpanded}>
                <div className={styles.footerRow}>
                  <span className={styles.footerTotalLabel}>합계</span>
                  <span className={styles.footerTotalValue}>{formatMoney(totals.realEstateGross)}</span>
                </div>
                {totals.realEstateLoan > 0 && (
                  <>
                    <div className={styles.footerRow}>
                      <span className={styles.footerLoanLabel}>담보대출</span>
                      <span className={styles.footerLoanValue}>-{formatMoney(totals.realEstateLoan)}</span>
                    </div>
                    <div className={styles.footerRow}>
                      <span className={styles.footerNetLabel}>순자산</span>
                      <span className={styles.footerNetValue}>{formatMoney(totals.realEstate)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : activeTab === "profile" ? (
          /* 프로필 탭 */
          <div className={styles.simpleSection}>
            <div className={styles.simpleSectionHeader}>
              <span className={styles.simpleSectionTitle}>프로필</span>
            </div>
            <div className={styles.profileContent}>
              {isProfileLoading ? (
                <div className={styles.profileLoading}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={styles.profileSkeletonItem}>
                      <div className={styles.profileSkeletonIcon} />
                      <div className={styles.profileSkeletonText}>
                        <div className={`${styles.profileSkeletonLine} ${styles.short}`} />
                        <div className={`${styles.profileSkeletonLine} ${styles.long}`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* 계획 단위 (개인/가계) */}
                  <button className={styles.profileInfoItem} onClick={() => setShowPlanningModeModal(true)}>
                    <div className={styles.profileInfoIcon}>
                      {isCouple ? <Users size={20} /> : <User size={20} />}
                    </div>
                    <div className={styles.profileInfoContent}>
                      <span className={styles.profileInfoLabel}>
                        {isCouple ? "가계 단위" : "개인 단위"}
                      </span>
                      <span className={styles.profileInfoValue}>
                        {isCouple ? "배우자와 함께 계획합니다" : "혼자서 계획합니다"}
                      </span>
                    </div>
                    <ChevronRight size={18} className={styles.profileInfoChevron} />
                  </button>

                  {/* 계획 단위 변경 모달 */}
                  {showPlanningModeModal && (
                    <div className={styles.planningModeModal}>
                      <div className={styles.planningModeModalContent}>
                        <div className={styles.planningModeModalHeader}>
                          <span>계획 단위 선택</span>
                          <button onClick={() => setShowPlanningModeModal(false)}>
                            <X size={18} />
                          </button>
                        </div>
                        <div className={styles.planningModeOptions}>
                          <button
                            className={`${styles.planningModeOption} ${!isCouple ? styles.active : ""}`}
                            onClick={() => {
                              if (isCouple) confirmPlanningModeChange();
                              else setShowPlanningModeModal(false);
                            }}
                          >
                            <div className={styles.planningModeOptionIcon}>
                              <User size={24} />
                            </div>
                            <div className={styles.planningModeOptionText}>
                              <span className={styles.planningModeOptionTitle}>개인 단위</span>
                              <span className={styles.planningModeOptionDesc}>혼자서 계획합니다</span>
                            </div>
                          </button>
                          <button
                            className={`${styles.planningModeOption} ${isCouple ? styles.active : ""}`}
                            onClick={() => {
                              if (!isCouple) confirmPlanningModeChange();
                              else setShowPlanningModeModal(false);
                            }}
                          >
                            <div className={styles.planningModeOptionIcon}>
                              <Users size={24} />
                            </div>
                            <div className={styles.planningModeOptionText}>
                              <span className={styles.planningModeOptionTitle}>가계 단위</span>
                              <span className={styles.planningModeOptionDesc}>배우자와 함께 계획합니다</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 본인 정보 */}
                  {editingProfileField === "profile" ? (
                    <div className={styles.profileEditCard}>
                      <div className={styles.profileEditHeader}>
                        <span>본인 정보 수정</span>
                        <button onClick={() => setEditingProfileField(null)}>
                          <X size={18} />
                        </button>
                      </div>
                      <div className={styles.profileEditGrid}>
                        <div className={styles.profileEditField}>
                          <label>이름</label>
                          <input
                            type="text"
                            value={editProfileData.name || ""}
                            placeholder="이름"
                            onChange={(e) => setEditProfileData(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className={styles.profileEditField}>
                          <label>생년월일</label>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="number"
                              style={{ width: 80 }}
                              value={editProfileData.birthYear || ""}
                              placeholder="1990"
                              onChange={(e) => setEditProfileData(prev => ({ ...prev, birthYear: e.target.value }))}
                            />
                            <span style={{ color: '#6b7280', fontSize: 13 }}>년</span>
                            <input
                              type="number"
                              style={{ width: 60 }}
                              value={editProfileData.birthMonth || ""}
                              placeholder="1"
                              min={1}
                              max={12}
                              onChange={(e) => setEditProfileData(prev => ({ ...prev, birthMonth: e.target.value }))}
                            />
                            <span style={{ color: '#6b7280', fontSize: 13 }}>월</span>
                            <input
                              type="number"
                              style={{ width: 60 }}
                              value={editProfileData.birthDay || ""}
                              placeholder="1"
                              min={1}
                              max={31}
                              onChange={(e) => setEditProfileData(prev => ({ ...prev, birthDay: e.target.value }))}
                            />
                            <span style={{ color: '#6b7280', fontSize: 13 }}>일</span>
                          </div>
                        </div>
                        <div className={styles.profileEditField}>
                          <label>목표 은퇴 나이</label>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="number"
                              style={{ width: 80 }}
                              value={editProfileData.targetRetirementAge || ""}
                              placeholder="60"
                              onChange={(e) => setEditProfileData(prev => ({ ...prev, targetRetirementAge: e.target.value }))}
                            />
                            <span style={{ color: '#6b7280', fontSize: 13 }}>세</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.profileEditActions}>
                        <button className={styles.profileEditCancel} onClick={() => setEditingProfileField(null)}>취소</button>
                        <button className={styles.profileEditSave} onClick={saveProfile}>저장</button>
                      </div>
                    </div>
                  ) : (
                    <button className={styles.profileInfoItem} onClick={startEditProfile}>
                      <div className={styles.profileInfoIcon}>
                        <User size={20} />
                      </div>
                      <div className={styles.profileInfoContent}>
                        <span className={styles.profileInfoLabel}>
                          {profile?.name || "본인"}
                        </span>
                        <span className={styles.profileInfoValue}>
                          {profile?.birth_date ? (
                            <>만 {calculateAge(profile.birth_date)}세 - {new Date(profile.birth_date).getFullYear()}년 {new Date(profile.birth_date).getMonth() + 1}월생</>
                          ) : (
                            "생년월일 미입력"
                          )}
                        </span>
                      </div>
                      <ChevronRight size={18} className={styles.profileInfoChevron} />
                    </button>
                  )}

                  {/* 배우자 정보 */}
                  {isCouple && (
                    editingProfileField === "spouse" ? (
                      <div className={styles.profileEditCard}>
                        <div className={styles.profileEditHeader}>
                          <span>배우자 정보 수정</span>
                          <button onClick={() => setEditingProfileField(null)}>
                            <X size={18} />
                          </button>
                        </div>
                        <div className={styles.profileEditGrid}>
                          <div className={styles.profileEditField}>
                            <label>이름</label>
                            <input
                              type="text"
                              value={editSpouseData.name || ""}
                              placeholder="배우자"
                              onChange={(e) => setEditSpouseData(prev => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          <div className={styles.profileEditField}>
                            <label>생년월일</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="number"
                                style={{ width: 80 }}
                                value={editSpouseData.birthYear || ""}
                                placeholder="1990"
                                onChange={(e) => setEditSpouseData(prev => ({ ...prev, birthYear: e.target.value }))}
                              />
                              <span style={{ color: '#6b7280', fontSize: 13 }}>년</span>
                              <input
                                type="number"
                                style={{ width: 60 }}
                                value={editSpouseData.birthMonth || ""}
                                placeholder="1"
                                min={1}
                                max={12}
                                onChange={(e) => setEditSpouseData(prev => ({ ...prev, birthMonth: e.target.value }))}
                              />
                              <span style={{ color: '#6b7280', fontSize: 13 }}>월</span>
                              <input
                                type="number"
                                style={{ width: 60 }}
                                value={editSpouseData.birthDay || ""}
                                placeholder="1"
                                min={1}
                                max={31}
                                onChange={(e) => setEditSpouseData(prev => ({ ...prev, birthDay: e.target.value }))}
                              />
                              <span style={{ color: '#6b7280', fontSize: 13 }}>일</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.profileEditActions}>
                          <button className={styles.profileEditCancel} onClick={() => setEditingProfileField(null)}>취소</button>
                          <button className={styles.profileEditSave} onClick={saveSpouse}>저장</button>
                        </div>
                      </div>
                    ) : (
                      <button className={styles.profileInfoItem} onClick={startEditSpouse}>
                        <div className={styles.profileInfoIcon}>
                          <Users size={20} />
                        </div>
                        <div className={styles.profileInfoContent}>
                          <span className={styles.profileInfoLabel}>
                            {spouse?.name || "배우자"}
                          </span>
                          <span className={styles.profileInfoValue}>
                            {spouse?.birth_date ? (
                              <>만 {calculateAge(spouse.birth_date)}세 - {new Date(spouse.birth_date).getFullYear()}년 {new Date(spouse.birth_date).getMonth() + 1}월생</>
                            ) : (
                              "생년월일 미입력"
                            )}
                          </span>
                        </div>
                        <ChevronRight size={18} className={styles.profileInfoChevron} />
                      </button>
                    )
                  )}

                  {/* 자녀 정보 */}
                  {(() => {
                    const children = familyMembers.filter(m => m.relationship === "child");
                    if (children.length === 0) return null;
                    return (
                      <div className={styles.profileInfoItem} style={{ cursor: 'default' }}>
                        <div className={styles.profileInfoIcon}>
                          <Baby size={20} />
                        </div>
                        <div className={styles.profileInfoContent}>
                          <span className={styles.profileInfoLabel}>
                            자녀 {children.length}명
                          </span>
                          <div className={styles.childrenList}>
                            {children.map((child) => (
                              <span key={child.id} className={styles.childItem}>
                                {child.name || (child.gender === "male" ? "아들" : child.gender === "female" ? "딸" : "자녀")}
                                {child.birth_date && (
                                  <> - 만 {calculateAge(child.birth_date)}세</>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 은퇴 목표 */}
                  <div className={styles.profileInfoItem} style={{ cursor: 'default' }}>
                    <div className={styles.profileInfoIcon}>
                      <Target size={20} />
                    </div>
                    <div className={styles.profileInfoContent}>
                      <span className={styles.profileInfoLabel}>은퇴 목표</span>
                      <span className={styles.profileInfoValue}>
                        {profile?.target_retirement_age || 60}세
                        {profile?.birth_date && (
                          <> ({new Date(profile.birth_date).getFullYear() + (profile?.target_retirement_age || 60)}년)</>
                        )}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : activeTab === "realAsset" ? (
          /* 실물 자산 탭 - 카드 UI */
          <div className={styles.simpleSection}>
            <div className={styles.simpleSectionHeader}>
              <span className={styles.simpleSectionTitle}>실물 자산</span>
              <span className={styles.simpleSectionDesc}>자동차, 귀금속, 미술품 등</span>
            </div>

            {currentItems.map(item => (
              <RealAssetCard
                key={item.id}
                item={item}
                isCouple={isCouple}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            ))}

            <div style={{ padding: '16px 20px' }}>
              <button className={styles.addButtonSmall} onClick={() => setAddModalCategory("realAsset")}>
                <Plus size={14} />
                실물 자산 추가
              </button>
            </div>

            {totals.realAssetGross > 0 && (
              <div className={styles.sectionFooterExpanded}>
                <div className={styles.footerRow}>
                  <span className={styles.footerTotalLabel}>합계</span>
                  <span className={styles.footerTotalValue}>{formatMoney(totals.realAssetGross)}</span>
                </div>
                {totals.realAssetInstallment > 0 && (
                  <>
                    <div className={styles.footerRow}>
                      <span className={styles.footerLoanLabel}>할부 잔액</span>
                      <span className={styles.footerLoanValue}>-{formatMoney(totals.realAssetInstallment)}</span>
                    </div>
                    <div className={styles.footerRow}>
                      <span className={styles.footerNetLabel}>순자산</span>
                      <span className={styles.footerNetValue}>{formatMoney(totals.realAsset)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : activeTab === "debt" ? (
          /* 금융 부채 탭 */
          <div className={styles.simpleSection}>
            <div className={styles.simpleSectionHeader}>
              <span className={styles.simpleSectionTitle}>금융 부채</span>
              <span className={styles.simpleSectionDesc}>신용대출, 카드론 등 담보 없는 부채</span>
            </div>

            {currentItems.map(item => (
              <DebtCard
                key={item.id}
                item={item}
                currentYear={currentYear}
                isCouple={isCouple}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            ))}

            <div style={{ padding: '16px 20px' }}>
              <button className={styles.addButtonSmall} onClick={() => setAddModalCategory("debt")}>
                <Plus size={14} />
                금융 부채 추가
              </button>
            </div>

            {totals.debt > 0 && (
              <div className={styles.sectionFooterExpanded}>
                <div className={styles.footerRow}>
                  <span className={styles.footerTotalLabel}>합계</span>
                  <span className={styles.footerTotalValue}>{formatMoney(totals.debt)}</span>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* 추가 모달 */}
      {addModalCategory && (
        <div className={styles.modalOverlay} onClick={() => setAddModalCategory(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{MODAL_ITEMS[addModalCategory].title} 추가</span>
              <button className={styles.modalCloseBtn} onClick={() => setAddModalCategory(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalGrid}>
                {MODAL_ITEMS[addModalCategory].items.map((item) => (
                  <button
                    key={item.value}
                    className={styles.modalItem}
                    onClick={() => handleModalSelect(item.value)}
                  >
                    <div
                      className={styles.modalItemIcon}
                      style={{ backgroundColor: MODAL_ITEMS[addModalCategory].color }}
                    >
                      {item.icon}
                    </div>
                    <span className={styles.modalItemLabel}>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
