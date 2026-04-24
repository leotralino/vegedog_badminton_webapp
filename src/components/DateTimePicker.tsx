'use client'

import { useState } from 'react'

const WEEKDAYS = ['周日','周一','周二','周三','周四','周五','周六']
const MONTHS   = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const MINUTES  = [0, 10, 20, 30, 40, 50]

function toLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

interface Props {
  value: string        // YYYY-MM-DDTHH:mm (local time)
  onChange: (v: string) => void
  label: string
}

export default function DateTimePicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false)

  const d       = new Date(value)
  const h24     = d.getHours()
  const h12     = h24 % 12 || 12
  const isPm    = h24 >= 12
  const minutes = d.getMinutes()

  function update(fn: (d: Date) => void) {
    const nd = new Date(value)
    fn(nd)
    onChange(toLocal(nd))
  }

  const displayDate = `${WEEKDAYS[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`
  const displayTime = `${h12}:${String(minutes).padStart(2,'0')}${isPm ? 'pm' : 'am'}`

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="input text-left flex items-center justify-between gap-2">
        <span className="text-gray-700">{displayDate}</span>
        <span className="text-brand-600 font-semibold shrink-0">{displayTime}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-t-2xl shadow-2xl p-5 space-y-4"
               style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>

            {/* Date */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">日</span>
              <button type="button" onClick={() => update(d => d.setDate(d.getDate() - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg active:bg-gray-200">‹</button>
              <span className="flex-1 text-center text-sm font-semibold text-gray-900">
                {WEEKDAYS[d.getDay()]}，{MONTHS[d.getMonth()]} {d.getDate()}
              </span>
              <button type="button" onClick={() => update(d => d.setDate(d.getDate() + 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg active:bg-gray-200">›</button>
            </div>

            {/* Hour + AM/PM */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">时</span>
              <button type="button" onClick={() => update(d => d.setHours((h24 - 1 + 24) % 24))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg active:bg-gray-200">‹</button>
              <span className="flex-1 text-center text-2xl font-bold text-gray-900">{h12}</span>
              <button type="button" onClick={() => update(d => d.setHours((h24 + 1) % 24))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg active:bg-gray-200">›</button>
              <button type="button" onClick={() => update(d => d.setHours(isPm ? h24 - 12 : h24 + 12))}
                className="ml-1 px-3 py-1.5 rounded-xl bg-brand-100 text-brand-700 text-sm font-bold active:bg-brand-200 w-14 text-center">
                {isPm ? 'PM' : 'AM'}
              </button>
            </div>

            {/* Minutes */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">分</span>
              <div className="flex-1 grid grid-cols-6 gap-1.5">
                {MINUTES.map(m => (
                  <button key={m} type="button" onClick={() => update(d => d.setMinutes(m))}
                    className={`py-2 rounded-xl text-sm font-semibold transition-colors
                      ${minutes === m
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 active:bg-gray-200'}`}>
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" onClick={() => setOpen(false)}
              className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold active:opacity-80 transition-opacity">
              确认
            </button>
          </div>
        </div>
      )}
    </>
  )
}
