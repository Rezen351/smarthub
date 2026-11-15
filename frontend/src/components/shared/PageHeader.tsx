import { idText } from '@/lib/indonesian'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

export default function PageHeader({ title, subtitle, actions, children, className = '' }: PageHeaderProps) {
  return (
    <header className={cn('mb-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{idText(title)}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{idText(subtitle)}</p>}
        </div>
        {actions && <div className="mobile-page-actions flex items-center flex-wrap gap-2">{idText(actions)}</div>}
      </div>
      {idText(children)}
    </header>
  )
}
