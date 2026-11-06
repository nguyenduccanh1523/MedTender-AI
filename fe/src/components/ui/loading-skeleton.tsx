export function LoadingSkeleton({ variant = 'page' }: { variant?: 'page' | 'workspace' }) {
  return (
    <main className={`loading-skeleton loading-skeleton-${variant}`} aria-label="Đang tải" aria-busy="true">
      <div className="skeleton-line skeleton-kicker" />
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-copy" />
      <div className="skeleton-cards"><i /><i /><i /></div>
    </main>
  )
}
