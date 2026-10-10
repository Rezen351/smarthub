import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  action?: ReactNode
  footer?: ReactNode
  padding?: 'sm' | 'md' | 'lg' | 'none'
  children: ReactNode
}

const padClass = { sm: 'card-pad-sm', md: '', lg: 'card-pad-lg', none: '!p-0' } as const

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
  return (
    <div className={`card ${padClass[padding]} ${className}`} {...rest}>
      {(title || action) && (
        <div className="card-header">
          <div className="min-w-0">
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  )
}
