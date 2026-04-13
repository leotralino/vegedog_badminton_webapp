'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6)        { setError('密码至少需要 6 位'); return }
    if (password !== password2)     { setError('两次密码不一致'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) setError(error.message)
    else router.push('/sessions')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12
                     bg-gradient-to-br from-brand-50 to-white">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="text-6xl">🔑</div>
          <h1 className="text-2xl font-bold text-gray-900">设置新密码</h1>
        </div>

        <div className="card">
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password" className="input" placeholder="新密码"
              value={password} onChange={e => setPassword(e.target.value)} required
            />
            <input
              type="password" className="input" placeholder="确认密码"
              value={password2} onChange={e => setPassword2(e.target.value)} required
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? '保存中…' : '设置密码'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
