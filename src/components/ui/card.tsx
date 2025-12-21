import * as React from "react"
import styles from './card.module.css'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={`${styles.card} ${className || ''}`}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={`${styles.cardHeader} ${className || ''}`}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: CardProps) {
  return (
    <div
      className={`${styles.cardTitle} ${className || ''}`}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: CardProps) {
  return (
    <div
      className={`${styles.cardDescription} ${className || ''}`}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: CardProps) {
  return (
    <div
      className={`${styles.cardContent} ${className || ''}`}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={`${styles.cardFooter} ${className || ''}`}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
