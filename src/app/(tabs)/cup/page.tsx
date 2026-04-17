export default function CupPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">菜狗杯</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dog_trophy.png" alt="" aria-hidden="true"
        className="fixed bottom-20 left-1/2 -translate-x-1/2 w-80 h-80 object-contain pointer-events-none opacity-30 z-0" />
      <div className="card text-gray-400 space-y-2">
        <p className="font-semibold text-gray-500 text-sm">TODO</p>
        <ul className="text-sm space-y-1.5">
          <li>🎯 自动配对</li>
          <li>📊 ELO 排名</li>
          <li>🏆 积分追踪</li>
        </ul>
      </div>
    </main>
  )
}
