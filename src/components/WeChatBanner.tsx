'use client'

import { useEffect, useState } from 'react'

export default function WeChatBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (/MicroMessenger/i.test(navigator.userAgent)) setShow(true)
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
        <p className="text-4xl">🌐</p>
        <h2 className="text-lg font-bold text-gray-900">请在浏览器中打开</h2>
        <p className="text-sm text-gray-600">
          微信内置浏览器不支持本应用的部分功能。
        </p>
        <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3">
          点击右上角 <strong>···</strong> → 选择 <strong>在浏览器中打开</strong>
        </p>
      </div>
    </div>
  )
}
