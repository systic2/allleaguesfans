// scripts/monitoring.ts - 데이터 동기화 모니터링 및 알림
import 'dotenv/config'
import { supa } from './lib/supabase'

interface SyncStatus {
  timestamp: string
  status: 'success' | 'warning' | 'error'
  message: string
  details: Record<string, any>
}

interface DataHealthCheck {
  table: string
  current_count: number
  expected_min: number
  last_updated: string | null
  status: 'healthy' | 'warning' | 'critical'
}

async function checkDataHealth(): Promise<DataHealthCheck[]> {
  const checks: DataHealthCheck[] = []
  
  // Define expected minimum counts for each table
  const expectedCounts = {
    leagues: 2,
    seasons: 4,
    teams: 20,
    players: 1000,
    squad_memberships: 2000,
    fixtures: 100, // May be 0 for current season
    standings: 20
  }
  
  for (const [tableName, expectedMin] of Object.entries(expectedCounts)) {
    try {
      const { count, error } = await supa
        .from(tableName)
        .select('*', { count: 'exact', head: true })
      
      if (error) throw error
      
      // Get last update time if available
      let lastUpdated = null
      try {
        const { data: lastRecord } = await supa
          .from(tableName)
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()
        
        lastUpdated = lastRecord?.updated_at
      } catch {
        // Some tables may not have updated_at field
      }
      
      const currentCount = count || 0
      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      
      if (currentCount === 0 && expectedMin > 0) {
        status = 'critical'
      } else if (currentCount < expectedMin * 0.8) {
        status = 'warning'
      }
      
      checks.push({
        table: tableName,
        current_count: currentCount,
        expected_min: expectedMin,
        last_updated: lastUpdated,
        status
      })
      
    } catch (error) {
      checks.push({
        table: tableName,
        current_count: 0,
        expected_min: expectedMin,
        last_updated: null,
        status: 'critical'
      })
    }
  }
  
  return checks
}

async function checkAPIStatus(): Promise<boolean> {
  try {
    const API_KEY = process.env.API_FOOTBALL_KEY
    if (!API_KEY) return false
    
    const response = await fetch('https://v3.football.api-sports.io/status', {
      headers: { 'x-apisports-key': API_KEY }
    })
    
    return response.ok
  } catch {
    return false
  }
}

async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supa.from('leagues').select('id').limit(1).single()
    return !error
  } catch {
    return false
  }
}

async function sendSlackNotification(message: string, isError = false) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return
  
  const color = isError ? '#ff0000' : '#00ff00'
  const emoji = isError ? '🚨' : '✅'
  
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `${emoji} AllLeaguesFans 데이터 동기화`,
          text: message,
          ts: Math.floor(Date.now() / 1000)
        }]
      })
    })
  } catch (error) {
    console.error('Slack notification failed:', error)
  }
}

async function sendEmailAlert(subject: string, body: string) {
  // 이메일 서비스 설정 (예: SendGrid, NodeMailer 등)
  const emailService = process.env.EMAIL_SERVICE // 'sendgrid', 'gmail', etc.
  
  if (!emailService) return
  
  // SendGrid 예시
  if (emailService === 'sendgrid') {
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
    const FROM_EMAIL = process.env.FROM_EMAIL
    const TO_EMAIL = process.env.ALERT_EMAIL
    
    if (!SENDGRID_API_KEY || !FROM_EMAIL || !TO_EMAIL) return
    
    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: TO_EMAIL }] }],
          from: { email: FROM_EMAIL },
          subject,
          content: [{ type: 'text/plain', value: body }]
        })
      })
    } catch (error) {
      console.error('Email alert failed:', error)
    }
  }
}

async function logSyncStatus(status: SyncStatus) {
  // Supabase에 동기화 로그 저장 (선택사항)
  try {
    await supa.from('sync_logs').insert([{
      timestamp: status.timestamp,
      status: status.status,
      message: status.message,
      details: status.details
    }])
  } catch (error) {
    console.error('Failed to log sync status:', error)
  }
}

async function generateHealthReport(): Promise<string> {
  const apiStatus = await checkAPIStatus()
  const supabaseStatus = await checkSupabaseConnection()
  const healthChecks = await checkDataHealth()
  
  const criticalIssues = healthChecks.filter(check => check.status === 'critical')
  const warnings = healthChecks.filter(check => check.status === 'warning')
  
  let report = '📊 AllLeaguesFans 데이터 상태 리포트\\n'
  report += `📅 ${new Date().toLocaleString('ko-KR')}\\n\\n`
  
  report += '🔌 연결 상태:\\n'
  report += `- API Football: ${apiStatus ? '✅ 정상' : '❌ 연결 실패'}\\n`
  report += `- Supabase: ${supabaseStatus ? '✅ 정상' : '❌ 연결 실패'}\\n\\n`
  
  report += '📈 데이터 상태:\\n'
  healthChecks.forEach(check => {
    const icon = check.status === 'healthy' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'
    report += `${icon} ${check.table}: ${check.current_count}개 (최소 ${check.expected_min}개 필요)\\n`
  })
  
  if (criticalIssues.length > 0) {
    report += '\\n🚨 긴급 조치 필요:\\n'
    criticalIssues.forEach(issue => {
      report += `- ${issue.table}: 데이터 없음 또는 심각한 부족\\n`
    })
  }
  
  if (warnings.length > 0) {
    report += '\\n⚠️ 주의 사항:\\n'
    warnings.forEach(warning => {
      report += `- ${warning.table}: 예상보다 적은 데이터 (${warning.current_count}/${warning.expected_min})\\n`
    })
  }
  
  return report
}

async function runHealthCheck() {
  console.log('🔍 시스템 상태 확인 중...')
  
  try {
    const report = await generateHealthReport()
    const healthChecks = await checkDataHealth()
    const hasCriticalIssues = healthChecks.some(check => check.status === 'critical')
    
    console.log(report)
    
    // 로그 기록
    const status: SyncStatus = {
      timestamp: new Date().toISOString(),
      status: hasCriticalIssues ? 'error' : 'success',
      message: hasCriticalIssues ? '시스템에 문제가 발견됨' : '시스템 정상 작동',
      details: { health_checks: healthChecks }
    }
    
    await logSyncStatus(status)
    
    // 알림 전송 (문제 발생시에만)
    if (hasCriticalIssues) {
      await sendSlackNotification(report, true)
      await sendEmailAlert('AllLeaguesFans 시스템 알림 - 문제 발생', report)
    }
    
  } catch (error) {
    console.error('Health check failed:', error)
    
    const errorStatus: SyncStatus = {
      timestamp: new Date().toISOString(),
      status: 'error',
      message: `Health check 실패: ${error}`,
      details: { error: String(error) }
    }
    
    await logSyncStatus(errorStatus)
    await sendSlackNotification(`시스템 모니터링 실패: ${error}`, true)
  }
}

// CLI에서 직접 실행 가능
if (import.meta.main) {
  runHealthCheck().catch(console.error)
}

export {
  runHealthCheck,
  checkDataHealth,
  generateHealthReport,
  sendSlackNotification,
  sendEmailAlert
}