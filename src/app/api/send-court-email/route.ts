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

  const names = participants.map((p, i) => `${i + 1}. ${p.display_name}`)
  const WEEKDAYS = ['周日','周一','周二','周三','周四','周五','周六']
  const dow = WEEKDAYS[new Date(session.starts_at).getDay()]

  const subject = `Yi Shen Group ${dow}预约名单`
  const body = `Lily您好，\n\nYi Shen, Miaoyan Li 和 Xuan Bai 已预订今日${(session as any).court_count}片场地。\n\n以下为本次菜狗群参与人员名单：\n\n${names.join('\n')}\n\n谢谢！\n-菜狗群AI管理员`

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
