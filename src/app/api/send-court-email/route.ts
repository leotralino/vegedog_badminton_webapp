export const runtime = 'nodejs'  // nodemailer requires Node.js, not Edge

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase/server'

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
    supabase.from('sessions').select('title, starts_at').eq('id', sessionId).single(),
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

  const names = participants.map((p, i) => `${i + 1}. ${p.display_name}`)

  const subject = `预约名单 — ${session.title}`
  const body = `您好，\n\n这是我们这次菜狗群正式成员名单：\n\n${names.join('\n')}\n\n谢谢！\n-菜狗群AI管理员`

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
