"use client";

import { ChevronRight } from "lucide-react";
import styles from "./CompletedItems.module.css";

// 완료된 항목 타입
export interface CompletedTask {
  id: string;
  title: string;
  stepNumber: number;
  summary?: string;
  completedAt?: string;
}

interface CompletedItemsProps {
  tasks: CompletedTask[];
  onEdit?: (taskId: string) => void;
}

export function CompletedItems({ tasks, onEdit }: CompletedItemsProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      {tasks.map((task) => (
        <button
          key={task.id}
          className={styles.card}
          onClick={() => onEdit?.(task.id)}
        >
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>{task.stepNumber}. {task.title}</span>
            {task.summary && (
              <span className={styles.cardSummary}>{task.summary}</span>
            )}
          </div>
          <div className={styles.cardRight}>
            <span className={styles.editText}>수정</span>
            <ChevronRight size={18} className={styles.arrow} />
          </div>
        </button>
      ))}
    </div>
  );
}
