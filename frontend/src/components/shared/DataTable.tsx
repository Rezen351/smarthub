import type { ReactNode } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
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
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    )
  }

  const mobileColumns = columns.filter((c) => c.priority)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Desktop / tablet */}
      <div className="overflow-x-auto hidden md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(col.align === 'right' && 'text-right')}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={rowKey(row, index)}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(col.align === 'right' && 'tabular-nums text-right')}
                  >
                    {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: rows become cards */}
      <div className="flex flex-col md:hidden divide-y divide-border">
        {data.map((row, index) => (
          <div className="p-3.5 flex flex-col gap-2" key={rowKey(row, index)}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
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
            <div className="grid grid-cols-2 gap-2 text-xs">
              {mobileColumns.slice(mobileTitle ? 0 : 1).map((col) => (
                <div className="flex flex-col" key={col.key}>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-foreground mt-0.5">
                    {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </span>
                </div>
              ))}
            </div>
            {mobileActions && <div className="flex items-center gap-2 flex-wrap mt-1">{mobileActions(row, index)}</div>}
          </div>
        ))}
      </div>

      {caption && <p className="text-xs text-muted-foreground px-4 py-3 border-t border-border">{caption}</p>}
    </div>
  )
}
