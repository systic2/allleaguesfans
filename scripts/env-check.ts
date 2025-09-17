// scripts/env-check.ts
// GitHub Actions 환경 변수 검증 스크립트

import 'dotenv/config'

interface EnvCheckResult {
  name: string;
  value: string | undefined;
  required: boolean;
  status: 'ok' | 'missing' | 'empty';
  masked?: boolean;
}

function checkEnvironmentVariables(): EnvCheckResult[] {
  const envVars: Omit<EnvCheckResult, 'status'>[] = [
    { name: 'SUPABASE_URL', value: process.env.SUPABASE_URL, required: true },
    { name: 'VITE_SUPABASE_URL', value: process.env.VITE_SUPABASE_URL, required: false },
    { name: 'SUPABASE_SERVICE_ROLE', value: process.env.SUPABASE_SERVICE_ROLE, required: true, masked: true },
    { name: 'VITE_SUPABASE_ANON_KEY', value: process.env.VITE_SUPABASE_ANON_KEY, required: false, masked: true },
    { name: 'API_FOOTBALL_KEY', value: process.env.API_FOOTBALL_KEY, required: true, masked: true },
    { name: 'SEASON_YEAR', value: process.env.SEASON_YEAR, required: false },
    { name: 'NODE_ENV', value: process.env.NODE_ENV, required: false },
    { name: 'CI', value: process.env.CI, required: false }
  ]

  return envVars.map(env => {
    let status: EnvCheckResult['status']
    if (!env.value) {
      status = 'missing'
    } else if (env.value.trim() === '') {
      status = 'empty'
    } else {
      status = 'ok'
    }

    return {
      ...env,
      status
    }
  })
}

function displayResults(results: EnvCheckResult[]) {
  console.log('🔍 Environment Variables Check')
  console.log('='.repeat(50))

  results.forEach(result => {
    const icon = result.status === 'ok' ? '✅' : '❌'
    const displayValue = result.masked && result.value 
      ? `${result.value.substring(0, 8)}...` 
      : result.value || 'undefined'
    
    const requiredText = result.required ? '(Required)' : '(Optional)'
    
    console.log(`${icon} ${result.name} ${requiredText}:`, displayValue)
  })

  console.log('\n📊 Summary:')
  const total = results.length
  const ok = results.filter(r => r.status === 'ok').length
  const missing = results.filter(r => r.status === 'missing').length
  const empty = results.filter(r => r.status === 'empty').length
  const requiredMissing = results.filter(r => r.required && r.status !== 'ok').length

  console.log(`Total variables: ${total}`)
  console.log(`✅ OK: ${ok}`)
  console.log(`❌ Missing: ${missing}`)
  console.log(`⚠️ Empty: ${empty}`)
  console.log(`🚨 Required missing: ${requiredMissing}`)

  return requiredMissing === 0
}

function checkSupabaseConnection() {
  console.log('\n🔗 Supabase Connection Check:')
  
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE

  if (!supabaseUrl) {
    console.log('❌ No Supabase URL found (SUPABASE_URL or VITE_SUPABASE_URL)')
    return false
  }

  if (!serviceRole) {
    console.log('❌ No Supabase Service Role found')
    return false
  }

  console.log('✅ Supabase URL:', supabaseUrl.substring(0, 30) + '...')
  console.log('✅ Service Role:', serviceRole.substring(0, 10) + '...')
  
  return true
}

function main() {
  console.log('🚀 GitHub Actions Environment Check\n')
  
  const results = checkEnvironmentVariables()
  const envOk = displayResults(results)
  const supabaseOk = checkSupabaseConnection()

  console.log('\n' + '='.repeat(50))
  
  if (envOk && supabaseOk) {
    console.log('🎉 All environment variables are properly configured!')
    process.exit(0)
  } else {
    console.log('❌ Environment configuration issues detected!')
    console.log('Please check your GitHub repository secrets.')
    process.exit(1)
  }
}

main()