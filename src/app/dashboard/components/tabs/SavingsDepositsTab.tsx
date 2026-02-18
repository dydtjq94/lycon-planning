"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, PiggyBank } from "lucide-react";
import type { Account, AccountInput, CurrencyType } from "@/types/tables";
import { formatWon } from "@/lib/utils";
import {
  getTermDepositAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "@/lib/services/budgetService";
import {
  calculateTermDepositValue,
  getMaturityDays,
  getDurationMonths,
  getTermDepositPrincipal,
  calculateMaturityAmountPreTax,
  calculateMaturityAmountPostTax,
} from "@/lib/utils/accountValueCalculator";
import styles from "./SavingsDepositsTab.module.css";

interface SavingsDepositsTabProps {
  profileId: string;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  savings: "적금",
  deposit: "예금",
  free_savings: "자유적금",
  housing: "청약",
};

const CURRENCY_OPTIONS: { value: CurrencyType; label: string }[] = [
  { value: "KRW", label: "KRW (원)" },
  { value: "USD", label: "USD (달러)" },
  { value: "EUR", label: "EUR (유로)" },
  { value: "JPY", label: "JPY (엔)" },
];

export function SavingsDepositsTab({ profileId }: SavingsDepositsTabProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 데이터 상태
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      const data = await getTermDepositAccounts(profileId);
      setAccounts(data);
    } catch (error) {
      console.error("Failed to load term deposits:", error);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 합계 계산
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
  }, [accounts]);

  const depositTotal = useMemo(() => {
    return accounts
      .filter((acc) => acc.account_type === "deposit")
      .reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
  }, [accounts]);

  const savingsTotal = useMemo(() => {
    return accounts
      .filter((acc) => acc.account_type === "savings")
      .reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
  }, [accounts]);

  // 추가 시작
  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setEditValues({
      account_type: "deposit",
      name: "",
      broker_name: "",
      current_balance: "",
      interest_rate: "",
      start_year: String(currentYear),
      start_month: String(currentMonth),
      maturity_year: String(currentYear + 1),
      maturity_month: String(currentMonth),
      is_tax_free: "false",
      currency: "KRW",
      monthly_contribution: "",
      interest_type: "simple",
    });
  };

  // 편집 시작
  const startEdit = (account: Account) => {
    setEditingId(account.id);
    setIsAdding(false);
    setEditValues({
      account_type: account.account_type,
      name: account.name,
      broker_name: account.broker_name,
      current_balance: account.current_balance?.toString() || "",
      interest_rate: account.interest_rate?.toString() || "",
      start_year: account.start_year?.toString() || "",
      start_month: account.start_month?.toString() || "",
      maturity_year: account.maturity_year?.toString() || "",
      maturity_month: account.maturity_month?.toString() || "",
      is_tax_free: account.is_tax_free ? "true" : "false",
      currency: account.currency || "KRW",
      monthly_contribution: account.monthly_contribution?.toString() || "",
      memo: account.memo || "",
      interest_type: account.interest_type || "simple",
    });
  };

  // 취소
  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditValues({});
  };

  // 저장
  const handleSave = async () => {
    if (!editValues.name || !editValues.broker_name) return;

    try {
      const input: Partial<AccountInput> = {
        name: editValues.name,
        broker_name: editValues.broker_name,
        account_type: editValues.account_type as "savings" | "deposit",
        current_balance: editValues.current_balance
          ? parseInt(editValues.current_balance)
          : 0,
        interest_rate: editValues.interest_rate
          ? parseFloat(editValues.interest_rate)
          : null,
        start_year: editValues.start_year
          ? parseInt(editValues.start_year)
          : null,
        start_month: editValues.start_month
          ? parseInt(editValues.start_month)
          : null,
        maturity_year: editValues.maturity_year
          ? parseInt(editValues.maturity_year)
          : null,
        maturity_month: editValues.maturity_month
          ? parseInt(editValues.maturity_month)
          : null,
        is_tax_free: editValues.is_tax_free === "true",
        currency: (editValues.currency as CurrencyType) || "KRW",
        monthly_contribution: editValues.monthly_contribution
          ? parseInt(editValues.monthly_contribution)
          : null,
        memo: editValues.memo || null,
        interest_type: (editValues.interest_type as any) || "simple",
      };

      if (isAdding) {
        await createAccount({
          ...input,
          profile_id: profileId,
          name: input.name!,
          broker_name: input.broker_name!,
          account_number: null,
          account_type: input.account_type || "deposit",
          owner: input.owner || "self",
          current_balance: input.current_balance || 0,
          is_default: false,
          memo: input.memo || null,
          interest_rate: input.interest_rate || null,
          start_year: input.start_year || null,
          start_month: input.start_month || null,
          start_day: null,
          maturity_year: input.maturity_year || null,
          maturity_month: input.maturity_month || null,
          maturity_day: null,
          is_tax_free: input.is_tax_free || false,
          currency: input.currency || "KRW",
          monthly_contribution: input.monthly_contribution || null,
          interest_type: input.interest_type || "simple",
        });
      } else if (editingId) {
        await updateAccount(editingId, input);
      }

      await loadData();
      cancelEdit();
    } catch (error) {
      console.error("Failed to save account:", error);
    }
  };

  // 삭제
  const handleDelete = async (accountId: string) => {
    try {
      await deleteAccount(accountId);
      await loadData();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  };

  // 전체 현재 평가금액
  const totalCurrentValue = accounts.reduce((sum, acc) => sum + calculateTermDepositValue(acc), 0);
  const totalPrincipal = accounts.reduce((sum, acc) => sum + getTermDepositPrincipal(acc), 0);
  const totalInterest = accounts.reduce((sum, acc) => {
    const interest = calculateTermDepositValue(acc) - getTermDepositPrincipal(acc);
    return sum + interest;
  }, 0);

  if (isLoading) {
    return (
      <div className={styles.container}>
        {/* 요약 헤더 스켈레톤 */}
        <div className={styles.summaryHeader}>
          <div className={styles.mainMetric}>
            <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
            <div className={`${styles.skeleton} ${styles.skeletonMainValue}`} />
          </div>
          <div className={styles.sideMetrics}>
            <div className={styles.sideMetric}>
              <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
              <div className={`${styles.skeleton} ${styles.skeletonSideValue}`} />
            </div>
            <div className={styles.sideMetric}>
              <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
              <div className={`${styles.skeleton} ${styles.skeletonSideValue}`} />
            </div>
          </div>
        </div>
        {/* 보유 목록 스켈레톤 */}
        <div className={styles.holdingsSection}>
          <div className={styles.holdingsList}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${styles.skeleton} ${styles.skeletonHoldingItem}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 요약 헤더 */}
      <div className={styles.summaryHeader}>
        <div className={styles.mainMetric}>
          <span className={styles.metricLabel}>현재 평가금액</span>
          <span className={styles.mainValue}>{formatWon(totalCurrentValue)}</span>
          <div className={`${styles.changeInfo} ${styles.positive}`}>
            +{formatWon(totalInterest)} (이자)
          </div>
        </div>
        <div className={styles.sideMetrics}>
          <div className={styles.sideMetric}>
            <span className={styles.sideLabel}>총 원금</span>
            <span className={styles.sideValue}>{formatWon(totalPrincipal)}</span>
          </div>
          <div className={styles.sideMetric}>
            <span className={styles.sideLabel}>보유 상품</span>
            <span className={styles.sideValue}>{accounts.length}개</span>
          </div>
        </div>
      </div>

      {/* 보유 목록 */}
      <div className={styles.holdingsSection}>
        <div className={styles.holdingsSectionHeader}>
          <h3 className={styles.holdingsSectionTitle}>보유 예적금</h3>
        </div>

        {accounts.length === 0 ? (
          <div className={styles.emptyState}>
            <PiggyBank size={48} strokeWidth={1} />
            <p>등록된 예적금이 없습니다.</p>
          </div>
        ) : (
          <div className={styles.holdingsList}>
            {accounts.map((account) =>
              editingId === account.id ? (
              // 편집 모드
              <div key={account.id} className={styles.editItem}>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>유형</span>
                  <div className={styles.typeButtons}>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${
                        editValues.account_type === "deposit"
                          ? styles.active
                          : ""
                      }`}
                      onClick={() =>
                        setEditValues({ ...editValues, account_type: "deposit" })
                      }
                    >
                      예금
                    </button>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${
                        editValues.account_type === "savings"
                          ? styles.active
                          : ""
                      }`}
                      onClick={() =>
                        setEditValues({ ...editValues, account_type: "savings" })
                      }
                    >
                      적금
                    </button>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>상품명</span>
                  <div className={styles.editField}>
                    <input
                      type="text"
                      className={styles.editInputWide}
                      value={editValues.name || ""}
                      onChange={(e) =>
                        setEditValues({ ...editValues, name: e.target.value })
                      }
                      placeholder="예: 정기예금 1년"
                      autoFocus
                    />
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>금융사</span>
                  <div className={styles.editField}>
                    <input
                      type="text"
                      className={styles.editInputWide}
                      value={editValues.broker_name || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          broker_name: e.target.value,
                        })
                      }
                      placeholder="예: 국민은행, 카카오뱅크"
                    />
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>
                    {editValues.account_type === "savings" ? "가입금액" : "예치금"}
                  </span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInput}
                      value={editValues.current_balance || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          current_balance: e.target.value,
                        })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.editUnit}>만원</span>
                  </div>
                </div>
                {editValues.account_type === "savings" && (
                  <div className={styles.editRow}>
                    <span className={styles.editRowLabel}>월납입</span>
                    <div className={styles.editField}>
                      <input
                        type="number"
                        className={styles.editInput}
                        value={editValues.monthly_contribution || ""}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            monthly_contribution: e.target.value,
                          })
                        }
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        placeholder="0"
                      />
                      <span className={styles.editUnit}>만원</span>
                    </div>
                  </div>
                )}
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>이율</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.interest_rate || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          interest_rate: e.target.value,
                        })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      step="0.01"
                      placeholder="0"
                    />
                    <span className={styles.editUnit}>%</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>이자방식</span>
                  <div className={styles.editField}>
                    <select
                      value={editValues.interest_type || "simple"}
                      onChange={(e) => setEditValues({ ...editValues, interest_type: e.target.value })}
                      className={styles.editInput}
                    >
                      <option value="simple">단리</option>
                      <option value="monthly_compound">월복리</option>
                      <option value="annual_compound">년복리</option>
                    </select>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>가입일</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.start_year || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          start_year: e.target.value,
                        })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder={String(currentYear)}
                    />
                    <span className={styles.editUnit}>년</span>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.start_month || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          start_month: e.target.value,
                        })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      min={1}
                      max={12}
                      placeholder="1"
                    />
                    <span className={styles.editUnit}>월</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>만기일</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.maturity_year || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          maturity_year: e.target.value,
                        })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder={String(currentYear + 1)}
                    />
                    <span className={styles.editUnit}>년</span>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.maturity_month || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          maturity_month: e.target.value,
                        })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      min={1}
                      max={12}
                      placeholder="12"
                    />
                    <span className={styles.editUnit}>월</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>비과세</span>
                  <div className={styles.typeButtons}>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${
                        editValues.is_tax_free === "true" ? styles.active : ""
                      }`}
                      onClick={() =>
                        setEditValues({ ...editValues, is_tax_free: "true" })
                      }
                    >
                      O
                    </button>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${
                        editValues.is_tax_free !== "true" ? styles.active : ""
                      }`}
                      onClick={() =>
                        setEditValues({ ...editValues, is_tax_free: "false" })
                      }
                    >
                      X
                    </button>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>통화</span>
                  <div className={styles.editField}>
                    <select
                      className={styles.editSelect}
                      value={editValues.currency || "KRW"}
                      onChange={(e) =>
                        setEditValues({ ...editValues, currency: e.target.value })
                      }
                    >
                      {CURRENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={styles.editActions}>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>
                    취소
                  </button>
                  <button className={styles.saveBtn} onClick={handleSave}>
                    저장
                  </button>
                </div>
              </div>
            ) : (
              // 읽기 모드 - 사용자 입력(파란색) vs 계산값(검정색) 구분
              <div key={account.id} className={styles.holdingItem}>
                {/* 상단: 상품명 + 뱃지들 */}
                <div className={styles.holdingHeader}>
                  <div className={styles.holdingTitleRow}>
                    <span className={`${styles.typeLabel} ${styles[account.account_type]}`}>
                      {ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
                    </span>
                    {account.is_tax_free && (
                      <span className={styles.taxFreeBadge}>비과세</span>
                    )}
                    {getMaturityDays(account) && (
                      <span className={styles.maturityBadge}>
                        {getMaturityDays(account)}
                      </span>
                    )}
                  </div>
                  <span className={styles.holdingName}>{account.name}</span>
                </div>

                {/* 사용자 입력 필드 (파란색) */}
                <div className={styles.inputFieldsRow}>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>은행</span>
                    <span className={styles.fieldValueInput}>{account.broker_name}</span>
                  </div>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>가입일</span>
                    <span className={styles.fieldValueInput}>
                      {account.start_year}.{String(account.start_month || 1).padStart(2, '0')}.{String(account.start_day || 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>이율</span>
                    <span className={styles.fieldValueInput}>
                      {account.interest_rate ? `${account.interest_rate}% (${account.interest_type === 'simple' ? '단리' : account.interest_type === 'monthly_compound' ? '월복리' : '년복리'})` : '-'}
                    </span>
                  </div>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>기간</span>
                    <span className={styles.fieldValueInput}>
                      {getDurationMonths(account) !== null ? `${getDurationMonths(account)}개월` : '-'}
                    </span>
                  </div>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>
                      {account.account_type === 'savings' ? '월납입' : '예치금'}
                    </span>
                    <span className={styles.fieldValueInput}>
                      {account.account_type === 'savings' && account.monthly_contribution
                        ? formatWon(account.monthly_contribution)
                        : formatWon(account.current_balance || 0)}
                    </span>
                  </div>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>통화</span>
                    <span className={styles.fieldValueInput}>{account.currency || 'KRW'}</span>
                  </div>
                </div>

                {/* 계산된 필드 (검정색) */}
                <div className={styles.calculatedFieldsRow}>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>만기일</span>
                    <span className={styles.fieldValueCalc}>
                      {account.maturity_year
                        ? `${account.maturity_year}.${String(account.maturity_month || 12).padStart(2, '0')}.${String(account.maturity_day || 1).padStart(2, '0')}`
                        : '-'}
                    </span>
                  </div>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>만기수령액(세전)</span>
                    <span className={styles.fieldValueCalc}>
                      {calculateMaturityAmountPreTax(account)
                        ? formatWon(calculateMaturityAmountPreTax(account)!)
                        : '-'}
                    </span>
                  </div>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>만기수령액(세후)</span>
                    <span className={`${styles.fieldValueCalc} ${styles.highlight}`}>
                      {calculateMaturityAmountPostTax(account)
                        ? formatWon(calculateMaturityAmountPostTax(account)!)
                        : '-'}
                    </span>
                  </div>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldLabel}>예상 이자</span>
                    <span className={`${styles.fieldValueCalc} ${styles.interestColor}`}>
                      +{formatWon(Math.round(calculateTermDepositValue(account) - getTermDepositPrincipal(account)))}
                    </span>
                  </div>
                </div>

              </div>
            )
          )}

          {/* 추가 폼 */}
          {isAdding ? (
            <div className={styles.editItem}>
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>유형</span>
                <div className={styles.typeButtons}>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${
                      editValues.account_type === "deposit" ? styles.active : ""
                    }`}
                    onClick={() =>
                      setEditValues({ ...editValues, account_type: "deposit" })
                    }
                  >
                    예금
                  </button>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${
                      editValues.account_type === "savings" ? styles.active : ""
                    }`}
                    onClick={() =>
                      setEditValues({ ...editValues, account_type: "savings" })
                    }
                  >
                    적금
                  </button>
                </div>
              </div>
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>상품명</span>
                <div className={styles.editField}>
                  <input
                    type="text"
                    className={styles.editInputWide}
                    value={editValues.name || ""}
                    onChange={(e) =>
                      setEditValues({ ...editValues, name: e.target.value })
                    }
                    placeholder="예: 정기예금 1년"
                    autoFocus
                  />
                </div>
              </div>
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>금융사</span>
                <div className={styles.editField}>
                  <input
                    type="text"
                    className={styles.editInputWide}
                    value={editValues.broker_name || ""}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        broker_name: e.target.value,
                      })
                    }
                    placeholder="예: 국민은행, 카카오뱅크"
                  />
                </div>
              </div>
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>
                  {editValues.account_type === "savings" ? "가입금액" : "예치금"}
                </span>
                <div className={styles.editField}>
                  <input
                    type="number"
                    className={styles.editInput}
                    value={editValues.current_balance || ""}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        current_balance: e.target.value,
                      })
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="0"
                  />
                  <span className={styles.editUnit}>만원</span>
                </div>
              </div>
              {editValues.account_type === "savings" && (
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>월납입</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInput}
                      value={editValues.monthly_contribution || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          monthly_contribution: e.target.value,
                        })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.editUnit}>만원</span>
                  </div>
                </div>
              )}
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>이율</span>
                <div className={styles.editField}>
                  <input
                    type="number"
                    className={styles.editInputSmall}
                    value={editValues.interest_rate || ""}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        interest_rate: e.target.value,
                      })
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    step="0.01"
                    placeholder="0"
                  />
                  <span className={styles.editUnit}>%</span>
                </div>
              </div>
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>이자방식</span>
                <div className={styles.editField}>
                  <select
                    value={editValues.interest_type || "simple"}
                    onChange={(e) => setEditValues({ ...editValues, interest_type: e.target.value })}
                    className={styles.editInput}
                  >
                    <option value="simple">단리</option>
                    <option value="monthly_compound">월복리</option>
                    <option value="annual_compound">년복리</option>
                  </select>
                </div>
              </div>
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>가입일</span>
                <div className={styles.editField}>
                  <input
                    type="number"
                    className={styles.editInputSmall}
                    value={editValues.start_year || ""}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        start_year: e.target.value,
                      })
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder={String(currentYear)}
                  />
                  <span className={styles.editUnit}>년</span>
                  <input
                    type="number"
                    className={styles.editInputSmall}
                    value={editValues.start_month || ""}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        start_month: e.target.value,
                      })
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    min={1}
                    max={12}
                    placeholder="1"
                  />
                  <span className={styles.editUnit}>월</span>
                </div>
              </div>
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>만기일</span>
                <div className={styles.editField}>
                  <input
                    type="number"
                    className={styles.editInputSmall}
                    value={editValues.maturity_year || ""}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        maturity_year: e.target.value,
                      })
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder={String(currentYear + 1)}
                  />
                  <span className={styles.editUnit}>년</span>
                  <input
                    type="number"
                    className={styles.editInputSmall}
                    value={editValues.maturity_month || ""}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        maturity_month: e.target.value,
                      })
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    min={1}
                    max={12}
                    placeholder="12"
                  />
                  <span className={styles.editUnit}>월</span>
                </div>
              </div>
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>비과세</span>
                <div className={styles.typeButtons}>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${
                      editValues.is_tax_free === "true" ? styles.active : ""
                    }`}
                    onClick={() =>
                      setEditValues({ ...editValues, is_tax_free: "true" })
                    }
                  >
                    O
                  </button>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${
                      editValues.is_tax_free !== "true" ? styles.active : ""
                    }`}
                    onClick={() =>
                      setEditValues({ ...editValues, is_tax_free: "false" })
                    }
                  >
                    X
                  </button>
                </div>
              </div>
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>통화</span>
                <div className={styles.editField}>
                  <select
                    className={styles.editSelect}
                    value={editValues.currency || "KRW"}
                    onChange={(e) =>
                      setEditValues({ ...editValues, currency: e.target.value })
                    }
                  >
                    {CURRENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.editActions}>
                <button className={styles.cancelBtn} onClick={cancelEdit}>
                  취소
                </button>
                <button className={styles.saveBtn} onClick={handleSave}>
                  저장
                </button>
              </div>
            </div>
          ) : null}
          </div>
        )}
      </div>

      {/* 추가/수정 모달 */}
      {isAdding && (
        <div className={styles.modalOverlay} onClick={cancelEdit}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>새 예적금 추가</h3>
              <button className={styles.modalCloseBtn} onClick={cancelEdit}>
                <Plus size={18} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>유형</span>
                <div className={styles.typeButtons}>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${editValues.account_type === "deposit" ? styles.active : ""}`}
                    onClick={() => setEditValues({ ...editValues, account_type: "deposit" })}
                  >
                    예금
                  </button>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${editValues.account_type === "savings" ? styles.active : ""}`}
                    onClick={() => setEditValues({ ...editValues, account_type: "savings" })}
                  >
                    적금
                  </button>
                </div>
              </div>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>상품명</span>
                <input
                  type="text"
                  className={styles.formInput}
                  value={editValues.name || ""}
                  onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                  placeholder="예: 정기예금 1년"
                />
              </div>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>금융사</span>
                <input
                  type="text"
                  className={styles.formInput}
                  value={editValues.broker_name || ""}
                  onChange={(e) => setEditValues({ ...editValues, broker_name: e.target.value })}
                  placeholder="예: 국민은행"
                />
              </div>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>{editValues.account_type === "savings" ? "납입금" : "예치금"}</span>
                <div className={styles.inputGroup}>
                  <input
                    type="number"
                    className={styles.formInputNumber}
                    value={editValues.current_balance || ""}
                    onChange={(e) => setEditValues({ ...editValues, current_balance: e.target.value })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="0"
                  />
                  <span className={styles.inputUnit}>만원</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>이율</span>
                <div className={styles.inputGroup}>
                  <input
                    type="number"
                    className={styles.formInputNumber}
                    value={editValues.interest_rate || ""}
                    onChange={(e) => setEditValues({ ...editValues, interest_rate: e.target.value })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="0.0"
                    step="0.1"
                  />
                  <span className={styles.inputUnit}>%</span>
                </div>
              </div>
              {editValues.account_type === "savings" && (
                <div className={styles.formRow}>
                  <span className={styles.formLabel}>월 납입액</span>
                  <div className={styles.inputGroup}>
                    <input
                      type="number"
                      className={styles.formInputNumber}
                      value={editValues.monthly_contribution || ""}
                      onChange={(e) => setEditValues({ ...editValues, monthly_contribution: e.target.value })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.inputUnit}>만원</span>
                  </div>
                </div>
              )}
              <div className={styles.formRow}>
                <span className={styles.formLabel}>가입일</span>
                <div className={styles.dateInputGroup}>
                  <input
                    type="number"
                    className={styles.dateInput}
                    value={editValues.start_year || ""}
                    onChange={(e) => setEditValues({ ...editValues, start_year: e.target.value })}
                    placeholder="YYYY"
                  />
                  <span>년</span>
                  <input
                    type="number"
                    className={styles.dateInput}
                    value={editValues.start_month || ""}
                    onChange={(e) => setEditValues({ ...editValues, start_month: e.target.value })}
                    placeholder="MM"
                  />
                  <span>월</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>만기일</span>
                <div className={styles.dateInputGroup}>
                  <input
                    type="number"
                    className={styles.dateInput}
                    value={editValues.maturity_year || ""}
                    onChange={(e) => setEditValues({ ...editValues, maturity_year: e.target.value })}
                    placeholder="YYYY"
                  />
                  <span>년</span>
                  <input
                    type="number"
                    className={styles.dateInput}
                    value={editValues.maturity_month || ""}
                    onChange={(e) => setEditValues({ ...editValues, maturity_month: e.target.value })}
                    placeholder="MM"
                  />
                  <span>월</span>
                </div>
              </div>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                <button className={styles.saveBtn} onClick={handleSave}>저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
