import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const schema = import.meta.env.VITE_DB_SCHEMA

if (!url || !anonKey || !schema) {
  throw new Error(
    'Missing Supabase env vars — check VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_DB_SCHEMA in .env'
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  db: { schema },
})
