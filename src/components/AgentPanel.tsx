"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, GripVertical, Send, Loader2 } from "lucide-react";
import styles from "./AgentPanel.module.css";

interface CustomerInfo {
  name: string;
  stage: string;
  age?: number;
  retirementAge?: number;
}

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contextText: string; // 고객 재무 컨텍스트 (마크다운 형식)
  customerInfo?: CustomerInfo;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 300;

// 간단한 마크다운 파서
function parseSimpleMarkdown(text: string): string {
  return text
    // 굵게 **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 기울임 *text*
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // 번호 리스트
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li class="numbered">$2</li>')
    // 불릿 리스트
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    // 연속된 li를 ul로 감싸기
    .replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
    // 줄바꿈
    .replace(/\n/g, '<br />');
}

export function AgentPanel({
  isOpen,
  onClose,
  contextText,
  customerInfo,
}: AgentPanelProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResizing = useRef(false);

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

    // textarea 높이 리셋
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

      {/* 고객 정보 */}
      {customerInfo && (
        <div className={styles.customerInfo}>
          <span className={styles.customerName}>{customerInfo.name}</span>
          <span className={styles.customerMeta}>
            {customerInfo.age && `${customerInfo.age}세`}
            {customerInfo.age && customerInfo.retirementAge && " / "}
            {customerInfo.retirementAge && `목표 은퇴 ${customerInfo.retirementAge}세`}
          </span>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className={styles.messagesArea}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyGreeting}>
              {customerInfo?.name ? `${customerInfo.name} 고객님의` : "고객님의"}
            </p>
            <p className={styles.emptyTitle}>재무설계를 함께 도와드릴게요</p>
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
                  <div
                    className={styles.messageContent}
                    dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(msg.content) }}
                  />
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
        <p className={styles.footerText}>고객에게 최적의 재무 설계를 함께 만들어 드려요</p>
      </div>
    </div>
  );
}
