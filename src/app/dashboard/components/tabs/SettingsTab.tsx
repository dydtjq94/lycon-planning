"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User, Sun, Moon, Monitor, HelpCircle, Palette, CreditCard, X, Plus, FileText, Lock, Pencil, Check, Info } from "lucide-react";
import { useTheme, type ColorMode, type AccentColor } from "@/contexts/ThemeContext";
import { ProfileBasics, FamilyMember } from "@/contexts/FinancialContext";
import { createFamilyMember, updateFamilyMember, deleteFamilyMember } from "@/lib/services/familyService";
import { getBrokerLogo, getCardLogo } from "@/lib/constants/financial";
import type { Account, PaymentMethod } from "@/types/tables";
import { AccountManagementModal } from "../AccountManagementModal";
import ReactMarkdown from "react-markdown";
import { CURRENT_VERSION, VERSION_HISTORY } from "@/lib/constants/versionHistory";
import styles from "./SettingsTab.module.css";
type ChartThemeId = "default" | "pastel" | "mono" | "vivid" | "ocean" | "sunset" | "forest" | "neon" | "retro" | "candy";

interface AccentColorOption {
  id: AccentColor;
  name: string;
  color: string;
}

interface ChartTheme {
  id: ChartThemeId;
  name: string;
  colors: string[];
}

const accentColors: AccentColorOption[] = [
  { id: "blue", name: "블루", color: "#007aff" },
  { id: "purple", name: "퍼플", color: "#a855f7" },
  { id: "green", name: "그린", color: "#22c55e" },
  { id: "teal", name: "틸", color: "#14b8a6" },
  { id: "indigo", name: "인디고", color: "#6366f1" },
  { id: "rose", name: "로즈", color: "#f43f5e" },
  { id: "orange", name: "오렌지", color: "#f97316" },
  { id: "amber", name: "앰버", color: "#f59e0b" },
  { id: "black", name: "블랙", color: "#525252" },
  { id: "cyan", name: "시안", color: "#06b6d4" },
];

const chartThemes: ChartTheme[] = [
  {
    id: "default",
    name: "기본",
    colors: ["#3b82f6", "#22c55e", "#8b5cf6", "#f59e0b", "#ef4444"],
  },
  {
    id: "pastel",
    name: "파스텔",
    colors: ["#93c5fd", "#86efac", "#c4b5fd", "#fcd34d", "#fca5a5"],
  },
  {
    id: "mono",
    name: "모노톤",
    colors: ["#1f2937", "#374151", "#6b7280", "#9ca3af", "#d1d5db"],
  },
  {
    id: "vivid",
    name: "비비드",
    colors: ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#dc2626"],
  },
  {
    id: "ocean",
    name: "오션",
    colors: ["#0ea5e9", "#06b6d4", "#0891b2", "#0284c7", "#38bdf8"],
  },
  {
    id: "sunset",
    name: "선셋",
    colors: ["#f97316", "#f59e0b", "#ec4899", "#ef4444", "#fb923c"],
  },
  {
    id: "forest",
    name: "포레스트",
    colors: ["#22c55e", "#16a34a", "#84cc16", "#65a30d", "#4ade80"],
  },
  {
    id: "neon",
    name: "네온",
    colors: ["#a855f7", "#06b6d4", "#f43f5e", "#22d3ee", "#d946ef"],
  },
  {
    id: "retro",
    name: "레트로",
    colors: ["#d97706", "#b45309", "#a16207", "#92400e", "#ca8a04"],
  },
  {
    id: "candy",
    name: "캔디",
    colors: ["#ec4899", "#f472b6", "#a855f7", "#c084fc", "#f9a8d4"],
  },
];

const RELATIONSHIP_LABELS: Record<string, string> = {
  self: "본인",
  spouse: "배우자",
  child: "자녀",
  parent: "부양가족",
};

type MenuId = "profile" | "account" | "appearance" | "help" | "version";

interface MenuItem {
  id: MenuId;
  label: string;
  icon: React.ReactNode;
}

const menuItems: MenuItem[] = [
  { id: "profile", label: "내 정보", icon: <User size={18} /> },
  { id: "account", label: "계좌 관리", icon: <CreditCard size={18} /> },
  { id: "appearance", label: "모양", icon: <Palette size={18} /> },
  { id: "help", label: "더보기", icon: <HelpCircle size={18} /> },
  { id: "version", label: `v${CURRENT_VERSION}`, icon: <Info size={18} /> },
];

const menuTitles: Record<MenuId, string> = {
  profile: "내 정보",
  account: "계좌 관리",
  appearance: "모양",
  help: "더보기",
  version: `v${CURRENT_VERSION}`,
};

interface SettingsTabProps {
  profile: ProfileBasics;
  familyMembers: FamilyMember[];
  onFamilyMembersChange: (members: FamilyMember[]) => void;
  onProfileUpdate: (updates: Partial<ProfileBasics>) => void;
}

export function SettingsTab({ profile, familyMembers, onFamilyMembersChange, onProfileUpdate }: SettingsTabProps) {
  const router = useRouter();
  const { colorMode, accentColor, setColorMode, setAccentColor } = useTheme();
  const [currentChartTheme, setCurrentChartTheme] = useState<ChartThemeId>("default");
  const [selectedMenu, setSelectedMenu] = useState<MenuId>("profile");

  // 계좌 관리 상태
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accountOwnerFilter, setAccountOwnerFilter] = useState<"all" | "self" | "spouse">("all");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<"checking" | "savings" | "investment" | "pension_savings" | "irp" | "isa">("checking");

  const loadAccounts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (data) setAccounts(data);

    const { data: pmData } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("is_active", true);
    if (pmData) setPaymentMethods(pmData);
  }, [profile.id]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // 가족 구성원 상태
  const [members, setMembers] = useState<FamilyMember[]>(familyMembers);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"name" | "birth_date" | null>(null);
  const [editValue, setEditValue] = useState("");

  // 프로필(본인) 편집 상태
  const [editingProfileField, setEditingProfileField] = useState<"name" | "birth_date" | null>(null);
  const [editProfileValue, setEditProfileValue] = useState("");

  // 생애 주기 상태
  const spouse = members.find((m) => m.relationship === "spouse");
  const [selfRetirementAge, setSelfRetirementAge] = useState(profile.target_retirement_age);
  const [selfLifeExpectancy, setSelfLifeExpectancy] = useState(profile.settings?.lifeExpectancy || 85);
  const [spouseRetirementAge, setSpouseRetirementAge] = useState(spouse?.retirement_age || 65);
  const [spouseLifeExpectancy, setSpouseLifeExpectancy] = useState(profile.settings?.lifeExpectancy || 85);

  // familyMembers 프롭이 변경되면 로컬 상태 업데이트
  useEffect(() => {
    setMembers(familyMembers);
  }, [familyMembers]);

  const calculateAge = useCallback((birthDate: string | null): string => {
    if (!birthDate) return "";
    const currentYear = new Date().getFullYear();
    const birthYear = parseInt(birthDate.split("-")[0]);
    const age = currentYear - birthYear;
    return `${age}세`;
  }, []);

  useEffect(() => {
    // 차트 테마 로드
    const savedChart = localStorage.getItem("chart-theme") as ChartThemeId | null;
    if (savedChart && chartThemes.some((t) => t.id === savedChart)) {
      setCurrentChartTheme(savedChart);
    }
  }, []);

  const handleColorModeChange = (mode: ColorMode) => {
    setColorMode(mode);
  };

  const handleAccentColorChange = (accent: AccentColor) => {
    setAccentColor(accent);
  };

  const handleChartThemeChange = (themeId: ChartThemeId) => {
    setCurrentChartTheme(themeId);
    localStorage.setItem("chart-theme", themeId);
    window.dispatchEvent(new CustomEvent("chart-theme-change", { detail: themeId }));
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // 가족 구성원 CRUD
  const handleAddMember = useCallback(async (
    relationship: "spouse" | "child" | "parent",
    options?: { gender?: "male" | "female"; name?: string }
  ) => {
    const defaultName = options?.name
      || (relationship === "child" ? (options?.gender === "male" ? "아들" : "딸") : RELATIONSHIP_LABELS[relationship]);
    const newMember = await createFamilyMember({
      user_id: profile.id,
      relationship,
      name: defaultName,
      birth_date: null,
      gender: options?.gender || null,
      is_dependent: relationship !== "spouse",
      is_working: relationship === "spouse",
      retirement_age: relationship === "spouse" ? 65 : null,
      monthly_income: 0,
      notes: null,
    });
    if (newMember) {
      const next = [...members, newMember];
      setMembers(next);
      onFamilyMembersChange(next);
    }
  }, [profile.id, members, onFamilyMembersChange]);

  const handleUpdateMember = useCallback(async (id: string, updates: Record<string, any>) => {
    const updated = await updateFamilyMember(id, updates);
    if (updated) {
      const next = members.map((m) => (m.id === id ? updated : m));
      setMembers(next);
      onFamilyMembersChange(next);
    }
  }, [members, onFamilyMembersChange]);

  const handleDeleteMember = useCallback(async (id: string) => {
    const success = await deleteFamilyMember(id);
    if (success) {
      const next = members.filter((m) => m.id !== id);
      setMembers(next);
      onFamilyMembersChange(next);
    }
  }, [members, onFamilyMembersChange]);

  const startEdit = useCallback((memberId: string, field: "name" | "birth_date", currentValue: string) => {
    setEditingMemberId(memberId);
    setEditingField(field);
    setEditValue(currentValue || "");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingMemberId || !editingField) return;
    // 빈 문자열은 null로 변환 (date 타입 컬럼에 빈 문자열 불가)
    const value = editValue || null;
    await handleUpdateMember(editingMemberId, { [editingField]: value });
    setEditingMemberId(null);
    setEditingField(null);
  }, [editingMemberId, editingField, editValue, handleUpdateMember]);

  const startProfileEdit = useCallback((field: "name" | "birth_date", currentValue: string) => {
    setEditingProfileField(field);
    setEditProfileValue(currentValue || "");
  }, []);

  const saveProfileEdit = useCallback(() => {
    if (!editingProfileField) return;
    const value = editProfileValue || null;
    onProfileUpdate({ [editingProfileField]: value });
    setEditingProfileField(null);
  }, [editingProfileField, editProfileValue, onProfileUpdate]);

  // 생애 주기 저장
  const handleSaveSelfRetirementAge = useCallback(async (value: number) => {
    onProfileUpdate({ target_retirement_age: value });
  }, [onProfileUpdate]);

  const handleSaveSelfLifeExpectancy = useCallback(async (value: number) => {
    onProfileUpdate({ settings: { ...profile.settings, lifeExpectancy: value } });
  }, [onProfileUpdate, profile.settings]);

  const handleSaveSpouseRetirementAge = useCallback(async (value: number) => {
    if (!spouse) return;
    await handleUpdateMember(spouse.id, { retirement_age: value });
  }, [spouse, handleUpdateMember]);

  const handleSaveSpouseLifeExpectancy = useCallback(async (value: number) => {
    const newSettings = { ...profile.settings, lifeExpectancy: profile.settings?.lifeExpectancy || 85 };
    (newSettings as any).spouseLifeExpectancy = value;
    onProfileUpdate({ settings: newSettings });
  }, [onProfileUpdate, profile.settings]);

  // Content renderers
  const renderProfileContent = () => (
    <div className={styles.contentBody}>
      {/* 기본 정보 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>기본 정보</h3>
        <div className={styles.menuList}>
          <div className={styles.profileRow}>
            <span className={styles.profileLabel}>이름</span>
            {editingProfileField === "name" ? (
              <input
                className={styles.nameInput}
                value={editProfileValue}
                onChange={(e) => setEditProfileValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveProfileEdit();
                  if (e.key === "Escape") setEditingProfileField(null);
                }}
                autoFocus
              />
            ) : (
              <span className={styles.profileValue}>{profile.name || "이름 없음"}</span>
            )}
            <button
              className={styles.profileEditBtn}
              onClick={() => {
                if (editingProfileField === "name") {
                  saveProfileEdit();
                } else {
                  startProfileEdit("name", profile.name || "");
                }
              }}
            >
              {editingProfileField === "name" ? <Check size={14} /> : <Pencil size={14} />}
            </button>
          </div>
          <div className={styles.profileRow}>
            <span className={styles.profileLabel}>생년월일</span>
            {editingProfileField === "birth_date" ? (
              <input
                type="date"
                className={styles.dateInput}
                value={editProfileValue}
                onChange={(e) => setEditProfileValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveProfileEdit();
                  if (e.key === "Escape") setEditingProfileField(null);
                }}
                autoFocus
              />
            ) : (
              <span className={styles.profileValue}>
                {profile.birth_date ? `${profile.birth_date} (${calculateAge(profile.birth_date)})` : "생년월일 없음"}
              </span>
            )}
            <button
              className={styles.profileEditBtn}
              onClick={() => {
                if (editingProfileField === "birth_date") {
                  saveProfileEdit();
                } else {
                  startProfileEdit("birth_date", profile.birth_date || "");
                }
              }}
            >
              {editingProfileField === "birth_date" ? <Check size={14} /> : <Pencil size={14} />}
            </button>
          </div>
        </div>
      </section>

      {/* 가족 구성 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>가족 구성</h3>
        <div className={styles.menuList}>
          {/* 본인 */}
          <div className={styles.memberRow}>
            <span className={styles.roleBadge}>본인</span>
            <div className={styles.memberInfo}>
              <span className={styles.memberName}>{profile.name || "이름 없음"}</span>
              <span className={styles.memberBirth}>
                {profile.birth_date ? `${profile.birth_date} (${calculateAge(profile.birth_date)})` : "생년월일 없음"}
              </span>
            </div>
          </div>

          {/* 가족 구성원 */}
          {members
            .filter((m) => m.relationship !== "self")
            .map((member) => (
              <div key={member.id} className={styles.memberRow}>
                <span className={styles.roleBadge}>
                  {member.relationship === "child"
                    ? (member.gender === "male" ? "아들" : member.gender === "female" ? "딸" : "자녀")
                    : (RELATIONSHIP_LABELS[member.relationship] || member.relationship)}
                </span>
                <div className={styles.memberInfo}>
                  {editingMemberId === member.id && editingField === "name" ? (
                    <input
                      className={styles.nameInput}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") {
                          setEditingMemberId(null);
                          setEditingField(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className={styles.memberName}
                      onClick={() => startEdit(member.id, "name", member.name)}
                    >
                      {member.name}
                    </span>
                  )}
                  {editingMemberId === member.id && editingField === "birth_date" ? (
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") {
                          setEditingMemberId(null);
                          setEditingField(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className={styles.memberBirth}
                      onClick={() => startEdit(member.id, "birth_date", member.birth_date || "")}
                    >
                      {member.birth_date
                        ? `${member.birth_date} (${calculateAge(member.birth_date)})`
                        : "생년월일 없음"}
                    </span>
                  )}
                </div>
                <button
                  className={styles.memberDeleteBtn}
                  onClick={() => handleDeleteMember(member.id)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}

          {/* 추가 버튼 */}
          <div className={styles.addButtonsRow}>
            {!members.some((m) => m.relationship === "spouse") && (
              <button
                className={styles.addMemberBtn}
                onClick={() => handleAddMember("spouse")}
              >
                + 배우자 추가
              </button>
            )}
            <button
              className={styles.addMemberBtn}
              onClick={() => handleAddMember("child", { gender: "male" })}
            >
              + 아들 추가
            </button>
            <button
              className={styles.addMemberBtn}
              onClick={() => handleAddMember("child", { gender: "female" })}
            >
              + 딸 추가
            </button>
            <button
              className={styles.addMemberBtn}
              onClick={() => handleAddMember("parent")}
            >
              + 부양가족 추가
            </button>
          </div>
        </div>
      </section>

      {/* 생애 주기 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>생애 주기</h3>
        <div className={styles.menuList}>
          <div className={styles.lifeCycleRow}>
            <span className={styles.lifeCycleLabel}>본인 은퇴 나이</span>
            <div className={styles.lifeCycleInputGroup}>
              <input
                type="number"
                className={styles.lifeCycleInput}
                value={selfRetirementAge}
                onChange={(e) => setSelfRetirementAge(parseInt(e.target.value) || 0)}
                onBlur={() => handleSaveSelfRetirementAge(selfRetirementAge)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
              />
              <span className={styles.lifeCycleUnit}>세</span>
            </div>
          </div>

          <div className={styles.lifeCycleRow}>
            <span className={styles.lifeCycleLabel}>본인 기대 수명</span>
            <div className={styles.lifeCycleInputGroup}>
              <input
                type="number"
                className={styles.lifeCycleInput}
                value={selfLifeExpectancy}
                onChange={(e) => setSelfLifeExpectancy(parseInt(e.target.value) || 0)}
                onBlur={() => handleSaveSelfLifeExpectancy(selfLifeExpectancy)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
              />
              <span className={styles.lifeCycleUnit}>세</span>
            </div>
          </div>

          {spouse && (
            <>
              <div className={styles.lifeCycleRow}>
                <span className={styles.lifeCycleLabel}>배우자 은퇴 나이</span>
                <div className={styles.lifeCycleInputGroup}>
                  <input
                    type="number"
                    className={styles.lifeCycleInput}
                    value={spouseRetirementAge}
                    onChange={(e) => setSpouseRetirementAge(parseInt(e.target.value) || 0)}
                    onBlur={() => handleSaveSpouseRetirementAge(spouseRetirementAge)}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.lifeCycleUnit}>세</span>
                </div>
              </div>

              <div className={styles.lifeCycleRow}>
                <span className={styles.lifeCycleLabel}>배우자 기대 수명</span>
                <div className={styles.lifeCycleInputGroup}>
                  <input
                    type="number"
                    className={styles.lifeCycleInput}
                    value={spouseLifeExpectancy}
                    onChange={(e) => setSpouseLifeExpectancy(parseInt(e.target.value) || 0)}
                    onBlur={() => handleSaveSpouseLifeExpectancy(spouseLifeExpectancy)}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.lifeCycleUnit}>세</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );

  const renderAppearanceContent = () => (
    <div className={styles.contentBody}>
      {/* 색상 모드 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>색상 모드</h2>
        <div className={styles.colorModeContainer}>
          <button
            className={`${styles.colorModeBtn} ${colorMode === "light" ? styles.colorModeBtnActive : ""}`}
            onClick={() => handleColorModeChange("light")}
          >
            <Sun size={18} />
            <span>라이트</span>
          </button>
          <button
            className={`${styles.colorModeBtn} ${colorMode === "dark" ? styles.colorModeBtnActive : ""}`}
            onClick={() => handleColorModeChange("dark")}
          >
            <Moon size={18} />
            <span>다크</span>
          </button>
          <button
            className={`${styles.colorModeBtn} ${colorMode === "system" ? styles.colorModeBtnActive : ""}`}
            onClick={() => handleColorModeChange("system")}
          >
            <Monitor size={18} />
            <span>시스템</span>
          </button>
        </div>
      </section>

      {/* 액센트 색상 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>액센트 색상</h2>
        <div className={styles.accentGrid}>
          {accentColors.map((color) => (
            <button
              key={color.id}
              className={`${styles.accentCard} ${accentColor === color.id ? styles.accentCardActive : ""}`}
              onClick={() => handleAccentColorChange(color.id)}
            >
              <div
                className={styles.accentDot}
                style={{ backgroundColor: color.color }}
              />
              <span className={styles.accentName}>{color.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 차트 색상 설정 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>차트 색상</h2>
        <div className={styles.chartList}>
          {chartThemes.map((theme) => (
            <button
              key={theme.id}
              className={`${styles.chartRow} ${currentChartTheme === theme.id ? styles.chartRowActive : ""}`}
              onClick={() => handleChartThemeChange(theme.id)}
            >
              <div className={styles.chartDots}>
                {theme.colors.map((color, idx) => (
                  <div
                    key={idx}
                    className={styles.chartDot}
                    style={{ backgroundColor: color, zIndex: theme.colors.length - idx }}
                  />
                ))}
              </div>
              <span className={styles.chartThemeName}>{theme.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  const renderAccountContent = () => {
    const filtered = accountOwnerFilter === "all"
      ? accounts
      : accounts.filter(a => a.owner === accountOwnerFilter);
    const checkingAccounts = filtered.filter(a => a.account_type === "checking");
    const savingsAccounts = filtered.filter(a => ["savings", "deposit", "free_savings", "housing"].includes(a.account_type || ""));
    const investmentAccounts = filtered.filter(a => a.account_type === "general");
    const pensionSavingsAccounts = filtered.filter(a => a.account_type === "pension_savings");
    const irpAccounts = filtered.filter(a => ["irp", "dc"].includes(a.account_type || ""));
    const isaAccounts = filtered.filter(a => a.account_type === "isa");

    const TYPE_LABELS: Record<string, string> = {
      checking: "입출금", savings: "정기적금", deposit: "정기예금",
      free_savings: "자유적금", housing: "청약", general: "일반",
      isa: "ISA", pension_savings: "연금저축", irp: "IRP", dc: "DC형",
    };

    const PAYMENT_TYPE_LABELS: Record<string, string> = {
      debit_card: "체크카드", credit_card: "신용카드", pay: "페이",
    };

    const renderAccountGroup = (title: string, list: Account[], tab: "checking" | "savings" | "investment" | "pension_savings" | "irp" | "isa", desc?: string) => (
      <section className={styles.section} key={tab}>
        <div className={styles.accountSectionHeader}>
          <h3 className={styles.sectionTitle}>{title}</h3>
          {desc && <span className={styles.accountSectionDesc}>{desc}</span>}
          <button
            className={styles.accountAddBtn}
            onClick={() => { setAccountModalTab(tab); setShowAccountModal(true); }}
          >
            <Plus size={14} />
            추가
          </button>
        </div>
        <div className={styles.menuList}>
          {list.length === 0 ? (
            <div className={styles.accountEmptyRow}>등록된 계좌가 없습니다</div>
          ) : (
            list.map((account) => {
              const logo = getBrokerLogo(account.broker_name);
              const linkedPms = tab === "checking"
                ? paymentMethods.filter(pm => pm.account_id === account.id)
                : [];
              return (
                <div key={account.id}>
                  <div
                    className={`${styles.accountRow} ${linkedPms.length > 0 ? styles.accountRowNoBottomBorder : ""}`}
                    onClick={() => { setAccountModalTab(tab); setShowAccountModal(true); }}
                  >
                    {logo ? (
                      <img src={logo} alt={account.broker_name} className={styles.accountLogo} />
                    ) : (
                      <div className={styles.accountLogoPlaceholder}>
                        <CreditCard size={16} />
                      </div>
                    )}
                    <div className={styles.accountInfo}>
                      <div className={styles.accountName}>
                        {account.name}
                        {account.is_default && <span className={styles.accountDefaultBadge}>기본</span>}
                      </div>
                      <div className={styles.accountMeta}>
                        {account.owner === "spouse" ? "배우자" : "본인"}
                        {" · "}{TYPE_LABELS[account.account_type || ""] || account.account_type}
                        {" · "}{account.broker_name}
                      </div>
                    </div>
                    <div className={styles.accountBalance} />
                  </div>
                  {linkedPms.length > 0 && (
                    <div className={styles.linkedPayments}>
                      {linkedPms.map((pm, idx) => {
                        const cardLogo = getCardLogo(pm.card_company);
                        const isLast = idx === linkedPms.length - 1;
                        return (
                          <div key={pm.id} className={styles.linkedPaymentRow}>
                            <div className={styles.treeLine}>
                              <span className={isLast ? styles.treeCorner : styles.treeTee} />
                            </div>
                            {cardLogo ? (
                              <img src={cardLogo} alt={pm.card_company || ""} className={styles.linkedPaymentLogo} />
                            ) : (
                              <div className={styles.linkedPaymentLogoPlaceholder}>
                                <CreditCard size={12} />
                              </div>
                            )}
                            <span className={styles.linkedPaymentName}>{pm.name}</span>
                            <span className={styles.linkedPaymentType}>
                              {PAYMENT_TYPE_LABELS[pm.type] || pm.type}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    );

    return (
      <div className={styles.contentBody}>
        {renderAccountGroup("입출금 계좌", checkingAccounts, "checking", "카드와 페이는 가계부 작성을 위해 등록하면 편합니다")}
        {renderAccountGroup("정기 예금/적금", savingsAccounts, "savings")}
        {renderAccountGroup("투자 계좌", investmentAccounts, "investment")}
        {renderAccountGroup("연금저축", pensionSavingsAccounts, "pension_savings")}
        {renderAccountGroup("IRP", irpAccounts, "irp")}
        {renderAccountGroup("ISA", isaAccounts, "isa")}
      </div>
    );
  };

  const renderVersionContent = () => (
    <div className={styles.contentBody}>
      {VERSION_HISTORY.map((entry) => (
        <section key={entry.version} className={styles.section}>
          <div className={styles.versionHeader}>
            <span className={styles.versionTag}>v{entry.version}</span>
            <span className={styles.versionDate}>{entry.date}</span>
            {!entry.summary && (
              <span className={styles.versionDevBadge}>개발 중</span>
            )}
          </div>
          {entry.summary && (
            <div className={styles.versionSummary}>
              <ReactMarkdown>{entry.summary}</ReactMarkdown>
            </div>
          )}
        </section>
      ))}
    </div>
  );

  const renderHelpContent = () => (
    <div className={styles.contentBody}>
      <section className={styles.section}>
        <div className={styles.menuList}>
          <button className={styles.helpRow}>
            <FileText size={16} />
            <span>이용약관</span>
          </button>
          <button className={styles.helpRow}>
            <Lock size={16} />
            <span>개인정보처리방침</span>
          </button>
        </div>
      </section>
    </div>
  );

  const renderContent = () => {
    switch (selectedMenu) {
      case "profile":
        return renderProfileContent();
      case "account":
        return renderAccountContent();
      case "appearance":
        return renderAppearanceContent();
      case "help":
        return renderHelpContent();
      case "version":
        return renderVersionContent();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.settingsLayout}>
        {/* Sidebar */}
        <nav className={styles.sidebar}>
          <h1 className={styles.sidebarTitle}>설정</h1>
          <div className={styles.sidebarMenu}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`${styles.sidebarItem} ${selectedMenu === item.id ? styles.sidebarItemActive : ""}`}
                onClick={() => setSelectedMenu(item.id)}
              >
                <span className={styles.sidebarItemIcon}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.sidebarBottom}>
            <button className={styles.logoutButton} onClick={handleLogout}>
              <LogOut size={18} />
              <span>로그아웃</span>
            </button>
          </div>
        </nav>

        {/* Content Panel */}
        <div className={styles.contentPanel}>
          <div className={styles.contentHeader}>
            <h2 className={styles.contentTitle}>{menuTitles[selectedMenu]}</h2>
            {selectedMenu === "account" && members.some(m => m.relationship === "spouse") && (
              <div className={styles.ownerToggle}>
                {(["all", "self", "spouse"] as const).map((v) => (
                  <button
                    key={v}
                    className={`${styles.ownerToggleBtn} ${accountOwnerFilter === v ? styles.ownerToggleBtnActive : ""}`}
                    onClick={() => setAccountOwnerFilter(v)}
                  >
                    {v === "all" ? "전체" : v === "self" ? "본인" : "배우자"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {renderContent()}
        </div>
      </div>

      {showAccountModal && (
        <AccountManagementModal
          profileId={profile.id}
          onClose={() => { setShowAccountModal(false); loadAccounts(); }}
          initialTab={accountModalTab}
          isMarried={members.some(m => m.relationship === "spouse")}
        />
      )}
    </div>
  );
}
