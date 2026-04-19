/**
 * Run before k6: authenticates all test users and creates a fresh load-test session.
 * Writes tests/load/fixtures.json which the k6 script reads.
 *
 * Usage: npx tsx tests/load/setup.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local')
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
})

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TEST_PASSWORD   = 'Vegdog123!'
const MAX_USERS       = 20
const SESSION_COUNT   = 10
const MIN_CAP         = 20
const MAX_CAP         = 80

function randCap() {
  return MIN_CAP + Math.floor(Math.random() * (MAX_CAP - MIN_CAP + 1))
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Authenticate all test users and collect tokens ────────────────────────
  console.log('Authenticating test users…')
  const { data: { users } } = await admin.auth.admin.listUsers()
  const testUsers = users.filter(u => u.email?.startsWith('test__'))

  const tokens: string[] = []
  for (const u of testUsers.slice(0, MAX_USERS)) {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await anon.auth.signInWithPassword({
      email: u.email!, password: TEST_PASSWORD,
    })
    if (error || !data.session) {
      console.warn(`  ✗ ${u.email}: ${error?.message}`)
      continue
    }
    tokens.push(data.session.access_token)
    console.log(`  ✓ ${u.email}`)
    // Avoid Supabase auth rate limit (10 req/min on free plan)
    await new Promise(r => setTimeout(r, 700))
  }

  // ── Create SESSION_COUNT sessions with random caps ────────────────────────
  console.log(`\nCreating ${SESSION_COUNT} load-test sessions…`)
  const { data: { users: adminUsers } } = await admin.auth.admin.listUsers()
  const initiator = adminUsers.find(u => u.email === 'test__corgi_driver@gmail.com')!

  const sessionTime  = new Date(Date.now() + 4 * 3_600_000).toISOString()
  const deadlineTime = new Date(Date.now() + 2 * 3_600_000).toISOString()

  const sessions: { id: string; max: number }[] = []
  for (let i = 0; i < SESSION_COUNT; i++) {
    const cap = randCap()
    const { data: s, error } = await admin
      .from('sessions')
      .insert({
        title:             `k6 Load Test #${i + 1} (cap ${cap})`,
        location:          'CBA (Synergy Mission)',
        starts_at:         sessionTime,
        withdraw_deadline: deadlineTime,
        court_count:       4,
        max_participants:  cap,
        initiator_id:      initiator.id,
        status:            'open',
      })
      .select('id')
      .single()

    if (error) { console.error(`Failed to create session ${i + 1}:`, error.message); process.exit(1) }
    await admin.from('session_admins').insert({ session_id: s.id, user_id: initiator.id })
    sessions.push({ id: s.id, max: cap })
    console.log(`  ✓ Session ${i + 1}: ${s.id}  cap=${cap}`)
  }

  const fixtures = {
    supabaseUrl: SUPABASE_URL,
    anonKey:     ANON_KEY,
    sessions,
    tokens,
  }

  const out = path.join(process.cwd(), 'tests/load/fixtures.json')
  fs.writeFileSync(out, JSON.stringify(fixtures, null, 2))
  console.log(`\n✓ Sessions: ${sessions.length}`)
  console.log(`✓ Tokens:   ${tokens.length}`)
  console.log(`✓ Written:  ${out}`)
}

main().catch(e => { console.error(e); process.exit(1) })
