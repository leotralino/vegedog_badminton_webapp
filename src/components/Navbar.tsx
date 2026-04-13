import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).single()
    profile = data
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/sessions" className="flex items-center gap-2 font-bold text-gray-900">
          <span className="text-xl">🏸</span>
          <span>菜狗</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/sessions/new"
                className="text-sm font-semibold text-white bg-brand-600 px-3 py-1.5 rounded-lg
                           active:bg-brand-700 transition-colors"
              >
                + New
              </Link>
              <Link href="/profile" className="flex items-center gap-1.5 text-sm text-gray-600">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
                    {(profile?.nickname ?? 'P')[0].toUpperCase()}
                  </span>
                )}
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
