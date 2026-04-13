import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import SessionCard from '@/components/SessionCard'
import type { SessionWithInitiator } from '@/lib/types'

export const revalidate = 0   // always fresh

async function getSessions() {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: active } = await supabase
    .from('sessions')
    .select(`*, initiator:profiles!initiator_id(id, nickname, avatar_url)`)
    .neq('status', 'canceled')
    .gte('starts_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString()) // within 6h past
    .order('starts_at', { ascending: true })

  const { data: past } = await supabase
    .from('sessions')
    .select(`*, initiator:profiles!initiator_id(id, nickname, avatar_url)`)
    .lt('starts_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString())
    .order('starts_at', { ascending: false })
    .limit(10)

  // Get joined counts
  const allSessions = [...(active ?? [])] as { id: string }[]
  const ids = allSessions.map(s => s.id)
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

  return {
    active: (active ?? []) as unknown as SessionWithInitiator[],
    past:   (past   ?? []) as unknown as SessionWithInitiator[],
    joinedBySession,
  }
}

export default async function SessionsPage() {
  const { active, past, joinedBySession } = await getSessions()

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* Active sessions */}
        <section>
          <h1 className="text-xl font-bold text-gray-900 mb-4">接龙 Sessions</h1>
          {active.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">🏸</p>
              <p className="text-sm">No upcoming sessions</p>
              <p className="text-xs mt-1">Create one and invite your crew!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map(s => (
                <SessionCard key={s.id} session={s} joinedCount={joinedBySession[s.id] ?? 0} />
              ))}
            </div>
          )}
        </section>

        {/* Past sessions */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              过往 History
            </h2>
            <div className="space-y-3">
              {past.map(s => (
                <SessionCard key={s.id} session={s} joinedCount={joinedBySession[s.id] ?? 0} />
              ))}
            </div>
          </section>
        )}

      </main>
    </>
  )
}
