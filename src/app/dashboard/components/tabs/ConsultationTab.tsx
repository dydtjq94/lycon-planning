'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getNextBooking,
  cancelBooking,
  getDefaultExpertId,
  type NextBooking,
} from '@/lib/services/bookingService'
import {
  getUserConsultationRecords,
  type ConsultationRecord,
} from '@/lib/services/consultationService'
import { ConsultationSkeleton } from './consultation/ConsultationSkeleton'
import { NextConsultationCard } from './consultation/NextConsultationCard'
import { ConsultationHistory } from './consultation/ConsultationHistory'
import { BookingModal } from './consultation/BookingModal'
import styles from './ConsultationTab.module.css'

interface ConsultationTabProps {
  profileId: string
}

const PAGE_SIZE = 10

export function ConsultationTab({ profileId }: ConsultationTabProps) {
  // Data states
  const [nextBooking, setNextBooking] = useState<NextBooking | null>(null)
  const [records, setRecords] = useState<ConsultationRecord[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [expertId, setExpertId] = useState<string | null>(null)

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Modal
  const [showBookingModal, setShowBookingModal] = useState(false)

  // Initial data load
  const loadData = useCallback(async () => {
    try {
      const [booking, { records: recs, total }, eid] = await Promise.all([
        getNextBooking(),
        getUserConsultationRecords(PAGE_SIZE, 0),
        getDefaultExpertId(),
      ])
      setNextBooking(booking)
      setRecords(recs)
      setTotalRecords(total)
      setExpertId(eid)
    } catch (err) {
      console.error('Failed to load consultation data:', err)
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Minimum skeleton time
  useEffect(() => {
    if (!initialLoading && !minTimeElapsed) {
      const timer = setTimeout(() => setMinTimeElapsed(true), 500)
      return () => clearTimeout(timer)
    }
  }, [initialLoading, minTimeElapsed])

  // Load more records
  const handleLoadMore = async () => {
    setLoadingMore(true)
    try {
      const { records: moreRecs } = await getUserConsultationRecords(
        PAGE_SIZE,
        records.length
      )
      setRecords(prev => [...prev, ...moreRecs])
    } catch (err) {
      console.error('Failed to load more records:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  // Cancel booking
  const handleCancel = async (bookingId: string) => {
    try {
      await cancelBooking(bookingId)
      setNextBooking(null)
      // Reload to get next upcoming if any
      const booking = await getNextBooking()
      setNextBooking(booking)
    } catch (err) {
      console.error('Failed to cancel booking:', err)
    }
  }

  // Booking success
  const handleBookingSuccess = () => {
    loadData()
  }

  // Show skeleton
  if (initialLoading || !minTimeElapsed) {
    return <ConsultationSkeleton />
  }

  const hasMore = records.length < totalRecords

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h2 className={styles.pageTitle}>상담</h2>
        {nextBooking && (
          <button
            className={styles.bookBtn}
            onClick={() => setShowBookingModal(true)}
          >
            새 상담 예약
          </button>
        )}
      </div>

      <NextConsultationCard
        nextBooking={nextBooking}
        loading={false}
        onCancel={handleCancel}
        onBookNew={() => setShowBookingModal(true)}
      />

      <ConsultationHistory
        records={records}
        loading={loadingMore}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
      />

      {expertId && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          expertId={expertId}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  )
}
