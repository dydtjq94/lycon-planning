"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  MessageCircle,
  User,
  PieChart,
  FileText,
  Target,
  UserMinus,
  UserPlus,
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
  Send,
  LayoutDashboard,
  Sparkles,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadPrepData } from "@/lib/services/prepDataService";
import type { PrepData } from "@/components/forms";
import { useAdmin } from "../../AdminContext";
import {
  NotesSection,
  ProgressSection,
  RetirementDiagnosisForm,
  AllDataSection,
} from "./components";
import { OnboardingSurveyModal } from "./components/finance/OnboardingSurveyModal";
import { AgentPanel, AgentAction } from "@/components/AgentPanel";
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

interface Message {
  id: string;
  conversation_id: string;
  sender_type: "user" | "expert";
  content: string;
  is_read: boolean;
  created_at: string;
}

interface FinancialSnapshot {
  id: string;
  profile_id: string;
  recorded_at: string;
  snapshot_type: string;
  total_assets: number;
  savings: number;
  investments: number;
  real_assets: number;
  total_debts: number;
  unsecured_debt: number;
  net_worth: number;
  memo: string | null;
}

type Section = "info" | "chat" | "consultation" | "snapshot" | "status" | "scenario";
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
  { id: "chat" as Section, label: "채팅", icon: MessageCircle },
  { id: "consultation" as Section, label: "상담", icon: FileText },
  { id: "snapshot" as Section, label: "재무 현황", icon: Wallet },
  { id: "status" as Section, label: "시뮬레이션", icon: PieChart },
  { id: "scenario" as Section, label: "시나리오", icon: Target },
];

// 모듈 레벨 캐시 (페이지 이동해도 유지)
interface CachedUserData {
  profile: Profile | null;
  familyMembers: FamilyMember[];
  conversationId: string | null;
  bookings: Booking[];
  consultationRecords: ConsultationRecord[];
  consultationHistory: Record<string, string | null>;
  snapshots: FinancialSnapshot[];
  latestSnapshot: FinancialSnapshot | null;
  prepData: PrepData | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  surveyResponses: any;
}

const userDataCache = new Map<string, CachedUserData>();

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { expertId } = useAdmin();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState<Section>("info");
  const currentSectionRef = useRef<Section>("info");
  const initialHashProcessed = useRef(false);
  const [statusSubTab, setStatusSubTab] = useState<StatusSubTab>("asset");
  const [budgetDate, setBudgetDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // 메시지 수정/삭제
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // 담당 제외 모달
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  // 더보기 드롭다운
  const [showDropdown, setShowDropdown] = useState(false);

  // 상담 종류 선택
  const [selectedConsultation, setSelectedConsultation] = useState<
    string | null
  >(null);

  // 예약된 상담 (bookings)
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);

  // 상담 이력 (consultation_records)
  const [consultationRecords, setConsultationRecords] = useState<
    ConsultationRecord[]
  >([]);

  // 상담 이력 (마지막 상담일) - consultation_records에서 계산
  const [consultationHistory, setConsultationHistory] = useState<
    Record<string, string | null>
  >({
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

  // SMS 발송
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [sendingChatNotification, setSendingChatNotification] = useState(false);

  // Gemini Agent 패널
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(true);
  const [prepData, setPrepData] = useState<PrepData | null>(null);

  // 재무 스냅샷
  const [snapshots, setSnapshots] = useState<FinancialSnapshot[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<FinancialSnapshot | null>(null);

  const [smsForm, setSmsForm] = useState({
    date: "",
    time: "14:00",
    message: "다음 상담이 예약되었습니다.",
  });

  // 다음 상담 추천일 계산
  const getNextConsultationDate = (
    typeId: string,
    lastDate: string | null,
  ): {
    date: string | null;
    status: "overdue" | "upcoming" | "ok" | "none";
  } => {
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
    const diffDays = Math.ceil(
      (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    const nextStr = `${next.getFullYear()}.${String(next.getMonth() + 1).padStart(2, "0")}.${String(next.getDate()).padStart(2, "0")}`;

    if (diffDays < 0) {
      return { date: nextStr, status: "overdue" };
    } else if (diffDays <= 14) {
      return { date: nextStr, status: "upcoming" };
    }
    return { date: nextStr, status: "ok" };
  };

  // 스케줄 셀 클릭 핸들러 (체크 토글)
  const handleScheduleCellClick = async (
    consultationType: string,
    month: number,
    year: number,
  ) => {
    if (!expertId) return;

    const supabase = createClient();
    const targetDateStr = `${year}-${String(month).padStart(2, "0")}-15`;

    // 해당 월에 완료된 레코드가 있는지 확인
    const existingRecord = consultationRecords.find(
      (r) =>
        r.consultation_type === consultationType &&
        r.status === "completed" &&
        new Date(r.scheduled_date).getMonth() + 1 === month &&
        new Date(r.scheduled_date).getFullYear() === year,
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
          prev.filter((r) => r.id !== existingRecord.id),
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
      const { status } = getNextConsultationDate(
        type.id,
        consultationHistory[type.id],
      );
      if (status === "overdue") overdue++;
      else if (status === "upcoming") upcoming++;
      else if (status === "ok") completed++;
    });

    return { overdue, upcoming, completed };
  };

  // URL 해시에서 초기 탭 결정 (클라이언트에서만)
  useEffect(() => {
    if (initialHashProcessed.current) return;
    initialHashProcessed.current = true;

    const hash = window.location.hash.replace("#", "");
    if (["info", "chat", "consultation", "snapshot", "status", "scenario"].includes(hash)) {
      setCurrentSection(hash as Section);
      currentSectionRef.current = hash as Section;
    }
  }, []);

  useEffect(() => {
    // 캐시 히트 시 즉시 표시
    const cached = userDataCache.get(userId);
    if (cached) {
      setProfile(cached.profile);
      setFamilyMembers(cached.familyMembers);
      setConversationId(cached.conversationId);
      setScheduledBookings(cached.bookings);
      setConsultationRecords(cached.consultationRecords);
      setConsultationHistory(cached.consultationHistory);
      setSnapshots(cached.snapshots);
      setLatestSnapshot(cached.latestSnapshot);
      setPrepData(cached.prepData);
      if (cached.surveyResponses) setSurveyResponses(cached.surveyResponses);
      setLoading(false);
    }

    const loadUserData = async () => {
      const supabase = createClient();

      // 2단계: 나머지 전부 병렬 실행
      const today = new Date().toISOString().split("T")[0];

      const [
        profileRes,
        familyRes,
        conversationRes,
        bookingsRes,
        recordsRes,
        snapshotRes,
        prepDataRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, name, birth_date, gender, target_retirement_age, created_at, onboarding_step, phone_number, customer_stage, survey_responses, guide_clicks, prep_data",
          )
          .eq("id", userId)
          .single(),
        supabase
          .from("family_members")
          .select("id, relation, name, birth_date")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("expert_id", expertId)
          .maybeSingle(),
        supabase
          .from("bookings")
          .select("id, booking_date, booking_time, consultation_type, status")
          .eq("user_id", userId)
          .in("status", ["confirmed", "pending"])
          .gte("booking_date", today)
          .order("booking_date", { ascending: true }),
        supabase
          .from("consultation_records")
          .select(
            "id, consultation_type, scheduled_date, scheduled_time, completed_date, status, summary",
          )
          .eq("profile_id", userId)
          .order("scheduled_date", { ascending: false }),
        supabase
          .from("financial_snapshots")
          .select("*")
          .eq("profile_id", userId)
          .order("recorded_at", { ascending: false }),
        loadPrepData(userId).catch(() => null),
      ]);

      // 결과 처리
      const profileData = profileRes.data;
      if (profileData) {
        setProfile(profileData);
        if (profileData.survey_responses) {
          setSurveyResponses(profileData.survey_responses);
        }
      }

      const familyData = familyRes.data || [];
      setFamilyMembers(familyData);

      const conversation = conversationRes.data;
      setConversationId(conversation?.id || null);

      const bookingsData = bookingsRes.data || [];
      setScheduledBookings(bookingsData);

      let history: Record<string, string | null> = {
        "retirement-diagnosis": null,
        "budget-consultation": null,
        "investment-portfolio": null,
        "asset-review": null,
        "pension-analysis": null,
        "real-estate": null,
        "tax-consultation": null,
        "financial-decision": null,
      };

      const recordsData = recordsRes.data || [];
      setConsultationRecords(recordsData);

      recordsData
        .filter((r) => r.status === "completed" && r.completed_date)
        .forEach((r) => {
          if (
            !history[r.consultation_type] ||
            r.completed_date! > history[r.consultation_type]!
          ) {
            history[r.consultation_type] = r.completed_date;
          }
        });
      setConsultationHistory(history);

      const snapshotData = snapshotRes.data || [];
      if (snapshotData.length > 0) {
        setSnapshots(snapshotData);
        setLatestSnapshot(snapshotData[0]);
      }

      if (prepDataRes) {
        setPrepData(prepDataRes);
      }

      // 캐시 저장
      userDataCache.set(userId, {
        profile: profileData || null,
        familyMembers: familyData,
        conversationId: conversation?.id || null,
        bookings: bookingsData,
        consultationRecords: recordsData,
        consultationHistory: history,
        snapshots: snapshotData,
        latestSnapshot: snapshotData[0] || null,
        prepData: prepDataRes || null,
        surveyResponses: profileData?.survey_responses || null,
      });

      setLoading(false);

      // 3단계: unread 카운트는 백그라운드
      if (conversation) {
        const { data: unreadMessages } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversation.id)
          .eq("sender_type", "user")
          .eq("is_read", false);

        setUnreadCount(unreadMessages?.length || 0);
      }

      // URL 해시 처리
      const hash = window.location.hash.replace("#", "");
      if (hash === "chat") {
        setCurrentSection("chat");
        currentSectionRef.current = "chat";
      }
    };

    loadUserData();
  }, [userId]);

  // 채팅 스크롤을 맨 아래로
  const scrollChatToBottom = () => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  };

  // 메시지 로드 함수
  const loadMessages = async () => {
    if (!conversationId) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  // 메시지 전송 함수
  const sendMessage = async () => {
    if (!conversationId || !messageInput.trim() || sendingMessage) return;

    // 앞뒤 줄바꿈만 제거하고 공백/들여쓰기는 유지
    const content = messageInput.replace(/^\n+|\n+$/g, '');

    setSendingMessage(true);
    const supabase = createClient();

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_type: "expert",
      content,
      is_read: false,
    });

    if (!error) {
      setMessageInput("");
      await loadMessages();
    }

    setSendingMessage(false);
  };

  // 메시지 수정
  const handleEditClick = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const handleEditSave = async () => {
    if (!editingMessageId || !editContent.trim()) return;

    // 앞뒤 줄바꿈만 제거하고 공백/들여쓰기는 유지
    const content = editContent.replace(/^\n+|\n+$/g, '');

    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .update({ content })
      .eq("id", editingMessageId);

    if (!error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessageId ? { ...m, content } : m
        )
      );
    }

    setEditingMessageId(null);
    setEditContent("");
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    }
    if (e.key === "Escape") {
      handleEditCancel();
    }
  };

  // 메시지 삭제
  const handleDeleteClick = async (messageId: string) => {
    if (!confirm("메시지를 삭제하시겠습니까?")) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  };

  // 수정 input focus
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(
        editInputRef.current.value.length,
        editInputRef.current.value.length
      );
    }
  }, [editingMessageId]);

  // 메시지 읽음 처리
  const markMessagesAsRead = async () => {
    if (!conversationId) return;

    const supabase = createClient();
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("sender_type", "user")
      .eq("is_read", false);

    setUnreadCount(0);

    // 사이드바 업데이트를 위한 커스텀 이벤트 발생
    window.dispatchEvent(new CustomEvent("admin-messages-read"));
  };

  // currentSection ref 업데이트
  useEffect(() => {
    currentSectionRef.current = currentSection;
  }, [currentSection]);

  // 채팅 탭 선택 시 메시지 로드 및 읽음 처리
  useEffect(() => {
    if (currentSection === "chat" && conversationId) {
      loadMessages();
      markMessagesAsRead();
    }
  }, [currentSection, conversationId]);

  // 메시지 스크롤 (채팅 탭일 때만) - 통합된 스크롤 로직
  useEffect(() => {
    if (currentSection === "chat" && messages.length > 0) {
      // DOM이 완전히 렌더링될 때까지 여러 번 시도
      const scrollWithRetry = (attempts: number) => {
        if (attempts <= 0) return;

        requestAnimationFrame(() => {
          if (chatMessagesRef.current) {
            const { scrollHeight, clientHeight } = chatMessagesRef.current;
            // 컨테이너가 실제로 렌더링되었는지 확인
            if (scrollHeight > clientHeight) {
              chatMessagesRef.current.scrollTop = scrollHeight;
            } else {
              // 아직 렌더링 안됐으면 재시도
              setTimeout(() => scrollWithRetry(attempts - 1), 50);
            }
          } else {
            setTimeout(() => scrollWithRetry(attempts - 1), 50);
          }
        });
      };

      scrollWithRetry(10); // 최대 10번 시도 (500ms)
    }
  }, [messages, currentSection]);

  // 실시간 메시지 구독
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const handleNewMessage = async () => {
      // 채팅 탭이 열려있으면 메시지 로드 및 읽음 처리
      if (currentSectionRef.current === "chat") {
        const { data } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        if (data) {
          setMessages(data);
        }

        // 즉시 읽음 처리
        await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", conversationId)
          .eq("sender_type", "user")
          .eq("is_read", false);

        setUnreadCount(0);

        // 사이드바 업데이트를 위한 커스텀 이벤트 발생
        window.dispatchEvent(new CustomEvent("admin-messages-read"));
      } else {
        // 채팅 탭이 아니면 읽지 않은 수만 업데이트
        const { data: unreadMessages } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("sender_type", "user")
          .eq("is_read", false);

        setUnreadCount(unreadMessages?.length || 0);

        // 사이드바도 새 메시지 반영
        window.dispatchEvent(new CustomEvent("admin-messages-read"));
      }
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
        () => handleNewMessage(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleRemoveFromMyCustomers = async () => {
    if (!expertId || !conversationId) {
      alert("담당 정보를 찾을 수 없습니다.");
      return;
    }

    setRemoving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("expert_id", expertId);

    if (error) {
      console.error("Error removing customer:", error);
      alert("제외 처리 중 오류가 발생했습니다.");
      setRemoving(false);
      return;
    }

    setShowRemoveModal(false);
    window.location.href = "/admin";
  };

  const handleAddToMyCustomers = async () => {
    if (!expertId) {
      alert("전문가 정보를 찾을 수 없습니다.");
      return;
    }

    const supabase = createClient();

    const { data: newConversation, error } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        expert_id: expertId,
        is_primary: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error adding customer:", error);
      alert("담당 추가 중 오류가 발생했습니다.");
      return;
    }

    if (newConversation) {
      setConversationId(newConversation.id);
      setShowDropdown(false);
    }
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  // SMS 발송 함수
  const handleSendBookingNotice = async () => {
    if (!profile?.phone_number) {
      alert("고객 전화번호가 없습니다.");
      return;
    }

    if (!smsForm.date) {
      alert("예약 날짜를 선택해주세요.");
      return;
    }

    if (!smsForm.message.trim()) {
      alert("안내 내용을 입력해주세요.");
      return;
    }

    setSendingSms(true);

    try {
      const bookingDate = new Date(smsForm.date);
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const formattedDate = `${bookingDate.getFullYear()}년 ${bookingDate.getMonth() + 1}월 ${bookingDate.getDate()}일(${weekdays[bookingDate.getDay()]})`;

      const response = await fetch(`/api/sms/booking-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: profile.phone_number,
          customer_name: profile.name,
          booking_date: formattedDate,
          booking_time: smsForm.time,
          message: smsForm.message,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert("예약 안내 메시지가 발송되었습니다.");
        setShowSmsModal(false);
        setSmsForm({
          date: "",
          time: "14:00",
          message: "다음 상담이 예약되었습니다.",
        });
      } else {
        alert(`SMS 발송 실패: ${result.message}`);
      }
    } catch (error) {
      console.error("SMS 발송 오류:", error);
      alert("SMS 발송 중 오류가 발생했습니다.");
    } finally {
      setSendingSms(false);
    }
  };

  const handleSendChatNotification = async () => {
    if (!profile?.phone_number) {
      alert("고객 전화번호가 없습니다.");
      return;
    }

    const confirmed = window.confirm(
      `${profile.name}님에게 알림 메시지를 보내시겠어요?`
    );
    if (!confirmed) return;

    setSendingChatNotification(true);

    try {
      const response = await fetch("/api/sms/chat-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: profile.phone_number,
          customer_name: profile.name,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert("알림 문자가 발송되었습니다.");
      } else {
        alert(`발송 실패: ${result.error || "알 수 없는 오류"}`);
      }
    } catch (error) {
      console.error("채팅 알림 SMS 발송 오류:", error);
      alert("문자 발송 중 오류가 발생했습니다.");
    } finally {
      setSendingChatNotification(false);
    }
  };

  // AI Agent 액션 처리 (Supabase 수정/추가/삭제)
  const handleAgentAction = async (actions: AgentAction[]) => {
    const supabase = createClient();

    for (const action of actions) {
      try {
        if (action.type === "update" && action.id && action.data) {
          const { error } = await supabase
            .from(action.table)
            .update(action.data)
            .eq("id", action.id);

          if (error) throw error;

        } else if (action.type === "insert" && action.data) {
          const { error } = await supabase
            .from(action.table)
            .insert(action.data);

          if (error) throw error;

        } else if (action.type === "delete" && action.id) {
          const { error } = await supabase
            .from(action.table)
            .delete()
            .eq("id", action.id);

          if (error) throw error;
        }
      } catch (error) {
        console.error(`[Agent Action Error] ${action.type} on ${action.table}:`, error);
        throw error;
      }
    }

    // 스냅샷 데이터 다시 로드
    const { data: snapshotData } = await supabase
      .from("financial_snapshots")
      .select("*")
      .eq("profile_id", profile?.id)
      .order("recorded_at", { ascending: false });

    if (snapshotData && snapshotData.length > 0) {
      setSnapshots(snapshotData);
      setLatestSnapshot(snapshotData[0]);
    }
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
          <AllDataSection userId={userId} profile={profile} />
        );

      case "chat":
        const formatMessageTime = (dateStr: string) => {
          const date = new Date(dateStr);
          return date.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });
        };

        return (
          <div className={styles.chatSection}>
            <div className={styles.chatMessages} ref={chatMessagesRef}>
              {messages.length === 0 ? (
                <div className={styles.chatEmpty}>
                  <MessageCircle size={48} color="#ccc" />
                  <p>메시지가 없습니다</p>
                  <span>고객에게 먼저 메시지를 보내보세요</span>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`${styles.chatMessage} ${
                      message.sender_type === "expert"
                        ? styles.sent
                        : styles.received
                    }`}
                  >
                    <div className={styles.chatBubble}>
                      <p>{message.content}</p>
                    </div>
                    <div className={styles.chatMessageFooter}>
                      {message.sender_type === "expert" && (
                        <div className={styles.messageActions}>
                          <button
                            className={styles.messageActionBtn}
                            onClick={() => handleEditClick(message)}
                            title="수정"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className={`${styles.messageActionBtn} ${styles.messageActionBtnDanger}`}
                            onClick={() => handleDeleteClick(message.id)}
                            title="삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                      <span className={styles.chatTime}>
                        {formatMessageTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className={styles.chatInputArea}>
              <textarea
                className={styles.chatTextarea}
                placeholder="메시지 입력 (Shift+Enter로 줄바꿈)"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={sendingMessage}
                rows={1}
              />
              <div className={styles.chatInputActions}>
                <button
                  className={styles.chatNotifyButton}
                  onClick={handleSendChatNotification}
                  disabled={sendingChatNotification || !profile?.phone_number}
                  title="새 메시지 알림 문자 발송"
                >
                  {sendingChatNotification ? <Clock size={18} /> : <MessageCircle size={18} />}
                </button>
                <button
                  className={styles.chatSendButton}
                  onClick={sendMessage}
                  disabled={!messageInput.trim() || sendingMessage}
                >
                  전송
                </button>
              </div>
            </div>

            {/* 메시지 수정 모달 */}
            {editingMessageId && (
              <div className={styles.editModalOverlay} onClick={handleEditCancel}>
                <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.editModalHeader}>
                    <h3>메시지 수정</h3>
                    <button className={styles.editModalClose} onClick={handleEditCancel}>
                      <X size={18} />
                    </button>
                  </div>
                  <textarea
                    ref={editInputRef}
                    className={styles.editModalTextarea}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    rows={5}
                    placeholder="메시지를 입력하세요..."
                  />
                  <div className={styles.editModalFooter}>
                    <button className={styles.editModalCancelBtn} onClick={handleEditCancel}>
                      취소
                    </button>
                    <button
                      className={styles.editModalSaveBtn}
                      onClick={handleEditSave}
                      disabled={!editContent.trim()}
                    >
                      저장
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "snapshot":
        const formatMoney = (amount: number) => {
          if (!amount && amount !== 0) return "-";
          if (amount >= 10000) {
            const billions = Math.floor(amount / 10000);
            const millions = amount % 10000;
            return millions > 0 ? `${billions}억 ${millions.toLocaleString()}만` : `${billions}억`;
          }
          return `${amount.toLocaleString()}만원`;
        };

        return (
          <div className={styles.snapshotSection}>
            {latestSnapshot ? (
              <>
                <div className={styles.snapshotHeader}>
                  <div className={styles.snapshotDate}>
                    <Calendar size={16} />
                    {latestSnapshot.recorded_at} 기준
                  </div>
                  <span className={styles.snapshotType}>
                    {latestSnapshot.snapshot_type === "initial" ? "최초 파악" :
                     latestSnapshot.snapshot_type === "quarterly" ? "분기 점검" :
                     latestSnapshot.snapshot_type === "annual" ? "연간 점검" : "팔로업"}
                  </span>
                </div>

                <div className={styles.snapshotSummary}>
                  <div className={styles.snapshotNetWorth}>
                    <span className={styles.snapshotLabel}>순자산</span>
                    <span className={styles.snapshotValue}>{formatMoney(latestSnapshot.net_worth)}</span>
                  </div>
                </div>

                <div className={styles.snapshotGrid}>
                  <div className={styles.snapshotCard}>
                    <h4 className={styles.snapshotCardTitle}>자산</h4>
                    <div className={styles.snapshotCardTotal}>
                      {formatMoney(latestSnapshot.total_assets)}
                    </div>
                    <div className={styles.snapshotCardItems}>
                      <div className={styles.snapshotItem}>
                        <span>저축</span>
                        <span>{formatMoney(latestSnapshot.savings)}</span>
                      </div>
                      <div className={styles.snapshotItem}>
                        <span>투자</span>
                        <span>{formatMoney(latestSnapshot.investments)}</span>
                      </div>
                      <div className={styles.snapshotItem}>
                        <span>실물자산</span>
                        <span>{formatMoney(latestSnapshot.real_assets)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.snapshotCard}>
                    <h4 className={styles.snapshotCardTitle}>부채</h4>
                    <div className={styles.snapshotCardTotal}>
                      {formatMoney(latestSnapshot.total_debts)}
                    </div>
                    <div className={styles.snapshotCardItems}>
                      <div className={styles.snapshotItem}>
                        <span>무담보</span>
                        <span>{formatMoney(latestSnapshot.unsecured_debt)}</span>
                      </div>
                      <div className={styles.snapshotItem}>
                        <span>담보대출</span>
                        <span>{formatMoney(latestSnapshot.total_debts - latestSnapshot.unsecured_debt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {latestSnapshot.memo && (
                  <div className={styles.snapshotMemo}>
                    <span className={styles.snapshotMemoLabel}>메모</span>
                    <p>{latestSnapshot.memo}</p>
                  </div>
                )}

                {/* 스냅샷 히스토리 */}
                {snapshots.length > 1 && (
                  <div className={styles.snapshotHistory}>
                    <h4>기록 히스토리</h4>
                    <div className={styles.snapshotHistoryList}>
                      {snapshots.slice(1).map((snap) => (
                        <div key={snap.id} className={styles.snapshotHistoryItem}>
                          <span className={styles.snapshotHistoryDate}>{snap.recorded_at}</span>
                          <span className={styles.snapshotHistoryValue}>순자산 {formatMoney(snap.net_worth)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.snapshotEmpty}>
                <p>기록된 재무 현황이 없습니다.</p>
                <p className={styles.snapshotEmptyHint}>재무 상담 후 현황을 기록해주세요.</p>
              </div>
            )}
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
                    <div
                      className={styles.assetSummaryIcon}
                      style={{ background: "#e6f2ff" }}
                    >
                      <TrendingUp size={20} color="#007aff" />
                    </div>
                    <div className={styles.assetSummaryInfo}>
                      <span className={styles.assetSummaryLabel}>총 자산</span>
                      <span className={styles.assetSummaryValue}>-</span>
                    </div>
                  </div>
                  <div className={styles.assetSummaryCard}>
                    <div
                      className={styles.assetSummaryIcon}
                      style={{ background: "#fef3c7" }}
                    >
                      <Home size={20} color="#d97706" />
                    </div>
                    <div className={styles.assetSummaryInfo}>
                      <span className={styles.assetSummaryLabel}>부동산</span>
                      <span className={styles.assetSummaryValue}>-</span>
                    </div>
                  </div>
                  <div className={styles.assetSummaryCard}>
                    <div
                      className={styles.assetSummaryIcon}
                      style={{ background: "#d1fae5" }}
                    >
                      <Banknote size={20} color="#059669" />
                    </div>
                    <div className={styles.assetSummaryInfo}>
                      <span className={styles.assetSummaryLabel}>
                        금융 자산
                      </span>
                      <span className={styles.assetSummaryValue}>-</span>
                    </div>
                  </div>
                  <div className={styles.assetSummaryCard}>
                    <div
                      className={styles.assetSummaryIcon}
                      style={{ background: "#fee2e2" }}
                    >
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
                    <p>
                      고객의 재무 데이터를 입력하면 자산 구성 차트가 표시됩니다
                    </p>
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
                    <span
                      className={styles.budgetSummaryValue}
                      style={{ color: "#007aff" }}
                    >
                      0원
                    </span>
                  </div>
                  <div className={styles.budgetSummaryDivider}>-</div>
                  <div className={styles.budgetSummaryItem}>
                    <span className={styles.budgetSummaryLabel}>지출</span>
                    <span
                      className={styles.budgetSummaryValue}
                      style={{ color: "#ff3b30" }}
                    >
                      0원
                    </span>
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
                  <span className={styles.consultationGroupBadge}>
                    구독 필수
                  </span>
                </div>
                <div className={styles.consultationList}>
                  {requiredTypes.map((type) => (
                    <button
                      key={type.id}
                      className={styles.consultationItem}
                      onClick={() => setSelectedConsultation(type.id)}
                    >
                      <span className={styles.consultationItemName}>
                        {type.name}
                      </span>
                      <span className={styles.consultationItemPeriod}>
                        {type.period}
                      </span>
                      <ChevronRight
                        size={16}
                        className={styles.consultationItemArrow}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* 상시 상담 (오른쪽) */}
              <div className={styles.consultationGroupCard}>
                <div className={styles.consultationGroupHeader}>
                  <h3 className={styles.cardTitle}>상시 상담</h3>
                  <span className={styles.consultationGroupBadgeOptional}>
                    필요시
                  </span>
                </div>
                <div className={styles.consultationList}>
                  {optionalTypes.map((type) => (
                    <button
                      key={type.id}
                      className={styles.consultationItem}
                      onClick={() => setSelectedConsultation(type.id)}
                    >
                      <span className={styles.consultationItemName}>
                        {type.name}
                      </span>
                      <ChevronRight
                        size={16}
                        className={styles.consultationItemArrow}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // 상담 종류 선택 후 - 노트 섹션 표시
        const selectedType = CONSULTATION_TYPES.find(
          (t) => t.id === selectedConsultation,
        );
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
                style={{
                  background: `${selectedType?.color}15`,
                  color: selectedType?.color,
                }}
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
                expertId && (
                  <NotesSection profileId={userId} expertId={expertId} />
                )
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
                    <span className={styles.scenarioName}>
                      순자산 시뮬레이션
                    </span>
                    <span className={styles.scenarioSub}>
                      연도별 순자산 변화 추이
                    </span>
                  </div>
                </button>
                <button className={styles.scenarioItem}>
                  <div className={styles.scenarioIcon}>
                    <Target size={24} />
                  </div>
                  <div className={styles.scenarioInfo}>
                    <span className={styles.scenarioName}>
                      현금흐름 시뮬레이션
                    </span>
                    <span className={styles.scenarioSub}>
                      연도별 수입/지출 흐름
                    </span>
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

  // Gemini Agent용 컨텍스트 생성
  const generateAgentContext = () => {
    if (!profile) return "";

    const currentYear = new Date().getFullYear();
    const birthYear = profile.birth_date ? parseInt(profile.birth_date.split("-")[0]) : null;
    const age = birthYear ? currentYear - birthYear : null;

    let text = `## 고객 재무 현황

### 기본 정보
- 이름: ${profile.name}`;

    if (age) {
      text += `\n- 나이: ${age}세`;
    }
    text += `\n- 목표 은퇴 나이: ${profile.target_retirement_age}세`;

    // 가족 구성 (family_members 테이블)
    if (familyMembers.length > 0) {
      text += `\n\n### 가족 구성`;
      familyMembers.forEach(fm => {
        const fmAge = fm.birth_date ? currentYear - parseInt(fm.birth_date.split("-")[0]) : null;
        text += `\n- ${fm.name} (${fm.relation}${fmAge ? `, ${fmAge}세` : ""})`;
      });
    }

    // PrepData가 로드되지 않았으면 여기서 반환
    if (!prepData) return text;

    // 주거 정보
    if (prepData.housing) {
      const h = prepData.housing;
      text += `\n\n### 주거`;
      text += `\n- 주거 형태: ${h.housingType}`;
      if (h.housingType === "자가" && h.currentValue) {
        text += `\n- 시세: ${h.currentValue.toLocaleString()}만원`;
      }
      if ((h.housingType === "전세" || h.housingType === "월세") && h.deposit) {
        text += `\n- 보증금: ${h.deposit.toLocaleString()}만원`;
      }
      if (h.housingType === "월세" && h.monthlyRent) {
        text += `\n- 월세: ${h.monthlyRent.toLocaleString()}만원`;
      }
      if (h.hasLoan && h.loanAmount) {
        text += `\n- ${h.loanType === "mortgage" ? "주택담보대출" : "전세대출"}: ${h.loanAmount.toLocaleString()}만원 (금리 ${h.loanRate}%)`;
      }
    }

    // 소득
    if (prepData.income && prepData.income.length > 0) {
      text += `\n\n### 소득`;
      prepData.income.forEach(inc => {
        const freq = inc.frequency === "monthly" ? "월" : "년";
        const owner = inc.owner === "self" ? "본인" : "배우자";
        text += `\n- ${inc.title} (${owner}): ${inc.amount.toLocaleString()}만원/${freq}`;
      });
    }

    // 지출
    if (prepData.expense) {
      const e = prepData.expense;
      text += `\n\n### 지출`;
      if (e.livingExpense) {
        text += `\n- 생활비: ${e.livingExpense.toLocaleString()}만원/월`;
      }
      if (e.fixedExpenses && e.fixedExpenses.length > 0) {
        e.fixedExpenses.forEach(exp => {
          const freq = exp.frequency === "monthly" ? "월" : "년";
          text += `\n- ${exp.title}: ${exp.amount.toLocaleString()}만원/${freq}`;
        });
      }
    }

    // 저축
    if (prepData.savings && prepData.savings.length > 0) {
      text += `\n\n### 저축`;
      prepData.savings.forEach(s => {
        const owner = s.owner === "self" ? "본인" : "배우자";
        text += `\n- ${s.title} (${owner}): ${s.currentBalance.toLocaleString()}만원`;
        if (s.monthlyDeposit) {
          text += ` (월 ${s.monthlyDeposit.toLocaleString()}만원 납입)`;
        }
      });
    }

    // 투자
    if (prepData.investment) {
      const inv = prepData.investment;
      text += `\n\n### 투자`;
      if (inv.securities) {
        text += `\n- 증권 계좌: ${inv.securities.balance.toLocaleString()}만원`;
        if (inv.securities.investmentTypes.length > 0) {
          text += ` (${inv.securities.investmentTypes.join(", ")})`;
        }
      }
      if (inv.crypto) {
        text += `\n- 암호화폐: ${inv.crypto.balance.toLocaleString()}만원`;
      }
      if (inv.gold) {
        text += `\n- 금: ${inv.gold.balance.toLocaleString()}만원`;
      }
    }

    // 부채
    if (prepData.debt && prepData.debt.length > 0) {
      text += `\n\n### 부채`;
      prepData.debt.forEach(d => {
        text += `\n- ${d.title}: ${d.currentBalance?.toLocaleString() || d.principal.toLocaleString()}만원 (금리 ${d.interestRate}%)`;
        if (d.monthlyPayment) {
          text += ` - 월 상환 ${d.monthlyPayment.toLocaleString()}만원`;
        }
      });
    }

    // 국민연금
    if (prepData.nationalPension) {
      const np = prepData.nationalPension;
      text += `\n\n### 국민연금`;
      if (np.selfExpectedAmount) {
        text += `\n- 본인 예상 수령액: ${np.selfExpectedAmount.toLocaleString()}만원/월`;
      }
      if (np.spouseExpectedAmount) {
        text += `\n- 배우자 예상 수령액: ${np.spouseExpectedAmount.toLocaleString()}만원/월`;
      }
    }

    // 퇴직연금
    if (prepData.retirementPension) {
      const rp = prepData.retirementPension;
      text += `\n\n### 퇴직연금`;
      if (rp.selfType !== "none") {
        text += `\n- 본인: ${rp.selfType === "db" ? "DB형" : "DC형"}`;
        if (rp.selfType === "db" && rp.selfYearsWorked) {
          text += ` (근속 ${rp.selfYearsWorked}년)`;
        } else if (rp.selfType === "dc" && rp.selfBalance) {
          text += ` - 잔액 ${rp.selfBalance.toLocaleString()}만원`;
        }
      }
      if (rp.spouseType !== "none") {
        text += `\n- 배우자: ${rp.spouseType === "db" ? "DB형" : "DC형"}`;
        if (rp.spouseType === "db" && rp.spouseYearsWorked) {
          text += ` (근속 ${rp.spouseYearsWorked}년)`;
        } else if (rp.spouseType === "dc" && rp.spouseBalance) {
          text += ` - 잔액 ${rp.spouseBalance.toLocaleString()}만원`;
        }
      }
    }

    // 개인연금
    if (prepData.personalPension && prepData.personalPension.length > 0) {
      text += `\n\n### 개인연금`;
      prepData.personalPension.forEach(pp => {
        const owner = pp.owner === "self" ? "본인" : "배우자";
        const typeName = pp.type === "irp" ? "IRP" : "연금저축";
        text += `\n- ${typeName} (${owner}): ${pp.balance.toLocaleString()}만원`;
        if (pp.monthlyDeposit) {
          text += ` (월 ${pp.monthlyDeposit.toLocaleString()}만원 납입)`;
        }
      });
    }

    // 재무 스냅샷 (수정/추가용)
    text += `\n\n### 재무 스냅샷 (현재)`;
    text += `\n- profile_id: ${profile.id}`;
    if (latestSnapshot) {
      text += `\n- snapshot_id: ${latestSnapshot.id}`;
      text += `\n- 기록일: ${latestSnapshot.recorded_at}`;
      text += `\n- 저축: ${latestSnapshot.savings?.toLocaleString() || 0}만원`;
      text += `\n- 투자자산: ${latestSnapshot.investments?.toLocaleString() || 0}만원`;
      text += `\n- 실물자산: ${latestSnapshot.real_assets?.toLocaleString() || 0}만원`;
      text += `\n- 무담보부채: ${latestSnapshot.unsecured_debt?.toLocaleString() || 0}만원`;
      text += `\n- 총자산: ${latestSnapshot.total_assets?.toLocaleString() || 0}만원`;
      text += `\n- 총부채: ${latestSnapshot.total_debts?.toLocaleString() || 0}만원`;
      text += `\n- 순자산: ${latestSnapshot.net_worth?.toLocaleString() || 0}만원`;
    } else {
      text += `\n- 스냅샷 없음 (새로 추가 필요)`;
    }

    return text;
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{profile.name}</h1>
          <span
            className={`${styles.stageBadge} ${styles[profile.customer_stage || "new"]}`}
          >
            {STAGE_LABELS[profile.customer_stage] || "신규"}
          </span>
        </div>
        <div className={styles.headerRight}>
          {/* Gemini 패널 토글 버튼 */}
          {!isAgentPanelOpen && (
            <button
              className={styles.geminiButton}
              onClick={() => setIsAgentPanelOpen(true)}
            >
              <Sparkles size={16} />
              Gemini
            </button>
          )}

          {/* 대시보드로 이동 버튼 */}
          <a
            href={`/dashboard?viewAs=${params.id}`}
            className={styles.dashboardButton}
          >
            <LayoutDashboard size={16} />
            대시보드
          </a>

          {/* SMS 발송 버튼 */}
          <button
            className={styles.smsButton}
            onClick={() => setShowSmsModal(true)}
            disabled={!profile.phone_number}
          >
            <Send size={16} />
            예약 안내 문자
          </button>

          {/* 담당 제외/추가 버튼 */}
          {conversationId ? (
            <button
              className={styles.removeButton}
              onClick={() => setShowRemoveModal(true)}
            >
              <UserMinus size={16} />
              담당 제외
            </button>
          ) : (
            <button
              className={styles.addButton}
              onClick={handleAddToMyCustomers}
            >
              <UserPlus size={16} />
              담당 추가
            </button>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${currentSection === tab.id ? styles.active : ""}`}
            onClick={() => {
              setCurrentSection(tab.id);
              window.history.replaceState(null, "", `#${tab.id}`);
            }}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {tab.id === "chat" && unreadCount > 0 && (
              <span className={styles.tabBadge}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className={styles.content}>{renderContent()}</div>

      {/* 담당 제외 확인 모달 */}
      {showRemoveModal && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowRemoveModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>담당 제외</h3>
            <p className={styles.modalText}>
              <strong>{profile.name}</strong> 님을 담당 고객에서
              제외하시겠습니까?
            </p>
            <p className={styles.modalSubtext}>
              제외해도 고객 정보는 삭제되지 않으며, 나중에 다시 담당 설정할 수
              있습니다.
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
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowGuideClicksModal(false)}
        >
          <div
            className={styles.guideClicksModal}
            onClick={(e) => e.stopPropagation()}
          >
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
                      <span className={styles.guideClickName}>
                        {GUIDE_LABELS[categoryId]}
                      </span>
                      <span
                        className={
                          count > 0
                            ? styles.guideClickCount
                            : styles.guideClickCountZero
                        }
                      >
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
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowPrepDataModal(false)}
        >
          <div
            className={styles.prepDataModal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>입력해두기 내역</h3>
            <div className={styles.prepDataContent}>
              {(() => {
                const prepData = profile.prep_data || {};
                const formatMoney = (amount: number) => {
                  if (!amount) return "-";
                  if (amount >= 10000)
                    return `${Math.floor(amount / 10000)}억 ${amount % 10000 > 0 ? (amount % 10000).toLocaleString() + "만" : ""}`;
                  return `${amount.toLocaleString()}만원`;
                };

                const housingTypeLabel = (type: string) => {
                  const labels: Record<string, string> = {
                    자가: "자가",
                    전세: "전세",
                    월세: "월세",
                    무상: "무상",
                  };
                  return labels[type] || type;
                };

                const relationLabel = (rel: string) => {
                  const labels: Record<string, string> = {
                    spouse: "배우자",
                    child: "자녀",
                    parent: "부모",
                  };
                  return labels[rel] || rel;
                };

                const savingsTypeLabel = (type: string) => {
                  const labels: Record<string, string> = {
                    checking: "입출금",
                    savings: "적금",
                    deposit: "예금",
                  };
                  return labels[type] || type;
                };

                const debtTypeLabel = (type: string) => {
                  const labels: Record<string, string> = {
                    mortgage: "주담대",
                    jeonse: "전세대출",
                    credit: "신용대출",
                    other: "기타",
                  };
                  return labels[type] || type;
                };

                const pensionTypeLabel = (type: string) => {
                  const labels: Record<string, string> = {
                    national: "국민연금",
                    government: "공무원연금",
                    military: "군인연금",
                    private_school: "사학연금",
                  };
                  return labels[type] || type;
                };

                const retirementTypeLabel = (type: string) => {
                  const labels: Record<string, string> = {
                    db: "DB형(퇴직금)",
                    dc: "DC형",
                    none: "없음",
                  };
                  return labels[type] || type;
                };

                const personalPensionTypeLabel = (type: string) => {
                  const labels: Record<string, string> = {
                    pension_savings: "연금저축",
                    irp: "IRP",
                  };
                  return labels[type] || type;
                };

                // 각 카테고리별 데이터 유무 확인
                const hasFamily = prepData.family?.length > 0;
                const hasIncome =
                  prepData.income &&
                  (prepData.income.selfLaborIncome > 0 ||
                    prepData.income.spouseLaborIncome > 0 ||
                    prepData.income.additionalIncomes?.length > 0);
                const hasExpense = prepData.expense;
                const hasHousing = prepData.housing;
                const hasSavings = prepData.savings?.length > 0;
                const hasInvestment =
                  prepData.investment &&
                  (prepData.investment.securities?.balance > 0 ||
                    prepData.investment.crypto?.balance > 0 ||
                    prepData.investment.gold?.balance > 0);
                const hasDebt = prepData.debt?.length > 0;
                const hasNationalPension = prepData.nationalPension;
                const hasRetirementPension =
                  prepData.retirementPension &&
                  ((prepData.retirementPension.selfType &&
                    prepData.retirementPension.selfType !== "none") ||
                    (prepData.retirementPension.spouseType &&
                      prepData.retirementPension.spouseType !== "none"));
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
                            <span>
                              {member.name}
                              {member.birth_date
                                ? ` (${member.birth_date})`
                                : ""}
                              {member.gender === "male"
                                ? " 남"
                                : member.gender === "female"
                                  ? " 여"
                                  : ""}
                            </span>
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
                        <>
                          {prepData.income.selfLaborIncome > 0 && (
                            <div className={styles.prepItem}>
                              <span>본인 근로소득</span>
                              <span>
                                {formatMoney(prepData.income.selfLaborIncome)}
                                {prepData.income.selfLaborFrequency ===
                                "monthly"
                                  ? "/월"
                                  : "/년"}
                              </span>
                            </div>
                          )}
                          {prepData.income.spouseLaborIncome > 0 && (
                            <div className={styles.prepItem}>
                              <span>배우자 근로소득</span>
                              <span>
                                {formatMoney(prepData.income.spouseLaborIncome)}
                                {prepData.income.spouseLaborFrequency ===
                                "monthly"
                                  ? "/월"
                                  : "/년"}
                              </span>
                            </div>
                          )}
                          {prepData.income.additionalIncomes?.map(
                            (item: any, idx: number) => (
                              <div key={idx} className={styles.prepItem}>
                                <span>
                                  {item.owner === "self" ? "본인" : "배우자"} -{" "}
                                  {item.title || item.type}
                                </span>
                                <span>
                                  {formatMoney(item.amount)}
                                  {item.frequency === "monthly" ? "/월" : "/년"}
                                </span>
                              </div>
                            ),
                          )}
                        </>
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
                              <span>
                                {formatMoney(prepData.expense.livingExpense)}/월
                              </span>
                            </div>
                          )}
                          {prepData.expense.livingExpenseDetails && (
                            <>
                              {prepData.expense.livingExpenseDetails.food >
                                0 && (
                                <div className={styles.prepItem}>
                                  <span>- 식비</span>
                                  <span>
                                    {formatMoney(
                                      prepData.expense.livingExpenseDetails
                                        .food,
                                    )}
                                  </span>
                                </div>
                              )}
                              {prepData.expense.livingExpenseDetails.transport >
                                0 && (
                                <div className={styles.prepItem}>
                                  <span>- 교통비</span>
                                  <span>
                                    {formatMoney(
                                      prepData.expense.livingExpenseDetails
                                        .transport,
                                    )}
                                  </span>
                                </div>
                              )}
                              {prepData.expense.livingExpenseDetails.shopping >
                                0 && (
                                <div className={styles.prepItem}>
                                  <span>- 쇼핑</span>
                                  <span>
                                    {formatMoney(
                                      prepData.expense.livingExpenseDetails
                                        .shopping,
                                    )}
                                  </span>
                                </div>
                              )}
                              {prepData.expense.livingExpenseDetails.leisure >
                                0 && (
                                <div className={styles.prepItem}>
                                  <span>- 여가</span>
                                  <span>
                                    {formatMoney(
                                      prepData.expense.livingExpenseDetails
                                        .leisure,
                                    )}
                                  </span>
                                </div>
                              )}
                              {prepData.expense.livingExpenseDetails.other >
                                0 && (
                                <div className={styles.prepItem}>
                                  <span>- 기타</span>
                                  <span>
                                    {formatMoney(
                                      prepData.expense.livingExpenseDetails
                                        .other,
                                    )}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                          {prepData.expense.fixedExpenses?.map(
                            (item: any, idx: number) => (
                              <div
                                key={`fixed-${idx}`}
                                className={styles.prepItem}
                              >
                                <span>{item.title || item.type}</span>
                                <span>
                                  {formatMoney(item.amount)}
                                  {item.frequency === "monthly" ? "/월" : "/년"}
                                </span>
                              </div>
                            ),
                          )}
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
                            <span>
                              {housingTypeLabel(prepData.housing.housingType)}
                            </span>
                          </div>
                          {prepData.housing.housingType === "자가" &&
                            prepData.housing.currentValue > 0 && (
                              <div className={styles.prepItem}>
                                <span>시세</span>
                                <span>
                                  {formatMoney(prepData.housing.currentValue)}
                                </span>
                              </div>
                            )}
                          {(prepData.housing.housingType === "전세" ||
                            prepData.housing.housingType === "월세") &&
                            prepData.housing.deposit > 0 && (
                              <div className={styles.prepItem}>
                                <span>보증금</span>
                                <span>
                                  {formatMoney(prepData.housing.deposit)}
                                </span>
                              </div>
                            )}
                          {prepData.housing.housingType === "월세" &&
                            prepData.housing.monthlyRent > 0 && (
                              <div className={styles.prepItem}>
                                <span>월세</span>
                                <span>
                                  {formatMoney(prepData.housing.monthlyRent)}/월
                                </span>
                              </div>
                            )}
                          {prepData.housing.maintenanceFee > 0 && (
                            <div className={styles.prepItem}>
                              <span>관리비</span>
                              <span>
                                {formatMoney(prepData.housing.maintenanceFee)}
                                /월
                              </span>
                            </div>
                          )}
                          {prepData.housing.hasLoan &&
                            prepData.housing.loanAmount > 0 && (
                              <div className={styles.prepItem}>
                                <span>
                                  {prepData.housing.loanType === "mortgage"
                                    ? "주담대"
                                    : "전세대출"}
                                </span>
                                <span>
                                  {formatMoney(prepData.housing.loanAmount)} (
                                  {prepData.housing.loanRate}%)
                                </span>
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
                            <span>
                              {item.title || savingsTypeLabel(item.type)}
                            </span>
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
                              <span>
                                증권
                                {prepData.investment.securities.investmentTypes
                                  ?.length > 0 &&
                                  ` (${prepData.investment.securities.investmentTypes
                                    .map((t: string) => {
                                      const labels: Record<string, string> = {
                                        domestic_stock: "국내주식",
                                        foreign_stock: "해외주식",
                                        fund: "펀드",
                                        etf: "ETF",
                                        bond: "채권",
                                      };
                                      return labels[t] || t;
                                    })
                                    .join(", ")})`}
                              </span>
                              <span>
                                {formatMoney(
                                  prepData.investment.securities.balance,
                                )}
                              </span>
                            </div>
                          )}
                          {prepData.investment.crypto?.balance > 0 && (
                            <div className={styles.prepItem}>
                              <span>코인</span>
                              <span>
                                {formatMoney(
                                  prepData.investment.crypto.balance,
                                )}
                              </span>
                            </div>
                          )}
                          {prepData.investment.gold?.balance > 0 && (
                            <div className={styles.prepItem}>
                              <span>금</span>
                              <span>
                                {formatMoney(prepData.investment.gold.balance)}
                              </span>
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
                            <span>
                              {item.title || debtTypeLabel(item.type)}
                            </span>
                            <span>
                              {formatMoney(
                                item.currentBalance || item.principal,
                              )}{" "}
                              ({item.interestRate}%)
                            </span>
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
                              <span>
                                본인 (
                                {pensionTypeLabel(
                                  prepData.nationalPension.selfType,
                                )}
                                )
                              </span>
                              <span>
                                {formatMoney(
                                  prepData.nationalPension.selfExpectedAmount,
                                )}
                                /월
                              </span>
                            </div>
                          )}
                          {prepData.nationalPension.spouseExpectedAmount >
                            0 && (
                            <div className={styles.prepItem}>
                              <span>
                                배우자 (
                                {pensionTypeLabel(
                                  prepData.nationalPension.spouseType,
                                )}
                                )
                              </span>
                              <span>
                                {formatMoney(
                                  prepData.nationalPension.spouseExpectedAmount,
                                )}
                                /월
                              </span>
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
                          {prepData.retirementPension.selfType &&
                            prepData.retirementPension.selfType !== "none" && (
                              <div className={styles.prepItem}>
                                <span>
                                  본인 (
                                  {retirementTypeLabel(
                                    prepData.retirementPension.selfType,
                                  )}
                                  )
                                </span>
                                <span>
                                  {prepData.retirementPension.selfType === "db"
                                    ? `근속 ${prepData.retirementPension.selfYearsWorked}년`
                                    : formatMoney(
                                        prepData.retirementPension.selfBalance,
                                      )}
                                </span>
                              </div>
                            )}
                          {prepData.retirementPension.spouseType &&
                            prepData.retirementPension.spouseType !==
                              "none" && (
                              <div className={styles.prepItem}>
                                <span>
                                  배우자 (
                                  {retirementTypeLabel(
                                    prepData.retirementPension.spouseType,
                                  )}
                                  )
                                </span>
                                <span>
                                  {prepData.retirementPension.spouseType ===
                                  "db"
                                    ? `근속 ${prepData.retirementPension.spouseYearsWorked}년`
                                    : formatMoney(
                                        prepData.retirementPension
                                          .spouseBalance,
                                      )}
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
                        prepData.personalPension.map(
                          (item: any, idx: number) => (
                            <div key={idx} className={styles.prepItem}>
                              <span>
                                {item.owner === "self" ? "본인" : "배우자"} -{" "}
                                {personalPensionTypeLabel(item.type)}
                              </span>
                              <span>{formatMoney(item.balance)}</span>
                            </div>
                          ),
                        )
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

      {/* SMS 발송 모달 */}
      {showSmsModal && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowSmsModal(false)}
        >
          <div className={styles.smsModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>예약 안내 문자 보내기</h3>
            <div className={styles.smsForm}>
              <div className={styles.smsFormRow}>
                <label className={styles.smsLabel}>받는 사람</label>
                <span className={styles.smsValue}>
                  {profile.name} ({profile.phone_number})
                </span>
              </div>
              <div className={styles.smsFormRow}>
                <label className={styles.smsLabel}>예약 날짜</label>
                <input
                  type="date"
                  max="9999-12-31"
                  className={styles.smsInput}
                  value={smsForm.date}
                  onChange={(e) =>
                    setSmsForm({ ...smsForm, date: e.target.value })
                  }
                />
              </div>
              <div className={styles.smsFormRow}>
                <label className={styles.smsLabel}>예약 시간</label>
                <input
                  type="time"
                  className={styles.smsInput}
                  value={smsForm.time}
                  onChange={(e) =>
                    setSmsForm({ ...smsForm, time: e.target.value })
                  }
                />
              </div>
              <div className={styles.smsFormRow}>
                <label className={styles.smsLabel}>안내 내용</label>
                <textarea
                  className={styles.smsTextarea}
                  value={smsForm.message}
                  onChange={(e) =>
                    setSmsForm({ ...smsForm, message: e.target.value })
                  }
                  placeholder="안내할 내용을 입력하세요"
                  rows={3}
                />
              </div>
              <div className={styles.smsPreview}>
                <div className={styles.smsPreviewTitle}>미리보기</div>
                <div className={styles.smsPreviewContent}>
                  [Lycon] 상담 예약 안내{"\n\n"}
                  {profile.name}님, 안녕하세요.{"\n\n"}
                  {smsForm.message}
                  {"\n\n"}
                  일시:{" "}
                  {smsForm.date
                    ? (() => {
                        const d = new Date(smsForm.date);
                        const weekdays = [
                          "일",
                          "월",
                          "화",
                          "수",
                          "목",
                          "금",
                          "토",
                        ];
                        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${weekdays[d.getDay()]})`;
                      })()
                    : "____년 __월 __일(__)"}{" "}
                  {smsForm.time}
                  {"\n"}
                  문의: 010-6657-6155{"\n"}
                </div>
              </div>
            </div>
            <div className={styles.smsModalButtons}>
              <button
                className={styles.smsCancelBtn}
                onClick={() => setShowSmsModal(false)}
              >
                취소
              </button>
              <button
                className={styles.smsSendBtn}
                onClick={handleSendBookingNotice}
                disabled={sendingSms}
              >
                {sendingSms ? "발송중..." : "문자 보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Gemini Agent 패널 */}
      <AgentPanel
        isOpen={isAgentPanelOpen}
        onClose={() => setIsAgentPanelOpen(false)}
        contextText={generateAgentContext()}
        customerInfo={{
          name: profile.name,
          stage: STAGE_LABELS[profile.customer_stage] || "신규",
          age: profile.birth_date
            ? new Date().getFullYear() - new Date(profile.birth_date).getFullYear()
            : undefined,
          retirementAge: profile.target_retirement_age,
        }}
        onAction={handleAgentAction}
      />
    </div>
  );
}
