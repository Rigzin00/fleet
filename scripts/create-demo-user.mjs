// Creates (or resets) the demo login in Supabase Auth.
//
//   npm run create-demo-user
//
// Reads from .env:  VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-only; never prefix with VITE_),
// and optionally VITE_DEMO_EMAIL / VITE_DEMO_PASSWORD (defaults below).
// You can do the same thing by hand in the dashboard: Authentication → Users → Add user (tick "Auto Confirm User").

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.VITE_DEMO_EMAIL || 'demo@fleetwatch.app'
const password = process.env.VITE_DEMO_PASSWORD || 'fleetwatch-demo'

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError
const existing = list.users.find((u) => u.email === email)

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
  if (error) throw error
  console.log(`Updated password for existing user ${email}`)
} else {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  console.log(`Created user ${email}`)
}
