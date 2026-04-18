/**
 * Run once to create all 20 test users in Supabase.
 * Usage: npx tsx tests/seed-users.ts
 */
import { createClient } from '@supabase/supabase-js'
import { TEST_USERS } from './test-users'
import fs from 'fs'
import path from 'path'

// Load .env.local manually (tsx doesn't forward --env-file to Node)
const envPath = path.resolve(process.cwd(), '.env.local')
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
})
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
})

async function seed() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  console.log(`Seeding ${TEST_USERS.length} test users...\n`)

  for (const user of TEST_USERS) {
    // Create auth user (skip if already exists)
    const { data, error } = await supabase.auth.admin.createUser({
      email:            user.email,
      password:         user.password,
      email_confirm:    true,
    })

    if (error && !error.message.includes('already been registered')) {
      console.error(`✗ ${user.email}: ${error.message}`)
      continue
    }

    const userId = data?.user?.id
    if (!userId) {
      // User already exists — look up their ID
      const { data: existing } = await supabase.auth.admin.listUsers()
      const found = existing?.users.find(u => u.email === user.email)
      if (!found) { console.error(`✗ ${user.email}: could not find user`); continue }

      await supabase.from('profiles').upsert({
        id:             found.id,
        nickname:       user.nickname,
        venmo_username: user.venmo,
        updated_at:     new Date().toISOString(),
      })
      console.log(`~ ${user.email} (already existed, profile updated)`)
      continue
    }

    await supabase.from('profiles').upsert({
      id:             userId,
      nickname:       user.nickname,
      venmo_username: user.venmo,
      updated_at:     new Date().toISOString(),
    })

    console.log(`✓ ${user.email} → ${user.nickname}${user.venmo ? ` (@${user.venmo})` : ''}`)
  }

  console.log('\nDone.')
}

seed().catch(console.error)
