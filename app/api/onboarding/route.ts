import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createSupabaseUserClient } from "@/lib/supabaseUser"

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "No session token" }, { status: 401 })

  const supabase = createSupabaseUserClient(token)
  const { data, error } = await supabase
    .from("user_onboarding")
    .select("services")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    completed: !!data,
    services: (data?.services as string[]) ?? [],
  })
}

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "No session token" }, { status: 401 })

  let body: { services?: string[] } | null = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const services: string[] = body?.services ?? []
  const supabase = createSupabaseUserClient(token)
  const { error } = await supabase
    .from("user_onboarding")
    .upsert(
      { user_id: userId, services, completed_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
