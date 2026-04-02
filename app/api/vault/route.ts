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
    .from("vaults")
    .select("vault")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    vault: data?.vault ?? null,
    userId,
  })
}

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "No session token" }, { status: 401 })

  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const vault = body?.vault ?? body?.encryptedVault ?? null
  if (!vault) return NextResponse.json({ error: "Missing vault payload" }, { status: 400 })

  const supabase = createSupabaseUserClient(token)
  const { error } = await supabase
    .from("vaults")
    .upsert({ user_id: userId, vault }, { onConflict: "user_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
