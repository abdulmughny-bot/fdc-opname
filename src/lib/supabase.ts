import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const schema = import.meta.env.VITE_DB_SCHEMA

if (!url || !anonKey || !schema) {
  throw new Error(
    'Missing Supabase env vars — check VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_DB_SCHEMA in .env'
  )
}

// dev/staging/prod share one identical shape (FdcSchema in types/database.ts).
// Pinning the client's type param to 'dev' is a type-level fiction only —
// .from()/.rpc() need ONE concrete schema key to resolve table/function
// types against, and all three resolve identically. The actual runtime
// schema below is still the real dev/staging/prod value from the env.
export const supabase: SupabaseClient<Database, 'dev', 'dev'> = createClient(url, anonKey, {
  db: { schema: schema as 'dev' },
})
