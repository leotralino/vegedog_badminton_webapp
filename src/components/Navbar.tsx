import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NavbarActions from './NavbarActions'

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
        <NavbarActions loggedIn={!!user} avatarSrc={avatarSrc} />
      </div>
    </header>
  )
}
