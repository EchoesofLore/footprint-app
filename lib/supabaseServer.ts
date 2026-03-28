import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side only client (do NOT use this in client components)
export const supabaseServer = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
