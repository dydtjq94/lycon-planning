"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  MessageCircle,
  User,
  PieChart,
  FileText,
  Target,
  UserMinus,
  ChevronDown,
  ClipboardCheck,
  Receipt,
  Wallet,
  TrendingUp,
  Home,
  Banknote,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BarChart3,
  Landmark,
  Building,
  Calculator,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NotesSection, ProgressSection, RetirementDiagnosisForm } from "./components";
import { OnboardingSurveyModal } from "./components/finance/OnboardingSurveyModal";
import styles from "./UserDetail.module.css";

interface Profile {
  id: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
  target_retirement_age: number;
  created_at: string;
  onboarding_step: string | null;
  phone_number: string | null;
  customer_stage: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  survey_responses?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guide_clicks?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prep_data?: any;
}

interface FamilyMember {
  id: string;
  relation: string;
  name: string;
  birth_date: string | null;
}

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  consultation_type: string;
  status: string;
}

interface ConsultationRecord {
  id: string;
  consultation_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  completed_date: string | null;
  status: string;
  summary: string | null;
}

type Section = "info" | "consultation" | "status" | "scenario";
type StatusSubTab = "asset" | "budget";

const STAGE_LABELS: Record<string, string> = {
  new: "신규",
  first_consultation: "1차 상담",
  report_delivered: "보고서 전달",
  second_consultation: "2차 상담",
  subscription: "구독 중",
  churned: "이탈",
};

// 상담 종류 정의
interface ConsultationType {
  id: string;
  name: string;
  description: string;
  icon: typeof ClipboardCheck;
  period: string; // 주기 텍스트
  periodMonths: number | null; // null = 상시
  isRequired: boolean; // 구독 고객 필수 여부
  color: string;
}

const CONSULTATION_TYPES: ConsultationType[] = [
  {
    id: "retirement-diagnosis",
    name: "기본형 종합 재무 검진",
    description: "은퇴 진단",
    icon: ClipboardCheck,
    period: "2년마다",
    periodMonths: 24,
    isRequired: true,
    color: "#007aff",
  },
  {
    id: "budget-consultation",
    name: "가계부 상담",
    description: "월별 수입/지출 점검",
    icon: Receipt,
    period: "매월",
    periodMonths: 1,
    isRequired: true,
    color: "#34c759",
  },
  {
    id: "investment-portfolio",
    name: "투자 포트폴리오 상담",
    description: "투자 전략, 리밸런싱",
    icon: BarChart3,
    period: "분기마다",
    periodMonths: 3,
    isRequired: true,
    color: "#5856d6",
  },
  {
    id: "asset-review",
    name: "자산 현황 파악",
    description: "전체 자산 점검",
    icon: Wallet,
    period: "반기마다",
    periodMonths: 6,
    isRequired: true,
    color: "#ff9500",
  },
  {
    id: "pension-analysis",
    name: "연금 분석",
    description: "연금 수령 전략",
    icon: Landmark,
    period: "매년",
    periodMonths: 12,
    isRequired: true,
    color: "#af52de",
  },
  {
    id: "real-estate",
    name: "부동산 상담",
    description: "매매, 임대, 대출",
    icon: Building,
    period: "상시",
    periodMonths: null,
    isRequired: false,
    color: "#ff3b30",
  },
  {
    id: "tax-consultation",
    name: "세금 상담",
    description: "절세 전략, 신고",
    icon: Calculator,
    period: "상시",
    periodMonths: null,
    isRequired: false,
    color: "#00c7be",
  },
  {
    id: "financial-decision",
    name: "재무 의사결정 상담",
    description: "주요 재무 결정 지원",
    icon: HelpCircle,
    period: "상시",
    periodMonths: null,
    isRequired: false,
    color: "#8e8e93",
  },
];

const tabs = [
  { id: "info" as Section, label: "기본 정보", icon: User },
  { id: "consultation" as Section, label: "상담", icon: FileText },
  { id: "status" as Section, label: "현황", icon: PieChart },
  { id: "scenario" as Section, label: "시나리오", icon: Target },
];

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState<Section>("info");
  const [statusSubTab, setStatusSubTab] = useState<StatusSubTab>("asset");
  const [budgetDate, setBudgetDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [expertId, setExpertId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // 담당 제외 모달
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  // 더보기 드롭다운
  const [showDropdown, setShowDropdown] = useState(false);

  // 상담 종류 선택
  const [selectedConsultation, setSelectedConsultation] = useState<string | null>(null);

  // 예약된 상담 (bookings)
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);

  // 상담 이력 (consultation_records)
  const [consultationRecords, setConsultationRecords] = useState<ConsultationRecord[]>([]);

  // 상담 이력 (마지막 상담일) - consultation_records에서 계산
  const [consultationHistory, setConsultationHistory] = useState<Record<string, string | null>>({
    "retirement-diagnosis": null,
    "budget-consultation": null,
    "investment-portfolio": null,
    "asset-review": null,
    "pension-analysis": null,
    "real-estate": null,
    "tax-consultation": null,
    "financial-decision": null,
  });

  // 온보딩 설문 모달
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [surveyResponses, setSurveyResponses] = useState<any>(null);

  // 가이드 클릭 모달
  const [showGuideClicksModal, setShowGuideClicksModal] = useState(false);

  // 입력해두기 모달
  const [showPrepDataModal, setShowPrepDataModal] = useState(false);

  // 다음 상담 추천일 계산
  const getNextConsultationDate = (typeId: string, lastDate: string | null): { date: string | null; status: "overdue" | "upcoming" | "ok" | "none" } => {
    const consultationType = CONSULTATION_TYPES.find((t) => t.id === typeId);
    if (!consultationType || consultationType.periodMonths === null) {
      return { date: null, status: "none" };
    }

    if (!lastDate) {
      return { date: "즉시", status: "overdue" };
    }

    const last = new Date(lastDate);
    const next = new Date(last);
    next.setMonth(next.getMonth() + consultationType.periodMonths);

    const today = new Date();
    const diffDays = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const nextStr = `${next.getFullYear()}.${String(next.getMonth() + 1).padStart(2, "0")}.${String(next.getDate()).padStart(2, "0")}`;

    if (diffDays < 0) {
      return { date: nextStr, status: "overdue" };
    } else if (diffDays <= 14) {
      return { date: nextStr, status: "upcoming" };
    }
    return { date: nextStr, status: "ok" };
  };

  // 스케줄 셀 클릭 핸들러 (체크 토글)
  const handleScheduleCellClick = async (consultationType: string, month: number, year: number) => {
    if (!expertId) return;

    const supabase = createClient();
    const targetDateStr = `${year}-${String(month).padStart(2, "0")}-15`;

    // 해당 월에 완료된 레코드가 있는지 확인
    const existingRecord = consultationRecords.find(
      (r) =>
        r.consultation_type === consultationType &&
        r.status === "completed" &&
        new Date(r.scheduled_date).getMonth() + 1 === month &&
        new Date(r.scheduled_date).getFullYear() === year
    );

    if (!existingRecord) {
      // 체크 추가 (완료 처리)
      const { data: newRecord, error } = await supabase
        .from("consultation_records")
        .insert({
          profile_id: userId,
          expert_id: expertId,
          consultation_type: consultationType,
          scheduled_date: targetDateStr,
          completed_date: targetDateStr,
          status: "completed",
        })
        .select()
        .single();

      if (!error && newRecord) {
        setConsultationRecords((prev) => [newRecord, ...prev]);
      }
    } else {
      // 체크 해제 (삭제)
      const { error } = await supabase
        .from("consultation_records")
        .delete()
        .eq("id", existingRecord.id);

      if (!error) {
        setConsultationRecords((prev) =>
          prev.filter((r) => r.id !== existingRecord.id)
        );
      }
    }
  };

  // 상담 현황 요약 계산
  const getConsultationSummary = () => {
    let overdue = 0;
    let upcoming = 0;
    let completed = 0;

    CONSULTATION_TYPES.filter((t) => t.isRequired).forEach((type) => {
      const { status } = getNextConsultationDate(type.id, consultationHistory[type.id]);
      if (status === "overdue") overdue++;
      else if (status === "upcoming") upcoming++;
      else if (status === "ok") completed++;
    });

    return { overdue, upcoming, completed };
  };

  useEffect(() => {
    const loadUserData = async () => {
      const supabase = createClient();

      // 현재 로그인한 전문가 ID
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: expert } = await supabase
          .from("experts")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (expert) {
          setExpertId(expert.id);
        }
      }

      // 고객 프로필
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, name, birth_date, gender, target_retirement_age, created_at, onboarding_step, phone_number, customer_stage, survey_responses, guide_clicks, prep_data")
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);
        if (profileData.survey_responses) {
          setSurveyResponses(profileData.survey_responses);
        }
      }

      // 가족 구성원
      const { data: familyData } = await supabase
        .from("family_members")
        .select("id, relation, name, birth_date")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (familyData) {
        setFamilyMembers(familyData);
      }

      // 대화방 로드 또는 생성
      let { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!conversation && user) {
        const { data: expert } = await supabase
          .from("experts")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (expert) {
          const { data: newConversation } = await supabase
            .from("conversations")
            .insert({
              user_id: userId,
              expert_id: expert.id,
              is_primary: true,
            })
            .select("id")
            .single();

          conversation = newConversation;
        }
      }

      if (conversation) {
        setConversationId(conversation.id);

        const { data: unreadMessages } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversation.id)
          .eq("sender_type", "user")
          .eq("is_read", false);

        setUnreadCount(unreadMessages?.length || 0);
      }

      // 예약된 상담 로드 (오늘 이후, confirmed 또는 pending 상태만)
      const today = new Date().toISOString().split("T")[0];
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("id, booking_date, booking_time, consultation_type, status")
        .eq("user_id", userId)
        .in("status", ["confirmed", "pending"])
        .gte("booking_date", today)
        .order("booking_date", { ascending: true });

      if (bookingsData) {
        setScheduledBookings(bookingsData);
      }

      // 상담 이력 로드
      const { data: recordsData } = await supabase
        .from("consultation_records")
        .select("id, consultation_type, scheduled_date, scheduled_time, completed_date, status, summary")
        .eq("profile_id", userId)
        .order("scheduled_date", { ascending: false });

      if (recordsData) {
        setConsultationRecords(recordsData);

        // 각 상담 종류별 마지막 완료일 계산
        const history: Record<string, string | null> = {
          "retirement-diagnosis": null,
          "budget-consultation": null,
          "investment-portfolio": null,
          "asset-review": null,
          "pension-analysis": null,
          "real-estate": null,
          "tax-consultation": null,
          "financial-decision": null,
        };

        recordsData
          .filter((r) => r.status === "completed" && r.completed_date)
          .forEach((r) => {
            if (!history[r.consultation_type] || r.completed_date! > history[r.consultation_type]!) {
              history[r.consultation_type] = r.completed_date;
            }
          });

        setConsultationHistory(history);
      }

      setLoading(false);
    };

    loadUserData();
  }, [userId]);

  // 실시간 메시지 구독
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const refreshUnreadCount = async () => {
      const { data: unreadMessages } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("sender_type", "user")
        .eq("is_read", false);

      setUnreadCount(unreadMessages?.length || 0);
    };

    const channel = supabase
      .channel(`admin-messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => refreshUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleRemoveFromMyCustomers = async () => {
    if (!expertId || !conversationId) return;

    setRemoving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      console.error("Error removing customer:", error);
      setRemoving(false);
      return;
    }

    router.push("/admin");
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.skeletonTitle} />
          </div>
        </div>
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>고객을 찾을 수 없습니다</h1>
        </div>
        <div className={styles.emptyContainer}>유저를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentSection) {
      case "info":
        return (
          <div className={styles.infoSection}>
            {/* 기본 정보 카드 */}
            <div className={styles.infoCard}>
              <h3 className={styles.cardTitle}>기본 정보</h3>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>이름</span>
                  <span className={styles.infoValue}>{profile.name}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>생년월일</span>
                  <span className={styles.infoValue}>
                    {profile.birth_date ? formatDate(profile.birth_date) : "-"}
                    {profile.birth_date && ` (${calculateAge(profile.birth_date)}세)`}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>성별</span>
                  <span className={styles.infoValue}>
                    {profile.gender === "male" ? "남성" : profile.gender === "female" ? "여성" : "-"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>연락처</span>
                  <span className={styles.infoValue}>{profile.phone_number || "-"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>목표 은퇴 나이</span>
                  <span className={styles.infoValue}>{profile.target_retirement_age}세</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>가입일</span>
                  <span className={styles.infoValue}>{formatDate(profile.created_at)}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>고객 단계</span>
                  <span className={`${styles.stageBadgeInline} ${styles[profile.customer_stage || "new"]}`}>
                    {STAGE_LABELS[profile.customer_stage] || "신규"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>온보딩</span>
                  <span className={styles.infoValue}>
                    {profile.onboarding_step === "completed" ? "완료" : "진행중"}
                    {surveyResponses && (
                      <button
                        className={styles.onboardingBtn}
                        onClick={() => setShowOnboardingModal(true)}
                        style={{ marginLeft: 8 }}
                      >
                        응답 보기
                      </button>
                    )}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>가이드 열람</span>
                  <span className={styles.infoValue}>
                    <button
                      className={styles.onboardingBtn}
                      onClick={() => setShowGuideClicksModal(true)}
                    >
                      {Object.values(profile.guide_clicks || {}).reduce(
                        (sum: number, c: any) => sum + (c?.count || 0),
                        0
                      )}회
                    </button>
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>입력해두기</span>
                  <span className={styles.infoValue}>
                    <button
                      className={styles.onboardingBtn}
                      onClick={() => setShowPrepDataModal(true)}
                    >
                      {Object.keys(profile.prep_data || {}).length}/10
                    </button>
                  </span>
                </div>
              </div>
            </div>

            {/* 예약된 상담 카드 */}
            {scheduledBookings.length > 0 && (
              <div className={styles.infoCard}>
                <h3 className={styles.cardTitle}>예약된 상담</h3>
                <div className={styles.upcomingBookings}>
                  {scheduledBookings.map((booking) => {
                    const consultationType = CONSULTATION_TYPES.find((t) => t.id === booking.consultation_type);
                    const bookingDate = new Date(booking.booking_date);
                    const isToday = new Date().toDateString() === bookingDate.toDateString();
                    const daysUntil = Math.ceil((bookingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <div key={booking.id} className={styles.upcomingBookingItem}>
                        <span className={styles.upcomingBookingName}>
                          {consultationType?.name || booking.consultation_type}
                        </span>
                        <span className={styles.upcomingBookingDate}>
                          {`${bookingDate.getMonth() + 1}/${bookingDate.getDate()} ${booking.booking_time}`}
                        </span>
                        <span className={`${styles.upcomingBookingDays} ${isToday ? styles.today : daysUntil <= 3 ? styles.soon : ""}`}>
                          {isToday ? "오늘" : daysUntil < 0 ? `${Math.abs(daysUntil)}일 전` : `D-${daysUntil}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 가족 구성원 카드 */}
            <div className={styles.infoCard}>
              <h3 className={styles.cardTitle}>가족 구성원</h3>
              {familyMembers.length === 0 ? (
                <p className={styles.emptyText}>등록된 가족 구성원이 없습니다.</p>
              ) : (
                <div className={styles.familyList}>
                  {familyMembers.map((member) => (
                    <div key={member.id} className={styles.familyItem}>
                      <span className={styles.familyRelation}>
                        {member.relation === "spouse" ? "배우자" :
                         member.relation === "child" ? "자녀" :
                         member.relation === "parent" ? "부모" : member.relation}
                      </span>
                      <span className={styles.familyName}>{member.name || "-"}</span>
                      <span className={styles.familyAge}>
                        {member.birth_date ? `${calculateAge(member.birth_date)}세` : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 연간 상담 스케줄 카드 */}
            {(() => {
              const currentYear = new Date().getFullYear();
              const currentMonth = new Date().getMonth() + 1;
              const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

              // 각 상담별 해당 월 계산
              const getConsultationMonths = (periodMonths: number | null): number[] => {
                if (periodMonths === null) return []; // 상시
                if (periodMonths === 1) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // 매월
                if (periodMonths === 3) return [3, 6, 9, 12]; // 분기
                if (periodMonths === 6) return [6, 12]; // 반기
                if (periodMonths === 12) return [12]; // 매년
                if (periodMonths === 24) return [1]; // 2년 (올해는 1월에 한 번)
                return [];
              };

              // 완료된 상담 월별 확인
              const getCompletedMonths = (typeId: string): number[] => {
                return consultationRecords
                  .filter((r) =>
                    r.consultation_type === typeId &&
                    r.status === "completed" &&
                    new Date(r.scheduled_date).getFullYear() === currentYear
                  )
                  .map((r) => new Date(r.scheduled_date).getMonth() + 1);
              };

              // 정기 상담만 표시
              const requiredConsultations = CONSULTATION_TYPES.filter((t) => t.isRequired);

              return (
                <div className={styles.infoCard}>
                  <div className={styles.scheduleHeader}>
                    <h3 className={styles.cardTitle}>{currentYear}년 상담 스케줄</h3>
                    <span className={styles.scheduleNote}>정기 상담 기준</span>
                  </div>

                  {/* 월 헤더 */}
                  <div className={styles.scheduleGrid}>
                    <div className={styles.scheduleRowHeader}>
                      <span className={styles.scheduleLabelHeader}>상담 종류</span>
                      {months.map((m, idx) => (
                        <span
                          key={m}
                          className={`${styles.scheduleMonthHeader} ${idx + 1 === currentMonth ? styles.currentMonth : ""}`}
                        >
                          {idx + 1}
                        </span>
                      ))}
                    </div>

                    {/* 각 상담별 행 */}
                    {requiredConsultations.map((consultation) => {
                      const dueMonths = getConsultationMonths(consultation.periodMonths);
                      const completedMonths = getCompletedMonths(consultation.id);

                      return (
                        <div key={consultation.id} className={styles.scheduleRow}>
                          <span className={styles.scheduleLabel}>
                            {consultation.name.length > 12
                              ? consultation.name.substring(0, 12) + "..."
                              : consultation.name}
                          </span>
                          {months.map((_, idx) => {
                            const month = idx + 1;
                            const isDue = dueMonths.includes(month);
                            const isCompleted = completedMonths.includes(month);

                            return (
                              <button
                                key={month}
                                type="button"
                                onClick={() => isDue && handleScheduleCellClick(consultation.id, month, currentYear)}
                                className={`${styles.scheduleCell} ${isDue ? styles.clickable : ""}`}
                              >
                                {isDue && (
                                  isCompleted ? (
                                    <span className={styles.checkMark} />
                                  ) : (
                                    <span className={styles.dotMark} style={{ background: consultation.color }} />
                                  )
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.scheduleLegend}>
                    <span className={styles.legendItem}>
                      <span className={styles.legendDotSimple} />
                      예정
                    </span>
                    <span className={styles.legendItem}>
                      <span className={styles.legendCheck} />
                      완료
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        );

      case "status":
        const prevMonth = () => {
          setBudgetDate((prev) => {
            if (prev.month === 1) {
              return { year: prev.year - 1, month: 12 };
            }
            return { ...prev, month: prev.month - 1 };
          });
        };
        const nextMonth = () => {
          setBudgetDate((prev) => {
            if (prev.month === 12) {
              return { year: prev.year + 1, month: 1 };
            }
            return { ...prev, month: prev.month + 1 };
          });
        };

        return (
          <div className={styles.statusSection}>
            {/* 서브 탭 */}
            <div className={styles.subTabs}>
              <button
                className={`${styles.subTab} ${statusSubTab === "asset" ? styles.active : ""}`}
                onClick={() => setStatusSubTab("asset")}
              >
                <Wallet size={16} />
                자산
              </button>
              <button
                className={`${styles.subTab} ${statusSubTab === "budget" ? styles.active : ""}`}
                onClick={() => setStatusSubTab("budget")}
              >
                <Receipt size={16} />
                가계부
              </button>
            </div>

            {/* 서브 탭 콘텐츠 */}
            {statusSubTab === "asset" ? (
              <div className={styles.assetSection}>
                {/* 자산 요약 카드들 */}
                <div className={styles.assetSummaryGrid}>
                  <div className={styles.assetSummaryCard}>
                    <div className={styles.assetSummaryIcon} style={{ background: "#e6f2ff" }}>
                      <TrendingUp size={20} color="#007aff" />
                    </div>
                    <div className={styles.assetSummaryInfo}>
                      <span className={styles.assetSummaryLabel}>총 자산</span>
                      <span className={styles.assetSummaryValue}>-</span>
                    </div>
                  </div>
                  <div className={styles.assetSummaryCard}>
                    <div className={styles.assetSummaryIcon} style={{ background: "#fef3c7" }}>
                      <Home size={20} color="#d97706" />
                    </div>
                    <div className={styles.assetSummaryInfo}>
                      <span className={styles.assetSummaryLabel}>부동산</span>
                      <span className={styles.assetSummaryValue}>-</span>
                    </div>
                  </div>
                  <div className={styles.assetSummaryCard}>
                    <div className={styles.assetSummaryIcon} style={{ background: "#d1fae5" }}>
                      <Banknote size={20} color="#059669" />
                    </div>
                    <div className={styles.assetSummaryInfo}>
                      <span className={styles.assetSummaryLabel}>금융 자산</span>
                      <span className={styles.assetSummaryValue}>-</span>
                    </div>
                  </div>
                  <div className={styles.assetSummaryCard}>
                    <div className={styles.assetSummaryIcon} style={{ background: "#fee2e2" }}>
                      <CreditCard size={20} color="#dc2626" />
                    </div>
                    <div className={styles.assetSummaryInfo}>
                      <span className={styles.assetSummaryLabel}>부채</span>
                      <span className={styles.assetSummaryValue}>-</span>
                    </div>
                  </div>
                </div>

                {/* 자산 차트 영역 */}
                <div className={styles.chartCard}>
                  <h3 className={styles.cardTitle}>자산 구성</h3>
                  <div className={styles.chartPlaceholder}>
                    <PieChart size={48} color="#ccc" />
                    <p>고객의 재무 데이터를 입력하면 자산 구성 차트가 표시됩니다</p>
                  </div>
                </div>

                {/* 순자산 추이 차트 */}
                <div className={styles.chartCard}>
                  <h3 className={styles.cardTitle}>순자산 추이</h3>
                  <div className={styles.chartPlaceholder}>
                    <TrendingUp size={48} color="#ccc" />
                    <p>시뮬레이션을 실행하면 순자산 추이 그래프가 표시됩니다</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.budgetSection}>
                {/* 월 선택 */}
                <div className={styles.budgetHeader}>
                  <button className={styles.monthNavButton} onClick={prevMonth}>
                    <ChevronLeft size={20} />
                  </button>
                  <span className={styles.budgetMonth}>
                    {budgetDate.year}년 {budgetDate.month}월
                  </span>
                  <button className={styles.monthNavButton} onClick={nextMonth}>
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* 소득/지출 요약 */}
                <div className={styles.budgetSummary}>
                  <div className={styles.budgetSummaryItem}>
                    <span className={styles.budgetSummaryLabel}>소득</span>
                    <span className={styles.budgetSummaryValue} style={{ color: "#007aff" }}>0원</span>
                  </div>
                  <div className={styles.budgetSummaryDivider}>-</div>
                  <div className={styles.budgetSummaryItem}>
                    <span className={styles.budgetSummaryLabel}>지출</span>
                    <span className={styles.budgetSummaryValue} style={{ color: "#ff3b30" }}>0원</span>
                  </div>
                  <div className={styles.budgetSummaryDivider}>=</div>
                  <div className={styles.budgetSummaryItem}>
                    <span className={styles.budgetSummaryLabel}>잔액</span>
                    <span className={styles.budgetSummaryValue}>0원</span>
                  </div>
                </div>

                {/* 소득 입력 */}
                <div className={styles.budgetCard}>
                  <div className={styles.budgetCardHeader}>
                    <h3 className={styles.cardTitle}>소득</h3>
                    <button className={styles.addButton}>+ 추가</button>
                  </div>
                  <div className={styles.budgetEmptyState}>
                    <Banknote size={24} color="#ccc" />
                    <p>등록된 소득이 없습니다</p>
                  </div>
                </div>

                {/* 지출 입력 */}
                <div className={styles.budgetCard}>
                  <div className={styles.budgetCardHeader}>
                    <h3 className={styles.cardTitle}>지출</h3>
                    <button className={styles.addButton}>+ 추가</button>
                  </div>
                  <div className={styles.budgetEmptyState}>
                    <Receipt size={24} color="#ccc" />
                    <p>등록된 지출이 없습니다</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "consultation":
        // 상담 종류 선택 전
        if (!selectedConsultation) {
          const requiredTypes = CONSULTATION_TYPES.filter((t) => t.isRequired);
          const optionalTypes = CONSULTATION_TYPES.filter((t) => !t.isRequired);

          return (
            <div className={styles.consultationGrid}>
              {/* 정기 상담 (왼쪽) */}
              <div className={styles.consultationGroupCard}>
                <div className={styles.consultationGroupHeader}>
                  <h3 className={styles.cardTitle}>정기 상담</h3>
                  <span className={styles.consultationGroupBadge}>구독 필수</span>
                </div>
                <div className={styles.consultationList}>
                  {requiredTypes.map((type) => (
                    <button
                      key={type.id}
                      className={styles.consultationItem}
                      onClick={() => setSelectedConsultation(type.id)}
                    >
                      <span className={styles.consultationItemName}>{type.name}</span>
                      <span className={styles.consultationItemPeriod}>{type.period}</span>
                      <ChevronRight size={16} className={styles.consultationItemArrow} />
                    </button>
                  ))}
                </div>
              </div>

              {/* 상시 상담 (오른쪽) */}
              <div className={styles.consultationGroupCard}>
                <div className={styles.consultationGroupHeader}>
                  <h3 className={styles.cardTitle}>상시 상담</h3>
                  <span className={styles.consultationGroupBadgeOptional}>필요시</span>
                </div>
                <div className={styles.consultationList}>
                  {optionalTypes.map((type) => (
                    <button
                      key={type.id}
                      className={styles.consultationItem}
                      onClick={() => setSelectedConsultation(type.id)}
                    >
                      <span className={styles.consultationItemName}>{type.name}</span>
                      <ChevronRight size={16} className={styles.consultationItemArrow} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // 상담 종류 선택 후 - 노트 섹션 표시
        const selectedType = CONSULTATION_TYPES.find((t) => t.id === selectedConsultation);
        const SelectedIcon = selectedType?.icon || ClipboardCheck;

        // Get birth year from profile
        const birthYear = profile.birth_date
          ? new Date(profile.birth_date).getFullYear()
          : new Date().getFullYear() - 40;

        return (
          <div className={styles.consultationSection}>
            {/* 뒤로가기 + 상담 유형 헤더 */}
            <div className={styles.consultationHeader}>
              <button
                className={styles.backToList}
                onClick={() => setSelectedConsultation(null)}
              >
                ← 상담 목록
              </button>
              <div
                className={styles.consultationTypeLabel}
                style={{ background: `${selectedType?.color}15`, color: selectedType?.color }}
              >
                <SelectedIcon size={18} />
                <span>{selectedType?.name}</span>
              </div>
            </div>
            <div className={styles.sectionContent}>
              {selectedConsultation === "retirement-diagnosis" ? (
                <RetirementDiagnosisForm
                  userId={userId}
                  birthYear={birthYear}
                  retirementAge={profile.target_retirement_age}
                />
              ) : (
                expertId && <NotesSection profileId={userId} expertId={expertId} />
              )}
            </div>
          </div>
        );

      case "scenario":
        return (
          <div className={styles.scenarioSection}>
            <div className={styles.scenarioCard}>
              <h3 className={styles.cardTitle}>시나리오 (플랜)</h3>
              <p className={styles.scenarioDesc}>
                고객의 재무 데이터를 기반으로 은퇴 시뮬레이션 결과를 확인합니다.
              </p>
              <div className={styles.scenarioItems}>
                <button className={styles.scenarioItem}>
                  <div className={styles.scenarioIcon}>
                    <PieChart size={24} />
                  </div>
                  <div className={styles.scenarioInfo}>
                    <span className={styles.scenarioName}>순자산 시뮬레이션</span>
                    <span className={styles.scenarioSub}>연도별 순자산 변화 추이</span>
                  </div>
                </button>
                <button className={styles.scenarioItem}>
                  <div className={styles.scenarioIcon}>
                    <Target size={24} />
                  </div>
                  <div className={styles.scenarioInfo}>
                    <span className={styles.scenarioName}>현금흐름 시뮬레이션</span>
                    <span className={styles.scenarioSub}>연도별 수입/지출 흐름</span>
                  </div>
                </button>
              </div>
              <p className={styles.comingSoon}>상세 시뮬레이션 뷰 준비중</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{profile.name}</h1>
          <span className={`${styles.stageBadge} ${styles[profile.customer_stage || "new"]}`}>
            {STAGE_LABELS[profile.customer_stage] || "신규"}
          </span>
        </div>
        <div className={styles.headerRight}>
          {/* 채팅 버튼 */}
          <button
            className={styles.chatButton}
            onClick={() => router.push(`/admin/chat/${userId}`)}
          >
            <MessageCircle size={18} />
            <span>채팅</span>
            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* 더보기 드롭다운 */}
          <div className={styles.dropdownContainer}>
            <button
              className={styles.moreButton}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              더보기
              <ChevronDown size={16} />
            </button>
            {showDropdown && (
              <>
                <div
                  className={styles.dropdownBackdrop}
                  onClick={() => setShowDropdown(false)}
                />
                <div className={styles.dropdown}>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => {
                      setShowDropdown(false);
                      setShowRemoveModal(true);
                    }}
                  >
                    <UserMinus size={16} />
                    담당 제외
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${currentSection === tab.id ? styles.active : ""}`}
            onClick={() => setCurrentSection(tab.id)}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className={styles.content}>
        {renderContent()}
      </div>

      {/* 담당 제외 확인 모달 */}
      {showRemoveModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowRemoveModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>담당 제외</h3>
            <p className={styles.modalText}>
              <strong>{profile.name}</strong> 님을 담당 고객에서 제외하시겠습니까?
            </p>
            <p className={styles.modalSubtext}>
              제외해도 고객 정보는 삭제되지 않으며, 나중에 다시 담당 설정할 수 있습니다.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setShowRemoveModal(false)}
                disabled={removing}
              >
                취소
              </button>
              <button
                className={styles.modalConfirm}
                onClick={handleRemoveFromMyCustomers}
                disabled={removing}
              >
                {removing ? "처리 중..." : "제외하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 온보딩 설문 모달 */}
      {showOnboardingModal && (
        <OnboardingSurveyModal
          surveyResponses={surveyResponses}
          onClose={() => setShowOnboardingModal(false)}
        />
      )}

      {/* 가이드 클릭 상세 모달 */}
      {showGuideClicksModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowGuideClicksModal(false)}>
          <div className={styles.guideClicksModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>가이드 열람 내역</h3>
            <div className={styles.guideClicksList}>
              {(() => {
                const GUIDE_LABELS: Record<string, string> = {
                  family: "가계 정보",
                  housing: "거주용 부동산",
                  savings: "저축",
                  investment: "투자",
                  debt: "부채",
                  income: "소득",
                  nationalPension: "국민(공적)연금",
                  retirementPension: "퇴직연금/퇴직금",
                  personalPension: "개인연금",
                  expense: "지출",
                };
                const clicks = profile.guide_clicks || {};
                const allCategories = Object.keys(GUIDE_LABELS);

                return allCategories.map((categoryId) => {
                  const data = clicks[categoryId];
                  const count = data?.count || 0;
                  return (
                    <div key={categoryId} className={styles.guideClickItem}>
                      <span className={styles.guideClickName}>{GUIDE_LABELS[categoryId]}</span>
                      <span className={count > 0 ? styles.guideClickCount : styles.guideClickCountZero}>
                        {count}회
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
            <button
              className={styles.guideClicksCloseBtn}
              onClick={() => setShowGuideClicksModal(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 입력해두기 상세 모달 */}
      {showPrepDataModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowPrepDataModal(false)}>
          <div className={styles.prepDataModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>입력해두기 내역</h3>
            <div className={styles.prepDataContent}>
              {(() => {
                const prepData = profile.prep_data || {};
                const formatMoney = (amount: number) => {
                  if (!amount) return "-";
                  if (amount >= 10000) return `${Math.floor(amount / 10000)}억 ${amount % 10000 > 0 ? (amount % 10000).toLocaleString() + "만" : ""}`;
                  return `${amount.toLocaleString()}만원`;
                };

                const housingTypeLabel = (type: string) => {
                  const labels: Record<string, string> = { "자가": "자가", "전세": "전세", "월세": "월세", "무상": "무상" };
                  return labels[type] || type;
                };

                const relationLabel = (rel: string) => {
                  const labels: Record<string, string> = { spouse: "배우자", child: "자녀", parent: "부모" };
                  return labels[rel] || rel;
                };

                const savingsTypeLabel = (type: string) => {
                  const labels: Record<string, string> = { checking: "입출금", savings: "적금", deposit: "예금" };
                  return labels[type] || type;
                };

                const debtTypeLabel = (type: string) => {
                  const labels: Record<string, string> = { mortgage: "주담대", jeonse: "전세대출", credit: "신용대출", other: "기타" };
                  return labels[type] || type;
                };

                const pensionTypeLabel = (type: string) => {
                  const labels: Record<string, string> = { national: "국민연금", government: "공무원연금", military: "군인연금", private_school: "사학연금" };
                  return labels[type] || type;
                };

                const retirementTypeLabel = (type: string) => {
                  const labels: Record<string, string> = { db: "DB형(퇴직금)", dc: "DC형", none: "없음" };
                  return labels[type] || type;
                };

                const personalPensionTypeLabel = (type: string) => {
                  const labels: Record<string, string> = { pension_savings: "연금저축", irp: "IRP" };
                  return labels[type] || type;
                };

                // 각 카테고리별 데이터 유무 확인
                const hasFamily = prepData.family?.length > 0;
                const hasIncome = prepData.income?.length > 0;
                const hasExpense = prepData.expense;
                const hasHousing = prepData.housing;
                const hasSavings = prepData.savings?.length > 0;
                const hasInvestment = prepData.investment && (
                  prepData.investment.securities?.balance > 0 ||
                  prepData.investment.crypto?.balance > 0 ||
                  prepData.investment.gold?.balance > 0
                );
                const hasDebt = prepData.debt?.length > 0;
                const hasNationalPension = prepData.nationalPension;
                const hasRetirementPension = prepData.retirementPension && (
                  (prepData.retirementPension.selfType && prepData.retirementPension.selfType !== "none") ||
                  (prepData.retirementPension.spouseType && prepData.retirementPension.spouseType !== "none")
                );
                const hasPersonalPension = prepData.personalPension?.length > 0;

                return (
                  <>
                    {/* 가계 정보 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>가계 정보</h4>
                      {hasFamily ? (
                        prepData.family.map((member: any, idx: number) => (
                          <div key={idx} className={styles.prepItem}>
                            <span>{relationLabel(member.relationship)}</span>
                            <span>{member.name}{member.birth_date ? ` (${member.birth_date.substring(0, 4)}년생)` : ""}</span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>

                    {/* 소득 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>소득</h4>
                      {hasIncome ? (
                        prepData.income.map((item: any, idx: number) => (
                          <div key={idx} className={styles.prepItem}>
                            <span>{item.owner === "self" ? "본인" : "배우자"} - {item.title || item.type}</span>
                            <span>{formatMoney(item.amount)}{item.frequency === "monthly" ? "/월" : "/년"}</span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>

                    {/* 지출 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>지출</h4>
                      {hasExpense ? (
                        <>
                          {prepData.expense.livingExpense > 0 && (
                            <div className={styles.prepItem}>
                              <span>생활비</span>
                              <span>{formatMoney(prepData.expense.livingExpense)}/월</span>
                            </div>
                          )}
                          {prepData.expense.fixedExpenses?.map((item: any, idx: number) => (
                            <div key={`fixed-${idx}`} className={styles.prepItem}>
                              <span>{item.title || item.type}</span>
                              <span>{formatMoney(item.amount)}{item.frequency === "monthly" ? "/월" : "/년"}</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>

                    {/* 거주용 부동산 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>거주용 부동산</h4>
                      {hasHousing ? (
                        <>
                          <div className={styles.prepItem}>
                            <span>거주 형태</span>
                            <span>{housingTypeLabel(prepData.housing.housingType)}</span>
                          </div>
                          {prepData.housing.housingType === "자가" && prepData.housing.currentValue > 0 && (
                            <div className={styles.prepItem}>
                              <span>시세</span>
                              <span>{formatMoney(prepData.housing.currentValue)}</span>
                            </div>
                          )}
                          {(prepData.housing.housingType === "전세" || prepData.housing.housingType === "월세") && prepData.housing.deposit > 0 && (
                            <div className={styles.prepItem}>
                              <span>보증금</span>
                              <span>{formatMoney(prepData.housing.deposit)}</span>
                            </div>
                          )}
                          {prepData.housing.housingType === "월세" && prepData.housing.monthlyRent > 0 && (
                            <div className={styles.prepItem}>
                              <span>월세</span>
                              <span>{formatMoney(prepData.housing.monthlyRent)}/월</span>
                            </div>
                          )}
                          {prepData.housing.maintenanceFee > 0 && (
                            <div className={styles.prepItem}>
                              <span>관리비</span>
                              <span>{formatMoney(prepData.housing.maintenanceFee)}/월</span>
                            </div>
                          )}
                          {prepData.housing.hasLoan && prepData.housing.loanAmount > 0 && (
                            <div className={styles.prepItem}>
                              <span>{prepData.housing.loanType === "mortgage" ? "주담대" : "전세대출"}</span>
                              <span>{formatMoney(prepData.housing.loanAmount)} ({prepData.housing.loanRate}%)</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>

                    {/* 저축 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>저축</h4>
                      {hasSavings ? (
                        prepData.savings.map((item: any, idx: number) => (
                          <div key={idx} className={styles.prepItem}>
                            <span>{item.title || savingsTypeLabel(item.type)}</span>
                            <span>{formatMoney(item.currentBalance)}</span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>

                    {/* 투자 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>투자</h4>
                      {hasInvestment ? (
                        <>
                          {prepData.investment.securities?.balance > 0 && (
                            <div className={styles.prepItem}>
                              <span>증권</span>
                              <span>{formatMoney(prepData.investment.securities.balance)}</span>
                            </div>
                          )}
                          {prepData.investment.crypto?.balance > 0 && (
                            <div className={styles.prepItem}>
                              <span>코인</span>
                              <span>{formatMoney(prepData.investment.crypto.balance)}</span>
                            </div>
                          )}
                          {prepData.investment.gold?.balance > 0 && (
                            <div className={styles.prepItem}>
                              <span>금</span>
                              <span>{formatMoney(prepData.investment.gold.balance)}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>

                    {/* 부채 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>부채</h4>
                      {hasDebt ? (
                        prepData.debt.map((item: any, idx: number) => (
                          <div key={idx} className={styles.prepItem}>
                            <span>{item.title || debtTypeLabel(item.type)}</span>
                            <span>{formatMoney(item.currentBalance || item.principal)} ({item.interestRate}%)</span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>

                    {/* 공적연금 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>공적연금</h4>
                      {hasNationalPension ? (
                        <>
                          {prepData.nationalPension.selfExpectedAmount > 0 && (
                            <div className={styles.prepItem}>
                              <span>본인 ({pensionTypeLabel(prepData.nationalPension.selfType)})</span>
                              <span>{formatMoney(prepData.nationalPension.selfExpectedAmount)}/월</span>
                            </div>
                          )}
                          {prepData.nationalPension.spouseExpectedAmount > 0 && (
                            <div className={styles.prepItem}>
                              <span>배우자 ({pensionTypeLabel(prepData.nationalPension.spouseType)})</span>
                              <span>{formatMoney(prepData.nationalPension.spouseExpectedAmount)}/월</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>

                    {/* 퇴직연금 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>퇴직연금</h4>
                      {hasRetirementPension ? (
                        <>
                          {prepData.retirementPension.selfType && prepData.retirementPension.selfType !== "none" && (
                            <div className={styles.prepItem}>
                              <span>본인 ({retirementTypeLabel(prepData.retirementPension.selfType)})</span>
                              <span>
                                {prepData.retirementPension.selfType === "db"
                                  ? `근속 ${prepData.retirementPension.selfYearsWorked}년`
                                  : formatMoney(prepData.retirementPension.selfBalance)}
                              </span>
                            </div>
                          )}
                          {prepData.retirementPension.spouseType && prepData.retirementPension.spouseType !== "none" && (
                            <div className={styles.prepItem}>
                              <span>배우자 ({retirementTypeLabel(prepData.retirementPension.spouseType)})</span>
                              <span>
                                {prepData.retirementPension.spouseType === "db"
                                  ? `근속 ${prepData.retirementPension.spouseYearsWorked}년`
                                  : formatMoney(prepData.retirementPension.spouseBalance)}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>

                    {/* 개인연금 */}
                    <div className={styles.prepSection}>
                      <h4 className={styles.prepSectionTitle}>개인연금</h4>
                      {hasPersonalPension ? (
                        prepData.personalPension.map((item: any, idx: number) => (
                          <div key={idx} className={styles.prepItem}>
                            <span>{item.owner === "self" ? "본인" : "배우자"} - {personalPensionTypeLabel(item.type)}</span>
                            <span>{formatMoney(item.balance)}</span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.prepItemEmpty}>입력 안함</div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            <button
              className={styles.guideClicksCloseBtn}
              onClick={() => setShowPrepDataModal(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
