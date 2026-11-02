import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
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

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50]

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
  /** Client-side pagination settings. */
  pageSize?: number
  pageSizeOptions?: number[]
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
  pageSize: defaultPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: DataTableProps<T>) {
  const pageSizeId = useId()
  const availablePageSizes = useMemo(
    () => Array.from(new Set([defaultPageSize, ...pageSizeOptions])).filter((size) => size > 0),
    [defaultPageSize, pageSizeOptions],
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(defaultPageSize)
  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage))

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return data.slice(start, start + rowsPerPage)
  }, [currentPage, data, rowsPerPage])

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    )
  }

  const mobileColumns = columns.filter((c) => c.priority)
  const firstRow = (currentPage - 1) * rowsPerPage + 1
  const lastRow = Math.min(currentPage * rowsPerPage, data.length)

  const handleRowsPerPageChange = (nextRowsPerPage: number) => {
    setRowsPerPage(nextRowsPerPage)
    setCurrentPage(1)
  }

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
            {paginatedData.map((row, index) => (
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
        {paginatedData.map((row, index) => (
          <div className="p-3.5 flex flex-col gap-2 min-w-0" key={rowKey(row, index)}>
            <div className="mobile-table-heading flex items-center justify-between gap-2">
              <span className="min-w-0 break-words text-sm font-semibold">
                {mobileTitle
                  ? mobileTitle(row, index)
                  : mobileColumns.length > 0 && mobileColumns[0].render
                    ? mobileColumns[0].render(row, index)
                    : ''}
              </span>
              {mobileColumns.length > 1 && mobileColumns[1].render && (
                <span className="min-w-0 flex items-center gap-2 break-words">{mobileColumns[1].render(row, index)}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {mobileColumns.slice(mobileTitle ? 0 : 1).map((col) => (
                <div className="min-w-0 flex flex-col" key={col.key}>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-foreground mt-0.5 break-words">
                    {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </span>
                </div>
              ))}
            </div>
            {mobileActions && <div className="mobile-table-actions flex items-center gap-2 flex-wrap mt-1">{mobileActions(row, index)}</div>}
          </div>
        ))}
      </div>

      <div className="mobile-table-pagination flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span>
          Showing {firstRow}-{lastRow} of {data.length}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5" htmlFor="data-table-page-size">
            Rows per page
            <select
              id={`data-table-page-size-${pageSizeId}`}
              value={rowsPerPage}
              onChange={(event) => handleRowsPerPageChange(Number(event.target.value))}
              className="h-8 border border-border bg-card px-2 text-xs text-foreground"
            >
              {availablePageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <span className="px-1 text-foreground">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="min-h-8 border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="min-h-8 border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {caption && <p className="text-xs text-muted-foreground px-4 py-3 border-t border-border">{caption}</p>}
    </div>
  )
}
