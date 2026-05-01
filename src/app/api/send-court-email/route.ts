export const runtime = 'nodejs'  // nodemailer requires Node.js, not Edge

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase/server'
import { buildCourtEmail } from '@/lib/courtEmail'

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_EMAIL !== 'true') return NextResponse.json({ ok: true, skipped: true })

  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

  // Verify caller is an admin for this session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase
    .from('session_admins')
    .select('user_id')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .single()
  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch session + joined participants
  const [{ data: session }, { data: participants }] = await Promise.all([
    supabase.from('sessions').select('title, starts_at, court_count').eq('id', sessionId).single(),
    supabase
      .from('participants')
      .select('display_name, profile:profiles!user_id(nickname)')
      .eq('session_id', sessionId)
      .eq('status', 'joined')
      .order('queue_position'),
  ])

  if (!session || !participants) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const courtEmail = process.env.COURT_EMAIL
  const gmailUser  = process.env.GMAIL_USER
  const gmailPass  = process.env.GMAIL_APP_PASSWORD

  if (!courtEmail || !gmailUser || !gmailPass) {
    const missing = [
      !courtEmail  && 'COURT_EMAIL',
      !gmailUser   && 'GMAIL_USER',
      !gmailPass   && 'GMAIL_APP_PASSWORD',
    ].filter(Boolean).join(', ')
    return NextResponse.json({ error: `Missing env vars: ${missing}` }, { status: 500 })
  }

  const { subject, body } = buildCourtEmail(session as any, participants as any)

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPass },
  })

  await transporter.sendMail({
    from: `菜狗羽球 <${gmailUser}>`,
    to: courtEmail.split(',').map(e => e.trim()).filter(Boolean).join(', '),

    subject,
    text: body,
  })

  return NextResponse.json({ ok: true, count: participants.length })
}
