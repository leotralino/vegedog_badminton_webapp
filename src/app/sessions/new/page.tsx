'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { defaultStartsAt, defaultWithdrawDeadline, roundTo15, localToPacificISO } from '@/lib/dates'

const PRESET_LOCATIONS = [
  { name: 'CBA (Synergy Mission)',  address: '46049 Warm Springs Blvd, Fremont, CA 94539' },
  { name: 'Synergy Menlo Park',     address: '190 Constitution Dr, Menlo Park, CA 94025' },
  { name: 'Happy Birdie Fremont',   address: '43921 Boscell Rd, Fremont, CA 94538' },
  { name: 'Canam',                  address: '691 Race St, San Jose, CA 95126' },
]

const DEFAULT_NOTES = `周三6pm前只接受一位+1
之后不限量+1
+1 需标注姓名
费用：$18
10-11pm: ~$2（估算）`

export default function NewSessionPage() {
  const router  = useRouter()
  const supabase = createClient()

  // Location state
  const [locationPreset, setLocationPreset] = useState(PRESET_LOCATIONS[0].name)
  const [customLocation, setCustomLocation] = useState('')
  const [showCustom, setShowCustom]         = useState(false)

  const [form, setForm] = useState({
    title:             '周五菜狗',
    starts_at:         defaultStartsAt(),
    withdraw_deadline: '',
    max_participants:  '8',
    court_count:       '2',
    notes:             DEFAULT_NOTES,
  })
  // Set default withdraw_deadline after starts_at is known
  useState(() => {
    setForm(f => ({ ...f, withdraw_deadline: defaultWithdrawDeadline(f.starts_at) }))
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleStartsAtChange(value: string) {
    const rounded = roundTo15(value)
    set('starts_at', rounded)
    set('withdraw_deadline', defaultWithdrawDeadline(rounded))
  }

  // Resolve the final location string
  function resolvedLocation() {
    if (showCustom) return customLocation.trim()
    return locationPreset
  }

  const selectedPreset = PRESET_LOCATIONS.find(p => p.name === locationPreset)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const maxP   = parseInt(form.max_participants)
      const courtC = parseInt(form.court_count)
      const loc    = resolvedLocation()

      if (!form.title.trim()) throw new Error('标题不能为空')
      if (!loc)               throw new Error('地点不能为空')
      if (isNaN(maxP)  || maxP < 1)   throw new Error('满员人数必须大于 0')
      if (isNaN(courtC) || courtC < 1) throw new Error('场地数必须大于 0')

      const startsAtISO = localToPacificISO(form.starts_at)
      const deadlineISO = localToPacificISO(form.withdraw_deadline)

      if (new Date(deadlineISO) > new Date(startsAtISO)) {
        throw new Error('退出截止时间必须早于开始时间')
      }

      const { data, error: dbErr } = await supabase
        .from('sessions')
        .insert({
          title:             form.title.trim(),
          location:          loc,
          starts_at:         startsAtISO,
          withdraw_deadline: deadlineISO,
          max_participants:  maxP,
          court_count:       courtC,
          notes:             form.notes.trim() || null,
          status:            'open',
          initiator_id:      user.id,
        })
        .select()
        .single() as { data: { id: string } | null; error: unknown }

      if (dbErr) throw dbErr

      router.push(`/sessions/${(data as { id: string }).id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '出现错误，请重试')
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
              <input className="input" placeholder="周五菜狗"
                value={form.title} onChange={e => set('title', e.target.value)} required />
            </div>

            {/* Location */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">地点</label>
              {!showCustom ? (
                <>
                  <select
                    className="input"
                    value={locationPreset}
                    onChange={e => setLocationPreset(e.target.value)}
                  >
                    {PRESET_LOCATIONS.map(loc => (
                      <option key={loc.name} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                  {selectedPreset && (
                    <p
                      className="mt-1.5 text-xs text-gray-400 select-all cursor-text"
                      title="点击选中全部复制"
                    >
                      📍 {selectedPreset.address}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCustom(true)}
                    className="mt-2 text-xs text-brand-600 font-semibold"
                  >
                    + 添加其他地点
                  </button>
                </>
              ) : (
                <>
                  <input
                    className="input"
                    placeholder="自定义地点名称"
                    value={customLocation}
                    onChange={e => setCustomLocation(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => { setShowCustom(false); setCustomLocation('') }}
                    className="mt-2 text-xs text-gray-400 underline"
                  >
                    返回预设地点
                  </button>
                </>
              )}
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
                <label className="text-sm font-medium text-gray-700 mb-1 block">满员</label>
                <input type="number" className="input" min="1" max="200"
                  value={form.max_participants}
                  onChange={e => set('max_participants', e.target.value)} />
              </div>
            </div>
          </div>

          {/* 细节 */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">细节</h2>
            <textarea
              className="input min-h-[120px] resize-y"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="费用、规则、注意事项等…"
            />
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
