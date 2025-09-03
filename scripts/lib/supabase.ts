// scripts/lib/supabase.ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL?.trim()
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE?.trim()
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
if (!SUPABASE_SERVICE_ROLE) throw new Error('Missing SUPABASE_SERVICE_ROLE')

export const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
