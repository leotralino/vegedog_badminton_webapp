'use client'

import { useState } from 'react'

const WEEKDAYS = ['周日','周一','周二','周三','周四','周五','周六']
const WEEKDAYS_SHORT = ['日','一','二','三','四','五','六']
const MONTHS   = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const MINUTES  = [0, 10, 20, 30, 40, 50]

function toLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
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

  const [calYear, setCalYear]   = useState(d.getFullYear())
  const [calMonth, setCalMonth] = useState(d.getMonth())

  function update(fn: (d: Date) => void) {
    const nd = new Date(value)
    fn(nd)
    onChange(toLocal(nd))
  }

  function selectDay(day: number) {
    update(nd => { nd.setFullYear(calYear); nd.setMonth(calMonth); nd.setDate(day) })
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  const firstDow  = new Date(calYear, calMonth, 1).getDay()
  const totalDays = daysInMonth(calYear, calMonth)
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]

  const isSelectedDay = (day: number) =>
    d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day

  const ampmClass =
    h24 >= 17 ? 'bg-blue-100 text-blue-700 active:bg-blue-200' :
    h24 >= 12 ? 'bg-orange-100 text-orange-700 active:bg-orange-200' :
                'bg-red-100 text-red-700 active:bg-red-200'

  const displayDate = `${WEEKDAYS[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`
  const displayTime = `${h12}:${String(minutes).padStart(2,'0')}${isPm ? 'pm' : 'am'}`

  return (
    <>
      <button type="button" onClick={() => { setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); setOpen(true) }}
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

            {/* Calendar */}
            <div className="space-y-2">
              {/* Month navigation */}
              <div className="flex items-center gap-2">
                <button type="button" onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 active:bg-gray-200">‹</button>
                <span className="flex-1 text-center text-sm font-semibold text-gray-900">
                  {calYear}年 {MONTHS[calMonth]}
                </span>
                <button type="button" onClick={nextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 active:bg-gray-200">›</button>
              </div>
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS_SHORT.map(w => (
                  <div key={w} className="text-center text-xs text-gray-400 py-1">{w}</div>
                ))}
              </div>
              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) =>
                  day === null ? (
                    <div key={`e-${i}`} />
                  ) : (
                    <button key={day} type="button" onClick={() => selectDay(day)}
                      className={`py-1.5 rounded-lg text-sm font-medium transition-colors
                        ${isSelectedDay(day)
                          ? 'bg-brand-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'}`}>
                      {day}
                    </button>
                  )
                )}
              </div>
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
                className={`ml-1 px-3 py-1.5 rounded-xl text-sm font-bold w-14 text-center transition-colors ${ampmClass}`}>
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
