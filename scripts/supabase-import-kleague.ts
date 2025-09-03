// scripts/supabase-import-kleague.ts
import 'dotenv/config'
import fs from 'node:fs/promises'
import fss from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type Seed = {
  league: { id: number; name: string; latestSeason: number; country?: string }
  season: number
  teams: Array<{
    id: string
    name: string
    shortName?: string
    logo?: string
    founded?: number
    country?: string
    venue?: string
  }>
}

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!
const BUCKET = process.env.SUPABASE_LOGO_BUCKET || 'logos'
const SEEDS_DIR = 'seeds'
const LOGOS_DIR = 'public/logos' // 앞서 캐싱된 경로
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

function leagueSlugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-') // "K League 1" -> "k-league-1"
}
function contentTypeOf(ext: string) {
  const e = ext.toLowerCase()
  if (e === '.png') return 'image/png'
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg'
  if (e === '.webp') return 'image/webp'
  if (e === '.gif') return 'image/gif'
  if (e === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

async function ensureBucketPublic(name: string) {
  // 이미 있으면 에러 무시
  await supabase.storage.createBucket(name, { public: true }).catch(() => {})
}

async function findLocalLogoFile(leagueSlug: string, teamId: string) {
  const dir = path.join(LOGOS_DIR, leagueSlug)
  if (!fss.existsSync(dir)) return null
  const files = await fs.readdir(dir)
  const cand = files.find(f => f.startsWith(teamId + '.')) // teamId.png|jpg|webp...
  return cand ? path.join(dir, cand) : null
}

async function uploadLogoAndGetUrl(leagueSlug: string, teamId: string) {
  const file = await findLocalLogoFile(leagueSlug, teamId)
  if (!file) return null
  const ext = path.extname(file) || '.png'
  const storagePath = `${leagueSlug}/${teamId}${ext}`
  const buf = await fs.readFile(file)
  const { error } = await supabase
    .storage
    .from(BUCKET)
    .upload(storagePath, buf, { upsert: true, contentType: contentTypeOf(ext) })
  if (error) {
    console.warn(`logo upload fail ${teamId}: ${error.message}`)
    return null
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl || null
}

async function upsertLeague(leagueId: number, name: string, country?: string) {
  const slug = leagueSlugFromName(name)
  const { error } = await supabase.from('leagues').upsert(
    [{ id: leagueId, name, country, slug }],
    { onConflict: 'id' }
  )
  if (error) throw error
  return slug
}

async function upsertSeason(leagueId: number, year: number, isCurrent = true) {
  const { error } = await supabase.from('seasons').upsert(
    [{ league_id: leagueId, year, is_current: isCurrent }],
    { onConflict: 'league_id,year' }
  )
  if (error) throw error
}

async function upsertTeams(teams: Seed['teams'], leagueId: number, year: number, leagueSlug: string) {
  for (const t of teams) {
    const teamId = Number(t.id)
    // 1) 로고 업로드(가능 시)
    const uploaded = await uploadLogoAndGetUrl(leagueSlug, String(teamId))
    const logoUrl = uploaded || t.logo || null

    // 2) 팀 업서트
    {
      const { error } = await supabase.from('teams').upsert(
        [{
          id: teamId,
          name: t.name,
          short_name: t.shortName || null,
          founded: t.founded ?? null,
          country: t.country || null,
          venue: t.venue || null,
          logo_url: logoUrl
        }],
        { onConflict: 'id' }
      )
      if (error) throw error
    }

    // 3) 시즌-팀 매핑 업서트
    {
      const { error } = await supabase.from('team_seasons').upsert(
        [{ team_id: teamId, league_id: leagueId, season_year: year }],
        { onConflict: 'team_id,league_id,season_year' }
      )
      if (error) throw error
    }
  }
}

async function loadSeedFiles() {
  const files = await fs.readdir(SEEDS_DIR)
  // 예: k-league-1-2025.json, k-league-2-2025.json
  return files.filter(f => /^k-league-\d-\d{4}\.json$/.test(f)).map(f => path.join(SEEDS_DIR, f))
}

async function importOne(seedPath: string) {
  const json = JSON.parse(await fs.readFile(seedPath, 'utf-8')) as Seed
  const { league, season, teams } = json
  console.log(`\n[IMPORT] ${league.name} ${season} (${teams.length} teams)`)

  await ensureBucketPublic(BUCKET)

  const slug = await upsertLeague(league.id, league.name, league.country)
  await upsertSeason(league.id, season, true)
  await upsertTeams(teams, league.id, season, slug)

  console.log(`→ done: ${league.name} ${season}`)
}

async function main() {
  const seedFiles = await loadSeedFiles()
  if (!seedFiles.length) throw new Error(`no seed files in ${SEEDS_DIR}`)
  for (const f of seedFiles) await importOne(f)
  console.log('\n✅ Supabase 적재 완료')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
