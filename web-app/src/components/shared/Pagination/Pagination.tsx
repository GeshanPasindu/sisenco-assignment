import './Pagination.css'

interface PaginationProps {
  page: number
  totalPages: number
  hasMore: boolean
  onPageChange: (page: number) => void
  disabled?: boolean
}

export function Pagination({ page, totalPages, hasMore, onPageChange, disabled = false }: PaginationProps) {
  const pageCount = Math.max(1, totalPages)
  const visibleCount = Math.min(5, pageCount)
  const firstPage = Math.max(1, Math.min(page - 2, pageCount - visibleCount + 1))
  const pages = Array.from({ length: visibleCount }, (_, index) => firstPage + index)

  return (
    <nav className="pagination" aria-label="Pagination" aria-busy={disabled}>
      <button
        type="button"
        className="pagination-button pagination-step"
        aria-label="Back"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(Math.max(1, Math.min(page - 1, pageCount)))}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m14 6-6 6 6 6" />
        </svg>
        <span className="pagination-step-label">Back</span>
      </button>
      {pages.map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          className="pagination-button"
          aria-label={`Page ${pageNumber}`}
          aria-current={pageNumber === page ? 'page' : undefined}
          disabled={disabled}
          onClick={() => { if (pageNumber !== page) onPageChange(pageNumber) }}
        >
          {pageNumber}
        </button>
      ))}
      <button
        type="button"
        className="pagination-button pagination-step"
        aria-label="Next"
        disabled={disabled || !hasMore || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <span className="pagination-step-label">Next</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m10 6 6 6-6 6" />
        </svg>
      </button>
      <span className="sr-only">Page {page} of {pageCount}</span>
    </nav>
  )
}
