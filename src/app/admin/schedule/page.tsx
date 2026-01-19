"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getExpertAvailability,
  updateAvailability,
  ExpertAvailability,
} from "@/lib/services/bookingService";
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
  const [expertId, setExpertId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: expert } = await supabase
        .from("experts")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!expert) return;
      setExpertId(expert.id);

      // 스케줄 로드
      const availability = await getExpertAvailability(expert.id);
      const scheduleMap: Record<number, ExpertAvailability> = {};
      availability.forEach((a) => {
        scheduleMap[a.day_of_week] = a;
      });

      // 모든 요일에 대해 스케줄 생성
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
  }, []);

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

  const handleSave = async () => {
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
      alert("저장되었습니다.");
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
        <div className={styles.loading}>불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => router.push("/admin")}>
          목록으로
        </button>
        <h1 className={styles.title}>스케줄 관리</h1>
      </div>

      <p className={styles.description}>
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

      <div className={styles.footer}>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
