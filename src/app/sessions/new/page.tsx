'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { defaultStartsAt, defaultWithdrawDeadline, roundTo15, localToPacificISO } from '@/lib/dates'

export default function NewSessionPage() {
  const router  = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    title:               '',
    location:            '',
    starts_at:           defaultStartsAt(),
    withdraw_deadline:   '',
    max_participants:    '8',
    court_count:         '2',
    fee_per_person:      '20',
    late_withdraw_ratio: '1',
  })
  // Set default withdraw_deadline after starts_at is known
  useState(() => {
    setForm(f => ({ ...f, withdraw_deadline: defaultWithdrawDeadline(f.starts_at) }))
  })

  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleStartsAtChange(value: string) {
    const rounded = roundTo15(value)
    set('starts_at', rounded)
    set('withdraw_deadline', defaultWithdrawDeadline(rounded))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const maxP = parseInt(form.max_participants)
      const courtC = parseInt(form.court_count)
      const fee = parseFloat(form.fee_per_person)
      const ratio = parseFloat(form.late_withdraw_ratio)

      if (!form.title.trim())    throw new Error('Title is required')
      if (!form.location.trim()) throw new Error('Location is required')
      if (isNaN(maxP)  || maxP < 1)  throw new Error('Max participants must be a positive number')
      if (isNaN(courtC) || courtC < 1) throw new Error('Court count must be a positive number')
      if (isNaN(fee) || fee < 0) throw new Error('Fee must be 0 or more')
      if (isNaN(ratio) || ratio < 0 || ratio > 1) throw new Error('Late ratio must be 0–1')

      const startsAtISO    = localToPacificISO(form.starts_at)
      const deadlineISO    = localToPacificISO(form.withdraw_deadline)

      if (new Date(deadlineISO) > new Date(startsAtISO)) {
        throw new Error('Withdraw deadline must be before session start')
      }

      const { data, error: dbErr } = await supabase
        .from('sessions')
        .insert({
          title:               form.title.trim(),
          location:            form.location.trim(),
          starts_at:           startsAtISO,
          withdraw_deadline:   deadlineISO,
          max_participants:    maxP,
          court_count:         courtC,
          fee_per_person:      fee,
          late_withdraw_ratio: ratio,
          status:              'open',
          initiator_id:        user.id,
        })
        .select()
        .single() as { data: { id: string } | null; error: unknown }

      if (dbErr) throw dbErr

      router.push(`/sessions/${(data as { id: string }).id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">创建场次</h1>

        <form onSubmit={submit} className="space-y-4">

          {/* Basic */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">基本信息</h2>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">标题</label>
              <input className="input" placeholder="周五夜场羽毛球"
                value={form.title} onChange={e => set('title', e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">地点</label>
              <input className="input" placeholder="阳光谷社区中心"
                value={form.location} onChange={e => set('location', e.target.value)} required />
            </div>
          </div>

          {/* Schedule */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">
              时间 <span className="font-normal normal-case text-gray-400">（太平洋时区）</span>
            </h2>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">开始时间</label>
              <input type="datetime-local" className="input"
                value={form.starts_at}
                step={900}
                onChange={e => handleStartsAtChange(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">退出截止时间</label>
              <input type="datetime-local" className="input"
                value={form.withdraw_deadline}
                step={900}
                max={form.starts_at}
                onChange={e => set('withdraw_deadline', roundTo15(e.target.value))} />
            </div>
          </div>

          {/* Capacity */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">人数</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">场地数</label>
                <input type="number" className="input" min="1" max="20"
                  value={form.court_count}
                  onChange={e => set('court_count', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">最大人数</label>
                <input type="number" className="input" min="1" max="200"
                  value={form.max_participants}
                  onChange={e => set('max_participants', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Fee */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">费用</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">每人（$）</label>
                <input type="number" className="input" min="0" step="0.5"
                  value={form.fee_per_person}
                  onChange={e => set('fee_per_person', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">迟退违约比例（0–1）</label>
                <input type="number" className="input" min="0" max="1" step="0.1"
                  value={form.late_withdraw_ratio}
                  onChange={e => set('late_withdraw_ratio', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              比例为 1 表示迟退需支付全额费用。
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
          )}

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? '创建中…' : '创建场次'}
          </button>

        </form>
    </main>
  )
}
