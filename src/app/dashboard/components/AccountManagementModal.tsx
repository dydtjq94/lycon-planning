"use client";

import { useState, useEffect } from "react";
import { X, Edit2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Account, AccountType, AccountInput, PaymentMethod, PaymentMethodType, PaymentMethodInput, Owner } from "@/types/tables";

// 폼 데이터 타입 (duration_months, balance_date 추가)
type AccountFormData = Partial<AccountInput> & { duration_months?: number; balance_date?: string; owner?: Owner };
import { formatWon } from "@/lib/utils";
import styles from "./AccountManagementModal.module.css";

type TabType = "checking" | "savings" | "securities";

interface AccountManagementModalProps {
  profileId: string;
  onClose: () => void;
  initialTab?: TabType;
  isMarried?: boolean;
}

import { BANK_OPTIONS, SECURITIES_OPTIONS, CARD_COMPANY_OPTIONS } from '@/lib/constants/financial'

// 은행 계좌 유형
const BANK_ACCOUNT_TYPE_OPTIONS = [
  { value: "checking", label: "입출금" },
] as const;

// 정기 예금/적금 유형
const SAVINGS_ACCOUNT_TYPE_OPTIONS = [
  { value: "deposit", label: "정기예금" },
  { value: "savings", label: "정기적금" },
  { value: "free_savings", label: "자유적금" },
  { value: "housing", label: "청약" },
] as const;

// 증권 계좌 유형
const SECURITIES_ACCOUNT_TYPE_OPTIONS = [
  { value: "general", label: "일반" },
  { value: "isa", label: "ISA" },
  { value: "pension_savings", label: "연금저축" },
  { value: "irp", label: "IRP" },
  { value: "dc", label: "DC형 퇴직연금" },
] as const;

// 결제수단 유형
const PAYMENT_METHOD_TYPE_OPTIONS = [
  { value: "debit_card", label: "체크카드" },
  { value: "credit_card", label: "신용카드" },
  { value: "pay", label: "페이" },
] as const;


export function AccountManagementModal({ profileId, onClose, initialTab = "checking", isMarried = false }: AccountManagementModalProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // 계좌 데이터
  const [checkingAccounts, setCheckingAccounts] = useState<Account[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<Account[]>([]);
  const [securitiesAccounts, setSecuritiesAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // 폼 상태
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountFormData, setAccountFormData] = useState<AccountFormData>({});
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | null>(null);
  const [paymentMethodFormData, setPaymentMethodFormData] = useState<Partial<PaymentMethodInput>>({});

  // 데이터 로드
  useEffect(() => {
    loadAllAccounts();
    loadPaymentMethods();
  }, [profileId]);

  const loadAllAccounts = async () => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setCheckingAccounts(data.filter(a => a.account_type === "checking"));
      setSavingsAccounts(data.filter(a => ["savings", "deposit", "free_savings", "housing"].includes(a.account_type || "")));
      setSecuritiesAccounts(data.filter(a => ["general", "isa", "pension_savings", "irp", "dc"].includes(a.account_type || "")));
    }
  };

  const loadPaymentMethods = async () => {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setPaymentMethods(data);
    }
  };

  // 계좌 저장
  const handleSaveAccount = async () => {
    if (!accountFormData.name || !accountFormData.broker_name) {
      alert("계좌명과 은행/증권사를 입력해주세요.");
      return;
    }

    // 가입일 + 기간으로 만기일 계산 (청약 제외)
    let maturityYear: number | null = null;
    let maturityMonth: number | null = null;
    let maturityDay: number | null = null;

    // 청약은 만기 없음
    if (accountFormData.account_type !== "housing") {
      if (accountFormData.duration_months && accountFormData.start_year && accountFormData.start_month) {
        const startDay = accountFormData.start_day || 1;
        const startDate = new Date(accountFormData.start_year, accountFormData.start_month - 1, startDay);
        startDate.setMonth(startDate.getMonth() + accountFormData.duration_months);
        maturityYear = startDate.getFullYear();
        maturityMonth = startDate.getMonth() + 1;
        maturityDay = startDate.getDate();
      } else {
        maturityYear = accountFormData.maturity_year || null;
        maturityMonth = accountFormData.maturity_month || null;
        maturityDay = accountFormData.maturity_day || null;
      }
    }

    const payload: AccountInput & { balance_updated_at?: string } = {
      profile_id: profileId,
      name: accountFormData.name,
      broker_name: accountFormData.broker_name,
      account_number: accountFormData.account_number || null,
      account_type: accountFormData.account_type || "checking",
      owner: accountFormData.owner || "self",
      current_balance: accountFormData.current_balance || 0,
      is_default: accountFormData.is_default || false,
      interest_rate: accountFormData.interest_rate || null,
      start_year: accountFormData.start_year || null,
      start_month: accountFormData.start_month || null,
      start_day: accountFormData.start_day || null,
      maturity_year: maturityYear,
      maturity_month: maturityMonth,
      maturity_day: maturityDay,
      monthly_contribution: accountFormData.monthly_contribution || null,
      is_tax_free: accountFormData.is_tax_free || false,
      interest_type: (accountFormData.interest_type as any) || 'simple',
    };

    // 기본 계좌 설정 시 같은 유형의 기존 기본 계좌 해제
    if (payload.is_default) {
      const accountTypes = getAccountTypesForTab(activeTab);
      await supabase
        .from("accounts")
        .update({ is_default: false })
        .eq("profile_id", profileId)
        .in("account_type", accountTypes)
        .eq("is_default", true);
    }

    // 잔액 기준일 설정 (입출금 계좌만)
    if (activeTab === "checking" && accountFormData.balance_date) {
      payload.balance_updated_at = new Date(accountFormData.balance_date + "T00:00:00").toISOString();
    } else if (activeTab !== "checking") {
      // 다른 유형은 가입일 기준
      if (accountFormData.start_year && accountFormData.start_month) {
        const day = accountFormData.start_day || 1;
        payload.balance_updated_at = new Date(accountFormData.start_year, accountFormData.start_month - 1, day).toISOString();
      }
    }

    if (editingAccountId) {
      await supabase.from("accounts").update(payload).eq("id", editingAccountId);
    } else {
      await supabase.from("accounts").insert(payload);
    }

    resetAccountForm();
    loadAllAccounts();
  };

  const handleEditAccount = (account: Account) => {
    // 기간(개월) 계산: maturity - start
    let durationMonths: number | undefined;
    if (account.start_year && account.start_month && account.maturity_year && account.maturity_month) {
      durationMonths = (account.maturity_year - account.start_year) * 12 + (account.maturity_month - account.start_month);
    }

    setAccountFormData({
      name: account.name,
      broker_name: account.broker_name,
      account_number: account.account_number || "",
      account_type: account.account_type || "checking",
      owner: account.owner || "self",
      current_balance: account.current_balance || 0,
      is_default: account.is_default || false,
      interest_rate: account.interest_rate || undefined,
      start_year: account.start_year || undefined,
      start_month: account.start_month || undefined,
      start_day: account.start_day || undefined,
      maturity_year: account.maturity_year || undefined,
      maturity_month: account.maturity_month || undefined,
      maturity_day: account.maturity_day || undefined,
      monthly_contribution: account.monthly_contribution || undefined,
      is_tax_free: account.is_tax_free || false,
      interest_type: account.interest_type || 'simple',
      duration_months: durationMonths,
      balance_date: account.balance_updated_at
        ? new Date(account.balance_updated_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    });
    setEditingAccountId(account.id);
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("이 계좌를 삭제하시겠습니까?")) return;
    await supabase.from("accounts").update({ is_active: false }).eq("id", id);
    loadAllAccounts();
  };

  const resetAccountForm = () => {
    const defaultType = getDefaultAccountType(activeTab);
    const now = new Date();
    setAccountFormData({
      broker_name: "",
      name: "",
      account_number: "",
      account_type: defaultType,
      owner: "self",
      current_balance: 0,
      is_default: false,
      // 정기 예금/적금 탭 기본값
      start_year: activeTab === "savings" ? now.getFullYear() : undefined,
      start_month: activeTab === "savings" ? now.getMonth() + 1 : undefined,
      start_day: activeTab === "savings" ? now.getDate() : undefined,
      duration_months: activeTab === "savings" ? 12 : undefined,
      is_tax_free: false,
      interest_type: 'simple',
      // 입출금 계좌 잔액 기준일 (오늘)
      balance_date: now.toISOString().split("T")[0],
    });
    setEditingAccountId(null);
  };

  // 결제수단 저장
  const handleSavePaymentMethod = async () => {
    if (!paymentMethodFormData.name || !paymentMethodFormData.account_id) {
      alert("결제수단 이름과 연결 계좌를 선택해주세요.");
      return;
    }

    const payload: PaymentMethodInput = {
      profile_id: profileId,
      account_id: paymentMethodFormData.account_id,
      name: paymentMethodFormData.name,
      type: paymentMethodFormData.type || "debit_card",
      card_company: paymentMethodFormData.card_company || null,
    };

    if (editingPaymentMethodId) {
      await supabase.from("payment_methods").update(payload).eq("id", editingPaymentMethodId);
    } else {
      await supabase.from("payment_methods").insert(payload);
    }

    resetPaymentMethodForm();
    loadPaymentMethods();
  };

  const handleEditPaymentMethod = (pm: PaymentMethod) => {
    setPaymentMethodFormData({
      account_id: pm.account_id,
      name: pm.name,
      type: pm.type,
      card_company: pm.card_company || "",
    });
    setEditingPaymentMethodId(pm.id);
  };

  const handleDeletePaymentMethod = async (id: string) => {
    if (!confirm("이 결제수단을 삭제하시겠습니까?")) return;
    await supabase.from("payment_methods").update({ is_active: false }).eq("id", id);
    loadPaymentMethods();
  };

  const resetPaymentMethodForm = () => {
    setPaymentMethodFormData({
      account_id: checkingAccounts[0]?.id || "",
      name: "",
      type: "debit_card",
      card_company: "",
    });
    setEditingPaymentMethodId(null);
  };

  // 탭 변경 시 폼 리셋
  useEffect(() => {
    resetAccountForm();
    resetPaymentMethodForm();
  }, [activeTab]);

  // 유틸 함수
  const getAccountTypesForTab = (tab: TabType): string[] => {
    switch (tab) {
      case "checking": return ["checking"];
      case "savings": return ["savings", "deposit", "free_savings", "housing"];
      case "securities": return ["general", "isa", "pension_savings", "irp", "dc"];
    }
  };

  const getDefaultAccountType = (tab: TabType): AccountType => {
    switch (tab) {
      case "checking": return "checking";
      case "savings": return "deposit";  // 정기예금을 기본으로
      case "securities": return "general";
    }
  };

  const getBrokerOptions = () => {
    return activeTab === "securities" ? SECURITIES_OPTIONS : BANK_OPTIONS;
  };

  const getAccountTypeOptions = () => {
    switch (activeTab) {
      case "checking": return BANK_ACCOUNT_TYPE_OPTIONS;
      case "savings": return SAVINGS_ACCOUNT_TYPE_OPTIONS;
      case "securities": return SECURITIES_ACCOUNT_TYPE_OPTIONS;
    }
  };

  const getCurrentAccounts = () => {
    switch (activeTab) {
      case "checking": return checkingAccounts;
      case "savings": return savingsAccounts;
      case "securities": return securitiesAccounts;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    const allOptions = [...BANK_ACCOUNT_TYPE_OPTIONS, ...SAVINGS_ACCOUNT_TYPE_OPTIONS, ...SECURITIES_ACCOUNT_TYPE_OPTIONS];
    return allOptions.find(opt => opt.value === type)?.label || type;
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>계좌 관리</h3>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* 탭 */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "checking" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("checking")}
          >
            입출금
          </button>
          <button
            className={`${styles.tab} ${activeTab === "savings" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("savings")}
          >
            정기 예금/적금
          </button>
          <button
            className={`${styles.tab} ${activeTab === "securities" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("securities")}
          >
            증권
          </button>
        </div>

        <div className={styles.modalContent}>
          {/* 계좌 추가/수정 폼 */}
          <div className={styles.formSection}>
            <h4>{editingAccountId ? "계좌 수정" : "새 계좌 추가"}</h4>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>소유자</label>
                {isMarried ? (
                  <select
                    value={accountFormData.owner || "self"}
                    onChange={(e) => setAccountFormData({ ...accountFormData, owner: e.target.value as Owner })}
                    className={styles.select}
                  >
                    <option value="self">본인</option>
                    <option value="spouse">배우자</option>
                  </select>
                ) : (
                  <div className={styles.ownerFixed}>본인</div>
                )}
              </div>
              {activeTab !== "checking" && (
                <div className={styles.formGroup}>
                  <label>유형</label>
                  <select
                    value={accountFormData.account_type || getDefaultAccountType(activeTab)}
                    onChange={(e) => setAccountFormData({ ...accountFormData, account_type: e.target.value as AccountType })}
                    className={styles.select}
                  >
                    {getAccountTypeOptions().map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.formGroup}>
                <label>{activeTab === "securities" ? "증권사" : "은행"}</label>
                <select
                  value={accountFormData.broker_name || ""}
                  onChange={(e) => setAccountFormData({ ...accountFormData, broker_name: e.target.value })}
                  className={styles.select}
                >
                  <option value="">선택</option>
                  {getBrokerOptions().map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>계좌명</label>
                <input
                  type="text"
                  placeholder={activeTab === "securities" ? "예: 미국주식 계좌" : "예: 월급통장"}
                  value={accountFormData.name || ""}
                  onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label>계좌번호 (선택)</label>
                <input
                  type="text"
                  placeholder="예: ****-****-1234"
                  value={accountFormData.account_number || ""}
                  onChange={(e) => setAccountFormData({ ...accountFormData, account_number: e.target.value })}
                  className={styles.input}
                />
              </div>
            </div>
            {activeTab === "checking" && (
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>현재 잔액 (원)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={accountFormData.current_balance || ""}
                    onChange={(e) => setAccountFormData({ ...accountFormData, current_balance: parseInt(e.target.value) || 0 })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>잔액 기준일</label>
                  <input
                    type="date"
                    value={accountFormData.balance_date || ""}
                    onChange={(e) => setAccountFormData({ ...accountFormData, balance_date: e.target.value })}
                    className={styles.input}
                  />
                </div>
              </div>
            )}
            {activeTab === "savings" && (
              <>
                {/* 가입일 - 모든 유형 공통 */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>가입일</label>
                    <div className={styles.dateInputs}>
                      <input
                        type="number"
                        placeholder={String(new Date().getFullYear())}
                        value={accountFormData.start_year || ""}
                        onChange={(e) => setAccountFormData({ ...accountFormData, start_year: parseInt(e.target.value) || undefined })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className={styles.input}
                      />
                      <span>년</span>
                      <input
                        type="number"
                        placeholder={String(new Date().getMonth() + 1)}
                        min={1}
                        max={12}
                        value={accountFormData.start_month || ""}
                        onChange={(e) => setAccountFormData({ ...accountFormData, start_month: parseInt(e.target.value) || undefined })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className={styles.input}
                      />
                      <span>월</span>
                      <input
                        type="number"
                        placeholder={String(new Date().getDate())}
                        min={1}
                        max={31}
                        value={accountFormData.start_day || ""}
                        onChange={(e) => setAccountFormData({ ...accountFormData, start_day: parseInt(e.target.value) || undefined })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className={styles.input}
                      />
                      <span>일</span>
                    </div>
                  </div>
                  {/* 기간 - 청약 제외 */}
                  {accountFormData.account_type !== "housing" && (
                    <div className={styles.formGroup}>
                      <label>기간</label>
                      <div className={styles.dateInputs}>
                        <input
                          type="number"
                          placeholder="12"
                          min={1}
                          value={accountFormData.duration_months || ""}
                          onChange={(e) => setAccountFormData({ ...accountFormData, duration_months: parseInt(e.target.value) || undefined })}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={styles.input}
                        />
                        <span>개월</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.formRow}>
                  <div className={styles.interestGroup}>
                    <label>이율 (%)</label>
                    <input
                      type="number"
                      placeholder="3.5"
                      step="0.1"
                      value={accountFormData.interest_rate || ""}
                      onChange={(e) => setAccountFormData({ ...accountFormData, interest_rate: parseFloat(e.target.value) || undefined })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.interestGroup}>
                    <label>이자방식</label>
                    <select
                      value={accountFormData.interest_type || "simple"}
                      onChange={(e) => setAccountFormData({ ...accountFormData, interest_type: e.target.value as any })}
                      className={styles.select}
                    >
                      <option value="simple">단리</option>
                      <option value="monthly_compound">월복리</option>
                      <option value="annual_compound">년복리</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={accountFormData.is_tax_free || false}
                        onChange={(e) => setAccountFormData({ ...accountFormData, is_tax_free: e.target.checked })}
                      />
                      비과세
                    </label>
                  </div>
                </div>
                {/* 금액 필드 - 유형별 */}
                <div className={styles.formRow}>
                  {/* 정기예금: 예치금 */}
                  {accountFormData.account_type === "deposit" && (
                    <div className={styles.formGroup}>
                      <label>예치금 (원)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={accountFormData.current_balance || ""}
                        onChange={(e) => setAccountFormData({ ...accountFormData, current_balance: parseInt(e.target.value) || 0 })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className={styles.input}
                      />
                    </div>
                  )}
                  {/* 정기적금: 월납입 */}
                  {accountFormData.account_type === "savings" && (
                    <div className={styles.formGroup}>
                      <label>월납입 (원)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={accountFormData.monthly_contribution || ""}
                        onChange={(e) => setAccountFormData({ ...accountFormData, monthly_contribution: parseInt(e.target.value) || undefined })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className={styles.input}
                      />
                    </div>
                  )}
                  {/* 자유적금: 현재 납입액 */}
                  {accountFormData.account_type === "free_savings" && (
                    <div className={styles.formGroup}>
                      <label>현재 납입액 (원)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={accountFormData.current_balance || ""}
                        onChange={(e) => setAccountFormData({ ...accountFormData, current_balance: parseInt(e.target.value) || 0 })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className={styles.input}
                      />
                    </div>
                  )}
                  {/* 청약: 월납입 + 현재 납입액 */}
                  {accountFormData.account_type === "housing" && (
                    <>
                      <div className={styles.formGroup}>
                        <label>월납입 (원, 최대 50만)</label>
                        <input
                          type="number"
                          placeholder="0"
                          max={500000}
                          value={accountFormData.monthly_contribution || ""}
                          onChange={(e) => setAccountFormData({ ...accountFormData, monthly_contribution: Math.min(parseInt(e.target.value) || 0, 500000) || undefined })}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>현재 납입액 (원)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={accountFormData.current_balance || ""}
                          onChange={(e) => setAccountFormData({ ...accountFormData, current_balance: parseInt(e.target.value) || 0 })}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={styles.input}
                        />
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={accountFormData.is_default || false}
                    onChange={(e) => setAccountFormData({ ...accountFormData, is_default: e.target.checked })}
                  />
                  <span>기본 계좌로 설정</span>
                </label>
              </div>
              <div className={styles.formActions}>
                {editingAccountId && (
                  <button onClick={resetAccountForm} className={styles.cancelBtn}>취소</button>
                )}
                <button onClick={handleSaveAccount} className={styles.submitBtn}>
                  {editingAccountId ? "수정" : "추가"}
                </button>
              </div>
            </div>
          </div>

          {/* 계좌 목록 */}
          <div className={styles.listSection}>
            <h4>등록된 계좌</h4>
            {getCurrentAccounts().length === 0 ? (
              <div className={styles.emptyState}>등록된 계좌가 없습니다.</div>
            ) : (
              getCurrentAccounts().map((account) => {
                const linkedPayments = activeTab === "checking"
                  ? paymentMethods.filter(pm => pm.account_id === account.id)
                  : [];
                return (
                  <div key={account.id} className={styles.listItem}>
                    <div className={styles.listItemInfo}>
                      <div className={styles.listItemName}>
                        {account.name}
                        {account.is_default && <span className={styles.defaultBadge}>기본</span>}
                      </div>
                      <div className={styles.listItemMeta}>
                        {getAccountTypeLabel(account.account_type || "")}
                        {" · "}{account.broker_name}
                        {isMarried && ` · ${account.owner === "spouse" ? "배우자" : "본인"}`}
                        {account.start_year && ` · ${account.start_year}.${String(account.start_month || 1).padStart(2, "0")}.${String(account.start_day || 1).padStart(2, "0")} 가입`}
                        {account.interest_rate && ` · ${account.interest_rate}% (${account.interest_type === 'simple' ? '단리' : account.interest_type === 'monthly_compound' ? '월복리' : '년복리'})`}
                        {account.current_balance !== null && account.current_balance > 0 && ` · ${formatWon(account.current_balance)}`}
                        {account.monthly_contribution && ` · 월 ${formatWon(account.monthly_contribution)}`}
                        {account.maturity_year && ` · ${account.maturity_year}.${String(account.maturity_month || 1).padStart(2, "0")}.${String(account.maturity_day || 1).padStart(2, "0")} 만기`}
                        {account.is_tax_free && " · 비과세"}
                      </div>
                      {linkedPayments.length > 0 && (
                        <div className={styles.linkedPayments}>
                          {linkedPayments.map(pm => (
                            <span key={pm.id} className={styles.linkedPaymentBadge}>{pm.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={styles.listItemActions}>
                      <button onClick={() => handleEditAccount(account)} className={styles.actionBtn}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteAccount(account.id)} className={styles.actionBtn}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 입출금 탭에서만 결제수단 관리 */}
          {activeTab === "checking" && (
            <>
              {checkingAccounts.length > 0 && (
                <div className={styles.formSection}>
                  <h4>{editingPaymentMethodId ? "결제수단 수정" : "카드/페이 추가"}</h4>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>유형</label>
                      <select
                        value={paymentMethodFormData.type || "debit_card"}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, type: e.target.value as PaymentMethodType })}
                        className={styles.select}
                      >
                        {PAYMENT_METHOD_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>카드사/페이</label>
                      <select
                        value={paymentMethodFormData.card_company || ""}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, card_company: e.target.value })}
                        className={styles.select}
                      >
                        <option value="">선택</option>
                        {CARD_COMPANY_OPTIONS.map((company) => (
                          <option key={company} value={company}>{company}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>결제수단 이름</label>
                      <input
                        type="text"
                        placeholder="예: 신한 체크카드"
                        value={paymentMethodFormData.name || ""}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>연결 계좌</label>
                      <select
                        value={paymentMethodFormData.account_id || ""}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, account_id: e.target.value })}
                        className={styles.select}
                      >
                        <option value="">선택</option>
                        {checkingAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.formActions}>
                    {editingPaymentMethodId && (
                      <button onClick={resetPaymentMethodForm} className={styles.cancelBtn}>취소</button>
                    )}
                    <button onClick={handleSavePaymentMethod} className={styles.submitBtn}>
                      {editingPaymentMethodId ? "수정" : "추가"}
                    </button>
                  </div>
                </div>
              )}

              {paymentMethods.length > 0 && (
                <div className={styles.listSection}>
                  <h4>등록된 결제수단</h4>
                  {paymentMethods.map((pm) => {
                    const linkedAccount = checkingAccounts.find(a => a.id === pm.account_id);
                    return (
                      <div key={pm.id} className={styles.listItem}>
                        <div className={styles.listItemInfo}>
                          <div className={styles.listItemName}>{pm.name}</div>
                          <div className={styles.listItemMeta}>
                            {PAYMENT_METHOD_TYPE_OPTIONS.find(opt => opt.value === pm.type)?.label || "체크카드"}
                            {pm.card_company && ` · ${pm.card_company}`}
                            {linkedAccount && ` → ${linkedAccount.name}`}
                          </div>
                        </div>
                        <div className={styles.listItemActions}>
                          <button onClick={() => handleEditPaymentMethod(pm)} className={styles.actionBtn}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeletePaymentMethod(pm.id)} className={styles.actionBtn}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
