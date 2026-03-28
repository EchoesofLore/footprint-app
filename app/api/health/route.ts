import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    has_clerk_publishable: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    has_clerk_secret: !!process.env.CLERK_SECRET_KEY,
    has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_supabase_service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
