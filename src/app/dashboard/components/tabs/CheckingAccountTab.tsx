"use client";

import styles from "./CheckingAccountTab.module.css";

interface CheckingAccountTabProps {
  profileId: string;
}

export function CheckingAccountTab({ profileId }: CheckingAccountTabProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>입출금통장</h2>
      </div>
      <div className={styles.content}>
        <div className={styles.placeholder}>
          입출금통장 관리 기능이 여기에 표시됩니다.
        </div>
      </div>
    </div>
  );
}
