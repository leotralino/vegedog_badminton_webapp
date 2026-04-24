import Link from 'next/link'
import { formatSessionDate } from '@/lib/dates'
import type { SessionWithInitiator } from '@/lib/types'

const STATUS_LABEL: Record<string, string> = {
  open:     '正在接龙',
  locked:   '已锁定',
  canceled: '已取消',
  closed:   '已结束',
}
const STATUS_CLASS: Record<string, string> = {
  open:     'bg-brand-100 text-brand-700',
  locked:   'bg-blue-100 text-blue-700',
  canceled: 'bg-red-100 text-red-700',
  closed:   'bg-gray-100 text-gray-500',
}

interface Props {
  session: SessionWithInitiator
  joinedCount?: number
}

export default function SessionCard({ session, joinedCount }: Props) {
  return (
    <Link href={`/sessions/${session.id}`} className="block">
      <div className="card hover:shadow-md transition-shadow active:scale-[0.99] transition-transform">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="font-semibold text-gray-900 leading-tight">{session.title}</h2>
          <span className={`badge shrink-0 ${STATUS_CLASS[session.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[session.status] ?? session.status}
          </span>
        </div>

        {/* Meta rows */}
        <div className="space-y-1.5 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span suppressHydrationWarning>{formatSessionDate(session.starts_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span className="truncate">{session.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🏸</span>
            <span>{session.court_count}片场地 · 最多{session.max_participants}人</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>发起：{session.initiator.nickname}</span>
          <span className="flex items-center gap-1 text-brand-600 font-semibold">
            <span>👥</span>
            <span>
              {joinedCount !== undefined ? `${joinedCount}/` : ''}{session.max_participants}
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}
