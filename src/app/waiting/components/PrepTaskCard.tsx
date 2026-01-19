"use client";

import { ChevronRight } from "lucide-react";
import styles from "./PrepTaskCard.module.css";

export interface PrepTask {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  icon?: React.ReactNode;
}

interface PrepTaskCardProps {
  task: PrepTask;
  currentStep: number;
  totalSteps: number;
  onStart: (taskId: string) => void;
}

export function PrepTaskCard({
  task,
  currentStep,
  totalSteps,
  onStart,
}: PrepTaskCardProps) {
  const progressPercent = ((currentStep - 1) / totalSteps) * 100;

  return (
    <div className={styles.container}>
      {/* 메인 타이틀 */}
      <h2 className={styles.mainTitle}>
        재무 검진 전,
        <br />내 자산 상황을 미리 파악해주세요.
      </h2>

      {/* 섹션 헤더 */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTop}>
          <span className={styles.sectionTitle}>검진 전 준비사항</span>
          <span className={styles.progress}>
            {currentStep}/{totalSteps}
          </span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 카드 */}
      <div className={styles.card}>
        <h3 className={styles.title}>
          {currentStep}. {task.title}
        </h3>
        <p className={styles.description}>{task.description}</p>
        <button className={styles.startButton} onClick={() => onStart(task.id)}>
          시작하기
        </button>
      </div>
    </div>
  );
}
