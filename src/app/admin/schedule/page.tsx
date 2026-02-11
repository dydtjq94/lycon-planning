"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Settings, X } from "lucide-react";
import {
  getExpertBookings,
  BookingWithUser,
  getExpertAvailability,
  updateAvailability,
  ExpertAvailability,
} from "@/lib/services/bookingService";
import { useAdmin } from "../AdminContext";
import styles from "./schedule.module.css";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const ALL_TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
];

interface DaySchedule {
  dayOfWeek: number;
  isActive: boolean;
  timeSlots: string[];
}

export default function SchedulePage() {
  const router = useRouter();
  const { expertId } = useAdmin();
  const [bookings, setBookings] = useState<BookingWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // 설정 모달
  const [showSettings, setShowSettings] = useState(false);
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // bookings + availability 병렬
      const [bookingList, availability] = await Promise.all([
        getExpertBookings(expertId),
        getExpertAvailability(expertId),
      ]);
      const scheduleMap: Record<number, ExpertAvailability> = {};
      availability.forEach((a) => {
        scheduleMap[a.day_of_week] = a;
      });

      const allSchedules: DaySchedule[] = [];
      for (let i = 0; i < 7; i++) {
        if (scheduleMap[i]) {
          allSchedules.push({
            dayOfWeek: i,
            isActive: scheduleMap[i].is_active,
            timeSlots: scheduleMap[i].time_slots,
          });
        } else {
          allSchedules.push({
            dayOfWeek: i,
            isActive: false,
            timeSlots: [...ALL_TIME_SLOTS],
          });
        }
      }
      setSchedules(allSchedules);
      setLoading(false);
    };

    loadData();
  }, [expertId]);

  // 캘린더 데이터 생성
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }
    return days;
  };

  const getBookingsForDay = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return bookings.filter((b) => b.booking_date === dateStr);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  // 스케줄 설정 관련
  const toggleDay = (dayOfWeek: number) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.dayOfWeek === dayOfWeek ? { ...s, isActive: !s.isActive } : s
      )
    );
  };

  const toggleTimeSlot = (dayOfWeek: number, time: string) => {
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.dayOfWeek !== dayOfWeek) return s;
        const hasTime = s.timeSlots.includes(time);
        return {
          ...s,
          timeSlots: hasTime
            ? s.timeSlots.filter((t) => t !== time)
            : [...s.timeSlots, time].sort(),
        };
      })
    );
  };

  const handleSaveSettings = async () => {
    if (!expertId) return;
    setSaving(true);

    try {
      for (const schedule of schedules) {
        await updateAvailability(
          expertId,
          schedule.dayOfWeek,
          schedule.timeSlots,
          schedule.isActive
        );
      }
      setShowSettings(false);
    } catch (error) {
      console.error("Save error:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>스케줄</h1>
        </div>
        <div className={styles.content}>
          <div className={styles.calendar}>
            <div className={styles.calendarHeader}>
              <div className={`${styles.bone} ${styles.boneMonthTitle}`} />
            </div>
            <div className={styles.weekdays}>
              {DAYS.map((day) => (
                <div key={day} className={styles.weekday}>{day}</div>
              ))}
            </div>
            <div className={styles.daysGrid}>
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className={styles.day}>
                  <div className={`${styles.bone} ${styles.boneDayNumber}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const calendarDays = getCalendarDays();

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <h1 className={styles.title}>스케줄</h1>
        <button
          className={styles.settingsButton}
          onClick={() => setShowSettings(true)}
        >
          <Settings size={18} />
          <span>예약 시간 설정</span>
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className={styles.content}>
        {/* 캘린더 */}
        <div className={styles.calendar}>
          {/* 캘린더 헤더 */}
          <div className={styles.calendarHeader}>
            <button className={styles.navButton} onClick={prevMonth}>
              <ChevronLeft size={20} />
            </button>
            <h2 className={styles.monthTitle}>
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </h2>
            <button className={styles.navButton} onClick={nextMonth}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className={styles.weekdays}>
            {DAYS.map((day, idx) => (
              <div
                key={day}
                className={`${styles.weekday} ${idx === 0 ? styles.sunday : ""} ${idx === 6 ? styles.saturday : ""}`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className={styles.daysGrid}>
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className={styles.dayEmpty} />;
              }

              const dayOfWeek = (new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay());
              const dayBookings = getBookingsForDay(day);

              return (
                <div
                  key={day}
                  className={`${styles.day} ${isToday(day) ? styles.today : ""} ${dayOfWeek === 0 ? styles.sunday : ""} ${dayOfWeek === 6 ? styles.saturday : ""}`}
                >
                  <div className={styles.dayNumber}>{day}</div>
                  <div className={styles.dayBookings}>
                    {dayBookings.slice(0, 3).map((booking) => (
                      <button
                        key={booking.id}
                        className={`${styles.booking} ${styles[booking.status]}`}
                        onClick={() => router.push(`/admin/users/${booking.user_id}`)}
                      >
                        <span className={styles.bookingTime}>{booking.booking_time}</span>
                        <span className={styles.bookingName}>{booking.user_name || "이름 없음"}</span>
                      </button>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className={styles.moreBookings}>+{dayBookings.length - 3}건</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 설정 모달 */}
      {showSettings && (
        <div className={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>예약 시간 설정</h2>
              <button className={styles.closeButton} onClick={() => setShowSettings(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalContent}>
              <p className={styles.modalDescription}>
                예약 가능한 요일과 시간대를 설정하세요.
              </p>
              <div className={styles.scheduleGrid}>
                {schedules.map((schedule) => (
                  <div key={schedule.dayOfWeek} className={styles.dayCard}>
                    <div className={styles.dayHeader}>
                      <span className={styles.dayName}>{DAYS[schedule.dayOfWeek]}요일</span>
                      <button
                        className={`${styles.toggleButton} ${schedule.isActive ? styles.active : ""}`}
                        onClick={() => toggleDay(schedule.dayOfWeek)}
                      >
                        {schedule.isActive ? "ON" : "OFF"}
                      </button>
                    </div>

                    {schedule.isActive && (
                      <div className={styles.timeSlots}>
                        {ALL_TIME_SLOTS.map((time) => {
                          const isSelected = schedule.timeSlots.includes(time);
                          return (
                            <button
                              key={time}
                              className={`${styles.timeSlot} ${isSelected ? styles.selected : ""}`}
                              onClick={() => toggleTimeSlot(schedule.dayOfWeek, time)}
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.cancelButton}
                onClick={() => setShowSettings(false)}
              >
                취소
              </button>
              <button
                className={styles.saveButton}
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
