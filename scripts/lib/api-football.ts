// scripts/lib/api-football.ts
import 'dotenv/config'

const API = 'https://v3.football.api-sports.io'
const KEY = process.env.API_FOOTBALL_KEY!
if (!KEY) throw new Error('Missing API_FOOTBALL_KEY')

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function apiGet(path: string, params: Record<string, any> = {}, retry = 2) {
  const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v!=null) as any)
  const res = await fetch(`${API}/${path}?${qs}`, { headers: { 'x-apisports-key': KEY } })
  if (res.status === 429) {                              // rate limit
    const wait = Number(res.headers.get('Retry-After')) * 1000 || 1000
    await delay(wait)
    return apiGet(path, params, retry)
  }
  if (!res.ok) {
    if (retry > 0) {
      await delay(500)
      return apiGet(path, params, retry - 1)
    }
    throw new Error(`API-FOOTBALL ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function apiPaged(path: string, baseParams: Record<string, any>) {
  const pages: any[] = []
  for (let page = 1; ; page++) {
    const data = await apiGet(path, { ...baseParams, page })
    const arr = data.response ?? []
    pages.push(...arr)
    if (data.paging?.current >= data.paging?.total) break
    await delay(150)  // 완충
  }
  return pages
}
