'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function LoginForm() {
  const supabase = createClient()
  const router   = useRouter()
  const params   = useSearchParams()
  const next     = params.get('next') ?? '/sessions'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [mode,     setMode]     = useState<'password' | 'magic'>('password')
  const [sent,     setSent]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) setError(error.message)
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (error) setError(error.message)
    else router.push(next)
  }

  async function signInWithMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center space-y-3">
        <div className="text-4xl">📬</div>
        <p className="font-semibold text-gray-900">查看邮箱</p>
        <p className="text-sm text-gray-500">
          我们已向 <strong>{email}</strong> 发送了登录链接。<br />
          点击链接即可登录，无需密码。
        </p>
        <button onClick={() => setSent(false)} className="text-sm text-brand-600 underline">
          换一个邮箱
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl
                   border border-gray-200 bg-white font-semibold text-gray-700
                   active:bg-gray-50 transition-colors shadow-sm"
      >
        <GoogleIcon />
        使用 Google 登录
      </button>

      <div className="flex items-center gap-3">
        <hr className="flex-1 border-gray-200" />
        <span className="text-xs text-gray-400">或</span>
        <hr className="flex-1 border-gray-200" />
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm font-semibold">
        <button
          onClick={() => setMode('password')}
          className={`flex-1 py-2 transition-colors ${mode === 'password' ? 'bg-brand-600 text-white' : 'bg-white text-gray-500'}`}
        >
          密码登录
        </button>
        <button
          onClick={() => setMode('magic')}
          className={`flex-1 py-2 transition-colors ${mode === 'magic' ? 'bg-brand-600 text-white' : 'bg-white text-gray-500'}`}
        >
          邮件链接
        </button>
      </div>

      {mode === 'password' ? (
        <form onSubmit={signInWithPassword} className="space-y-3">
          <input
            type="email" className="input" placeholder="your@email.com"
            value={email} onChange={e => setEmail(e.target.value)} required
          />
          <input
            type="password" className="input" placeholder="密码"
            value={password} onChange={e => setPassword(e.target.value)} required
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      ) : (
        <form onSubmit={signInWithMagicLink} className="space-y-3">
          <input
            type="email" className="input" placeholder="your@email.com"
            value={email} onChange={e => setEmail(e.target.value)} required
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '发送中…' : '发送登录链接'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12
                     bg-gradient-to-br from-brand-50 to-white">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dog_main.png" alt="菜狗" className="w-64 h-64 object-contain mx-auto" />
          <p className="text-2xl font-semibold text-gray-700">羽毛球接龙</p>
        </div>

        <div className="card">
          <Suspense fallback={<div className="h-32 animate-pulse bg-gray-100 rounded-xl" />}>
            <LoginForm />
          </Suspense>
        </div>

      </div>
    </main>
  )
}
