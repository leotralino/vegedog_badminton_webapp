export default function SessionsLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="h-7 w-16 bg-gray-200 rounded-lg animate-pulse" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card animate-pulse space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="h-5 w-40 bg-gray-200 rounded-lg" />
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-48 bg-gray-100 rounded" />
              <div className="h-4 w-36 bg-gray-100 rounded" />
              <div className="h-4 w-44 bg-gray-100 rounded" />
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <div className="h-3 w-24 bg-gray-100 rounded" />
              <div className="h-3 w-12 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
