// scripts/lib/supabase.ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// GitHub Actions 환경과 로컬 개발 환경 모두 지원
const SUPABASE_URL = (
  process.env.SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL
)?.trim()

const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE?.trim()

// 환경별 에러 메시지 개선
if (!SUPABASE_URL) {
  console.error('Environment variables available:', {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI
  })
  throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL environment variable')
}

if (!SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_SERVICE_ROLE environment variable')
  throw new Error('Missing SUPABASE_SERVICE_ROLE environment variable')
}

console.log('✅ Supabase client initialized successfully')
export const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
