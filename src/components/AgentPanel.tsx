"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, GripVertical, Send, Loader2, RotateCcw, ChevronUp } from "lucide-react";
import styles from "./AgentPanel.module.css";

// Agent 타입 정의
type AgentType = "general" | "analysis" | "retirement" | "scenario" | "insight";
type AgentMode = "plan" | "edit";

interface AgentConfig {
  id: AgentType;
  name: string;
  title: string;
  description: string;
  placeholder: string;
}

const AGENTS: AgentConfig[] = [
  {
    id: "general",
    name: "자유 질문",
    title: "무엇이든 물어보세요",
    description: "고객 데이터를 기반으로 분석하고 답변합니다",
    placeholder: "예: 이 고객의 재무 상태는 어때?",
  },
  {
    id: "analysis",
    name: "현황 파악",
    title: "재무 현황을 분석합니다",
    description: "자산, 부채, 현금흐름, 저축률을 종합 분석",
    placeholder: "예: 현황 분석해줘 / 자산 구성이 어때?",
  },
  {
    id: "retirement",
    name: "은퇴 진단",
    title: "은퇴 준비 상태를 진단합니다",
    description: "3층 연금, 은퇴자금 충분도, 갭 분석",
    placeholder: "예: 은퇴 준비 상태는? / 연금 분석해줘",
  },
  {
    id: "scenario",
    name: "시나리오",
    title: "What-if 시나리오를 분석합니다",
    description: "저축률, 은퇴시점, 수익률 변경 시 결과 비교",
    placeholder: "예: 5년 더 일하면? / 월 100만원 더 저축하면?",
  },
  {
    id: "insight",
    name: "제안 포인트",
    title: "상담 포인트를 정리합니다",
    description: "칭찬 포인트, 핵심 과제, 상담 멘트 제안",
    placeholder: "예: 상담 포인트 정리해줘 / 뭘 제안하면 좋을까?",
  },
];

interface CustomerInfo {
  name: string;
  stage: string;
  age?: number;
  retirementAge?: number;
}

export interface AgentAction {
  type: "update" | "insert" | "delete";
  table: string;
  id?: string;
  data?: Record<string, unknown>;
}

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contextText: string;
  customerInfo?: CustomerInfo;
  onAction?: (actions: AgentAction[]) => Promise<void>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  pendingActions?: AgentAction[];  // 승인 대기 중인 액션
  actionsApproved?: boolean;  // 액션 승인 여부
  suggestEditMode?: boolean;  // 수정 모드 전환 제안
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 360;

// 간단한 마크다운 파서
function parseSimpleMarkdown(text: string): string {
  const parseTable = (text: string): string => {
    const tableRegex = /(\|.+\|[\r\n]*)+/g;
    return text.replace(tableRegex, (match) => {
      const rows = match.trim().split('\n').filter(row => row.trim());
      const dataRows = rows.filter(row => !row.match(/^\|[\s\-:]+\|[\s\-:]*\|?$/));
      if (dataRows.length === 0) return '';

      const tableRows = dataRows.map((row, idx) => {
        const cells = row.split('|').filter(cell => cell !== '');
        if (cells.every(cell => cell.trim().match(/^[-:]+$/))) return '';
        const cellTag = idx === 0 ? 'th' : 'td';
        const cellsHtml = cells.map(cell => `<${cellTag}>${cell.trim()}</${cellTag}>`).join('');
        return `<tr>${cellsHtml}</tr>`;
      }).filter(row => row).join('');

      return tableRows ? `<table>${tableRows}</table>` : '';
    });
  };

  let result = text;
  result = parseTable(result);
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/^[-•]\s+(.+)$/gm, '<li class="main">$1</li>');
  result = result.replace(/^\*\s+(.+)$/gm, '<li class="sub">$1</li>');
  result = result.replace(/^(\d+)\.\s+(.+)$/gm, '<li class="numbered">$2</li>');
  result = result.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, (match) => {
    return '<ul>' + match.replace(/\n/g, '') + '</ul>';
  });
  result = result.replace(/\n{2,}/g, '<br /><br />');
  result = result.replace(/\n/g, '<br />');

  return result;
}

export function AgentPanel({
  isOpen,
  onClose,
  contextText,
  customerInfo,
  onAction,
}: AgentPanelProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("general");
  const [agentMode, setAgentMode] = useState<AgentMode>("plan");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showEditModeSelector, setShowEditModeSelector] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResizing = useRef(false);

  const currentAgent = AGENTS.find(a => a.id === selectedAgent) || AGENTS[0];

  // 메시지 스크롤
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Agent 변경 시 대화 초기화
  const handleAgentChange = (agentId: AgentType) => {
    if (agentId !== selectedAgent) {
      setSelectedAgent(agentId);
      setMessages([]);
    }
    setShowModeSelector(false);
  };

  // 대화 초기화
  const handleReset = () => {
    setMessages([]);
  };

  // 액션 승인
  const handleApproveActions = async (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message.pendingActions || !onAction) return;

    try {
      await onAction(message.pendingActions);
      // 승인 완료 표시
      const updatedMessages = [...messages];
      updatedMessages[messageIndex] = {
        ...message,
        actionsApproved: true,
      };
      setMessages(updatedMessages);
    } catch (error) {
      console.error("[Action Error]", error);
    }
  };

  // 액션 거절
  const handleRejectActions = (messageIndex: number) => {
    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = {
      ...messages[messageIndex],
      pendingActions: undefined,
    };
    setMessages(updatedMessages);
  };

  // 수정 모드로 전환하고 마지막 질문 다시 보내기
  const handleSwitchToEditMode = async (messageIndex: number) => {
    // 해당 메시지 바로 앞의 유저 메시지 찾기
    let lastUserMessage = "";
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessage = messages[i].content;
        break;
      }
    }

    if (!lastUserMessage) return;

    // 수정 모드로 변경
    setAgentMode("edit");

    // 해당 assistant 메시지 제거하고 다시 요청
    const messagesUntilUser = messages.slice(0, messageIndex);
    setMessages(messagesUntilUser);
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesUntilUser,
          context: contextText,
          agentType: selectedAgent,
          agentMode: "edit",  // 수정 모드로 재요청
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages([
          ...messagesUntilUser,
          { role: "assistant", content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요." },
        ]);
      } else {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.message,
          pendingActions: data.actions?.length > 0 ? data.actions : undefined,
          actionsApproved: false,
        };
        setMessages([...messagesUntilUser, assistantMessage]);
      }
    } catch {
      setMessages([
        ...messagesUntilUser,
        { role: "assistant", content: "네트워크 오류가 발생했습니다. 다시 시도해주세요." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 수정 요청 키워드 감지
  const detectEditRequest = (text: string): boolean => {
    const editKeywords = ["수정", "변경", "추가", "삭제", "업데이트", "바꿔", "고쳐", "넣어", "빼", "만들어"];
    return editKeywords.some(keyword => text.includes(keyword));
  };

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

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          context: contextText,
          agentType: selectedAgent,
          agentMode: agentMode,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요." },
        ]);
      } else {
        // 계획 모드인데 수정 요청을 한 경우 감지
        const userAskedForEdit = agentMode === "plan" && detectEditRequest(userMessage.content);
        const noActionsReturned = !data.actions || data.actions.length === 0;

        const assistantMessage: Message = {
          role: "assistant",
          content: data.message,
          pendingActions: data.actions?.length > 0 ? data.actions : undefined,
          actionsApproved: false,
          suggestEditMode: userAskedForEdit && noActionsReturned,
        };
        setMessages([...newMessages, assistantMessage]);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
        <div className={styles.headerActions}>
          {messages.length > 0 && (
            <button className={styles.resetBtn} onClick={handleReset} title="대화 초기화">
              <RotateCcw size={16} />
            </button>
          )}
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className={styles.messagesArea}>
        {messages.length === 0 ? (
          <div key={selectedAgent} className={styles.emptyState}>
            <div className={styles.agentBadge}>{currentAgent.name}</div>
            <p className={styles.emptyTitle}>{currentAgent.title}</p>
            <p className={styles.emptyDescription}>{currentAgent.description}</p>
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
                {msg.role === "user" ? (
                  <div className={styles.messageContent}>{msg.content}</div>
                ) : (
                  <>
                    <div
                      className={styles.messageContent}
                      dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(msg.content) }}
                    />
                    {/* 액션 승인 UI */}
                    {msg.pendingActions && msg.pendingActions.length > 0 && !msg.actionsApproved && (
                      <div className={styles.actionApproval}>
                        <div className={styles.actionList}>
                          {msg.pendingActions.map((action, actionIdx) => (
                            <div key={actionIdx} className={styles.actionItem}>
                              <span className={styles.actionType}>
                                {action.type === "update" ? "수정" : action.type === "insert" ? "추가" : "삭제"}
                              </span>
                              <span className={styles.actionTable}>{action.table}</span>
                              {action.data && (
                                <span className={styles.actionData}>
                                  {Object.entries(action.data).map(([k, v]) => `${k}: ${v}`).join(", ")}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.actionReject}
                            onClick={() => handleRejectActions(idx)}
                          >
                            취소
                          </button>
                          <button
                            className={styles.actionApprove}
                            onClick={() => handleApproveActions(idx)}
                          >
                            적용하기
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.actionsApproved && (
                      <div className={styles.actionApplied}>
                        변경사항이 적용되었습니다
                      </div>
                    )}
                    {msg.suggestEditMode && (
                      <div className={styles.modeSwitchSuggestion}>
                        <span>데이터 수정이 필요하신가요?</span>
                        <button
                          className={styles.modeSwitchBtn}
                          onClick={() => handleSwitchToEditMode(idx)}
                        >
                          수정 모드로 전환
                        </button>
                      </div>
                    )}
                  </>
                )}
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
        <textarea
          ref={inputRef}
          className={styles.input}
          placeholder={currentAgent.placeholder}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading}
        />
        <div className={styles.inputActions}>
          {/* 모드 선택기 */}
          <div className={styles.modeSelector}>
            <button
              className={styles.modeButton}
              onClick={() => {
                setShowModeSelector(!showModeSelector);
                setShowEditModeSelector(false);
              }}
            >
              <span className={styles.modeLabel}>{currentAgent.name}</span>
              <ChevronUp size={12} className={`${styles.modeIcon} ${showModeSelector ? styles.modeIconOpen : ""}`} />
            </button>

            {showModeSelector && (
              <div className={styles.modeDropdown}>
                {AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    className={`${styles.modeOption} ${selectedAgent === agent.id ? styles.modeOptionActive : ""}`}
                    onClick={() => handleAgentChange(agent.id)}
                  >
                    <span className={styles.modeOptionName}>{agent.name}</span>
                    <span className={styles.modeOptionDesc}>{agent.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 계획/수정 모드 선택기 */}
          <div className={styles.modeSelector}>
            <button
              className={styles.modeButton}
              onClick={() => {
                setShowEditModeSelector(!showEditModeSelector);
                setShowModeSelector(false);
              }}
            >
              <span className={styles.modeLabel}>{agentMode === "plan" ? "계획 모드" : "수정 모드"}</span>
              <ChevronUp size={12} className={`${styles.modeIcon} ${showEditModeSelector ? styles.modeIconOpen : ""}`} />
            </button>

            {showEditModeSelector && (
              <div className={styles.modeDropdown}>
                <button
                  className={`${styles.modeOption} ${agentMode === "plan" ? styles.modeOptionActive : ""}`}
                  onClick={() => {
                    setAgentMode("plan");
                    setShowEditModeSelector(false);
                  }}
                >
                  <span className={styles.modeOptionName}>계획 모드</span>
                  <span className={styles.modeOptionDesc}>분석과 조언만 제공</span>
                </button>
                <button
                  className={`${styles.modeOption} ${agentMode === "edit" ? styles.modeOptionActive : ""}`}
                  onClick={() => {
                    setAgentMode("edit");
                    setShowEditModeSelector(false);
                  }}
                >
                  <span className={styles.modeOptionName}>수정 모드</span>
                  <span className={styles.modeOptionDesc}>데이터 수정 제안 가능</span>
                </button>
              </div>
            )}
          </div>

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
