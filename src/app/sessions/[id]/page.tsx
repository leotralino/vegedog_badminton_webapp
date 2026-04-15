import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import SessionDetailClient from './SessionDetailClient'

export const revalidate = 0

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: session },
    { data: { user } },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select(`*, initiator:profiles!initiator_id(id, nickname, avatar_url)`)
      .eq('id', id)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!session) notFound()

  const [
    { data: participants },
    { data: paymentMethods },
    { data: paymentRecords },
    { data: sessionAdmins },
    profileResult,
  ] = await Promise.all([
    supabase
      .from('participants')
      .select(`*, profile:profiles!user_id(id, nickname, avatar_url, venmo_username)`)
      .eq('session_id', id)
      .order('queue_position'),
    supabase.from('payment_methods').select('*').eq('session_id', id),
    user ? supabase.from('payment_records').select('*').eq('session_id', id) : { data: [] },
    supabase
      .from('session_admins')
      .select(`session_id, user_id, created_at, profile:profiles!user_id(id, nickname, avatar_url)`)
      .eq('session_id', id),
    user ? supabase.from('profiles').select('*').eq('id', user.id).single() : { data: null },
  ])

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <SessionDetailClient
          session={session as any}
          initialParticipants={participants as any ?? []}
          paymentMethods={paymentMethods ?? []}
          paymentRecords={paymentRecords ?? []}
          initialAdmins={sessionAdmins as any ?? []}
          currentUser={user ? { id: user.id, profile: profileResult.data } : null}
        />
      </main>
    </>
  )
}
