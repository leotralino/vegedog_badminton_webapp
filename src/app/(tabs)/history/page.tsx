import { createClient } from '@/lib/supabase/server'
import HistoryClient from './HistoryClient'
import type { SessionWithInitiator } from '@/lib/types'

export const revalidate = 0

async function getHistory() {
  const supabase = await createClient()
  // 历史: sessions that started more than 3h ago
  const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`*, initiator:profiles!initiator_id(id, nickname, avatar_url)`)
    .or(`starts_at.lt.${cutoff},status.eq.closed`)
    .order('starts_at', { ascending: false })
    .limit(30)

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

export default async function HistoryPage() {
  const { sessions, joinedBySession } = await getHistory()

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">历史</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dog_only.png" alt="" aria-hidden="true"
        className="fixed bottom-16 right-2 w-80 h-80 object-contain pointer-events-none opacity-30 z-0" />
      <HistoryClient sessions={sessions} joinedBySession={joinedBySession} />
    </main>
  )
}
