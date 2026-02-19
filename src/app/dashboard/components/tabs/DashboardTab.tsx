"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSnapshots } from "@/hooks/useFinancialData";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatMoney } from "@/lib/utils";
import {
  MessageSquare,
  ArrowRight,
  User,
  Wallet,
  TrendingUp,
  Building2,
  Gem,
  ChevronRight,
  Check,
  CircleDollarSign,
  Receipt,
  PiggyBank,
  Users,
  BookOpen,
  Shield,
} from "lucide-react";
import { loadChatData, type Expert, type Message } from "@/lib/services/messageService";
import { getActionItems, toggleActionItem, type ActionItem } from "@/lib/services/actionItemService";
import styles from "./DashboardTab.module.css";

interface DashboardTabProps {
  simulationId: string;
  birthYear: number;
  spouseBirthYear: number | null;
  retirementAge: number | null;
  unreadMessageCount: number;
  onNavigate: (section: string) => void;
  profileId?: string;
}

interface DetectedItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  section: string;
}

export function DashboardTab({
  simulationId,
  profileId,
  unreadMessageCount,
  onNavigate,
}: DashboardTabProps) {
  const supabase = createClient();
  const { data: snapshots, isLoading: snapshotsLoading } = useSnapshots(profileId || "", !!profileId);
  const { categoryColors } = useChartTheme();

  const [expert, setExpert] = useState<Expert | null>(null);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load all data
  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);

      // Load chat data, action items, and detect missing data in parallel
      const [chatData, items] = await Promise.all([
        loadChatData().catch(() => null),
        getActionItems().catch(() => [] as ActionItem[]),
      ]);

      if (chatData) {
        setExpert(chatData.expert);
        // Get last 5 messages
        setRecentMessages(chatData.messages.slice(-5));
      }

      setActionItems(items);

      // Detect missing financial data
      await detectMissingData(simulationId);

      setIsLoading(false);
    };

    load();
  }, [profileId, simulationId]);

  // Detect missing financial data entries
  const detectMissingData = useCallback(async (simId: string) => {
    const detected: DetectedItem[] = [];

    const checks = [
      { table: "incomes", icon: <CircleDollarSign size={16} />, title: "소득 정보 입력", desc: "급여, 사업소득 등을 입력하세요", section: "simulation" },
      { table: "expenses", icon: <Receipt size={16} />, title: "지출 정보 입력", desc: "고정 지출, 생활비 등을 입력하세요", section: "simulation" },
      { table: "savings", icon: <PiggyBank size={16} />, title: "저축/투자 정보 입력", desc: "예적금, 투자 계좌를 입력하세요", section: "simulation" },
      { table: "national_pensions", icon: <Shield size={16} />, title: "국민연금 입력", desc: "국민연금 가입 정보를 입력하세요", section: "simulation" },
    ];

    const results = await Promise.all(
      checks.map((c) =>
        supabase
          .from(c.table)
          .select("id", { count: "exact", head: true })
          .eq("simulation_id", simId)
      )
    );

    results.forEach((res, i) => {
      if (!res.error && (res.count === 0 || res.count === null)) {
        detected.push({
          id: checks[i].table,
          icon: checks[i].icon,
          title: checks[i].title,
          description: checks[i].desc,
          section: checks[i].section,
        });
      }
    });

    // Check family members
    const { count: familyCount } = await supabase
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId!);

    if (familyCount === 0 || familyCount === null) {
      detected.push({
        id: "family",
        icon: <Users size={16} />,
        title: "가족 정보 입력",
        description: "배우자, 자녀 정보를 입력하세요",
        section: "settings",
      });
    }

    setDetectedItems(detected);
  }, [supabase, profileId]);

  // Snapshot data
  const latestSnapshot = snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const prevSnapshot = snapshots && snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  const netWorthChange = useMemo(() => {
    if (!latestSnapshot || !prevSnapshot) return null;
    return (latestSnapshot.net_worth || 0) - (prevSnapshot.net_worth || 0);
  }, [latestSnapshot, prevSnapshot]);

  const assetCards = useMemo(() => {
    const s = latestSnapshot;
    return [
      { label: "저축", value: s?.savings || 0, color: categoryColors.savings, icon: <Wallet size={14} /> },
      { label: "투자", value: s?.investments || 0, color: categoryColors.investment, icon: <TrendingUp size={14} /> },
      { label: "부동산", value: s?.real_estate || 0, color: categoryColors.realEstate, icon: <Building2 size={14} /> },
      { label: "실물자산", value: s?.real_assets || 0, color: categoryColors.realAsset, icon: <Gem size={14} /> },
    ];
  }, [latestSnapshot, categoryColors]);

  // Toggle action item
  const handleToggle = useCallback(async (id: string, currentState: boolean) => {
    // Optimistic update
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_completed: !currentState } : item
      )
    );

    const success = await toggleActionItem(id, !currentState);
    if (!success) {
      // Revert on failure
      setActionItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_completed: currentState } : item
        )
      );
    }
  }, []);

  // Format time relative
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "방금";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}일 전`;
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  // Skeleton
  if (isLoading || snapshotsLoading) {
    return (
      <div className={styles.skeletonContainer}>
        <div className={styles.skeletonExpert}>
          <div className={styles.skeletonExpertCard} />
          <div className={styles.skeletonMessages} />
        </div>
        <div>
          <div className={styles.skeletonAssetHeader} />
          <div className={styles.skeletonAssetGrid} style={{ marginTop: 12 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className={styles.skeletonAssetCard} />
            ))}
          </div>
        </div>
        <div className={styles.skeletonActions}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className={styles.skeletonActionItem} />
          ))}
        </div>
      </div>
    );
  }

  const incompleteActions = actionItems.filter((a) => !a.is_completed);
  const completedActions = actionItems.filter((a) => a.is_completed);

  return (
    <div className={styles.container}>
      {/* Section 1: Expert + Recent Messages */}
      {expert ? (
        <div className={styles.expertSection}>
          <div className={styles.expertCard}>
            {expert.profile_image ? (
              <img
                src={expert.profile_image}
                alt={expert.name}
                className={styles.expertAvatar}
              />
            ) : (
              <div className={styles.expertAvatarFallback}>
                <User size={24} />
              </div>
            )}
            <span className={styles.expertName}>{expert.name}</span>
            <span className={styles.expertTitle}>{expert.title}</span>
            <button
              className={styles.chatBtn}
              onClick={() => onNavigate("messages")}
            >
              <MessageSquare size={14} />
              채팅하기
              {unreadMessageCount > 0 && (
                <span className={styles.unreadBadge}>{unreadMessageCount}</span>
              )}
            </button>
          </div>

          <div className={styles.messagePreview}>
            <div className={styles.messagePreviewHeader}>
              <span className={styles.messagePreviewTitle}>최근 대화</span>
              <button className={styles.moreBtn} onClick={() => onNavigate("messages")}>
                전체보기
                <ArrowRight size={12} />
              </button>
            </div>
            {recentMessages.length > 0 ? (
              <div className={styles.messageList}>
                {recentMessages.map((msg) => (
                  <div key={msg.id} className={styles.messageRow}>
                    <span
                      className={`${styles.messageSender} ${
                        msg.sender_type === "expert" ? styles.messageSenderExpert : ""
                      }`}
                    >
                      {msg.sender_type === "expert" ? expert.name : "나"}
                    </span>
                    <span className={styles.messageContent}>{msg.content}</span>
                    <span className={styles.messageTime}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyMessages}>
                아직 대화 내역이 없습니다
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.noExpertCard}>
          <div className={styles.expertAvatarFallback}>
            <User size={24} />
          </div>
          <div className={styles.noExpertText}>
            <div className={styles.noExpertTitle}>담당 전문가 배정 대기중</div>
            <div className={styles.noExpertDesc}>
              곧 전문가가 배정됩니다. 채팅에서 확인해 보세요.
            </div>
          </div>
          <button className={styles.chatBtn} onClick={() => onNavigate("messages")}>
            <MessageSquare size={14} />
            채팅
          </button>
        </div>
      )}

      {/* Section 2: Asset Summary */}
      <div className={styles.assetSection}>
        <div className={styles.assetHeader}>
          <span className={styles.netWorthLabel}>순자산</span>
          <span className={styles.netWorthValue}>
            {formatMoney(latestSnapshot?.net_worth || 0)}
          </span>
          {netWorthChange !== null ? (
            <span
              className={`${styles.netWorthChange} ${
                netWorthChange >= 0 ? styles.positive : styles.negative
              }`}
            >
              {netWorthChange >= 0 ? "+" : ""}
              {formatMoney(netWorthChange)}
            </span>
          ) : (
            <span className={`${styles.netWorthChange} ${styles.muted}`}>
              첫 기록
            </span>
          )}
        </div>
        <div className={styles.assetGrid}>
          {assetCards.map((card) => (
            <div
              key={card.label}
              className={styles.assetCard}
              onClick={() => onNavigate("current-asset")}
            >
              <div className={styles.assetCardHeader}>
                <span
                  className={styles.assetCardDot}
                  style={{ backgroundColor: card.color }}
                />
                <span className={styles.assetCardLabel}>{card.label}</span>
              </div>
              <span className={styles.assetCardValue}>
                {formatMoney(card.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Action Items */}
      <div className={styles.actionSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>다음 할 일</span>
        </div>

        {detectedItems.length === 0 && actionItems.length === 0 ? (
          <div className={styles.emptyAction}>
            모든 항목이 완료되었습니다
          </div>
        ) : (
          <div className={styles.actionList}>
            {/* Auto-detected missing data */}
            {detectedItems.length > 0 && (
              <div className={styles.actionGroup}>
                <span className={styles.actionGroupLabel}>데이터 입력</span>
                {detectedItems.map((item) => (
                  <div
                    key={item.id}
                    className={styles.detectedItem}
                    onClick={() => onNavigate(item.section)}
                  >
                    <div className={styles.detectedIcon}>{item.icon}</div>
                    <div className={styles.detectedText}>
                      <div className={styles.detectedTitle}>{item.title}</div>
                      <div className={styles.detectedDesc}>{item.description}</div>
                    </div>
                    <ChevronRight size={16} className={styles.detectedArrow} />
                  </div>
                ))}
              </div>
            )}

            {/* Expert-assigned action items (incomplete) */}
            {incompleteActions.length > 0 && (
              <div className={styles.actionGroup}>
                <span className={styles.actionGroupLabel}>전문가 지정</span>
                {incompleteActions.map((item) => (
                  <div key={item.id} className={styles.actionItem}>
                    <button
                      className={styles.actionCheckbox}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(item.id, item.is_completed);
                      }}
                    >
                      <Check size={12} />
                    </button>
                    <div className={styles.actionTextWrap}>
                      <div className={styles.actionTitle}>{item.title}</div>
                      {item.description && (
                        <div className={styles.actionDesc}>{item.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed action items */}
            {completedActions.length > 0 && (
              <div className={styles.actionGroup}>
                <span className={styles.actionGroupLabel}>완료</span>
                {completedActions.map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.actionItem} ${styles.actionItemCompleted}`}
                  >
                    <button
                      className={`${styles.actionCheckbox} ${styles.actionCheckboxChecked}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(item.id, item.is_completed);
                      }}
                    >
                      <Check size={12} />
                    </button>
                    <div className={styles.actionTextWrap}>
                      <div className={`${styles.actionTitle} ${styles.actionTitleCompleted}`}>
                        {item.title}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
