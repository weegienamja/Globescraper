/**
 * Lightweight skeleton loader components for loading states.
 * Uses CSS shimmer animation defined in globals.css.
 */

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="admin__metrics">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div
            className="skeleton skeleton-heading"
            style={{ width: "50%", margin: "0 auto 10px" }}
          />
          <div
            className="skeleton skeleton-text skeleton-text--short"
            style={{ margin: "0 auto" }}
          />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="admin__table-wrap" style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );
}
