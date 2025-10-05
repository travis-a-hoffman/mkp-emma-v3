import { createClient } from "@supabase/supabase-js"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.SUPABASE_URL === "string" &&
  process.env.SUPABASE_URL.length > 0 &&
  typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
  process.env.SUPABASE_SERVICE_ROLE_KEY.length > 0

if (!isSupabaseConfigured) {
  console.warn("Supabase environment variables are not configured properly")
}

// We call createClient with bad values in the !isSupabaseConfigured case ratehr than
// assigning 'null' to supabase to simplify the downstream typing. If we don't take
// this approach, we have to huge amounts of messy type checking because TSC doesn't
// seem to be able to appropriately analyze this logic around isSupabaseConfigure
export const supabase = isSupabaseConfigured
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createClient("https://foobar.supabase.com/", "foobar", {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
