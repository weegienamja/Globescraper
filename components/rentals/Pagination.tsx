import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Build the URL for a given page number */
  buildHref: (page: number) => string;
}

/**
 * Prev/Next + compact page numbers.
 * If totalPages > 7, uses ellipsis: 1 ... 4 5 6 ... 20
 */
export function Pagination({ currentPage, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <nav className="rentals-pagination" aria-label="Pagination">
      <Link
        href={buildHref(currentPage - 1)}
        className={`rentals-pagination__btn${currentPage <= 1 ? " rentals-pagination__btn--disabled" : ""}`}
        aria-label="Previous page"
        aria-disabled={currentPage <= 1}
        tabIndex={currentPage <= 1 ? -1 : undefined}
      >
        Prev
      </Link>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="rentals-pagination__ellipsis">...</span>
        ) : (
          <Link
            key={p}
            href={buildHref(p as number)}
            className={`rentals-pagination__btn${p === currentPage ? " rentals-pagination__btn--active" : ""}`}
            aria-current={p === currentPage ? "page" : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={buildHref(currentPage + 1)}
        className={`rentals-pagination__btn${currentPage >= totalPages ? " rentals-pagination__btn--disabled" : ""}`}
        aria-label="Next page"
        aria-disabled={currentPage >= totalPages}
        tabIndex={currentPage >= totalPages ? -1 : undefined}
      >
        Next
      </Link>
    </nav>
  );
}

function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}
