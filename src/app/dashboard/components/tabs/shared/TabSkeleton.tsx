import styles from './TabSkeleton.module.css'

interface TabSkeletonProps {
  sections?: number
  itemsPerSection?: number
}

export function TabSkeleton({ sections = 2, itemsPerSection = 3 }: TabSkeletonProps) {
  return (
    <div className={styles.container}>
      {Array.from({ length: sections }).map((_, si) => (
        <div key={si} className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={`${styles.bone} ${styles.sectionTitle}`} />
            <div className={`${styles.bone} ${styles.sectionTotal}`} />
          </div>
          {Array.from({ length: itemsPerSection }).map((_, ii) => (
            <div key={ii} className={styles.item}>
              <div className={styles.itemLeft}>
                <div className={`${styles.bone} ${styles.itemLabel}`} />
                <div className={`${styles.bone} ${styles.itemAmount}`} />
                <div className={`${styles.bone} ${styles.itemMeta}`} />
              </div>
              <div className={`${styles.bone} ${styles.itemRight}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
