import { idText } from '@/lib/indonesian'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import Icon, { type IconName } from './Icon'

interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center gap-1.5 py-12 px-6', className)}>
      <div className="size-11 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground mb-1.5">
        <Icon name={icon} size={20} />
      </div>
      <p className="text-sm font-semibold text-foreground">{idText(title)}</p>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{idText(description)}</p>}
      {action && <div className="mt-3">{idText(action)}</div>}
    </div>
  )
}
