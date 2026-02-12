"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User, Bell, Shield, HelpCircle, ChevronRight, Check, Sun, Moon, Monitor, X } from "lucide-react";
import { useTheme, type ColorMode, type AccentColor } from "@/contexts/ThemeContext";
import { ProfileBasics, FamilyMember } from "@/contexts/FinancialContext";
import { createFamilyMember, updateFamilyMember, deleteFamilyMember } from "@/lib/services/familyService";
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

  // 가족 구성원 상태
  const [members, setMembers] = useState<FamilyMember[]>(familyMembers);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"name" | "birth_date" | null>(null);
  const [editValue, setEditValue] = useState("");

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

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {/* 프로필 섹션 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>프로필</h2>
            <div className={styles.menuList}>
              <button className={styles.menuItem}>
                <User size={20} />
                <div className={styles.menuInfo}>
                  <span className={styles.menuLabel}>내 정보</span>
                  <span className={styles.menuValue}>{profile.name || "이름 없음"}</span>
                </div>
                <ChevronRight size={16} className={styles.chevron} />
              </button>
            </div>
          </section>

          {/* 가족 구성 섹션 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>가족 구성</h2>
            <div className={styles.menuList}>
              {/* 본인 (읽기 전용) */}
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

          {/* 생애 주기 섹션 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>생애 주기</h2>
            <div className={styles.menuList}>
              {/* 본인 은퇴 나이 */}
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

              {/* 본인 기대 수명 */}
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

              {/* 배우자 설정 (배우자가 있을 때만) */}
              {spouse && (
                <>
                  <hr className={styles.lifeCycleDivider} />
                  <div className={styles.lifeCycleSectionTitle}>배우자</div>

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

          {/* 앱 설정 섹션 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>앱 설정</h2>
            <div className={styles.menuList}>
              <button className={styles.menuItem}>
                <Bell size={20} />
                <div className={styles.menuInfo}>
                  <span className={styles.menuLabel}>알림</span>
                </div>
                <ChevronRight size={16} className={styles.chevron} />
              </button>
              <button className={styles.menuItem}>
                <Shield size={20} />
                <div className={styles.menuInfo}>
                  <span className={styles.menuLabel}>보안</span>
                </div>
                <ChevronRight size={16} className={styles.chevron} />
              </button>
            </div>
          </section>

          {/* 지원 섹션 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>지원</h2>
            <div className={styles.menuList}>
              <button className={styles.menuItem}>
                <HelpCircle size={20} />
                <div className={styles.menuInfo}>
                  <span className={styles.menuLabel}>도움말</span>
                </div>
                <ChevronRight size={16} className={styles.chevron} />
              </button>
            </div>
          </section>

          {/* 로그아웃 */}
          <section className={styles.section}>
            <div className={styles.menuList}>
              <button className={styles.logoutButton} onClick={handleLogout}>
                <LogOut size={20} />
                <span>로그아웃</span>
              </button>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
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
      </div>
    </div>
  );
}
