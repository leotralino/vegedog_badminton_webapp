import { createClient } from '@/lib/supabase/server'
import SessionCard from '@/components/SessionCard'
import type { SessionWithInitiator } from '@/lib/types'

export const revalidate = 0

async function getSessions() {
  const supabase = await createClient()
  // 接龙: sessions that started less than 3h ago, or haven't started yet
  const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`*, initiator:profiles!initiator_id(id, nickname, avatar_url)`)
    .neq('status', 'canceled')
    .neq('status', 'closed')
    .gte('starts_at', cutoff)
    .order('starts_at', { ascending: true })

  const ids = (sessions ?? []).map((s: { id: string }) => s.id)
  const { data: counts } = ids.length
    ? await supabase
        .from('participants')
        .select('session_id')
        .in('session_id', ids)
        .eq('status', 'joined')
    : { data: [] as { session_id: string }[] }

  const joinedBySession: Record<string, number> = {}
  for (const row of (counts ?? []) as { session_id: string }[]) {
    joinedBySession[row.session_id] = (joinedBySession[row.session_id] ?? 0) + 1
  }

  return { sessions: (sessions ?? []) as unknown as SessionWithInitiator[], joinedBySession }
}

export default async function SessionsPage() {
  const { sessions, joinedBySession } = await getSessions()

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">接龙</h1>
        <a href="/sessions/new"
          className="text-sm font-semibold text-white bg-brand-600 px-3 py-1.5 rounded-lg
                     active:bg-brand-700 transition-colors">
          + 发起接龙
        </a>
      </div>
      {sessions.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🏸</p>
          <p className="text-sm">暂无进行中的接龙</p>
          <p className="text-xs mt-1">快来发起一场吧！</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <SessionCard key={s.id} session={s} joinedCount={joinedBySession[s.id] ?? 0} />
          ))}
        </div>
      )}
    </main>
  )
}
