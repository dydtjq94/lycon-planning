"use client";

import { useState, useEffect } from "react";
import { X, Edit2, Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Account, AccountType, AccountInput, Owner } from "@/types/tables";

// 폼 데이터 타입 (duration_months, balance_date 추가)
type AccountFormData = Partial<AccountInput> & { duration_months?: number; balance_date?: string; owner?: Owner };
import { formatWon } from "@/lib/utils";
import { getBrokerLogo } from "@/lib/constants/financial";
import { useChartTheme } from "@/hooks/useChartTheme";
import styles from "./AccountManagementModal.module.css";

type TabType = "checking" | "savings" | "investment" | "pension_savings" | "irp" | "dc" | "isa";

const ALL_TABS: { key: TabType; label: string }[] = [
  { key: "checking", label: "입출금" },
  { key: "savings", label: "예금/적금" },
  { key: "investment", label: "투자" },
  { key: "pension_savings", label: "연금저축" },
  { key: "irp", label: "IRP" },
  { key: "dc", label: "퇴직연금 DC" },
  { key: "isa", label: "ISA" },
];

interface AccountManagementModalProps {
  profileId: string;
  onClose: () => void;
  initialTab?: TabType;
  isMarried?: boolean;
  triggerRect?: { top: number; left: number; width: number } | null;
  visibleTabs?: TabType[];
  title?: string;
}

import { BANK_OPTIONS, SECURITIES_OPTIONS } from '@/lib/constants/financial'

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

// 투자 계좌 유형
const INVESTMENT_ACCOUNT_TYPE_OPTIONS = [
  { value: "general", label: "일반" },
] as const;

// IRP 계좌 유형
const IRP_ACCOUNT_TYPE_OPTIONS = [
  { value: "irp", label: "IRP" },
] as const;

// DC형 퇴직연금 유형
const DC_ACCOUNT_TYPE_OPTIONS = [
  { value: "dc", label: "DC형 퇴직연금" },
] as const;

// ISA 계좌 유형
const ISA_ACCOUNT_TYPE_OPTIONS = [
  { value: "isa", label: "ISA" },
] as const;

// 연금저축 계좌 유형
const PENSION_SAVINGS_ACCOUNT_TYPE_OPTIONS = [
  { value: "pension_savings", label: "연금저축" },
] as const;

// 모든 유형 레이블 조회용
const ALL_ACCOUNT_TYPE_OPTIONS = [
  { value: "checking", label: "입출금" },
  { value: "deposit", label: "정기예금" },
  { value: "savings", label: "정기적금" },
  { value: "free_savings", label: "자유적금" },
  { value: "housing", label: "청약" },
  { value: "general", label: "일반" },
  { value: "isa", label: "ISA" },
  { value: "pension_savings", label: "연금저축" },
  { value: "irp", label: "IRP" },
  { value: "dc", label: "DC형 퇴직연금" },
] as const;


export function AccountManagementModal({ profileId, onClose, initialTab = "checking", isMarried = false, triggerRect, visibleTabs, title }: AccountManagementModalProps) {
  const tabs = visibleTabs ? ALL_TABS.filter(t => visibleTabs.includes(t.key)) : ALL_TABS;
  const modalTitle = title || "계좌 관리";
  const { isDark } = useChartTheme();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // ESC로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // 계좌 데이터
  const [checkingAccounts, setCheckingAccounts] = useState<Account[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<Account[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<Account[]>([]);
  const [pensionSavingsAccounts, setPensionSavingsAccounts] = useState<Account[]>([]);
  const [irpAccounts, setIrpAccounts] = useState<Account[]>([]);
  const [dcAccounts, setDcAccounts] = useState<Account[]>([]);
  const [isaAccounts, setIsaAccounts] = useState<Account[]>([]);
  // 폼 상태
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountFormData, setAccountFormData] = useState<AccountFormData>({});

  // 폼 표시 상태
  const [showAccountForm, setShowAccountForm] = useState(false);

  // 데이터 로드
  useEffect(() => {
    loadAllAccounts();
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
      setInvestmentAccounts(data.filter(a => a.account_type === "general"));
      setPensionSavingsAccounts(data.filter(a => a.account_type === "pension_savings"));
      setIrpAccounts(data.filter(a => a.account_type === "irp"));
      setDcAccounts(data.filter(a => a.account_type === "dc"));
      setIsaAccounts(data.filter(a => a.account_type === "isa"));
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

    // 잔액 기준일 설정
    if (activeTab === "checking" && accountFormData.balance_date) {
      payload.balance_updated_at = new Date(accountFormData.balance_date + "T00:00:00").toISOString();
    } else if (activeTab === "savings") {
      // 정기 예금/적금은 가입일 기준
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
    setShowAccountForm(true);
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
    setShowAccountForm(false);
  };

  // 탭 변경 시 폼 리셋
  useEffect(() => {
    resetAccountForm();
  }, [activeTab]);

  // 유틸 함수
  const getAccountTypesForTab = (tab: TabType): string[] => {
    switch (tab) {
      case "checking": return ["checking"];
      case "savings": return ["savings", "deposit", "free_savings", "housing"];
      case "investment": return ["general"];
      case "pension_savings": return ["pension_savings"];
      case "irp": return ["irp"];
      case "dc": return ["dc"];
      case "isa": return ["isa"];
    }
  };

  const getDefaultAccountType = (tab: TabType): AccountType => {
    switch (tab) {
      case "checking": return "checking";
      case "savings": return "deposit";
      case "investment": return "general";
      case "pension_savings": return "pension_savings";
      case "irp": return "irp";
      case "dc": return "dc";
      case "isa": return "isa";
    }
  };

  const isListMode = !!visibleTabs;

  const getBrokerOptionsForTab = (tab: TabType) => {
    return tab === "checking" || tab === "savings" ? BANK_OPTIONS : SECURITIES_OPTIONS;
  };
  const getBrokerOptions = () => getBrokerOptionsForTab(activeTab);

  const getAccountTypeOptionsForTab = (tab: TabType) => {
    switch (tab) {
      case "checking": return BANK_ACCOUNT_TYPE_OPTIONS;
      case "savings": return SAVINGS_ACCOUNT_TYPE_OPTIONS;
      case "investment": return INVESTMENT_ACCOUNT_TYPE_OPTIONS;
      case "pension_savings": return PENSION_SAVINGS_ACCOUNT_TYPE_OPTIONS;
      case "irp": return IRP_ACCOUNT_TYPE_OPTIONS;
      case "dc": return DC_ACCOUNT_TYPE_OPTIONS;
      case "isa": return ISA_ACCOUNT_TYPE_OPTIONS;
    }
  };
  const getAccountTypeOptions = () => getAccountTypeOptionsForTab(activeTab);

  // 탭에서 계좌유형 드롭다운을 보여줄지 여부 (여러 유형이 있는 탭만)
  const shouldShowAccountTypeDropdownForTab = (tab: TabType) => {
    return tab === "savings";
  };
  const shouldShowAccountTypeDropdown = () => shouldShowAccountTypeDropdownForTab(activeTab);

  const getAccountsForTab = (tab: TabType) => {
    switch (tab) {
      case "checking": return checkingAccounts;
      case "savings": return savingsAccounts;
      case "investment": return investmentAccounts;
      case "pension_savings": return pensionSavingsAccounts;
      case "irp": return irpAccounts;
      case "dc": return dcAccounts;
      case "isa": return isaAccounts;
    }
  };
  const getCurrentAccounts = () => getAccountsForTab(activeTab);

  const getAccountTypeLabel = (type: string) => {
    return ALL_ACCOUNT_TYPE_OPTIONS.find(opt => opt.value === type)?.label || type;
  };

  // 리스트 모드용 인라인 폼
  const renderListModeForm = () => (
    <div className={styles.formSection}>
      <div className={styles.formSectionHeader}>
        <h4>{editingAccountId ? "계좌 수정" : "새 계좌 추가"}</h4>
        <button onClick={resetAccountForm} className={styles.formCloseBtn}>
          <X size={16} />
        </button>
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>소유자</label>
          {isMarried ? (
            <select value={accountFormData.owner || "self"} onChange={(e) => setAccountFormData({ ...accountFormData, owner: e.target.value as Owner })} className={styles.select}>
              <option value="self">본인</option>
              <option value="spouse">배우자</option>
            </select>
          ) : (
            <div className={styles.ownerFixed}>본인</div>
          )}
        </div>
        <div className={styles.formGroup}>
          <label>유형</label>
          <select
            value={accountFormData.account_type || "general"}
            onChange={(e) => setAccountFormData({ ...accountFormData, account_type: e.target.value as AccountType })}
            className={styles.select}
          >
            {tabs.flatMap(t => getAccountTypeOptionsForTab(t.key).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            )))}
          </select>
        </div>
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>계좌명</label>
          <input type="text" placeholder="예: 미국주식 계좌" value={accountFormData.name || ""} onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })} className={styles.input} />
        </div>
        <div className={styles.formGroup}>
          <label>증권사</label>
          <select value={accountFormData.broker_name || ""} onChange={(e) => setAccountFormData({ ...accountFormData, broker_name: e.target.value })} className={styles.select}>
            <option value="">선택</option>
            {SECURITIES_OPTIONS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.formRow} style={{ alignItems: 'center' }}>
        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={accountFormData.is_default || false} onChange={(e) => setAccountFormData({ ...accountFormData, is_default: e.target.checked })} />
            <span>기본 계좌로 설정</span>
          </label>
        </div>
        <div className={styles.formActions}>
          <button onClick={handleSaveAccount} className={styles.submitBtn}>
            {editingAccountId ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );

  // Calculate modal position
  const modalStyle: React.CSSProperties = {
    background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
  };

  if (triggerRect) {
    const modalWidth = 700;
    let left = triggerRect.left;
    if (left + modalWidth > window.innerWidth - 16) {
      left = window.innerWidth - modalWidth - 16;
    }
    if (left < 16) left = 16;

    modalStyle.position = 'fixed';
    modalStyle.top = triggerRect.top + 6;
    modalStyle.left = left;
  }

  const isCentered = !triggerRect;

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      style={isCentered ? { display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 276 } : undefined}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={modalStyle}>
        <div className={styles.modalHeader}>
          <h3>{modalTitle}</h3>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* 탭 (리스트 모드에서는 숨김) */}
        {!isListMode && (
          <div className={styles.tabs}>
            {tabs.map(t => (
              <button
                key={t.key}
                className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.modalContent}>
          {isListMode ? (
            /* 리스트 모드: 플랫 리스트 + 하단 추가 버튼 하나 */
            <>
              {(() => {
                const allAccounts = tabs.flatMap(t => getAccountsForTab(t.key));
                return allAccounts.length === 0 && !showAccountForm ? (
                  <div className={styles.emptyState}>등록된 계좌가 없습니다.</div>
                ) : (
                  allAccounts.map((account) => {
                    if (account.id === editingAccountId) {
                      // 인라인 수정 폼
                      return (
                        <div key={account.id} className={styles.inlineFormWrap}>
                          {renderListModeForm()}
                        </div>
                      );
                    }
                    const logo = getBrokerLogo(account.broker_name);
                    return (
                      <div key={account.id} className={styles.listItem}>
                        {logo ? (
                          <img src={logo} alt={account.broker_name} className={styles.brokerLogo} />
                        ) : (
                          <div className={styles.brokerLogoPlaceholder} />
                        )}
                        <div className={styles.listItemInfo}>
                          <div className={styles.listItemName}>
                            {account.name}
                            {account.is_default && <span className={styles.defaultBadge}>기본</span>}
                          </div>
                          <div className={styles.listItemMeta}>
                            {getAccountTypeLabel(account.account_type || "")}
                            {" · "}{account.broker_name}
                            {isMarried && ` · ${account.owner === "spouse" ? "배우자" : "본인"}`}
                          </div>
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
                );
              })()}

              {/* 새 계좌 추가 폼 (수정 중이 아닐 때만) */}
              {showAccountForm && !editingAccountId ? (
                <div className={styles.inlineFormWrap}>
                  {renderListModeForm()}
                </div>
              ) : !editingAccountId && !showAccountForm ? (
                <button
                  className={styles.addSectionButton}
                  onClick={() => { resetAccountForm(); setShowAccountForm(true); }}
                  type="button"
                >
                  <Plus size={16} />
                  추가
                </button>
              ) : null}
            </>
          ) : (
          <>
          {/* 탭 모드: 기존 단일 섹션 */}
          <div className={styles.listSection}>
            <h4>등록된 계좌</h4>
            {getCurrentAccounts().length === 0 ? (
              <div className={styles.emptyState}>등록된 계좌가 없습니다.</div>
            ) : (
              getCurrentAccounts().map((account) => {
                const logo = getBrokerLogo(account.broker_name);
                return (
                <div key={account.id} className={styles.listItem}>
                  {logo ? (
                    <img src={logo} alt={account.broker_name} className={styles.brokerLogo} />
                  ) : (
                    <div className={styles.brokerLogoPlaceholder} />
                  )}
                  <div className={styles.listItemInfo}>
                    <div className={styles.listItemName}>
                      {account.name}
                      {account.is_default && <span className={styles.defaultBadge}>기본</span>}
                    </div>
                    <div className={styles.listItemMeta}>
                      {getAccountTypeLabel(account.account_type || "")}
                      {" · "}{account.broker_name}
                      {isMarried && ` · ${account.owner === "spouse" ? "배우자" : "본인"}`}
                    </div>
                    {(account.start_year || account.interest_rate || (account.current_balance !== null && account.current_balance > 0) || account.monthly_contribution || account.maturity_year || account.is_tax_free) && (
                      <div className={styles.listItemMeta}>
                        {account.start_year && `${account.start_year}.${String(account.start_month || 1).padStart(2, "0")}.${String(account.start_day || 1).padStart(2, "0")} 가입`}
                        {account.interest_rate && `${account.start_year ? " · " : ""}${account.interest_rate}% (${account.interest_type === 'simple' ? '단리' : account.interest_type === 'monthly_compound' ? '월복리' : '년복리'})`}
                        {account.current_balance !== null && account.current_balance > 0 && `${account.start_year || account.interest_rate ? " · " : ""}${formatWon(account.current_balance)}`}
                        {account.monthly_contribution && ` · 월 ${formatWon(account.monthly_contribution)}`}
                        {account.maturity_year && ` · ${account.maturity_year}.${String(account.maturity_month || 1).padStart(2, "0")}.${String(account.maturity_day || 1).padStart(2, "0")} 만기`}
                        {account.is_tax_free && " · 비과세"}
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

          {/* 새 계좌 추가 버튼 or 폼 */}
          {showAccountForm || editingAccountId ? (
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
              {shouldShowAccountTypeDropdown() && (
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
                <label>{activeTab === "checking" || activeTab === "savings" ? "은행" : "증권사"}</label>
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
                  placeholder={activeTab === "checking" || activeTab === "savings" ? "예: 월급통장" : "예: 미국주식 계좌"}
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
                    max="9999-12-31"
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
                        max={9999}
                        value={accountFormData.start_year || ""}
                        onChange={(e) => {
                          if (e.target.value.length > 4) return;
                          setAccountFormData({ ...accountFormData, start_year: parseInt(e.target.value) || undefined });
                        }}
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
            <div className={styles.formRow} style={{ alignItems: 'center' }}>
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
          ) : (
            <button
              className={styles.addSectionButton}
              onClick={() => { resetAccountForm(); setShowAccountForm(true); }}
              type="button"
            >
              <Plus size={16} />
              새 계좌 추가
            </button>
          )}
          </>
          )}

        </div>
      </div>
    </div>
  );
}
