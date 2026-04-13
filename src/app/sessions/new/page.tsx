'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { defaultStartsAt, defaultWithdrawDeadline, roundTo15, localToPacificISO } from '@/lib/dates'
import { PRESET_LOCATIONS } from '@/lib/locations'

const DEFAULT_NOTES = `周三6pm前只接受一位+1
之后不限量+1
+1 需标注姓名
费用：$18
10-11pm: ~$2（估算）`

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={copy}
      className="shrink-0 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500
                 hover:bg-gray-200 transition-colors font-medium">
      {copied ? '✓' : '复制'}
    </button>
  )
}

export default function NewSessionPage() {
  const router   = useRouter()
  const supabase = createClient()

  // Location state
  const [locDropOpen,    setLocDropOpen]    = useState(false)
  const [locationPreset, setLocationPreset] = useState(PRESET_LOCATIONS[0].name)
  const [isCustom,       setIsCustom]       = useState(false)
  const [customNickname, setCustomNickname] = useState('')
  const [customAddress,  setCustomAddress]  = useState('')
  const locRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (locRef.current && !locRef.current.contains(e.target as Node)) setLocDropOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selectedPreset = PRESET_LOCATIONS.find(p => p.name === locationPreset)
  const displayedAddress = isCustom ? customAddress : (selectedPreset?.address ?? '')
  const displayedName    = isCustom ? (customNickname || '自定义地点') : locationPreset

  // Form state
  const [form, setForm] = useState({
    title:             '周五菜狗',
    starts_at:         defaultStartsAt(),
    withdraw_deadline: '',
    max_participants:  '8',
    court_count:       '2',
    notes:             DEFAULT_NOTES,
  })
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const maxP   = parseInt(form.max_participants)
      const courtC = parseInt(form.court_count)
      const loc    = isCustom ? customNickname.trim() : locationPreset
      const addr   = isCustom ? (customAddress.trim() || null) : null

      if (!form.title.trim()) throw new Error('标题不能为空')
      if (!loc)               throw new Error('地点不能为空')
      if (isCustom && !customNickname.trim()) throw new Error('请输入地点昵称')
      if (isNaN(maxP)   || maxP < 1)   throw new Error('满员人数必须大于 0')
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
          location_address:  addr,
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

          {/* Location picker */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">地点</label>
            <div ref={locRef} className="relative">
              {/* Trigger button */}
              <button
                type="button"
                onClick={() => setLocDropOpen(o => !o)}
                className="input w-full flex items-center justify-between text-left"
              >
                <span className={isCustom && !customNickname ? 'text-gray-400' : ''}>
                  {displayedName}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${locDropOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
                </svg>
              </button>

              {/* Dropdown */}
              {locDropOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100
                                rounded-xl shadow-lg overflow-hidden">
                  {PRESET_LOCATIONS.map(loc => (
                    <button
                      key={loc.name}
                      type="button"
                      onMouseDown={() => {
                        setLocationPreset(loc.name)
                        setIsCustom(false)
                        setLocDropOpen(false)
                      }}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50
                        ${!isCustom && locationPreset === loc.name ? 'bg-brand-50' : ''}`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{loc.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{loc.address}</p>
                    </button>
                  ))}
                  <button
                    type="button"
                    onMouseDown={() => { setIsCustom(true); setLocDropOpen(false) }}
                    className="w-full text-left px-4 py-3 border-t border-gray-100
                               text-sm text-brand-600 font-semibold hover:bg-brand-50 transition-colors"
                  >
                    + 添加其他地点
                  </button>
                </div>
              )}
            </div>

            {/* Address row for preset */}
            {!isCustom && displayedAddress && (
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-400 flex-1 select-all leading-relaxed">
                  {displayedAddress}
                </p>
                <CopyButton text={displayedAddress} />
              </div>
            )}

            {/* Custom location inputs */}
            {isCustom && (
              <div className="mt-2 space-y-2 border border-gray-100 rounded-xl p-3">
                <input
                  className="input"
                  placeholder="地点昵称（如：菜狗村）"
                  value={customNickname}
                  onChange={e => setCustomNickname(e.target.value)}
                  required={isCustom}
                />
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="详细地址（可选）"
                    value={customAddress}
                    onChange={e => setCustomAddress(e.target.value)}
                  />
                  {customAddress && <CopyButton text={customAddress} />}
                </div>
                <button
                  type="button"
                  onClick={() => { setIsCustom(false); setCustomNickname(''); setCustomAddress('') }}
                  className="text-xs text-gray-400 underline"
                >
                  返回预设地点
                </button>
              </div>
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
              value={form.starts_at} step={900}
              onChange={e => handleStartsAtChange(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">退出截止时间</label>
            <input type="datetime-local" className="input"
              value={form.withdraw_deadline} step={900} max={form.starts_at}
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
