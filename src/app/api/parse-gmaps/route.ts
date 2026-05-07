import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url || !/^https?:\/\/(maps\.app\.goo\.gl|www\.google\.com\/maps)/.test(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        // Mobile UA gives lighter HTML with more complete meta tags
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })

    const html = await res.text()
    const finalUrl = res.url

    const result: { name?: string; address?: string; hours?: string } = {}

    // 1. Name from <title> — usually "Restaurant Name - Google Maps"
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch?.[1]) {
      result.name = titleMatch[1]
        .replace(/\s*[-–—]\s*Google Maps\s*$/i, '')
        .replace(/\s*\|[^|]*$/, '')
        .trim()
    }

    // 2. Name from URL path as fallback (works for desktop-style URLs)
    const pathMatch = finalUrl.match(/\/maps\/place\/([^/@?&#]+)/)
    if (pathMatch && (!result.name || result.name.length < 2)) {
      result.name = decodeURIComponent(pathMatch[1].replace(/\+/g, ' ')).trim()
    }

    // 3. JSON-LD structured data — most reliable for address + hours
    const jsonLdRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let m: RegExpExecArray | null
    while ((m = jsonLdRe.exec(html)) !== null) {
      try {
        const ld = JSON.parse(m[1])
        const items: Record<string, unknown>[] = Array.isArray(ld) ? ld : [ld]
        const BUSINESS_TYPES = new Set(['LocalBusiness', 'Restaurant', 'FoodEstablishment', 'CafeOrCoffeeShop', 'BarOrPub', 'Bakery', 'IceCreamShop'])
        for (const item of items) {
          if (!BUSINESS_TYPES.has(item['@type'] as string)) continue
          if (!result.name && item.name) result.name = String(item.name)
          if (item.address) {
            const a = item.address as Record<string, string>
            result.address = typeof a === 'string'
              ? a
              : [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', ')
          }
          if (item.openingHoursSpecification) {
            const specs = Array.isArray(item.openingHoursSpecification)
              ? item.openingHoursSpecification
              : [item.openingHoursSpecification]
            const DAY_SHORT: Record<string, string> = {
              'https://schema.org/Monday': 'Mon', 'https://schema.org/Tuesday': 'Tue',
              'https://schema.org/Wednesday': 'Wed', 'https://schema.org/Thursday': 'Thu',
              'https://schema.org/Friday': 'Fri', 'https://schema.org/Saturday': 'Sat',
              'https://schema.org/Sunday': 'Sun',
            }
            result.hours = specs.map((s: Record<string, unknown>) => {
              const days = (Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek])
                .map((d: unknown) => DAY_SHORT[String(d)] ?? String(d).replace('https://schema.org/', ''))
                .join('/')
              return `${days} ${s.opens ?? ''}–${s.closes ?? ''}`
            }).join(', ')
          } else if (item.openingHours) {
            result.hours = Array.isArray(item.openingHours)
              ? (item.openingHours as string[]).join(', ')
              : String(item.openingHours)
          }
          break
        }
      } catch {}
    }

    // 4. og:description fallback for address when JSON-LD didn't have it
    if (!result.address) {
      const descRe = /<meta[^>]+(?:property=["']og:description["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*property=["']og:description["'])/i
      const descMatch = html.match(descRe)
      const desc = (descMatch?.[1] ?? descMatch?.[2] ?? '').replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
      if (desc) {
        const parts = desc.split(/[·•]/).map((s: string) => s.trim()).filter(Boolean)
        const addrPart = parts.find((p: string) =>
          /\d/.test(p) &&
          /\s(St|Ave|Blvd|Dr|Rd|Way|Ln|Ct|Pl|Pkwy|Hwy|Cir|Loop|Sq)[\s,.]/i.test(p)
        )
        if (addrPart) result.address = addrPart
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[parse-gmaps]', err)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
