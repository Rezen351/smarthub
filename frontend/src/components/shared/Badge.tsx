import type { HTMLAttributes, ReactNode } from 'react'
import { Badge as UIBadge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Icon, { type IconName } from './Icon'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'solid'

const toneVariantMap: Record<Tone, 'secondary' | 'accent' | 'success' | 'warning' | 'destructive' | 'default'> = {
  neutral: 'secondary',
  accent: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
  solid: 'default',
}

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
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
    <UIBadge
      variant={toneVariantMap[tone]}
      className={cn('inline-flex items-center gap-1.5 font-medium', className)}
      {...rest}
    >
      {dot && (
        <span
          className={cn(
            'size-1.5 rounded-full bg-current shrink-0',
            live && 'animate-pulse',
          )}
          aria-hidden="true"
        />
      )}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </UIBadge>
  )
}
