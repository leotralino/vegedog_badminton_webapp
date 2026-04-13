'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  loggedIn: boolean
  avatarSrc: string
}

export default function NavbarActions({ loggedIn, avatarSrc }: Props) {
  const pathname = usePathname()
  const onNewPage = pathname === '/sessions/new'

  if (!loggedIn) {
    return (
      <Link href="/login"
        className="text-sm font-semibold text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg">
        登录
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {!onNewPage && (
        <Link href="/sessions/new"
          className="text-sm font-semibold text-white bg-brand-600 px-3 py-1.5 rounded-lg
                     active:bg-brand-700 transition-colors">
          + 发起接龙
        </Link>
      )}
      <Link href="/settings" className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarSrc} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-100" />
      </Link>
    </div>
  )
}
