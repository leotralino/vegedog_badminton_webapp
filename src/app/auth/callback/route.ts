import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url  = new URL(request.url)
  const code = url.searchParams.get('code')
  const type = url.searchParams.get('type')
  const next = url.searchParams.get('next') ?? '/sessions'

  if (code) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

    // New user or user without a nickname — send to settings first
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('nickname').eq('id', user.id).maybeSingle()
      if (!profile?.nickname?.trim()) {
        return NextResponse.redirect(new URL('/settings?setup=1', url.origin))
      }
    }
  }

  // Password recovery — send to set-password page
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/auth/reset-password', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
