'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

type Tab = '账户' | '统计' | '关注'

// ── Account tab ────────────────────────────────────────────────────────────
function AccountTab({ onSignOut }: { onSignOut: () => void }) {
  const supabase = createClient()
  const router   = useRouter()
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [nickname,      setNickname]      = useState('')
  const [venmoUsername, setVenmoUsername] = useState('')
  const [avatarUrl,     setAvatarUrl]     = useState('')
  const [email,         setEmail]         = useState('')

  const [editingNickname, setEditingNickname] = useState(false)
  const [editingVenmo,    setEditingVenmo]    = useState(false)
  const [draftNickname,   setDraftNickname]   = useState('')
  const [draftVenmo,      setDraftVenmo]      = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? '')
      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single() as { data: Profile | null; error: unknown }
      if (profile) {
        setNickname(profile.nickname ?? '')
        setVenmoUsername(profile.venmo_username ?? '')
        setAvatarUrl(profile.avatar_url ?? '')
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveField(field: 'nickname' | 'venmo') {
    setError('')
    const newNickname = field === 'nickname' ? draftNickname.trim() : nickname
    const newVenmo    = field === 'venmo'    ? draftVenmo.trim()    : venmoUsername
    if (!newNickname) { setError('昵称不能为空'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbErr } = await (supabase.from('profiles') as any).upsert({
        id:             user.id,
        nickname:       newNickname,
        venmo_username: newVenmo || null,
        avatar_url:     user.user_metadata?.avatar_url || null,
        updated_at:     new Date().toISOString(),
      })
      if (dbErr) throw dbErr
      if (field === 'nickname') { setNickname(newNickname); setEditingNickname(false) }
      else                      { setVenmoUsername(newVenmo); setEditingVenmo(false) }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '出现错误，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card animate-pulse h-48" />

  return (
    <div className="space-y-4">
      {avatarUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt="avatar"
            className="w-20 h-20 rounded-full border-2 border-brand-200 shadow object-cover" />
        </div>
      )}

      <div className="card space-y-4">
        {/* Email — read-only */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">邮箱</label>
          <p className="text-sm text-gray-500 py-2">{email}</p>
        </div>

        <hr className="border-gray-100" />

        {/* Nickname */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">昵称</label>
            {!editingNickname && (
              <button
                onClick={() => { setDraftNickname(nickname); setEditingNickname(true); setError('') }}
                className="text-xs text-brand-600 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors">
                编辑
              </button>
            )}
          </div>
          {editingNickname ? (
            <>
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                为了方便接龙与查账，请不要使用特殊字符或emoji。谢谢！
              </p>
              <input className="input" placeholder="别人看到的名字"
                value={draftNickname} onChange={e => setDraftNickname(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <button onClick={() => saveField('nickname')} disabled={saving}
                  className="btn-primary py-1.5 text-sm flex-1">
                  {saving ? '保存中…' : '保存'}
                </button>
                <button onClick={() => { setEditingNickname(false); setError('') }}
                  className="flex-1 py-1.5 text-sm rounded-xl border border-gray-200 text-gray-600 font-medium">
                  取消
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-800">{nickname || <span className="text-gray-400">未设置</span>}</p>
          )}
        </div>

        <hr className="border-gray-100" />

        {/* Venmo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Venmo 账号<span className="ml-1 font-normal text-gray-400">（选填）</span>
            </label>
            {!editingVenmo && (
              <button
                onClick={() => { setDraftVenmo(venmoUsername); setEditingVenmo(true); setError('') }}
                className="text-xs text-brand-600 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors">
                编辑
              </button>
            )}
          </div>
          {editingVenmo ? (
            <>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                <input className="input pl-7" placeholder="your-venmo-handle"
                  value={draftVenmo} onChange={e => setDraftVenmo(e.target.value.replace(/^@/, ''))} autoFocus />
              </div>
              <p className="text-xs text-gray-400">其他人在场次中可以看到你的付款按钮</p>
              <div className="flex gap-2">
                <button onClick={() => saveField('venmo')} disabled={saving}
                  className="btn-primary py-1.5 text-sm flex-1">
                  {saving ? '保存中…' : '保存'}
                </button>
                <button onClick={() => { setEditingVenmo(false); setError('') }}
                  className="flex-1 py-1.5 text-sm rounded-xl border border-gray-200 text-gray-600 font-medium">
                  取消
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-800">
              {venmoUsername ? `@${venmoUsername}` : <span className="text-gray-400">未设置</span>}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      </div>

      <div className="card">
        <button onClick={onSignOut}
          className="w-full text-sm text-red-500 font-medium py-1 hover:text-red-700 transition-colors">
          退出登录
        </button>
      </div>
    </div>
  )
}

// ── Stats tab ──────────────────────────────────────────────────────────────
function StatsTab() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats,   setStats]   = useState({
    joined:     0,
    plusOne:    0,
    waitlisted: 0,
    initiated:  0,
    stayedLate: 0,
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [
        { data: activeRows },
        { count: waitlisted },
        { count: initiated },
      ] = await Promise.all([
        supabase.from('participants')
          .select('session_id, stayed_late')
          .eq('user_id', user.id)
          .in('status', ['joined', 'withdrawn', 'late_withdraw']),
        supabase.from('participants').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('status', 'waitlist'),
        supabase.from('sessions').select('*', { count: 'exact', head: true })
          .eq('initiator_id', user.id),
      ])

      const rows = activeRows ?? []
      const joinedSessions   = new Set(rows.map(r => r.session_id))
      const stayedLateSessions = new Set(rows.filter(r => r.stayed_late).map(r => r.session_id))

      setStats({
        joined:     joinedSessions.size,
        plusOne:    rows.length - joinedSessions.size,
        waitlisted: waitlisted ?? 0,
        initiated:  initiated  ?? 0,
        stayedLate: stayedLateSessions.size,
      })
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="card animate-pulse h-48" />

  const items = [
    { label: '参与接龙次数', value: stats.joined,     emoji: '🏸' },
    { label: '帮助+1次数',   value: stats.plusOne,    emoji: '👥' },
    { label: '候补次数',     value: stats.waitlisted, emoji: '⏳' },
    { label: '发起接龙次数', value: stats.initiated,  emoji: '📋' },
    { label: '加时次数',     value: stats.stayedLate, emoji: '⏰' },
  ]

  return (
    <div className="card">
      <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">接龙统计</h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ label, value, emoji }, i) => (
          <div key={label}
            className={`bg-gray-50 rounded-xl p-4 text-center${i === items.length - 1 && items.length % 2 !== 0 ? ' col-span-2' : ''}`}>
            <p className="text-2xl mb-1">{emoji}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Follow tab ─────────────────────────────────────────────────────────────
function FollowTab() {
  const supabase = createClient()
  const router   = useRouter()
  const [loading,    setLoading]    = useState(true)
  const [following,  setFollowing]  = useState<Profile[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [search,     setSearch]     = useState('')
  const [candidates, setCandidates] = useState<Profile[]>([])
  const [dropOpen,   setDropOpen]   = useState(false)
  const [userId,     setUserId]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: followingData }, { count }] = await Promise.all([
        supabase
          .from('follows')
          .select('following:profiles!following_id(id, nickname, avatar_url)')
          .eq('follower_id', user.id),
        supabase.from('follows').select('*', { count: 'exact', head: true })
          .eq('following_id', user.id),
      ])

      setFollowing((followingData ?? []).map((f: any) => f.following as Profile))
      setFollowerCount(count ?? 0)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const searchProfiles = useCallback(async (q: string) => {
    if (!q.trim()) { setCandidates([]); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('profiles') as any)
      .select('id, nickname, avatar_url')
      .ilike('nickname', `%${q.trim()}%`)
      .limit(6)
    setCandidates(
      (data ?? []).filter((p: Profile) =>
        p.id !== userId && !following.some(f => f.id === p.id)
      )
    )
  }, [following, userId, supabase])

  useEffect(() => {
    const timer = setTimeout(() => searchProfiles(search), 200)
    return () => clearTimeout(timer)
  }, [search, searchProfiles])

  async function follow(profile: Profile) {
    if (!userId) return
    setSearch(''); setCandidates([]); setDropOpen(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('follows') as any)
      .insert({ follower_id: userId, following_id: profile.id })
    if (!error) setFollowing(prev => [...prev, profile])
  }

  async function unfollow(profileId: string) {
    if (!userId) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('follows') as any)
      .delete().eq('follower_id', userId).eq('following_id', profileId)
    if (!error) setFollowing(prev => prev.filter(f => f.id !== profileId))
  }

  if (loading) return <div className="card animate-pulse h-48" />

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">我的关注</h2>
          <span className="text-xs text-gray-400">{followerCount} 人关注你</span>
        </div>

        {following.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">还没有关注任何人</p>
        ) : (
          <div className="space-y-2">
            {following.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar_url ?? `https://api.dicebear.com/9.x/thumbs/svg?seed=${p.id}`}
                  alt="" className="w-8 h-8 rounded-full bg-gray-100 shrink-0 object-cover" />
                <span className="text-sm text-gray-800 flex-1">{p.nickname}</span>
                <button onClick={() => unfollow(p.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded transition-colors">
                  取消关注
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search to follow */}
        <div className="relative">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setDropOpen(true) }}
            onFocus={() => setDropOpen(true)}
            onBlur={() => setTimeout(() => { setDropOpen(false); setSearch(''); setCandidates([]) }, 150)}
            placeholder="搜索用户昵称来关注…"
            className="input text-sm"
          />
          {dropOpen && candidates.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100
                            rounded-xl shadow-lg overflow-hidden">
              {candidates.map(p => (
                <button key={p.id} onMouseDown={() => follow(p)}
                  className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatar_url ?? `https://api.dicebear.com/9.x/thumbs/svg?seed=${p.id}`}
                    alt="" className="w-6 h-6 rounded-full bg-gray-100 shrink-0 object-cover" />
                  <span>{p.nickname}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">关注后，对方发起新接龙时你将收到邮件通知。</p>
      </div>
    </div>
  )
}

// ── Main settings page ─────────────────────────────────────────────────────
export default function SettingsPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [tab, setTab] = useState<Tab>('账户')

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tabs: Tab[] = ['账户', '统计', '关注']

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">设置</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors
              ${tab === t
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === '账户' && <AccountTab onSignOut={signOut} />}
      {tab === '统计' && <StatsTab />}
      {tab === '关注' && <FollowTab />}
    </main>
  )
}
