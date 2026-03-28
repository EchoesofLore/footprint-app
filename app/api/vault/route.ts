import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuth } from "@clerk/nextjs/server";

const TABLE = "vaults"; // ✅ change if your table name differs

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRole);

export async function GET(req: Request) {
  const { userId } = getAuth(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("vault")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    vault: data?.vault ?? null,
    userId,
  });
}

export async function POST(req: Request) {
  const { userId } = getAuth(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Accept either key name:
  // - body.vault
  // - body.encryptedVault (extension naming)
  const vault = body?.vault ?? body?.encryptedVault ?? null;

  if (!vault) {
    return NextResponse.json({ error: "Missing vault payload" }, { status: 400 });
  }

  const { error: upsertError } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, vault },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
