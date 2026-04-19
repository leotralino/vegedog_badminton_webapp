/**
 * k6 load test — 200 concurrent users across 10 sessions
 *
 * Run:
 *   npx tsx tests/load/setup.ts        # creates fixtures.json
 *   k6 run tests/load/join-stress.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

const f            = JSON.parse(open('./fixtures.json'))
const SUPABASE_URL = f.supabaseUrl
const ANON_KEY     = f.anonKey
const SESSIONS     = f.sessions   // [{ id, max }, ...]
const TOKENS       = f.tokens

// ── Custom metrics ────────────────────────────────────────────────────────────
const joinedCount  = new Counter('joined_count')
const waitlisted   = new Counter('waitlisted_count')
const dupRejected  = new Counter('duplicate_rejections')
const rpcErrors    = new Counter('rpc_errors')
const rpcDuration  = new Trend('rpc_duration_ms', true)
const successRate  = new Rate('success_rate')

// ── Test config: ramp to 200 VUs, hold 2 min ─────────────────────────────────
export const options = {
  scenarios: {
    multi_session_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },
        { duration: '2m',  target: 200 },
        { duration: '15s', target: 0   },
      ],
    },
  },
  thresholds: {
    rpc_duration_ms:  ['p(95)<3000'],
    success_rate:     ['rate>0.9'],
    http_req_failed:  ['rate<0.05'],
  },
}

function tokenFor(vu)    { return TOKENS[vu % TOKENS.length] }
function sessionFor(vu)  { return SESSIONS[vu % SESSIONS.length] }
function headers(token)  {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey':        ANON_KEY,
  }
}

// ── Main VU loop ──────────────────────────────────────────────────────────────
export default function () {
  const token   = tokenFor(__VU - 1)
  const session = sessionFor(__VU - 1)
  const name    = `k6_vu${__VU}_i${__ITER}`

  const start = Date.now()
  const res = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/join_session`,
    JSON.stringify({
      p_session_id:   session.id,
      p_user_id:      getUserId(token),
      p_display_name: name,
    }),
    { headers: headers(token), timeout: '10s' }
  )
  rpcDuration.add(Date.now() - start)

  const ok = check(res, { 'status 200': r => r.status === 200 })

  if (res.status === 200) {
    successRate.add(1)
    try {
      const body = JSON.parse(res.body)
      if (body.status === 'joined')   joinedCount.add(1)
      if (body.status === 'waitlist') waitlisted.add(1)
    } catch (_) {}
  } else {
    successRate.add(0)
    const body = res.body ?? ''
    if (body.includes('already have an active entry')) dupRejected.add(1)
    else { rpcErrors.add(1); console.error(`VU${__VU} s=${session.id.slice(0,8)}: ${res.status} ${body.slice(0,100)}`) }
  }

  sleep(0.5)
}

// ── Teardown: verify no session exceeded its cap ──────────────────────────────
export function teardown() {
  console.log('\n── Teardown ──────────────────────────────────────────')
  let allGood = true
  for (const s of SESSIONS) {
    const res = http.get(
      `${SUPABASE_URL}/rest/v1/participants?session_id=eq.${s.id}&status=eq.joined&select=id`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${TOKENS[0]}` } }
    )
    if (res.status !== 200) { console.log(`  ? ${s.id.slice(0,8)}: could not query`); continue }
    const count = JSON.parse(res.body).length
    const ok    = count <= s.max
    if (!ok) allGood = false
    console.log(`  ${ok ? '✓' : '✗'} session ${s.id.slice(0,8)}  joined=${count}  cap=${s.max}  ${ok ? 'OK' : 'OVERCOUNTED!'}`)
  }
  console.log(allGood ? '\n  ✓ Lock held on all sessions' : '\n  ✗ OVERCOUNTING DETECTED')
}

function getUserId(token) {
  try {
    const payload = token.split('.')[1]
    const padded  = payload + '='.repeat((4 - payload.length % 4) % 4)
    const b64     = padded.replace(/-/g, '+').replace(/_/g, '/')
    try { return JSON.parse(atob(b64)).sub } catch (_) {}
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    let result = ''
    for (let i = 0; i < b64.length; i += 4) {
      const a = chars.indexOf(b64[i]),   b = chars.indexOf(b64[i+1])
      const c = chars.indexOf(b64[i+2]), d = chars.indexOf(b64[i+3])
      result += String.fromCharCode((a << 2) | (b >> 4))
      if (b64[i+2] !== '=') result += String.fromCharCode(((b & 15) << 4) | (c >> 2))
      if (b64[i+3] !== '=') result += String.fromCharCode(((c & 3) << 6) | d)
    }
    return JSON.parse(result).sub
  } catch (_) { return 'unknown' }
}
