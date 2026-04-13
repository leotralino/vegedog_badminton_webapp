'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatSessionDate } from '@/lib/dates'
import type {
  SessionWithInitiator, Participant, ParticipantWithProfile,
  PaymentMethod, PaymentRecord, Profile, PaymentMethodType,
} from '@/lib/types'
import { presetAddress } from '@/lib/locations'

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  session:             SessionWithInitiator
  initialParticipants: ParticipantWithProfile[]
  paymentMethods:      PaymentMethod[]
  paymentRecords:      PaymentRecord[]
  currentUser:         { id: string; profile: Profile | null } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = { open:'正在接龙', locked:'已锁定', canceled:'已取消' }
const STATUS_CLASS: Record<string, string> = {
  open:    'bg-brand-100 text-brand-700',
  locked:  'bg-blue-100 text-blue-700',
  canceled:'bg-red-100 text-red-700',
}
const PAY_CLASS: Record<string, string> = {
  paid:   'bg-green-100 text-green-700',
  unpaid: 'bg-red-100 text-red-700',
  waived: 'bg-orange-100 text-orange-700',
}
const PAY_LABEL: Record<string, string> = { paid:'已付 ✓', unpaid:'未付', waived:'已免' }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} title="复制地址"
      className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600
                 hover:bg-gray-100 transition-colors">
      {copied ? (
        <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  )
}

function venmoUrl(accountRef: string): string {
  const username = accountRef.startsWith('@') ? accountRef.slice(1) : accountRef
  return `https://venmo.com/${username}`
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SessionDetailClient({
  session,
  initialParticipants,
  paymentMethods: initialMethods,
  paymentRecords,
  currentUser,
}: Props) {
  const supabase = createClient()
  const router   = useRouter()

  const [participants, setParticipants]   = useState(initialParticipants)
  const [paymentMethods, setPaymentMethods] = useState(initialMethods)
  const [joinName, setJoinName]           = useState('')
  const [joining, setJoining]             = useState(false)
  const [locking, setLocking]             = useState(false)
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null)

  const isAdmin = currentUser?.id === session.initiator_id

  // ── Realtime subscription ─────────────────────────────────────────────
  const refreshParticipants = useCallback(async () => {
    const { data } = await supabase
      .from('participants')
      .select(`*, profile:profiles!user_id(id, nickname, avatar_url, venmo_username)`)
      .eq('session_id', session.id)
      .order('queue_position')
    if (data) setParticipants(data as ParticipantWithProfile[])
  }, [session.id, supabase])

  useEffect(() => {
    const channel = supabase
      .channel(`session-${session.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'participants',
        filter: `session_id=eq.${session.id}`,
      }, refreshParticipants)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, supabase, refreshParticipants])

  // ── Default join name ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return
    const base = currentUser.profile?.nickname ?? 'Player'
    const mine = participants.filter(p => p.user_id === currentUser.id && (p.status === 'joined' || p.status === 'waitlist'))
    const allMine = participants.filter(p => p.user_id === currentUser.id)
    const maxIdx = allMine.reduce((max, p) => {
      const m = p.display_name.match(/\+(\d+)$/)
      return m ? Math.max(max, parseInt(m[1])) : Math.max(max, mine.length === 0 ? -1 : 0)
    }, -1)
    const nextIdx = maxIdx + 1
    setJoinName(nextIdx === 0 ? base : `${base} +${nextIdx}`)
  }, [participants, currentUser])

  // ── Toast helper ──────────────────────────────────────────────────────
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Join ──────────────────────────────────────────────────────────────
  async function handleJoin() {
    if (!currentUser) { router.push(`/login?next=/sessions/${session.id}`); return }
    const name = joinName.trim() || (currentUser.profile?.nickname ?? 'Player')
    setJoining(true)

    // Optimistic update — show entry immediately
    const tempId = `temp-${Date.now()}`
    const joinedNow = participants.filter(p => p.status === 'joined').length
    const tempP: ParticipantWithProfile = {
      id: tempId, session_id: session.id, user_id: currentUser.id,
      display_name: name, queue_position: participants.length + 1,
      status: joinedNow < session.max_participants ? 'joined' : 'waitlist',
      stayed_late: false, joined_at: new Date().toISOString(), withdrew_at: null,
      profile: { id: currentUser.id, nickname: currentUser.profile?.nickname ?? 'Player', avatar_url: currentUser.profile?.avatar_url ?? null, venmo_username: null },
    }
    setParticipants(prev => [...prev, tempP])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('join_session', {
      p_session_id: session.id, p_user_id: currentUser.id, p_display_name: name,
    })
    setJoining(false)
    if (error) {
      setParticipants(prev => prev.filter(p => p.id !== tempId)) // revert
      showToast(error.message, false)
    } else {
      showToast('已加入！🎉')
      refreshParticipants()
    }
  }

  // ── Withdraw ──────────────────────────────────────────────────────────
  async function handleWithdraw(participantId: string) {
    if (!currentUser) return

    // Optimistic update — hide entry immediately
    setParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, status: 'withdrawn' as const, withdrew_at: new Date().toISOString() } : p
    ))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('withdraw_participant', {
      p_participant_id: participantId, p_user_id: currentUser.id,
    })
    if (error) { showToast(error.message, false); refreshParticipants() }
    else { showToast('已退出'); refreshParticipants() }
  }

  // ── Lock session ──────────────────────────────────────────────────────
  async function handleLock() {
    setLocking(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('sessions') as any)
      .update({ status: 'locked' })
      .eq('id', session.id)
    setLocking(false)
    if (error) showToast(error.message, false)
    else { showToast('接龙已锁定 🔒'); router.refresh() }
  }

  // ── Toggle stayed late ────────────────────────────────────────────────
  async function handleToggleLate(p: Participant) {
    const newVal = !p.stayed_late
    setParticipants(prev => prev.map(pt => pt.id === p.id ? { ...pt, stayed_late: newVal } : pt))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('participants') as any)
      .update({ stayed_late: newVal })
      .eq('id', p.id)
    if (error) { showToast(error.message, false); refreshParticipants() }
  }

  // ── Partition participants ────────────────────────────────────────────
  const joined    = participants.filter(p => p.status === 'joined')
  const waitlist  = participants.filter(p => p.status === 'waitlist')
  const withdrawn = participants.filter(p => p.status === 'withdrawn' || p.status === 'late_withdraw')
    .sort((a,b) => new Date(b.withdrew_at ?? 0).getTime() - new Date(a.withdrew_at ?? 0).getTime())

  const myActiveEntries = currentUser
    ? participants.filter(p => p.user_id === currentUser.id && (p.status === 'joined' || p.status === 'waitlist'))
    : []

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl
                        text-white text-sm font-semibold shadow-lg transition-all
                        ${toast.ok ? 'bg-brand-600' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Meta card */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{session.title}</h1>
          <span className={`badge shrink-0 ${STATUS_CLASS[session.status]}`}>
            {STATUS_LABEL[session.status]}
          </span>
        </div>

        <div className="space-y-1.5 text-sm text-gray-600">
          <div className="flex gap-2"><span>📅</span><span suppressHydrationWarning>{formatSessionDate(session.starts_at)}</span></div>
          <div className="flex gap-2"><span>⏰</span>
            <span suppressHydrationWarning>退出截止：{formatSessionDate(session.withdraw_deadline)}</span>
          </div>
          {/* Location with address + copy */}
          <div className="flex gap-2">
            <span>📍</span>
            <div className="flex-1 min-w-0">
              <span>{session.location}</span>
              {(() => {
                const addr = (session as any).location_address ?? presetAddress(session.location)
                return addr ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 flex-1 leading-relaxed">{addr}</span>
                    <CopyButton text={addr} />
                  </div>
                ) : null
              })()}
            </div>
          </div>
          <div className="flex gap-2"><span>👤</span>
            <span>发起：{(session as any).initiator?.nickname ?? '—'}</span>
          </div>
          <div className="flex gap-2"><span>🏸</span>
            <span>{session.court_count}片场地 · {session.max_participants}人满员</span>
          </div>
        </div>

        {/* Admin controls */}
        {isAdmin && session.status === 'open' && (
          <button onClick={handleLock} disabled={locking}
            className="w-full mt-2 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold
                       active:bg-blue-700 disabled:opacity-50 transition-colors">
            {locking ? '锁定中…' : '🔒 锁定接龙'}
          </button>
        )}

        {/* Share link */}
        <ShareButton sessionId={session.id} />
      </div>

      {/* Notes card — below meta */}
      {session.notes && (
        <div className="card bg-brand-50 border border-brand-100">
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">注意事项</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{session.notes}</p>
        </div>
      )}

      {/* Join section */}
      {session.status === 'open' && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">加入接龙</h2>
          {currentUser ? (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  报名名称（可改为 +1、+2 多次报名）
                </label>
                <input className="input" value={joinName} onChange={e => setJoinName(e.target.value)} />
              </div>
              <button onClick={handleJoin} disabled={joining} className="btn-primary">
                {joining ? '加入中…' : `以"${joinName}"加入`}
              </button>
              {myActiveEntries.length > 0 && (
                <p className="text-xs text-gray-400 text-center">
                  已有 {myActiveEntries.length} 个报名，点击 – 可撤回。
                </p>
              )}
            </>
          ) : (
            <a href={`/login?next=/sessions/${session.id}`}
               className="btn-primary text-center block py-3 rounded-xl bg-brand-600 text-white font-semibold">
              登录后加入
            </a>
          )}
        </div>
      )}

      {session.status === 'locked' && (
        <div className="text-center text-sm text-gray-400 py-2">
          🔒 接龙已锁定，无法加入或撤回
        </div>
      )}

      {/* Participant list */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            已报名（{joined.length}/{session.max_participants}）
          </h2>
        </div>

        {joined.length === 0 && waitlist.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">暂无报名，快来第一个！</p>
        ) : (
          <div className="space-y-1">
            {joined.map((p, i) => (
              <ParticipantRow key={p.id} p={p} rank={i+1}
                isAdmin={isAdmin} isLocked={session.status === 'locked'}
                isOwn={currentUser?.id === p.user_id}
                payRecord={paymentRecords.find(r => r.participant_id === p.id)}
                onWithdraw={() => handleWithdraw(p.id)}
                onToggleLate={() => handleToggleLate(p)} />
            ))}
            {waitlist.length > 0 && (
              <>
                <div className="text-xs text-brand-600 font-semibold pt-2 pb-1">— 候补 —</div>
                {waitlist.map((p, i) => (
                  <ParticipantRow key={p.id} p={p} rank={joined.length + i + 1}
                    isAdmin={isAdmin} isLocked={session.status === 'locked'}
                    isOwn={currentUser?.id === p.user_id}
                    payRecord={paymentRecords.find(r => r.participant_id === p.id)}
                    onWithdraw={() => handleWithdraw(p.id)}
                    onToggleLate={() => handleToggleLate(p)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Withdrawn */}
      {withdrawn.length > 0 && (
        <div className="card space-y-2">
          <h2 className="font-semibold text-gray-900 text-sm">已退出</h2>
          {withdrawn.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-500 line-through">{p.display_name}</span>
              {p.status === 'late_withdraw' && (
                <span className="badge bg-orange-100 text-orange-700">Late ⚠️</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payment section */}
      {session.status === 'locked' && (
        <PaymentSection
          session={session}
          participants={[...joined, ...waitlist]}
          paymentMethods={paymentMethods}
          paymentRecords={paymentRecords}
          currentUserId={currentUser?.id}
          isAdmin={isAdmin}
          onMethodAdded={m => setPaymentMethods(prev => [...prev, m])}
        />
      )}
    </div>
  )
}

// ── Participant row ────────────────────────────────────────────────────────
function ParticipantRow({
  p, rank, isAdmin, isLocked, isOwn, payRecord,
  onWithdraw, onToggleLate,
}: {
  p: ParticipantWithProfile
  rank: number
  isAdmin: boolean
  isLocked: boolean
  isOwn: boolean
  payRecord?: PaymentRecord
  onWithdraw: () => void
  onToggleLate: () => void
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Rank badge */}
      <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-xs font-bold
                       flex items-center justify-center shrink-0">
        {rank}
      </span>

      {/* Avatar */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={(p as any).profile?.avatar_url ?? `https://api.dicebear.com/9.x/thumbs/svg?seed=${p.user_id}`}
        alt=""
        className="w-8 h-8 rounded-full object-cover shrink-0 bg-gray-100"
      />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 truncate block">{p.display_name}</span>
        {payRecord && (
          <span className="text-xs text-gray-400">
            ${(payRecord.base_fee + payRecord.late_fee).toFixed(2)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Stayed late toggle (admin, locked) */}
        {isAdmin && isLocked && (
          <button onClick={onToggleLate}
            title={p.stayed_late ? 'Played extra — click to unmark' : 'Mark as played extra time'}
            className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors
              ${p.stayed_late
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-400 hover:bg-orange-50 hover:text-orange-500'}`}>
            +时
          </button>
        )}

        {/* Payment status badge (admin sees all, others see own) */}
        {payRecord && (
          <span className={`badge ${PAY_CLASS[payRecord.status]}`}>
            {PAY_LABEL[payRecord.status]}
          </span>
        )}

        {/* Withdraw (own entries, unlocked) */}
        {isOwn && !isLocked && (
          <button onClick={onWithdraw}
            className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 active:scale-95">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Payment section ────────────────────────────────────────────────────────
function PaymentSection({
  session, participants, paymentMethods, paymentRecords,
  currentUserId, isAdmin, onMethodAdded,
}: {
  session: SessionWithInitiator
  participants: ParticipantWithProfile[]
  paymentMethods: PaymentMethod[]
  paymentRecords: PaymentRecord[]
  currentUserId?: string
  isAdmin: boolean
  onMethodAdded: (m: PaymentMethod) => void
}) {
  const supabase  = createClient()
  const [showForm,  setShowForm]  = useState(false)
  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState<ParticipantWithProfile | null>(null)
  const [venmoId,   setVenmoId]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [dropOpen,  setDropOpen]  = useState(false)

  // Deduplicate participants by user_id for the search dropdown
  const uniqueUsers = participants.filter(
    (p, i, arr) => arr.findIndex(x => x.user_id === p.user_id) === i
  )
  const filtered = uniqueUsers.filter(p =>
    (p.profile?.nickname ?? p.display_name).toLowerCase().includes(search.toLowerCase())
  )

  function selectUser(p: ParticipantWithProfile) {
    setSelected(p)
    setSearch(p.profile?.nickname ?? p.display_name)
    setVenmoId(p.profile?.venmo_username ?? '')
    setDropOpen(false)
  }

  function resetForm() {
    setShowForm(false); setSelected(null); setSearch(''); setVenmoId(''); setDropOpen(false)
  }

  async function saveMethod() {
    if (!selected || !currentUserId) return
    const ref = venmoId.trim().replace(/^@/, '')
    if (!ref) return
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('payment_methods') as any)
      .insert({
        session_id:  session.id,
        type:        'venmo',
        label:       selected.profile?.nickname ?? selected.display_name,
        account_ref: ref,
        created_by:  currentUserId,
      })
      .select().single() as { data: PaymentMethod | null; error: unknown }
    setSaving(false)
    if (!error && data) { onMethodAdded(data); resetForm() }
  }

  // Amount owed by current user
  const myIds   = currentUserId ? participants.filter(p => p.user_id === currentUserId).map(p => p.id) : []
  const myTotal = paymentRecords.filter(r => myIds.includes(r.participant_id))
    .reduce((s, r) => s + r.base_fee + r.late_fee, 0)

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-gray-900">💳 付款</h2>

      {/* Pay-to rows */}
      {paymentMethods.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">付款给</p>
          {paymentMethods.map(method => (
            <div key={method.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{method.label}</p>
                <p className="text-xs text-gray-400">@{method.account_ref}</p>
              </div>
              <div className="shrink-0 text-right">
                {myTotal > 0 && (
                  <p className="text-xs text-gray-500 mb-1">金额：<strong>${myTotal.toFixed(2)}</strong></p>
                )}
                <a href={venmoUrl(method.account_ref)}
                   target="_blank" rel="noopener noreferrer"
                   className="inline-block px-4 py-2 rounded-xl text-sm font-bold text-white
                              bg-[#008CFF] active:opacity-80 transition-opacity">
                  Venmo 付款
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin: add payment receiver */}
      {isAdmin && (
        <div>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="text-sm text-brand-600 font-semibold">
              + 添加收款人
            </button>
          ) : (
            <div className="space-y-3 border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                选择收款人
              </p>

              {/* User search */}
              <div className="relative">
                <input
                  className="input"
                  placeholder="搜索参与者…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelected(null); setDropOpen(true) }}
                  onFocus={() => setDropOpen(true)}
                />
                {dropOpen && search && filtered.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100
                                  rounded-xl shadow-lg overflow-hidden">
                    {filtered.map(p => (
                      <button key={p.user_id} onMouseDown={() => selectUser(p)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50
                                   flex items-center gap-2.5 transition-colors">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.profile?.avatar_url ?? `https://api.dicebear.com/9.x/thumbs/svg?seed=${p.user_id}`}
                          alt="" className="w-6 h-6 rounded-full bg-gray-100 shrink-0"
                        />
                        <span className="font-medium">{p.profile?.nickname ?? p.display_name}</span>
                        {p.profile?.venmo_username && (
                          <span className="text-xs text-gray-400 ml-auto">@{p.profile.venmo_username}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Venmo ID — pre-filled from profile or blank */}
              {selected && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Venmo ID
                    {selected.profile?.venmo_username
                      ? <span className="ml-1 text-brand-600">（来自个人资料）</span>
                      : <span className="ml-1 text-orange-500">（未设置，请手动填写）</span>
                    }
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                    <input
                      className="input pl-7"
                      placeholder="venmo-handle"
                      value={venmoId}
                      onChange={e => setVenmoId(e.target.value.replace(/^@/, ''))}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={saveMethod} disabled={saving || !selected || !venmoId.trim()}
                  className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold
                             disabled:opacity-40 transition-opacity">
                  {saving ? '保存中…' : '添加'}
                </button>
                <button onClick={resetForm}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment records */}
      {paymentRecords.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">付款记录</p>
          {participants.map(p => {
            const record = paymentRecords.find(r => r.participant_id === p.id)
            if (!record) return null
            return (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.display_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">
                    ${(record.base_fee + record.late_fee).toFixed(2)}
                  </span>
                  <span className={`badge ${PAY_CLASS[record.status]}`}>
                    {PAY_LABEL[record.status]}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Share button ──────────────────────────────────────────────────────────
function ShareButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = `${location.origin}/sessions/${sessionId}`
    if (navigator.share) {
      await navigator.share({ title: '菜狗 Badminton Session', url })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button onClick={share}
      className="w-full py-2 text-sm font-medium text-gray-500 border border-gray-200
                 rounded-xl active:bg-gray-50 transition-colors">
      {copied ? '✅ 已复制链接！' : '🔗 分享邀请链接'}
    </button>
  )
}
