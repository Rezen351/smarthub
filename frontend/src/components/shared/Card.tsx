import { ReactNode } from 'react'

export default function Card({ children, className = '', title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-sm p-6 ${className}`}>
      {title && <h3 className="text-lg font-semibold text-text mb-4">{title}</h3>}
      {children}
    </div>
  )
}
