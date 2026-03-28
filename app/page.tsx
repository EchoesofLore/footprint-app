import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { SignInButton } from "@clerk/nextjs"
import { supabaseServer } from "@/lib/supabaseServer"

export default async function Home() {
  const { userId } = await auth()

  if (userId) {
    const { data } = await supabaseServer
      .from("user_onboarding")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()

    redirect(data ? "/dashboard" : "/onboarding")
  }

  return (
    <main style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Footprint</h1>
      <p>Your secure password manager.</p>
      <div style={{ marginTop: 20 }}>
        <SignInButton mode="modal">
          <button style={{ padding: "10px 14px", cursor: "pointer" }}>
            Sign in
          </button>
        </SignInButton>
      </div>
    </main>
  )
}
