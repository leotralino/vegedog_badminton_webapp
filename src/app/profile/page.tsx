'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState('')
  const [success, setSuccess]   = useState('')

  const [nickname,      setNickname]      = useState('')
  const [venmoUsername, setVenmoUsername] = useState('')
  const [avatarUrl,     setAvatarUrl]     = useState('')
  const [email,         setEmail]         = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single() as { data: Profile | null; error: unknown }

      if (profile) {
        setNickname(profile.nickname ?? '')
        setVenmoUsername(profile.venmo_username ?? '')
        setAvatarUrl(profile.avatar_url ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!nickname.trim()) { setError('Nickname is required'); return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: dbErr } = await (supabase.from('profiles') as any)
        .upsert({
            id:             user.id,
            nickname:       nickname.trim(),
            venmo_username: venmoUsername.trim() || null,
            avatar_url:     user.user_metadata?.avatar_url || null,
            updated_at:     new Date().toISOString(),
        })

      if (dbErr) throw dbErr
      setSuccess('Profile saved!')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="card animate-pulse h-48" />
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Profile</h1>

        {/* Avatar */}
        {avatarUrl && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-20 h-20 rounded-full border-2 border-brand-200 shadow"
            />
          </div>
        )}

        <form onSubmit={save} className="space-y-4">
          <div className="card space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
              <input className="input bg-gray-50 cursor-not-allowed" value={email} disabled />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nickname *</label>
              <input
                className="input"
                placeholder="How others see you"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Venmo username
                <span className="ml-1 font-normal text-gray-400">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                <input
                  className="input pl-7"
                  placeholder="your-venmo-handle"
                  value={venmoUsername}
                  onChange={e => setVenmoUsername(e.target.value.replace(/^@/, ''))}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Others will see a Pay button when you&apos;re in a session
              </p>
            </div>
          </div>

          {error   && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
          {success && <p className="text-sm text-green-600 bg-green-50 rounded-xl px-4 py-3">{success}</p>}

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>

        <div className="card">
          <button
            onClick={signOut}
            className="w-full text-sm text-red-500 font-medium py-1 hover:text-red-700 transition-colors"
          >
            Sign out
          </button>
        </div>
    </main>
  )
}
