import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  let cookieStore: any = null
  try {
    cookieStore = await cookies()
  } catch {
    // Non-request context
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-domain.supabase.co"
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore ? cookieStore.getAll() : []
      },
      setAll(cookiesToSet) {
        try {
          if (cookieStore) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          }
        } catch {
          // Ignored in Server Components
        }
      },
    },
  })
}
