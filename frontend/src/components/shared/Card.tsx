import type { HTMLAttributes, ReactNode } from 'react'
import {
  Card as UICard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  action?: ReactNode
  footer?: ReactNode
  padding?: 'sm' | 'md' | 'lg' | 'none'
  children: ReactNode
}

const padClasses = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-7',
  none: 'p-0',
} as const

export default function Card({
  title,
  subtitle,
  action,
  footer,
  padding = 'md',
  children,
  className = '',
  ...rest
}: CardProps) {
  const hasHeader = Boolean(title || action)

  return (
    <UICard className={cn('overflow-hidden', className)} {...rest}>
      {hasHeader && (
        <CardHeader className="flex flex-row items-start justify-between gap-3 p-5 pb-3 space-y-0">
          <div className="min-w-0">
            {title && <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>}
            {subtitle && <CardDescription className="text-sm mt-1">{subtitle}</CardDescription>}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(padClasses[padding], hasHeader && 'pt-0')}>
        {children}
      </CardContent>
      {footer && (
        <CardFooter className="border-t border-border bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
          {footer}
        </CardFooter>
      )}
    </UICard>
  )
}
