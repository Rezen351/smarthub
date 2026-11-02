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
        <CardHeader className="flex flex-col items-stretch justify-between gap-3 p-5 pb-3 space-y-0 sm:flex-row sm:items-start">
          <div className="min-w-0">
            {title && <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>}
            {subtitle && <CardDescription className="text-sm mt-1">{subtitle}</CardDescription>}
          </div>
          {action && <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:shrink-0">{action}</div>}
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
