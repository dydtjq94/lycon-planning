"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Lock, ChevronLeft } from "lucide-react";
import {
  getConversations,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  initializePrimaryConversation,
  type Conversation,
  type Message,
} from "@/lib/services/messageService";
import styles from "./MessagesTab.module.css";

interface MessagesTabProps {
  onUnreadCountChange?: (count: number) => void;
}

export function MessagesTab({ onUnreadCountChange }: MessagesTabProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConversationList, setShowConversationList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 대화 목록 로드
  const loadConversations = useCallback(async () => {
    try {
      let convos = await getConversations();

      // 대화가 없으면 기본 담당자와 대화 생성
      if (convos.length === 0) {
        await initializePrimaryConversation();
        convos = await getConversations();
      }

      setConversations(convos);

      // 안 읽은 메시지 수 계산
      const totalUnread = convos.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      onUnreadCountChange?.(totalUnread);

      // 첫 번째 대화 선택
      if (convos.length > 0 && !selectedConversation) {
        setSelectedConversation(convos[0]);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onUnreadCountChange, selectedConversation]);

  // 메시지 로드
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const msgs = await getMessages(conversationId);
      setMessages(msgs);

      // 먼저 로컬 상태 즉시 업데이트 (사용자가 빠르게 이탈해도 반영됨)
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        );
        const totalUnread = updated.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        onUnreadCountChange?.(totalUnread);
        return updated;
      });

      // DB 동기화는 백그라운드에서 진행
      markMessagesAsRead(conversationId).catch(console.error);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, [onUnreadCountChange]);

  // 초기 로드
  useEffect(() => {
    loadConversations();
  }, []);

  // 대화 선택 시 메시지 로드
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      setShowConversationList(false);
    }
  }, [selectedConversation?.id]);

  // 메시지 영역 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 날짜 포맷 (대화 목록용)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return formatTime(dateStr);
    } else if (diffDays === 1) {
      return "어제";
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        {/* 스켈레톤 대화 목록 */}
        <div className={styles.conversationList}>
          <div className={styles.listHeader}>
            <h2>메시지</h2>
          </div>
          <div className={styles.listContent}>
            {[1, 2].map((i) => (
              <div key={i} className={styles.skeletonItem}>
                <div className={styles.skeletonAvatar} />
                <div className={styles.skeletonInfo}>
                  <div className={styles.skeletonName} />
                  <div className={styles.skeletonTitle} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 스켈레톤 채팅 영역 */}
        <div className={styles.chatArea}>
          <div className={styles.chatHeader}>
            <div className={styles.skeletonAvatarSmall} />
            <div className={styles.skeletonInfo}>
              <div className={styles.skeletonName} />
              <div className={styles.skeletonTitle} />
            </div>
          </div>
          <div className={styles.messagesArea}>
            <div className={styles.messagesList}>
              <div className={styles.skeletonMessage}>
                <div className={styles.skeletonAvatarTiny} />
                <div className={styles.skeletonBubble} />
              </div>
              <div className={styles.skeletonMessage}>
                <div className={styles.skeletonAvatarTiny} />
                <div className={styles.skeletonBubbleLong} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 대화 목록 */}
      <div className={`${styles.conversationList} ${showConversationList ? styles.show : ""}`}>
        <div className={styles.listHeader}>
          <h2>메시지</h2>
        </div>
        <div className={styles.listContent}>
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`${styles.conversationItem} ${
                selectedConversation?.id === conversation.id ? styles.selected : ""
              }`}
              onClick={() => setSelectedConversation(conversation)}
            >
              <div className={styles.conversationAvatar}>
                {conversation.expert?.name?.[0] || "?"}
                {conversation.is_primary && (
                  <span className={styles.primaryBadge} />
                )}
              </div>
              <div className={styles.conversationInfo}>
                <div className={styles.conversationHeader}>
                  <span className={styles.conversationName}>
                    {conversation.expert?.name}
                  </span>
                  <span className={styles.conversationTime}>
                    {formatDate(conversation.last_message_at)}
                  </span>
                </div>
                <div className={styles.conversationPreview}>
                  <span className={styles.conversationTitle}>
                    {conversation.expert?.title}
                  </span>
                  {conversation.unread_count > 0 && (
                    <span className={styles.unreadBadge}>
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className={styles.chatArea}>
        {selectedConversation ? (
          <>
            {/* 채팅 헤더 */}
            <div className={styles.chatHeader}>
              <button
                className={styles.backButton}
                onClick={() => setShowConversationList(true)}
              >
                <ChevronLeft size={20} />
              </button>
              <div className={styles.chatHeaderAvatar}>
                {selectedConversation.expert?.name?.[0] || "?"}
              </div>
              <div className={styles.chatHeaderInfo}>
                <span className={styles.chatHeaderName}>
                  {selectedConversation.expert?.name}
                </span>
                <span className={styles.chatHeaderTitle}>
                  {selectedConversation.expert?.title}
                </span>
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className={styles.messagesArea}>
              <div className={styles.messagesList}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`${styles.messageRow} ${
                      message.sender_type === "user"
                        ? styles.userRow
                        : styles.expertRow
                    }`}
                  >
                    {message.sender_type === "expert" && (
                      <div className={styles.messageAvatar}>
                        {selectedConversation.expert?.name?.[0] || "?"}
                      </div>
                    )}
                    <div className={styles.bubbleWrapper}>
                      <div
                        className={`${styles.messageBubble} ${
                          message.sender_type === "user"
                            ? styles.userBubble
                            : styles.expertBubble
                        }`}
                      >
                        <p className={styles.messageContent}>{message.content}</p>
                      </div>
                      <span className={styles.messageTime}>
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* 입력 영역 - 잠금 상태 */}
            <div className={styles.inputArea}>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.lockIconInline} />
                <input
                  type="text"
                  className={styles.input}
                  placeholder="첫 은퇴 진단 후 상담이 가능해요"
                  disabled
                />
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <p>대화를 선택해주세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
