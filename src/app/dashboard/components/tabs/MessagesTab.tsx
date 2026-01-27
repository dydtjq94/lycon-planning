"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, Image as ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getConversations,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  initializePrimaryConversation,
  uploadChatImage,
  type Conversation,
  type Message,
} from "@/lib/services/messageService";
import { ImageViewer } from "@/app/waiting/components/ImageViewer";
import styles from "./MessagesTab.module.css";

interface MessagesTabProps {
  onUnreadCountChange?: (count: number) => void;
  isVisible?: boolean;
}

export function MessagesTab({ onUnreadCountChange, isVisible = true }: MessagesTabProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showConversationList, setShowConversationList] = useState(true);
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [scrollReady, setScrollReady] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSendRef = useRef(false);
  const justSentRef = useRef(false);

  // 메시지 목록 맨 아래로 스크롤
  const scrollToBottom = useCallback((smooth = true) => {
    if (messageListRef.current) {
      const scrollHeight = messageListRef.current.scrollHeight;
      if (smooth) {
        messageListRef.current.scrollTo({ top: scrollHeight, behavior: "smooth" });
      } else {
        messageListRef.current.scrollTop = scrollHeight;
      }
    }
  }, []);

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
      setScrollReady(false);
    }
  }, [selectedConversation?.id]);

  // 메시지 로드 후 스크롤
  useEffect(() => {
    if (messages.length === 0) {
      setScrollReady(true);
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
        setScrollReady(true);
      });
    });
  }, [messages.length, selectedConversation?.id]);

  // 탭이 활성화될 때 읽음 처리
  useEffect(() => {
    if (isVisible && selectedConversation) {
      markMessagesAsRead(selectedConversation.id);
    }
  }, [isVisible, selectedConversation]);

  // Realtime 구독
  useEffect(() => {
    if (!selectedConversation) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`dashboard-messages:${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;

          // 내가 보낸 메시지는 handleSend에서 처리하므로 무시
          if (newMsg.sender_type === "user") {
            return;
          }

          setMessages((prev) => {
            // 중복 방지
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(scrollToBottom, 100);

          // 채팅 탭 보고 있을 때만 읽음 처리
          if (isVisible) {
            markMessagesAsRead(selectedConversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, scrollToBottom, isVisible]);

  // 메시지 전송 (낙관적 UI)
  const handleSend = async () => {
    if (!selectedConversation || (!newMessage.trim() && pendingImages.length === 0) || sending) return;

    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const imagesToUpload = [...pendingImages];

    // 즉시 UI에 표시 (낙관적 업데이트)
    const tempMessage: Message = {
      id: tempId,
      conversation_id: selectedConversation.id,
      sender_type: "user",
      content,
      attachments: imagesToUpload.map((img) => img.preview),
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");
    setPendingImages([]);
    setTimeout(scrollToBottom, 100);

    // 백그라운드에서 서버 전송
    try {
      setSending(true);

      // 이미지 업로드
      const uploadedUrls: string[] = [];
      for (const img of imagesToUpload) {
        const url = await uploadChatImage(img.file);
        uploadedUrls.push(url);
      }

      // 업로드된 이미지 미리 로드 (깜빡임 방지)
      if (uploadedUrls.length > 0) {
        await Promise.all(uploadedUrls.map(url => {
          return new Promise<void>((resolve) => {
            const img = new window.Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
          });
        }));
      }

      const msg = await sendMessage(selectedConversation.id, content, uploadedUrls.length > 0 ? uploadedUrls : undefined);

      // 임시 메시지를 실제 메시지로 교체
      setMessages((prev) => prev.map((m) => m.id === tempId ? msg : m));

      // Slack 알림 (비동기, 실패해도 무시)
      fetch("/api/slack/new-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedConversation.user_id }),
      }).catch(() => {});

      // preview URL 해제
      imagesToUpload.forEach((img) => URL.revokeObjectURL(img.preview));
    } catch (error) {
      console.error("메시지 전송 오류:", error);
      // 실패시 임시 메시지 제거하고 입력창에 복원
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
      setPendingImages(imagesToUpload);
    } finally {
      setSending(false);
    }

    inputRef.current?.focus();
  };

  // Enter 키로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) {
        // 한글 조합 중이면 조합 완료 후 전송하도록 예약
        pendingSendRef.current = true;
      } else {
        // 방금 compositionEnd에서 전송했으면 스킵
        if (justSentRef.current) {
          justSentRef.current = false;
          e.preventDefault();
          return;
        }
        e.preventDefault();
        handleSend();
      }
    }
  };

  // 한글 조합 완료 시 예약된 전송 처리
  const handleCompositionEnd = () => {
    if (pendingSendRef.current) {
      pendingSendRef.current = false;
      justSentRef.current = true;
      handleSend();
    }
  };

  // 이미지 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: { file: File; preview: string }[] = [];
    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const preview = URL.createObjectURL(file);
        newImages.push({ file, preview });
      }
    });

    setPendingImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
  };

  // 이미지 제거
  const removeImage = (index: number) => {
    setPendingImages((prev) => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // 날짜 포맷 (대화 목록용)
  const formatListDate = (dateStr: string) => {
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

  // 날짜 포맷 (날짜 구분선용)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "오늘";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "어제";
    } else {
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  };

  // 날짜 구분선 표시 여부
  const shouldShowDateDivider = (index: number) => {
    if (index === 0) return true;
    const current = new Date(messages[index].created_at).toDateString();
    const prev = new Date(messages[index - 1].created_at).toDateString();
    return current !== prev;
  };

  // 같은 그룹인지 확인 (같은 발신자 + 같은 시간(분))
  const isSameGroup = (msg1: Message, msg2: Message) => {
    if (msg1.sender_type !== msg2.sender_type) return false;
    const time1 = formatTime(msg1.created_at);
    const time2 = formatTime(msg2.created_at);
    return time1 === time2;
  };

  // 그룹의 첫 메시지인지
  const isFirstInGroup = (index: number) => {
    if (index === 0) return true;
    if (shouldShowDateDivider(index)) return true;
    return !isSameGroup(messages[index - 1], messages[index]);
  };

  // 그룹의 마지막 메시지인지
  const isLastInGroup = (index: number) => {
    if (index === messages.length - 1) return true;
    if (shouldShowDateDivider(index + 1)) return true;
    return !isSameGroup(messages[index], messages[index + 1]);
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
                    {formatListDate(conversation.last_message_at)}
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
            <div className={styles.messagesArea} ref={messageListRef}>
              <div className={styles.messagesList} style={{ opacity: scrollReady ? 1 : 0 }}>
                {messages.length === 0 ? (
                  <div className={styles.emptyMessages}>
                    <p>아직 메시지가 없습니다.</p>
                    <p>궁금한 점이 있으시면 메시지를 보내주세요.</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const firstInGroup = isFirstInGroup(index);
                    const lastInGroup = isLastInGroup(index);

                    return (
                      <div key={message.id}>
                        {shouldShowDateDivider(index) && (
                          <div className={styles.dateDivider}>
                            <span>{formatDate(message.created_at)}</span>
                          </div>
                        )}
                        <div
                          className={`${styles.messageRow} ${
                            message.sender_type === "user"
                              ? styles.userRow
                              : styles.expertRow
                          } ${!firstInGroup ? styles.continuedRow : ""}`}
                        >
                          {message.sender_type === "expert" && (
                            <div className={styles.expertInfo}>
                              {firstInGroup ? (
                                <div className={styles.messageAvatar}>
                                  {selectedConversation.expert?.name?.[0] || "?"}
                                </div>
                              ) : (
                                <div className={styles.avatarPlaceholder} />
                              )}
                            </div>
                          )}
                          <div className={styles.messageContentWrapper}>
                            {message.sender_type === "expert" && firstInGroup && (
                              <span className={styles.senderName}>
                                {selectedConversation.expert?.name}
                              </span>
                            )}
                            {/* 이미지 */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className={`${styles.imageWithTime} ${
                                message.sender_type === "user" ? styles.imageWithTimeUser : ""
                              } ${message.content ? styles.imageWithContent : ""}`}>
                                {lastInGroup && !message.content && message.sender_type === "user" && (
                                  <span className={styles.messageTime}>
                                    {formatTime(message.created_at)}
                                  </span>
                                )}
                                <div className={styles.messageImages}>
                                  {message.attachments.map((url, imgIdx) => (
                                    <img
                                      key={imgIdx}
                                      src={url}
                                      alt="첨부 이미지"
                                      className={styles.messageImage}
                                      onClick={() => setViewingImage(url)}
                                    />
                                  ))}
                                </div>
                                {lastInGroup && !message.content && message.sender_type === "expert" && (
                                  <span className={styles.messageTime}>
                                    {formatTime(message.created_at)}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* 텍스트 */}
                            {message.content && (
                              <div className={`${styles.bubbleWithTime} ${
                                message.sender_type === "user" ? styles.bubbleWithTimeUser : ""
                              }`}>
                                {lastInGroup && message.sender_type === "user" && (
                                  <span className={styles.messageTime}>
                                    {formatTime(message.created_at)}
                                  </span>
                                )}
                                <div
                                  className={`${styles.messageBubble} ${
                                    message.sender_type === "user"
                                      ? styles.userBubble
                                      : styles.expertBubble
                                  } ${
                                    firstInGroup
                                      ? message.sender_type === "user"
                                        ? styles.userBubbleTail
                                        : styles.expertBubbleTail
                                      : ""
                                  }`}
                                >
                                  <p className={styles.messageText}>{message.content}</p>
                                </div>
                                {lastInGroup && message.sender_type === "expert" && (
                                  <span className={styles.messageTime}>
                                    {formatTime(message.created_at)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* 입력 영역 */}
            <div className={styles.inputArea}>
              <div className={styles.inputWrapper}>
                {/* 이미지 프리뷰 */}
                {pendingImages.length > 0 && (
                  <div className={styles.imagePreviewRow}>
                    {pendingImages.map((img, idx) => (
                      <div key={idx} className={styles.imagePreviewItem}>
                        <img src={img.preview} alt="첨부 이미지" className={styles.previewImage} />
                        <button
                          type="button"
                          className={styles.removeImageButton}
                          onClick={() => removeImage(idx)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.inputRow}>
                  <button
                    type="button"
                    className={styles.attachButton}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon size={20} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className={styles.hiddenInput}
                    onChange={handleImageSelect}
                  />
                  <textarea
                    ref={inputRef}
                    className={styles.input}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onCompositionEnd={handleCompositionEnd}
                    placeholder="메시지 입력"
                    disabled={sending}
                    rows={1}
                  />
                  <button
                    className={`${styles.sendButton} ${
                      (newMessage.trim() || pendingImages.length > 0) && !sending
                        ? styles.sendButtonActive
                        : ""
                    }`}
                    onClick={handleSend}
                    disabled={(!newMessage.trim() && pendingImages.length === 0) || sending}
                  >
                    전송
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <p>대화를 선택해주세요</p>
          </div>
        )}
      </div>

      {/* 이미지 뷰어 */}
      {viewingImage && (
        <ImageViewer
          src={viewingImage}
          onClose={() => setViewingImage(null)}
        />
      )}
    </div>
  );
}
