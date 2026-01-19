"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft } from "lucide-react";
import styles from "../../admin.module.css";

interface Message {
  id: string;
  conversation_id: string;
  sender_type: "expert" | "user";
  content: string;
  is_read: boolean;
  created_at: string;
  attachments?: string[];
}

interface UserProfile {
  id: string;
  name: string;
}

export default function AdminChatPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const loadChat = async () => {
      const supabase = createClient();

      // 유저 정보
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("id", userId)
        .single();

      if (profile) {
        setUser(profile);
      }

      // 현재 전문가 정보
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: expert } = await supabase
        .from("experts")
        .select("id")
        .eq("user_id", authUser.id)
        .single();

      if (!expert) return;

      // 대화방 찾기
      const { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .eq("expert_id", expert.id)
        .single();

      if (conversation) {
        setConversationId(conversation.id);

        // 메시지 로드
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true });

        if (messagesData) {
          setMessages(messagesData);
        }

        // 유저 메시지 읽음 처리
        await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", conversation.id)
          .eq("sender_type", "user")
          .eq("is_read", false);

        // unread_count 리셋
        await supabase
          .from("conversations")
          .update({ unread_count: 0 })
          .eq("id", conversation.id);
      }

      setLoading(false);
    };

    loadChat();
  }, [userId]);

  // 메시지 로드 후 스크롤
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom();
    }
  }, [loading, messages.length, scrollToBottom]);

  // Realtime 구독
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`admin-messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollToBottom();

          // 유저 메시지면 읽음 처리
          if (newMsg.sender_type === "user") {
            supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, scrollToBottom]);

  const handleSend = async () => {
    if (!conversationId || !newMessage.trim() || sending) return;

    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    // 낙관적 업데이트
    const tempMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_type: "expert",
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");
    scrollToBottom();

    setSending(true);

    const supabase = createClient();

    const { data: newMsg, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "expert",
        content,
      })
      .select()
      .single();

    if (error) {
      // 실패 시 복원
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
    } else if (newMsg) {
      // 성공 시 임시 메시지 교체
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? newMsg : m))
      );

      // last_message_at 업데이트
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 조합 중이면 무시 (마지막 글자 남는 문제 방지)
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className={styles.chatContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <button className={styles.backButton} onClick={() => router.back()}>
          <ChevronLeft size={18} />
        </button>
        <span className={styles.chatUserName}>{user?.name || "알 수 없음"}</span>
        <button
          className={styles.actionButton}
          onClick={() => router.push(`/admin/users/${userId}`)}
        >
          정보 보기
        </button>
      </div>

      <div className={styles.chatMessages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.chatMessage} ${
              msg.sender_type === "expert"
                ? styles.chatMessageExpert
                : styles.chatMessageUser
            }`}
          >
            {msg.content && <p>{msg.content}</p>}
            {msg.attachments && msg.attachments.length > 0 && (
              <div className={styles.chatAttachments}>
                {msg.attachments.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.chatImageLink}
                  >
                    <img
                      src={url}
                      alt={`첨부 이미지 ${idx + 1}`}
                      className={styles.chatImage}
                    />
                  </a>
                ))}
              </div>
            )}
            <span style={{ fontSize: 10, opacity: 0.7, marginTop: 4, display: "block" }}>
              {formatTime(msg.created_at)}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.chatInputArea}>
        <textarea
          ref={inputRef}
          className={styles.chatInput}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력..."
          rows={1}
        />
        <button
          className={styles.chatSendButton}
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          전송
        </button>
      </div>
    </div>
  );
}
