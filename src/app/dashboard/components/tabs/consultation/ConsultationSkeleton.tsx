import styles from './ConsultationSkeleton.module.css'

export function ConsultationSkeleton() {
  return (
    <div className={styles.container}>
      {/* Hero card skeleton */}
      <div className={styles.heroCard}>
        <div className={styles.heroTitle} />
        <div className={styles.heroLine} />
        <div className={styles.heroDetails}>
          <div className={styles.heroAction} />
          <div className={styles.heroAction} />
        </div>
      </div>

      {/* History section skeleton */}
      <div className={styles.historySection}>
        <div className={styles.historyTitle} />
        {[0, 1, 2].map(i => (
          <div key={i} className={styles.recordCard}>
            <div className={styles.recordLine} />
          </div>
        ))}
      </div>
    </div>
  )
}
