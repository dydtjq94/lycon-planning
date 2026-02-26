import { useState } from 'react'
import { ChevronDown, Check, Circle } from 'lucide-react'
import { getConsultationType } from '@/lib/constants/consultationTypes'
import type { ConsultationRecord } from '@/lib/services/consultationService'
import styles from './ConsultationHistory.module.css'

interface ConsultationHistoryProps {
  records: ConsultationRecord[]
  loading: boolean
  onLoadMore: () => void
  hasMore: boolean
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: '예정',
  in_progress: '진행 중',
  completed: '완료',
  cancelled: '취소',
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${year}.${month}.${day}`
}

export function ConsultationHistory({ records, loading, onLoadMore, hasMore }: ConsultationHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>상담 이력</h3>

      {records.length === 0 && !loading && (
        <div className={styles.emptyText}>상담 이력이 없습니다</div>
      )}

      {records.map(record => {
        const consultType = getConsultationType(record.consultation_type)
        const isOpen = expandedId === record.id
        const hasSummary = record.summary || record.action_items.length > 0
        const displayDate = record.completed_date
          ? formatDate(record.completed_date)
          : formatDate(record.scheduled_date)

        return (
          <div key={record.id} className={styles.recordCard}>
            <div
              className={styles.recordHeader}
              onClick={() => hasSummary && toggle(record.id)}
              style={{ cursor: hasSummary ? 'pointer' : 'default' }}
            >
              <div className={styles.recordLeft}>
                <span className={styles.recordDate}>{displayDate}</span>
                {consultType && (
                  <span
                    className={styles.badge}
                    style={{ backgroundColor: consultType.color }}
                  >
                    {consultType.name}
                  </span>
                )}
                <span className={styles.expertName}>{record.expert_name}</span>
                <span className={styles.statusText}>
                  {STATUS_LABELS[record.status] || record.status}
                </span>
              </div>
              {hasSummary && (
                <ChevronDown
                  size={16}
                  className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                />
              )}
            </div>

            {isOpen && hasSummary && (
              <div className={styles.recordBody}>
                {record.summary && (
                  <>
                    <div className={styles.summaryLabel}>요약</div>
                    <div className={styles.summaryText}>{record.summary}</div>
                  </>
                )}
                {record.action_items.length > 0 && (
                  <>
                    <div className={styles.summaryLabel}>액션 아이템</div>
                    <ul className={styles.actionList}>
                      {record.action_items.map((item, i) => (
                        <li
                          key={i}
                          className={`${styles.actionItem} ${item.completed ? styles.actionDone : ''}`}
                        >
                          {item.completed ? (
                            <Check size={14} className={styles.actionCheck} />
                          ) : (
                            <Circle size={14} className={styles.actionCheck} />
                          )}
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {hasMore && (
        <button
          className={styles.loadMoreBtn}
          onClick={onLoadMore}
          disabled={loading}
        >
          {loading ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </div>
  )
}
