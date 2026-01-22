"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Calendar,
  PieChart,
  Receipt,
  Target,
  Wallet,
  Home,
  CreditCard,
  Car,
  Banknote,
  LineChart,
  Landmark,
  Shield,
  ArrowRightLeft,
  UserMinus,
} from "lucide-react";
import styles from "./AdminSidebar.module.css";

interface AdminSidebarProps {
  customerName: string;
  customerStage: string;
  currentSection: string;
  onSectionChange: (section: string) => void;
  unreadCount: number;
  onRemoveCustomer: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  new: "신규",
  first_consultation: "1차 상담",
  report_delivered: "보고서 전달",
  second_consultation: "2차 상담",
  subscription: "구독 중",
  churned: "이탈",
};

// 담당자 관련
const expertMenu = [
  { id: "chat", label: "채팅", icon: MessageCircle },
  { id: "consultation", label: "상담", icon: Calendar },
];

// 프로그레스
const progressMenu = [
  { id: "asset-snapshot", label: "자산 현황", icon: PieChart },
  { id: "household-budget", label: "가계부", icon: Receipt },
];

// 시나리오 내 서브메뉴
const scenarioOverviewMenus = [
  { id: "networth", label: "순자산", icon: PieChart },
  { id: "cashflow", label: "현금흐름", icon: ArrowRightLeft },
];

// 나의 재무
const financeSubmenus = [
  { id: "realEstate", label: "부동산", icon: Home },
  { id: "debt", label: "부채", icon: CreditCard },
  { id: "asset", label: "실물 자산", icon: Car },
  { id: "income", label: "소득", icon: Banknote },
  { id: "expense", label: "지출", icon: Receipt },
  { id: "savings", label: "저축/투자", icon: LineChart },
  { id: "pension", label: "연금", icon: Landmark },
  { id: "insurance", label: "보험", icon: Shield },
];

export function AdminSidebar({
  customerName,
  customerStage,
  currentSection,
  onSectionChange,
  unreadCount,
  onRemoveCustomer,
}: AdminSidebarProps) {
  const router = useRouter();
  const [isScenarioOpen, setIsScenarioOpen] = useState(true);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);

  const isExpertSection = expertMenu.some((item) => item.id === currentSection);
  const isProgressSection = progressMenu.some((item) => item.id === currentSection);
  const isScenarioOverview = scenarioOverviewMenus.some((item) => item.id === currentSection);
  const isFinanceSection = financeSubmenus.some((sub) => sub.id === currentSection);

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          {/* 뒤로가기 + 고객 정보 */}
          <div className={styles.customerHeader}>
            <button className={styles.backButton} onClick={() => router.push("/admin")}>
              <ChevronLeft size={18} />
            </button>
            <div className={styles.customerInfo}>
              <span className={styles.customerName}>{customerName}</span>
              <span className={`${styles.stageBadge} ${styles[customerStage]}`}>
                {STAGE_LABELS[customerStage] || customerStage}
              </span>
            </div>
          </div>

          {/* 담당자 관련 */}
          <div className={styles.sectionLabel}>담당자</div>
          {expertMenu.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${currentSection === item.id ? styles.active : ""}`}
              onClick={() => onSectionChange(item.id)}
            >
              <div className={styles.iconWrapper}>
                <item.icon size={20} />
                {item.id === "chat" && unreadCount > 0 && (
                  <span className={styles.unreadBadge}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}

          <div className={styles.divider} />

          {/* 프로그레스 */}
          <div className={styles.sectionLabel}>프로그레스</div>
          {progressMenu.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${currentSection === item.id ? styles.active : ""}`}
              onClick={() => onSectionChange(item.id)}
            >
              <item.icon size={20} />
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}

          <div className={styles.divider} />

          {/* 시나리오 */}
          <div className={styles.sectionLabel}>시나리오</div>
          <div className={styles.navGroup}>
            <button
              className={`${styles.navItem} ${
                isScenarioOverview || isFinanceSection ? styles.active : ""
              }`}
              onClick={() => setIsScenarioOpen(!isScenarioOpen)}
            >
              <Target size={20} />
              <span className={styles.navLabel}>은퇴</span>
              <span className={styles.chevron}>
                {isScenarioOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            </button>

            {isScenarioOpen && (
              <div className={styles.submenu}>
                {scenarioOverviewMenus.map((item) => (
                  <button
                    key={item.id}
                    className={`${styles.submenuItem} ${
                      currentSection === item.id ? styles.active : ""
                    }`}
                    onClick={() => onSectionChange(item.id)}
                  >
                    <item.icon size={16} />
                    <span className={styles.navLabel}>{item.label}</span>
                  </button>
                ))}

                {/* 나의 재무 */}
                <button
                  className={`${styles.submenuItem} ${isFinanceSection ? styles.active : ""}`}
                  onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                >
                  <Wallet size={16} />
                  <span className={styles.navLabel}>나의 재무</span>
                  <span className={styles.chevron}>
                    {isFinanceOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>

                {isFinanceOpen && (
                  <div className={styles.nestedSubmenu}>
                    {financeSubmenus.map((item) => (
                      <button
                        key={item.id}
                        className={`${styles.nestedItem} ${
                          currentSection === item.id ? styles.active : ""
                        }`}
                        onClick={() => onSectionChange(item.id)}
                      >
                        <item.icon size={14} />
                        <span className={styles.navLabel}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 하단: 담당 제외 */}
      <div className={styles.footer}>
        <button className={styles.removeButton} onClick={onRemoveCustomer}>
          <UserMinus size={18} />
          <span className={styles.navLabel}>담당 제외</span>
        </button>
      </div>
    </aside>
  );
}
