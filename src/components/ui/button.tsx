import * as React from "react"
import styles from './button.module.css'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  default: styles.default,
  destructive: styles.destructive,
  outline: styles.outline,
  secondary: styles.secondary,
  ghost: styles.ghost,
  link: styles.link,
}

const sizeStyles: Record<ButtonSize, string> = {
  default: styles.sizeDefault,
  sm: styles.sizeSm,
  lg: styles.sizeLg,
  icon: styles.sizeIcon,
  'icon-sm': styles.sizeIconSm,
  'icon-lg': styles.sizeIconLg,
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const classNames = [
    styles.button,
    variantStyles[variant],
    sizeStyles[size],
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      className={classNames}
      {...props}
    />
  )
}

export { Button }
export type { ButtonProps }
