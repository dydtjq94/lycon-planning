'use client'

import React from 'react'

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export function NumberInput({ className, onWheel, ...props }: NumberInputProps) {
  return (
    <input
      type="number"
      className={className}
      onWheel={(e) => {
        e.currentTarget.blur()
        onWheel?.(e)
      }}
      {...props}
    />
  )
}
