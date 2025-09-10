// scripts/seed-api-football-kleague.ts
/* pnpm tsx scripts/seed-api-football-kleague.ts
   결과:
   - seeds/k-league1-{년도}.json
   - seeds/k-league2-{년도}.json
   - (옵션) public/logos/{league}/{teamId}.png  로 로고 캐시
*/
import fs from "node:fs/promises"
import path from "node:path"
import 'dotenv/config'

const API = "https://v3.football.api-sports.io"
const KEY = process.env.API_FOOTBALL_KEY
if (!KEY) throw new Error("Missing API_FOOTBALL_KEY")

const _TARGET_LEAGUE_NAMES = ["K League 1", "K League 2"] as const
type _TargetName = typeof _TARGET_LEAGUE_NAMES[number]

const LOGO_CACHE_DIR = process.env.LOGO_CACHE_DIR || "public/logos"
const SEEDS_DIR = "seeds"

async function req(pathname: string, params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as any)
  const r = await fetch(`${API}/${pathname}?${qs}`, { headers: { "x-apisports-key": KEY! } })
  if (!r.ok) {
    const t = await r.text().catch(() => "")
    throw new Error(`API-FOOTBALL ${r.status} ${r.statusText} ${t}`)
  }
  return r.json()
}

async function findKLeagues() {
  // 1) KR 국가명 확보 (일반적으로 "Korea Republic")
  const countries = await req("countries", { code: "KR" })
  const krName = countries?.response?.[0]?.name // e.g., "Korea Republic"

  // 2) 탐색 후보 (국가명, 리그명 별칭)
  const COUNTRY_CANDIDATES = [krName, "Korea Republic", "South Korea"].filter(Boolean)

  const ALIASES = {
    k1: ["K League 1", "K-League 1", "K League Classic"],
    k2: ["K League 2", "K-League 2", "K League Challenge"]
  } as const

  const norm = (s: string) => s.toLowerCase().replace(/[\s\-]+/g, "")
  const matchByAliases = (name: string, aliases: readonly string[]) => {
    const n = norm(name || "")
    return aliases.some(a => n === norm(a) || n.includes(norm(a)))
  }

  // 3) 후보 국가명들로 leagues 조회
  const rows: any[] = []
  const seen = new Set<number>()
  for (const cname of COUNTRY_CANDIDATES) {
    const d = await req("leagues", { country: cname })
    for (const r of d.response ?? []) {
      if (!seen.has(r.league?.id)) {
        rows.push(r)
        seen.add(r.league?.id)
      }
    }
  }

  // 4) 부족하면 검색 파라미터로 보강 (country.code=KR 필터)
  if (rows.length === 0) {
    for (const q of ["K League", "K-League"]) {
      const d = await req("leagues", { search: q })
      for (const r of d.response ?? []) {
        if ((r.country?.code === "KR" || /korea/i.test(r.country?.name)) && !seen.has(r.league?.id)) {
          rows.push(r)
          seen.add(r.league?.id)
        }
      }
    }
  }

  // 5) 최신 시즌 선택 유틸
  const pickLatest = (candidates: any[]) => {
    if (!candidates.length) return null
    const withSeasons = candidates.map(r => {
      const years = (r.seasons ?? []).map((s: any) => s?.year).filter((y: any) => Number.isInteger(y))
      const latest = years.length ? Math.max(...years) : -Infinity
      return { row: r, latest }
    })
    // 타입이 League인 걸 우선, 최신 시즌 큰 것을 우선
    withSeasons.sort((a, b) => {
      const ta = a.row.league?.type === "League" ? 1 : 0
      const tb = b.row.league?.type === "League" ? 1 : 0
      if (tb !== ta) return tb - ta
      return b.latest - a.latest
    })
    return withSeasons[0]
  }

  // 6) 별칭으로 K1/K2 후보 걸러서 최종 픽
  const k1Candidates = rows.filter(r => matchByAliases(r.league?.name, ALIASES.k1))
  const k2Candidates = rows.filter(r => matchByAliases(r.league?.name, ALIASES.k2))

  const k1 = pickLatest(k1Candidates)
  const k2 = pickLatest(k2Candidates)

  // 7) 환경변수로 강제 지정 가능 (막판 백업)
  const K1_ENV = process.env.API_FOOTBALL_K1_ID && Number(process.env.API_FOOTBALL_K1_ID)
  const K2_ENV = process.env.API_FOOTBALL_K2_ID && Number(process.env.API_FOOTBALL_K2_ID)

  const result = []
  if (K1_ENV) {
    result.push({ id: K1_ENV, name: "K League 1", latestSeason: new Date().getFullYear() })
  } else if (k1) {
    result.push({ id: k1.row.league.id, name: "K League 1", latestSeason: k1.latest })
  }

  if (K2_ENV) {
    result.push({ id: K2_ENV, name: "K League 2", latestSeason: new Date().getFullYear() })
  } else if (k2) {
    result.push({ id: k2.row.league.id, name: "K League 2", latestSeason: k2.latest })
  }

  if (result.length !== 2) {
    // 디버깅 도움 로그
    console.log("==== 디버그: KR 관련 리그 목록 ====")
    for (const r of rows) {
      const years = (r.seasons ?? []).map((s: any) => s?.year).filter((y: any) => Number.isInteger(y))
      const latest = years.length ? Math.max(...years) : ""
      console.log(`${r.league?.id}\t${r.league?.name}\t${r.league?.type}\t${r.country?.name}\tlatest:${latest}`)
    }
    throw new Error(`K League 식별 실패 (국가명/별칭 확인 필요). 필요시 API_FOOTBALL_K1_ID / API_FOOTBALL_K2_ID 환경변수로 강제 지정하세요.`)
  }

  return result as Array<{ id: number; name: "K League 1" | "K League 2"; latestSeason: number }>
}


async function fetchTeams(leagueId: number, season: number) {
  const data = await req("teams", { league: leagueId, season })
  return (data.response ?? []).map((x: any) => ({
    id: String(x.team.id),
    name: x.team.name as string,
    shortName: x.team.code as string | undefined,
    logo: x.team.logo as string | undefined,
    founded: x.team.founded as number | undefined,
    country: x.team.country as string | undefined,
    venue: x.venue?.name as string | undefined
  }))
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true }).catch(() => {})
}

async function cacheLogo(url: string, destFile: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`로고 다운로드 실패 ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await ensureDir(path.dirname(destFile))
  await fs.writeFile(destFile, buf)
}

async function main() {
  await ensureDir(SEEDS_DIR)
  const leagues = await findKLeagues()
  console.log("찾은 리그:", leagues)

  for (const l of leagues) {
    console.log(`\n[${l.name}] 시즌 ${l.latestSeason} 팀 수집 중...`)
    const teams = await fetchTeams(l.id, l.latestSeason)
    console.log(`팀 ${teams.length}개 수집 완료`)

    // JSON 시드 파일 저장
    const seedName = l.name.toLowerCase().replace(/\s+/g, "-")
    const seedPath = path.join(SEEDS_DIR, `${seedName}-${l.latestSeason}.json`)
    await fs.writeFile(seedPath, JSON.stringify({ league: l, season: l.latestSeason, teams }, null, 2), "utf-8")
    console.log(`→ ${seedPath} 저장`)

    // 로고 캐시(옵션) : public/logos/k-league-1/{teamId}.png
    const leagueSlug = seedName
    let cached = 0
    for (const t of teams) {
      if (!t.logo) continue
      const ext = path.extname(new URL(t.logo).pathname) || ".png"
      const dest = path.join(LOGO_CACHE_DIR, leagueSlug, `${t.id}${ext}`)
      try {
        await cacheLogo(t.logo, dest)
        cached++
      } catch (e) {
        console.warn(`로고 캐시 실패: ${t.name} - ${(e as Error).message}`)
      }
    }
    console.log(`로고 캐시 완료: ${cached}/${teams.length}개 → ${LOGO_CACHE_DIR}/${leagueSlug}`)
  }

  console.log("\n✅ K리그 시드/로고 캐시 완료")
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
