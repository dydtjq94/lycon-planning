"use client";

import type { OnboardingData } from "@/types";
import styles from "./Charts.module.css";

interface LifeNavigationChartProps {
  data: OnboardingData;
}

function calculateAge(birthDate: string): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

interface LifeEvent {
  age: number;
  label: string;
}

export function LifeNavigationChart({ data }: LifeNavigationChartProps) {
  const currentAge = data.birth_date ? calculateAge(data.birth_date) : 0;
  const hasSpouse = data.isMarried;

  if (!data.birth_date) {
    return (
      <div className={styles.journeyContainer}>
        <div className={styles.journeyPlaceholder}>
          생년월일을 입력하면 인생 여정이 나타납니다.
        </div>
      </div>
    );
  }

  // 인생 이벤트 (특정 나이에 발생)
  const events: LifeEvent[] = [];

  events.push({ age: currentAge, label: "지금" });

  // 자녀 교육 (50대 초반)
  if (currentAge < 52) {
    events.push({ age: 52, label: "자녀 교육" });
  }

  // 부모님 관련
  if (currentAge < 55) {
    events.push({ age: 55, label: "부모 간병" });
  }

  // 은퇴
  const retireAge = data.target_retirement_age || 60;
  if (currentAge < retireAge) {
    events.push({ age: retireAge, label: "은퇴" });
  }

  // 자녀 독립/결혼
  if (currentAge < 62) {
    events.push({ age: 62, label: "자녀 독립" });
  }

  // 연금
  if (currentAge < 65) {
    events.push({ age: 65, label: "연금 수령" });
  }

  // 건강
  if (currentAge < 75) {
    events.push({ age: 75, label: "건강 관리" });
  }

  // 요양
  if (currentAge < 85) {
    events.push({ age: 85, label: "요양 대비" });
  }

  // 전 구간 재무 설계 영역
  const planningAreas = [
    "부동산",
    "세금",
    "상속",
    "증여",
    "보험",
    "투자",
    "연금",
    "절세",
  ];

  // 정렬 후 최대 8개
  const sortedEvents = events
    .sort((a, b) => a.age - b.age)
    .filter((e, i, arr) => i === 0 || e.age !== arr[i - 1].age)
    .slice(0, 8);

  return (
    <div className={styles.journeyContainer}>
      {/* 직선 타임라인 */}
      <div className={styles.linePath}>
        {/* 배경 라인 */}
        <div className={styles.lineTrack} />
        {/* 애니메이션 라인 */}
        <div className={styles.lineProgress} />

        {/* 이벤트들 */}
        <div className={styles.lineEvents}>
          {sortedEvents.map((event, i) => {
            const xPercent = (i / (sortedEvents.length - 1)) * 100;
            const isTop = i % 2 === 0;

            return (
              <div
                key={i}
                className={`${styles.lineEvent} ${
                  isTop ? styles.lineEventTop : styles.lineEventBottom
                }`}
                style={{ left: `${xPercent}%` }}
              >
                <span className={styles.lineAge}>{event.age}세</span>
                <span className={styles.lineLabel}>{event.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 전 구간 재무 설계 영역 */}
      <div className={styles.planningCloud}>
        {planningAreas.map((area, i) => (
          <span key={i} className={styles.planningTag}>
            {area}
          </span>
        ))}
      </div>
    </div>
  );
}
