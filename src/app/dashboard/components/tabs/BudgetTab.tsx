"use client";

import { useState, useMemo } from "react";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useBudgetCategories,
  useBudgetTransactions,
  useMonthlySummary,
  useCreateTransaction,
  useDeleteTransaction,
} from "@/hooks/useBudget";
import type { BudgetTransaction, TransactionType } from "@/lib/services/budgetService";
import { formatMoney } from "@/lib/utils";
import styles from "./BudgetTab.module.css";

interface BudgetTabProps {
  profileId: string;
}

// 기본 카테고리 목록 (DB에서 가져오기 전 폴백)
const DEFAULT_EXPENSE_CATEGORIES = [
  "식비", "주거", "교통", "통신", "의료", "문화", "교육", "의류", "경조사", "기타"
];
const DEFAULT_INCOME_CATEGORIES = ["급여", "부수입", "이자/배당", "기타"];

export function BudgetTab({ profileId }: BudgetTabProps) {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<TransactionType>("expense");

  // 데이터 조회
  const { data: categories = [] } = useBudgetCategories(profileId);
  const { data: transactions = [], isLoading } = useBudgetTransactions(
    profileId,
    selectedYear,
    selectedMonth
  );
  const { data: expenseSummary = [] } = useMonthlySummary(
    profileId,
    selectedYear,
    selectedMonth,
    "expense"
  );
  const { data: incomeSummary = [] } = useMonthlySummary(
    profileId,
    selectedYear,
    selectedMonth,
    "income"
  );

  // Mutations
  const createMutation = useCreateTransaction(profileId, selectedYear, selectedMonth);
  const deleteMutation = useDeleteTransaction(profileId, selectedYear, selectedMonth);

  // 카테고리 목록 (DB에서 가져온 것 또는 기본값)
  const expenseCategories = useMemo(() => {
    const dbCategories = categories
      .filter((c) => c.type === "expense")
      .map((c) => c.name);
    return dbCategories.length > 0 ? dbCategories : DEFAULT_EXPENSE_CATEGORIES;
  }, [categories]);

  const incomeCategories = useMemo(() => {
    const dbCategories = categories
      .filter((c) => c.type === "income")
      .map((c) => c.name);
    return dbCategories.length > 0 ? dbCategories : DEFAULT_INCOME_CATEGORIES;
  }, [categories]);

  // 총합 계산
  const totalExpense = expenseSummary.reduce((sum, s) => sum + s.total, 0);
  const totalIncome = incomeSummary.reduce((sum, s) => sum + s.total, 0);

  // 월 이동
  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // 거래 추가
  const handleAddTransaction = (data: {
    type: TransactionType;
    category: string;
    title: string;
    amount: number;
    day: number | null;
    memo: string;
  }) => {
    createMutation.mutate(
      {
        profile_id: profileId,
        type: data.type,
        category: data.category,
        title: data.title,
        amount: data.amount,
        year: selectedYear,
        month: selectedMonth,
        day: data.day,
        memo: data.memo || null,
      },
      {
        onSuccess: () => {
          setShowForm(false);
        },
      }
    );
  };

  // 거래 삭제
  const handleDelete = (id: string) => {
    if (confirm("이 거래를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className={styles.container}>
      {/* 월 선택기 */}
      <div className={styles.header}>
        <div className={styles.monthSelector}>
          <button onClick={goToPrevMonth} className={styles.monthButton}>
            <ChevronLeft size={20} />
          </button>
          <span className={styles.monthLabel}>
            {selectedYear}년 {selectedMonth}월
          </span>
          <button onClick={goToNextMonth} className={styles.monthButton}>
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          className={styles.addButton}
          onClick={() => {
            setFormType("expense");
            setShowForm(true);
          }}
        >
          <Plus size={16} />
          추가
        </button>
      </div>

      <div className={styles.content}>
        {/* 왼쪽: 카테고리 요약 */}
        <div className={styles.summarySection}>
          <div className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>지출</h3>
            <div className={styles.summaryTotal}>
              {formatMoney(totalExpense)}
            </div>
            <div className={styles.categoryList}>
              {expenseSummary.map((item) => (
                <div key={item.category} className={styles.categoryRow}>
                  <span className={styles.categoryName}>{item.category}</span>
                  <span className={styles.categoryAmount}>
                    {formatMoney(item.total)}
                  </span>
                </div>
              ))}
              {expenseSummary.length === 0 && (
                <div className={styles.emptyText}>지출 내역이 없습니다</div>
              )}
            </div>
          </div>

          <div className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>수입</h3>
            <div className={styles.summaryTotalIncome}>
              {formatMoney(totalIncome)}
            </div>
            <div className={styles.categoryList}>
              {incomeSummary.map((item) => (
                <div key={item.category} className={styles.categoryRow}>
                  <span className={styles.categoryName}>{item.category}</span>
                  <span className={styles.categoryAmount}>
                    {formatMoney(item.total)}
                  </span>
                </div>
              ))}
              {incomeSummary.length === 0 && (
                <div className={styles.emptyText}>수입 내역이 없습니다</div>
              )}
            </div>
          </div>

          <div className={styles.balanceCard}>
            <span className={styles.balanceLabel}>잔액</span>
            <span
              className={
                totalIncome - totalExpense >= 0
                  ? styles.balancePositive
                  : styles.balanceNegative
              }
            >
              {formatMoney(totalIncome - totalExpense)}
            </span>
          </div>
        </div>

        {/* 오른쪽: 거래 목록 */}
        <div className={styles.transactionSection}>
          <h3 className={styles.sectionTitle}>거래 내역</h3>

          {isLoading ? (
            <div className={styles.loading}>로딩 중...</div>
          ) : transactions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>이번 달 거래 내역이 없습니다</p>
              <button
                className={styles.addFirstButton}
                onClick={() => {
                  setFormType("expense");
                  setShowForm(true);
                }}
              >
                첫 거래 추가하기
              </button>
            </div>
          ) : (
            <div className={styles.transactionList}>
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onDelete={() => handleDelete(tx.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 거래 추가 폼 모달 */}
      {showForm && (
        <TransactionForm
          type={formType}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          month={selectedMonth}
          onSubmit={handleAddTransaction}
          onClose={() => setShowForm(false)}
          onTypeChange={setFormType}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}

// 거래 행 컴포넌트
function TransactionRow({
  transaction,
  onDelete,
}: {
  transaction: BudgetTransaction;
  onDelete: () => void;
}) {
  const isExpense = transaction.type === "expense";

  return (
    <div className={styles.transactionRow}>
      <div className={styles.transactionDate}>
        {transaction.day ? `${transaction.month}/${transaction.day}` : `${transaction.month}월`}
      </div>
      <div className={styles.transactionCategory}>{transaction.category}</div>
      <div className={styles.transactionTitle}>{transaction.title}</div>
      <div
        className={
          isExpense ? styles.transactionAmountExpense : styles.transactionAmountIncome
        }
      >
        {isExpense ? "-" : "+"}
        {formatMoney(transaction.amount)}
      </div>
      <button className={styles.deleteButton} onClick={onDelete}>
        <X size={14} />
      </button>
    </div>
  );
}

// 거래 추가 폼 컴포넌트
function TransactionForm({
  type,
  expenseCategories,
  incomeCategories,
  month,
  onSubmit,
  onClose,
  onTypeChange,
  isLoading,
}: {
  type: TransactionType;
  expenseCategories: string[];
  incomeCategories: string[];
  month: number;
  onSubmit: (data: {
    type: TransactionType;
    category: string;
    title: string;
    amount: number;
    day: number | null;
    memo: string;
  }) => void;
  onClose: () => void;
  onTypeChange: (type: TransactionType) => void;
  isLoading: boolean;
}) {
  const categories = type === "expense" ? expenseCategories : incomeCategories;
  const [category, setCategory] = useState(categories[0] || "");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState<string>("");
  const [memo, setMemo] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title || !amount) return;

    onSubmit({
      type,
      category,
      title,
      amount: parseInt(amount, 10),
      day: day ? parseInt(day, 10) : null,
      memo,
    });
  };

  // 타입 변경 시 카테고리도 리셋
  const handleTypeChange = (newType: TransactionType) => {
    onTypeChange(newType);
    const newCategories = newType === "expense" ? expenseCategories : incomeCategories;
    setCategory(newCategories[0] || "");
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>거래 추가</h3>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 지출/수입 선택 */}
          <div className={styles.typeSelector}>
            <button
              type="button"
              className={`${styles.typeButton} ${type === "expense" ? styles.typeButtonActive : ""}`}
              onClick={() => handleTypeChange("expense")}
            >
              지출
            </button>
            <button
              type="button"
              className={`${styles.typeButton} ${type === "income" ? styles.typeButtonActiveIncome : ""}`}
              onClick={() => handleTypeChange("income")}
            >
              수입
            </button>
          </div>

          {/* 날짜 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>날짜</label>
            <div className={styles.dateInputGroup}>
              <span className={styles.monthDisplay}>{month}월</span>
              <input
                type="number"
                className={styles.dayInput}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="일"
                min={1}
                max={31}
              />
              <span className={styles.unitText}>일</span>
              <span className={styles.optionalText}>(선택)</span>
            </div>
          </div>

          {/* 카테고리 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>카테고리</label>
            <select
              className={styles.select}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* 내용 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>내용</label>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 점심, 교통카드 충전"
            />
          </div>

          {/* 금액 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>금액</label>
            <div className={styles.amountInputGroup}>
              <input
                type="number"
                className={styles.amountInput}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.unitText}>만원</span>
            </div>
          </div>

          {/* 메모 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>메모</label>
            <input
              type="text"
              className={styles.input}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="(선택)"
            />
          </div>

          {/* 버튼 */}
          <div className={styles.formButtons}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={!category || !title || !amount || isLoading}
            >
              {isLoading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
