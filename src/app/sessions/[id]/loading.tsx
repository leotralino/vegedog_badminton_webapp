export default function SessionDetailLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Meta card skeleton */}
      <div className="card animate-pulse space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="h-6 w-48 bg-gray-200 rounded-lg" />
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-52 bg-gray-100 rounded" />
          <div className="h-4 w-44 bg-gray-100 rounded" />
          <div className="h-4 w-40 bg-gray-100 rounded" />
          <div className="h-4 w-36 bg-gray-100 rounded" />
          <div className="h-4 w-32 bg-gray-100 rounded" />
        </div>
        <div className="h-9 w-full bg-gray-100 rounded-xl" />
      </div>

      {/* Notes skeleton */}
      <div className="card animate-pulse space-y-2 bg-brand-50">
        <div className="h-3 w-16 bg-brand-200 rounded" />
        <div className="h-4 w-full bg-brand-100 rounded" />
        <div className="h-4 w-4/5 bg-brand-100 rounded" />
        <div className="h-4 w-3/5 bg-brand-100 rounded" />
      </div>

      {/* Join section skeleton */}
      <div className="card animate-pulse space-y-3">
        <div className="h-5 w-24 bg-gray-200 rounded-lg" />
        <div className="h-10 w-full bg-gray-100 rounded-xl" />
        <div className="h-10 w-full bg-gray-200 rounded-xl" />
      </div>

      {/* Participant list skeleton */}
      <div className="card animate-pulse space-y-3">
        <div className="h-5 w-32 bg-gray-200 rounded-lg" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1">
            <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
            <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
            <div className="h-4 flex-1 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </main>
  )
}
