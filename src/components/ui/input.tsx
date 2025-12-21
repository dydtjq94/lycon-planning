import * as React from "react"
import styles from './input.module.css'

interface InputProps extends React.ComponentProps<"input"> {
  className?: string
}

function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={`${styles.input} ${className || ''}`}
      {...props}
    />
  )
}

export { Input }
