'use client'

import { useState, useEffect } from 'react'
import styles from './ConversationalForm.module.css'

interface TypewriterTextProps {
  text: string
  speed?: number
  onComplete?: () => void
}

export function TypewriterText({
  text,
  speed = 30,
  onComplete,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    setDisplayedText('')
    setIsComplete(false)

    let index = 0
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        clearInterval(timer)
        setIsComplete(true)
        onComplete?.()
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed, onComplete])

  return (
    <p className={`${styles.message} ${styles.handwriting}`}>
      {displayedText}
      {!isComplete && <span className={styles.cursor}>|</span>}
    </p>
  )
}
