import type { ReactNode } from 'react'
import EmptyState from './EmptyState'

export interface Column<T> {
  key: string
  label: string
  /** Desktop + mobile rendering. Mobile collapses to priority columns only. */
  render?: (row: T, index: number) => ReactNode
  /** Show this column in the mobile card layout (max 3 recommended). */
  priority?: boolean
  align?: 'left' | 'right'
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  /** Rendered under each row in the mobile card layout (action buttons). */
  mobileActions?: (row: T, index: number) => ReactNode
  /** Rendered as the row headline in the mobile card layout. Defaults to first priority column. */
  mobileTitle?: (row: T, index: number) => ReactNode
  caption?: string
}

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyTitle = 'No data available',
  emptyDescription,
  emptyAction,
  mobileActions,
  mobileTitle,
  caption,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="table-container">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    )
  }

  const mobileColumns = columns.filter((c) => c.priority)

  return (
    <div className="table-container">
      {/* Desktop / tablet */}
      <div className="table-scroll hide-mobile">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width, textAlign: col.align === 'right' ? 'right' : 'left' }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={rowKey(row, index)}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={col.align === 'right' ? 'cell-num' : undefined}
                  >
                    {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: rows become cards (§9.5) */}
      <div className="mobile-list md:hidden">
        {data.map((row, index) => (
          <div className="mobile-row" key={rowKey(row, index)}>
            <div className="mobile-row-head">
              <span className="mobile-row-title">
                {mobileTitle
                  ? mobileTitle(row, index)
                  : mobileColumns.length > 0 && mobileColumns[0].render
                    ? mobileColumns[0].render(row, index)
                    : ''}
              </span>
              {mobileColumns.length > 1 && mobileColumns[1].render && (
                <span className="flex items-center gap-2">{mobileColumns[1].render(row, index)}</span>
              )}
            </div>
            <div className="mobile-row-grid">
              {mobileColumns.slice(mobileTitle ? 0 : 1).map((col) => (
                <div className="mobile-row-item" key={col.key}>
                  <span className="mobile-row-key">{col.label}</span>
                  <span className="mobile-row-val">
                    {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </span>
                </div>
              ))}
            </div>
            {mobileActions && <div className="mobile-row-actions">{mobileActions(row, index)}</div>}
          </div>
        ))}
      </div>

      {caption && <p className="t-caption px-4 py-3 border-t border-border">{caption}</p>}
    </div>
  )
}
