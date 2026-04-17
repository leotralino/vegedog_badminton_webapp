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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
            <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
          </svg>
          <span>菜狗主页</span>
        </Link>
        <NavbarActions loggedIn={!!user} avatarSrc={avatarSrc} />
      </div>
    </header>
  )
}
