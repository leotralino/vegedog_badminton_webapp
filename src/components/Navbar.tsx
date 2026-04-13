import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: { nickname: string; avatar_url: string | null } | null = null
  if (user) {
    const { data } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).single()
    profile = data as { nickname: string; avatar_url: string | null } | null
  }
  const avatarSrc = profile?.avatar_url ?? `https://api.dicebear.com/9.x/thumbs/svg?seed=${user?.id}`

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/sessions" className="flex items-center gap-2 font-bold text-gray-900">
          <span className="text-xl">🏸</span>
          <span>菜狗主页</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/sessions/new"
                className="text-sm font-semibold text-white bg-brand-600 px-3 py-1.5 rounded-lg
                           active:bg-brand-700 transition-colors"
              >
                + 发起接龙
              </Link>
              <Link href="/settings" className="flex items-center gap-1.5 text-sm text-gray-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarSrc} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-100" />
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
