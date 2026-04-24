export default function NewSessionLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-pulse">
      {/* Title */}
      <div className="h-6 w-32 bg-gray-200 rounded-lg" />

      {/* Form card */}
      <div className="card space-y-4">
        {/* Title field */}
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-100 rounded-xl" />
        </div>
        {/* Location field */}
        <div className="space-y-1.5">
          <div className="h-3 w-12 bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-100 rounded-xl" />
        </div>
        {/* Two datetime fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-100 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-100 rounded-xl" />
          </div>
        </div>
        {/* Two number fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="h-3 w-12 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-100 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-12 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-100 rounded-xl" />
          </div>
        </div>
        {/* Notes */}
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-24 w-full bg-gray-100 rounded-xl" />
        </div>
        {/* Submit button */}
        <div className="h-11 w-full bg-gray-200 rounded-xl" />
      </div>
    </main>
  )
}
