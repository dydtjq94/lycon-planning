"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Image as ImageIcon, X } from "lucide-react";
import {
  loadChatData,
  sendMessage,
  markMessagesAsRead,
  uploadChatImage,
  type Message,
  type Conversation,
  type Expert,
} from "@/lib/services/messageService";
import styles from "./ChatRoom.module.css";

interface ChatRoomProps {
  userId: string;
}

export function ChatRoom({ userId }: ChatRoomProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expert, setExpert] = useState<Expert | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSendRef = useRef(false);
  const justSentRef = useRef(false);
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  // 메시지 목록 맨 아래로 스크롤
  const scrollToBottom = useCallback((smooth = true) => {
    if (smooth) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, []);

  // 대화방 초기화 (단일 쿼리로 최적화)
  useEffect(() => {
    const initChat = async () => {
      try {
        const data = await loadChatData();
        if (!data || !data.expert || !data.conversation) {
          setLoading(false);
          return;
        }

        setExpert(data.expert);
        setConversation(data.conversation);
        setMessages(data.messages);
        setLoading(false);

        // 읽음 처리 (백그라운드)
        markMessagesAsRead(data.conversation.id);
      } catch (error) {
        console.error("채팅 초기화 오류:", error);
        setLoading(false);
      }
    };

    initChat();
  }, [userId]);

  // 로딩 완료 후 스크롤 (useLayoutEffect로 렌더링 전에 처리)
  useLayoutEffect(() => {
    if (!loading && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [loading]);

  // Realtime 구독
  useEffect(() => {
    if (!conversation) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // 중복 방지
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(scrollToBottom, 100);

          // 전문가 메시지면 읽음 처리
          if (newMsg.sender_type === "expert") {
            markMessagesAsRead(conversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation, scrollToBottom]);

  // 메시지 전송 (낙관적 UI)
  const handleSend = async () => {
    if (!conversation || (!newMessage.trim() && pendingImages.length === 0) || sending || uploading) return;

    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const imagesToUpload = [...pendingImages];

    // 즉시 UI에 표시 (낙관적 업데이트)
    const tempMessage: Message = {
      id: tempId,
      conversation_id: conversation.id,
      sender_type: 'user',
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
      setUploading(true);

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

      const msg = await sendMessage(conversation.id, content, uploadedUrls.length > 0 ? uploadedUrls : undefined);
      // 임시 메시지를 실제 메시지로 교체
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? msg : m)
      );

      // preview URL 해제
      imagesToUpload.forEach((img) => URL.revokeObjectURL(img.preview));
    } catch (error) {
      console.error("메시지 전송 오류:", error);
      // 실패시 임시 메시지 제거하고 입력창에 복원
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
      setPendingImages(imagesToUpload);
    } finally {
      setUploading(false);
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
    // input 초기화 (같은 파일 재선택 가능하도록)
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

  // 날짜 포맷
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

  // 그룹의 첫 메시지인지 (이전 메시지와 다른 그룹)
  const isFirstInGroup = (index: number) => {
    if (index === 0) return true;
    if (shouldShowDateDivider(index)) return true;
    return !isSameGroup(messages[index - 1], messages[index]);
  };

  // 그룹의 마지막 메시지인지 (다음 메시지와 다른 그룹)
  const isLastInGroup = (index: number) => {
    if (index === messages.length - 1) return true;
    if (shouldShowDateDivider(index + 1)) return true;
    return !isSameGroup(messages[index], messages[index + 1]);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.messageList}>
          {/* 스켈레톤 메시지들 */}
          <div className={styles.skeletonRow}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonName} />
              <div className={styles.skeletonBubble} />
            </div>
          </div>
          <div className={`${styles.skeletonRow} ${styles.skeletonUser}`}>
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonBubbleShort} />
            </div>
          </div>
          <div className={styles.skeletonRow}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonName} />
              <div className={styles.skeletonBubbleLong} />
            </div>
          </div>
        </div>
        <div className={styles.inputArea}>
          <div className={styles.inputWrapper}>
            <div className={styles.skeletonInput} />
          </div>
        </div>
      </div>
    );
  }

  if (!expert) {
    return (
      <div className={styles.noExpert}>
        <p>담당 설계사가 배정되지 않았습니다.</p>
        <p>곧 배정될 예정입니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 메시지 목록 */}
      <div className={styles.messageList} ref={messageListRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>아직 메시지가 없습니다.</p>
            <p>궁금한 점이 있으시면 메시지를 보내주세요.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const firstInGroup = isFirstInGroup(index);
            const lastInGroup = isLastInGroup(index);

            return (
              <div key={msg.id}>
                {shouldShowDateDivider(index) && (
                  <div className={styles.dateDivider}>
                    <span>{formatDate(msg.created_at)}</span>
                  </div>
                )}
                <div
                  className={`${styles.messageRow} ${
                    msg.sender_type === "user" ? styles.userRow : styles.expertRow
                  } ${!firstInGroup ? styles.continuedRow : ""}`}
                >
                  {msg.sender_type === "expert" && (
                    <div className={styles.expertInfo}>
                      {firstInGroup ? (
                        <div className={styles.expertAvatar}>
                          {expert.name.charAt(0)}
                        </div>
                      ) : (
                        <div className={styles.avatarPlaceholder} />
                      )}
                    </div>
                  )}
                  <div className={styles.messageContent}>
                    {msg.sender_type === "expert" && firstInGroup && (
                      <span className={styles.senderName}>{expert.name}</span>
                    )}
                    {/* 이미지는 버블 밖에 표시 */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className={`${styles.imageWithTime} ${
                        msg.sender_type === "user" ? styles.imageWithTimeUser : ""
                      } ${msg.content ? styles.imageWithContent : ""}`}>
                        {lastInGroup && !msg.content && msg.sender_type === "user" && (
                          <span className={styles.messageTime}>
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                        <div className={styles.messageImages}>
                          {msg.attachments.map((url, imgIdx) => (
                            <img
                              key={imgIdx}
                              src={url}
                              alt="첨부 이미지"
                              className={styles.messageImage}
                            />
                          ))}
                        </div>
                        {lastInGroup && !msg.content && msg.sender_type === "expert" && (
                          <span className={styles.messageTime}>
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                      </div>
                    )}
                    {/* 텍스트는 버블 안에 표시 (마지막 메시지는 시간과 함께) */}
                    {msg.content && (
                      <div className={`${styles.bubbleWithTime} ${
                        msg.sender_type === "user" ? styles.bubbleWithTimeUser : ""
                      }`}>
                        {lastInGroup && msg.sender_type === "user" && (
                          <span className={styles.messageTime}>
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                        <div
                          className={`${styles.messageBubble} ${
                            msg.sender_type === "user"
                              ? styles.userBubble
                              : styles.expertBubble
                          } ${
                            firstInGroup
                              ? msg.sender_type === "user"
                                ? styles.userBubbleTail
                                : styles.expertBubbleTail
                              : ""
                          }`}
                        >
                          <p className={styles.messageText}>{msg.content}</p>
                        </div>
                        {lastInGroup && msg.sender_type === "expert" && (
                          <span className={styles.messageTime}>
                            {formatTime(msg.created_at)}
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

      {/* 메시지 입력 */}
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
          <textarea
            ref={inputRef}
            className={styles.input}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionEnd={handleCompositionEnd}
            placeholder="메시지 입력"
            disabled={sending || uploading}
          />
          <div className={styles.sendButtonRow}>
            <button
              type="button"
              className={styles.attachButton}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
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
            <button
              className={styles.sendButton}
              onClick={handleSend}
              disabled={(!newMessage.trim() && pendingImages.length === 0) || sending || uploading}
            >
              {uploading ? "업로드 중..." : "전송"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
