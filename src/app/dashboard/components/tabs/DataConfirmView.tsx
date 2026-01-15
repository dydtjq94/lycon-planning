'use client'

import styles from './DataConfirmView.module.css'

interface DataItem {
  label: string
  value: string
}

interface DataConfirmViewProps {
  title: string
  data: DataItem[]
  onConfirm: () => void
  onEdit: () => void
}

export function DataConfirmView({ title, data, onConfirm, onEdit }: DataConfirmViewProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <p className={styles.subtitle}>이전에 입력하신 정보예요</p>
        <h2 className={styles.title}>{title}</h2>

        <div className={styles.dataList}>
          {data.map((item, index) => (
            <div key={index} className={styles.dataItem}>
              <span className={styles.dataLabel}>{item.label}</span>
              <span className={styles.dataValue}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.editButton} onClick={onEdit}>
          수정하기
        </button>
        <button className={styles.confirmButton} onClick={onConfirm}>
          확인
        </button>
      </div>
    </div>
  )
}
