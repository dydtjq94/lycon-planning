import { getConsultationType } from '@/lib/constants/consultationTypes'
import type { NextBooking } from '@/lib/services/bookingService'
import styles from './NextConsultationCard.module.css'

interface NextConsultationCardProps {
  nextBooking: NextBooking | null
  loading: boolean
  onCancel: (bookingId: string) => void
  onBookNew: () => void
}

function formatBookingDate(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-')
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토']
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  const dow = dayOfWeek[date.getDay()]
  return `${Number(month)}월 ${Number(day)}일 (${dow}) ${timeStr}`
}

export function NextConsultationCard({ nextBooking, loading, onCancel, onBookNew }: NextConsultationCardProps) {
  if (loading) return null

  const STATUS_LABELS: Record<string, string> = {
    pending: '대기 중',
    confirmed: '확정',
  }

  if (!nextBooking) {
    return (
      <div className={styles.card}>
        <div className={styles.label}>다음 상담</div>
        <div className={styles.emptyState}>
          <div className={styles.emptyText}>예약된 상담이 없습니다</div>
          <button className={styles.bookBtn} onClick={onBookNew}>
            새 상담 예약
          </button>
        </div>
      </div>
    )
  }

  const consultType = getConsultationType(nextBooking.consultation_type)

  return (
    <div className={styles.card}>
      <div className={styles.label}>다음 상담</div>
      <div className={styles.bookingInfo}>
        <div className={styles.infoLeft}>
          <div className={styles.dateTime}>
            {formatBookingDate(nextBooking.booking_date, nextBooking.booking_time)}
          </div>
          <div className={styles.meta}>
            <span className={styles.expertName}>{nextBooking.expert_name}</span>
            {consultType && (
              <span
                className={styles.badge}
                style={{ backgroundColor: consultType.color }}
              >
                {consultType.name}
              </span>
            )}
            <span className={styles.statusBadge}>
              {STATUS_LABELS[nextBooking.status] || nextBooking.status}
            </span>
          </div>
        </div>
        <button
          className={styles.cancelBtn}
          onClick={() => onCancel(nextBooking.id)}
        >
          취소
        </button>
      </div>
    </div>
  )
}
