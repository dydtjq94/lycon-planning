"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X, GripVertical, Send, Loader2 } from "lucide-react";
import type { ProfileBasics, FamilyMember } from "@/contexts/FinancialContext";
import type { GlobalSettings, FinancialItem } from "@/types";
import type { SimulationResult } from "@/lib/services/simulationEngine";
import { formatMoney } from "@/lib/utils";
import styles from "./AgentPanel.module.css";

interface SimulationProfile {
  birthYear: number;
  spouseBirthYear?: number | null;
  retirementAge: number;
}

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileBasics;
  familyMembers: FamilyMember[];
  simulationProfile: SimulationProfile;
  globalSettings: GlobalSettings | null;
  items: FinancialItem[];
  simulationResult: SimulationResult;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 300;

export function AgentPanel({
  isOpen,
  onClose,
  profile,
  familyMembers,
  simulationProfile,
  globalSettings,
  items,
  simulationResult,
}: AgentPanelProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResizing = useRef(false);

  // 재무 컨텍스트 생성
  const financialContext = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const age = currentYear - simulationProfile.birthYear;
    const spouseAge = simulationProfile.spouseBirthYear
      ? currentYear - simulationProfile.spouseBirthYear
      : null;

    // 가족 구성
    const children = familyMembers.filter(
      (fm) => fm.relationship === "child" || fm.relationship.includes("son") || fm.relationship.includes("daughter")
    );
    const spouse = familyMembers.find((fm) => fm.relationship === "spouse");

    // 카테고리별 아이템 분류
    const incomes = items.filter((i) => i.category === "income");
    const expenses = items.filter((i) => i.category === "expense");
    const assets = items.filter((i) => i.category === "asset");
    const debts = items.filter((i) => i.category === "debt");
    const pensions = items.filter((i) => i.category === "pension");
    const savings = items.filter((i) => i.category === "savings");
    const realEstates = items.filter((i) => (i.category as string) === "realEstate" || (i.category as string) === "real_estate");

    // 월 소득 계산
    const monthlyIncome = incomes.reduce((sum, item) => {
      const data = item.data as { amount?: number; frequency?: string };
      if (!data.amount) return sum;
      return sum + (data.frequency === "yearly" ? data.amount / 12 : data.amount);
    }, 0);

    // 월 지출 계산
    const monthlyExpense = expenses.reduce((sum, item) => {
      const data = item.data as { amount?: number; frequency?: string };
      if (!data.amount) return sum;
      return sum + (data.frequency === "yearly" ? data.amount / 12 : data.amount);
    }, 0);

    // 총 자산 계산
    const totalAssets = assets.reduce((sum, item) => {
      const data = item.data as { currentValue?: number };
      return sum + (data.currentValue || 0);
    }, 0);

    // 총 부채 계산
    const totalDebt = debts.reduce((sum, item) => {
      const data = item.data as { principal?: number; remainingBalance?: number };
      return sum + (data.remainingBalance || data.principal || 0);
    }, 0);

    // 저축/투자 총액
    const totalSavings = savings.reduce((sum, item) => {
      const data = item.data as { currentBalance?: number };
      return sum + (data.currentBalance || 0);
    }, 0);

    // 부동산 총액
    const totalRealEstate = realEstates.reduce((sum, item) => {
      const data = item.data as { currentValue?: number };
      return sum + (data.currentValue || 0);
    }, 0);

    // 연금 현황
    const pensionSummary = pensions.map((p) => {
      const data = p.data as { currentBalance?: number; expectedMonthlyAmount?: number };
      return {
        type: p.type,
        title: p.title,
        balance: data.currentBalance || 0,
        expectedMonthly: data.expectedMonthlyAmount || 0,
      };
    });

    // 은퇴 준비율 계산 (은퇴 시점 순자산 / FI 목표)
    const retirementReadiness = simulationResult.summary?.fiTarget
      ? Math.round((simulationResult.summary.retirementNetWorth / simulationResult.summary.fiTarget) * 100)
      : 0;

    return {
      // 기본 정보
      name: profile.name || "고객",
      age,
      spouseAge,
      retirementAge: simulationProfile.retirementAge,
      yearsUntilRetirement: Math.max(0, simulationProfile.retirementAge - age),

      // 가족
      isMarried: !!spouse,
      childrenCount: children.length,
      childrenAges: children.map((c) => {
        if (!c.birth_date) return null;
        const birthYear = parseInt(c.birth_date.split("-")[0]);
        return currentYear - birthYear;
      }).filter(Boolean),

      // 재무 현황
      monthlyIncome,
      monthlyExpense,
      monthlySurplus: monthlyIncome - monthlyExpense,

      // 자산
      totalAssets,
      totalSavings,
      totalRealEstate,
      totalDebt,
      netWorth: totalAssets + totalSavings + totalRealEstate - totalDebt,

      // 연금
      pensionSummary,

      // 시뮬레이션 결과
      retirementReadiness,

      // 설정
      inflationRate: globalSettings?.inflationRate || 2,
      investmentReturnRate: globalSettings?.investmentReturnRate || 5,
    };
  }, [profile, familyMembers, simulationProfile, globalSettings, items, simulationResult]);

  // 컨텍스트를 텍스트로 변환
  const contextText = useMemo(() => {
    const ctx = financialContext;

    let text = `## 고객 재무 현황

### 기본 정보
- 이름: ${ctx.name}
- 나이: ${ctx.age}세
- 목표 은퇴 나이: ${ctx.retirementAge}세 (${ctx.yearsUntilRetirement}년 후)
- 결혼 여부: ${ctx.isMarried ? "기혼" : "미혼"}`;

    if (ctx.spouseAge) {
      text += `\n- 배우자 나이: ${ctx.spouseAge}세`;
    }

    if (ctx.childrenCount > 0) {
      text += `\n- 자녀: ${ctx.childrenCount}명 (${ctx.childrenAges.join("세, ")}세)`;
    }

    text += `

### 월간 현금 흐름
- 월 소득: ${formatMoney(ctx.monthlyIncome)}
- 월 지출: ${formatMoney(ctx.monthlyExpense)}
- 월 잉여: ${formatMoney(ctx.monthlySurplus)}

### 자산 현황
- 금융 자산: ${formatMoney(ctx.totalSavings)}
- 실물 자산: ${formatMoney(ctx.totalAssets)}
- 부동산: ${formatMoney(ctx.totalRealEstate)}
- 부채: ${formatMoney(ctx.totalDebt)}
- 순자산: ${formatMoney(ctx.netWorth)}`;

    if (ctx.pensionSummary.length > 0) {
      text += `\n\n### 연금 현황`;
      ctx.pensionSummary.forEach((p) => {
        text += `\n- ${p.title}: 적립금 ${formatMoney(p.balance)}`;
        if (p.expectedMonthly > 0) {
          text += `, 예상 월 수령액 ${formatMoney(p.expectedMonthly)}`;
        }
      });
    }

    text += `

### 은퇴 준비 상태
- 은퇴 준비율: ${ctx.retirementReadiness.toFixed(0)}%

### 가정
- 물가상승률: ${ctx.inflationRate}%
- 투자 수익률: ${ctx.investmentReturnRate}%`;

    return text;
  }, [financialContext]);

  // 메시지 스크롤
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 리사이즈 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;

    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // 메시지 전송
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          context: contextText,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요." },
        ]);
      } else {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.message },
        ]);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "네트워크 오류가 발생했습니다. 다시 시도해주세요." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Enter로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 텍스트에어리어 자동 높이
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      style={{ width: `${width}px` }}
    >
      {/* 리사이즈 핸들 */}
      <div className={styles.resizeHandle} onMouseDown={handleMouseDown}>
        <GripVertical size={12} />
      </div>

      {/* 헤더 */}
      <div className={styles.header}>
        <h2 className={styles.title}>Lycon Gemini</h2>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* 메시지 영역 */}
      <div className={styles.messagesArea}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-4.587-1.112L3 22l1.112-4.413A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2z" />
                <path d="M8 12h.01M12 12h.01M16 12h.01" />
              </svg>
            </div>
            <p className={styles.emptyTitle}>무엇이든 물어보세요</p>
            <p className={styles.emptyDesc}>
              재무 계획, 투자 전략, 은퇴 준비 등<br />
              당신의 재정 목표 달성을 도와드립니다
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`${styles.message} ${
                  msg.role === "user" ? styles.userMessage : styles.assistantMessage
                }`}
              >
                <div className={styles.messageContent}>{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className={`${styles.message} ${styles.assistantMessage}`}>
                <div className={styles.loadingDots}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 입력 영역 */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            className={styles.input}
            placeholder="메시지를 입력하세요..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? <Loader2 size={18} className={styles.spinner} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
