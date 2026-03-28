import { NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { supabaseServer } from "@/lib/supabaseServer"

// Run this SQL in Supabase before using this route:
//
// CREATE TABLE user_onboarding (
//   user_id      TEXT        PRIMARY KEY,
//   services     JSONB       NOT NULL DEFAULT '[]',
//   completed_at TIMESTAMPTZ DEFAULT now()
// );

export async function GET(req: Request) {
  const { userId } = getAuth(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabaseServer
    .from("user_onboarding")
    .select("services")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    completed: !!data,
    services: (data?.services as string[]) ?? [],
  })
}

export async function POST(req: Request) {
  const { userId } = getAuth(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { services?: string[] } | null = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const services: string[] = body?.services ?? []

  const { error } = await supabaseServer
    .from("user_onboarding")
    .upsert(
      { user_id: userId, services, completed_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
