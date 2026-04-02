import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Admin-only client — bypasses RLS. Do NOT use for user-owned data.
// Reserved for future privileged server operations only.
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
})
