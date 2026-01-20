"use client";

import { useState } from "react";
import { X, Phone, MessageSquare, Calendar, Clock, User, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BookingWithUser } from "@/lib/services/bookingService";
import styles from "./BookingModal.module.css";

interface BookingModalProps {
  booking: BookingWithUser;
  onClose: () => void;
  onUpdate: () => void;
}

// 상태 정보 정의
const STATUS_INFO = {
  pending: {
    label: "인증 대기",
    description: "고객이 전화번호 인증을 완료하지 않았습니다",
    color: "#ff9500",
  },
  confirmed: {
    label: "예약 확정",
    description: "고객이 인증을 완료하고 예약이 확정되었습니다",
    color: "#34c759",
  },
  completed: {
    label: "상담 완료",
    description: "상담이 완료되었습니다",
    color: "#86868b",
  },
  cancelled: {
    label: "취소됨",
    description: "예약이 취소되었습니다",
    color: "#ff3b30",
  },
};

export function BookingModal({ booking, onClose, onUpdate }: BookingModalProps) {
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState(booking.notes || "");

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
  };

  // 예약까지 남은 시간 계산
  const getTimeUntilBooking = () => {
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}:00`);
    const now = new Date();
    const diff = bookingDateTime.getTime() - now.getTime();

    if (diff < 0) {
      const hoursPassed = Math.floor(-diff / (1000 * 60 * 60));
      if (hoursPassed < 24) {
        return { text: `${hoursPassed}시간 전 시작`, isPast: true, isToday: true };
      }
      return { text: "지난 예약", isPast: true, isToday: false };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days === 0) {
      if (hours === 0) {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return { text: `${minutes}분 후 시작`, isPast: false, isToday: true };
      }
      return { text: `${hours}시간 후 시작`, isPast: false, isToday: true };
    }
    if (days === 1) {
      return { text: "내일", isPast: false, isToday: false };
    }
    return { text: `${days}일 후`, isPast: false, isToday: false };
  };

  const statusInfo = STATUS_INFO[booking.status as keyof typeof STATUS_INFO] || STATUS_INFO.pending;
  const timeInfo = getTimeUntilBooking();

  const handleStatusChange = async (newStatus: "confirmed" | "completed" | "cancelled") => {
    // 확인 메시지
    const confirmMessages = {
      confirmed: "예약을 확정 처리하시겠습니까?",
      completed: "상담 완료 처리하시겠습니까?",
      cancelled: "예약을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    };

    if (!confirm(confirmMessages[newStatus])) return;

    setUpdating(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("bookings")
        .update({
          status: newStatus,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", booking.id);

      if (error) throw error;
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Failed to update booking:", error);
      alert("예약 상태 변경에 실패했습니다.");
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    setUpdating(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("bookings")
        .update({
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", booking.id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error("Failed to save notes:", error);
      alert("메모 저장에 실패했습니다.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>예약 상세</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {/* 상태 + 시간 정보 */}
          <div className={styles.statusSection}>
            <div className={styles.statusHeader}>
              <span
                className={styles.statusBadge}
                style={{ background: `${statusInfo.color}15`, color: statusInfo.color }}
              >
                {statusInfo.label}
              </span>
              {(booking.status === "confirmed" || booking.status === "pending") && (
                <span className={`${styles.timeBadge} ${timeInfo.isToday ? styles.timeToday : ""}`}>
                  {timeInfo.text}
                </span>
              )}
            </div>
            <p className={styles.statusDescription}>{statusInfo.description}</p>

            {/* 상태 흐름 표시 */}
            <div className={styles.statusFlow}>
              <div className={`${styles.flowStep} ${booking.status === "pending" ? styles.flowActive : styles.flowDone}`}>
                <div className={styles.flowDot} />
                <span>인증 대기</span>
              </div>
              <div className={styles.flowLine} />
              <div className={`${styles.flowStep} ${booking.status === "confirmed" ? styles.flowActive : booking.status === "completed" ? styles.flowDone : ""}`}>
                <div className={styles.flowDot} />
                <span>예약 확정</span>
              </div>
              <div className={styles.flowLine} />
              <div className={`${styles.flowStep} ${booking.status === "completed" ? styles.flowActive : ""}`}>
                <div className={styles.flowDot} />
                <span>상담 완료</span>
              </div>
            </div>
          </div>

          {/* 고객 정보 */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <User size={16} />
              고객 정보
            </div>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>이름</span>
                <span className={styles.infoValue}>{booking.user_name || "이름 없음"}</span>
              </div>
              {booking.user_birth_date && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>생년월일</span>
                  <span className={styles.infoValue}>{booking.user_birth_date}</span>
                </div>
              )}
              {booking.user_gender && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>성별</span>
                  <span className={styles.infoValue}>
                    {booking.user_gender === "male" ? "남성" : "여성"}
                  </span>
                </div>
              )}
              {booking.user_phone && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>연락처</span>
                  <span className={styles.infoValue}>{booking.user_phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* 예약 정보 */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <Calendar size={16} />
              예약 정보
            </div>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>날짜</span>
                <span className={styles.infoValue}>{formatDate(booking.booking_date)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>시간</span>
                <span className={styles.infoValue}>
                  <Clock size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {booking.booking_time}
                </span>
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <MessageSquare size={16} />
              메모
            </div>
            <textarea
              className={styles.notesInput}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예약 관련 메모를 입력하세요..."
              rows={3}
            />
            {notes !== (booking.notes || "") && (
              <button
                className={styles.saveNotesButton}
                onClick={handleSaveNotes}
                disabled={updating}
              >
                메모 저장
              </button>
            )}
          </div>

          {/* 빠른 액션 */}
          {booking.user_phone && (
            <div className={styles.quickActions}>
              <a
                href={`tel:${booking.user_phone}`}
                className={styles.quickActionButton}
              >
                <Phone size={16} />
                전화 걸기
              </a>
            </div>
          )}
        </div>

        {/* 액션 버튼 - 상태별로 다른 액션 */}
        {booking.status === "pending" && (
          <div className={styles.footer}>
            <button
              className={styles.cancelButton}
              onClick={() => handleStatusChange("cancelled")}
              disabled={updating}
            >
              예약 취소
            </button>
            <button
              className={styles.confirmButton}
              onClick={() => handleStatusChange("confirmed")}
              disabled={updating}
            >
              <CheckCircle size={16} />
              확정 처리
            </button>
          </div>
        )}

        {booking.status === "confirmed" && (
          <div className={styles.footer}>
            <button
              className={styles.cancelButton}
              onClick={() => handleStatusChange("cancelled")}
              disabled={updating}
            >
              예약 취소
            </button>
            <button
              className={styles.completeButton}
              onClick={() => handleStatusChange("completed")}
              disabled={updating}
            >
              <CheckCircle size={16} />
              상담 완료
            </button>
          </div>
        )}

        {(booking.status === "completed" || booking.status === "cancelled") && (
          <div className={styles.footerInfo}>
            <AlertCircle size={16} />
            {booking.status === "completed" ? "완료된 상담입니다" : "취소된 예약입니다"}
          </div>
        )}
      </div>
    </div>
  );
}
