import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Bypassa RLS — só usar depois de checar permissão no código (getUserInfo()).
// Nunca importar este arquivo em componentes client ('use client').
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
