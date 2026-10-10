import type { HTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'solid'

const toneClass: Record<Tone, string> = {
  neutral: 'badge-neutral',
  accent: 'badge-accent',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  solid: 'badge-solid',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  icon?: IconName
  dot?: boolean
  live?: boolean
  children: ReactNode
}

export default function Badge({
  tone = 'neutral',
  icon,
  dot = false,
  live = false,
  children,
  className = '',
  ...rest
}: BadgeProps) {
  return (
    <span className={`badge ${toneClass[tone]} ${className}`} {...rest}>
      {dot && <span className={`badge-dot ${live ? 'badge-dot-live' : ''}`} aria-hidden="true" />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}
