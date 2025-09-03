// scripts/seed-kleague.ts
// 실행: pnpm tsx --env-file=.env scripts/seed-kleague.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SB_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
const YEAR = Number(process.env.SEASON_YEAR || '2025');

const TSD_KEY = process.env.THESPORTSDB_KEY || '3';
const TSD_V1 = 'https://www.thesportsdb.com/api/v1/json';

const K1 = 4689; // K League 1
const K2 = 4822; // K League 2

type TeamDTO = {
  idTeam: string;
  strTeam: string;
  strTeamShort?: string;
  intFormedYear?: string;
  strTeamBadge?: string;
  strCountry?: string | null;
};

type EventDTO = {
  idEvent: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
};

const sb = createClient(SB_URL, SB_SERVICE_ROLE, { auth: { persistSession: false } });

// ---------- TSD helpers ----------
async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const txt = await r.text();
    if (!txt.trim()) return null;
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

async function lookupAllTeamsByLeague(leagueId: number): Promise<TeamDTO[] | null> {
  const j = await getJSON<{ teams?: TeamDTO[] }>(`${TSD_V1}/${TSD_KEY}/lookup_all_teams.php?id=${leagueId}`);
  return j?.teams ?? null;
}

async function lookupLeagueName(leagueId: number): Promise<string | null> {
  const j = await getJSON<{ leagues?: any[] }>(`${TSD_V1}/${TSD_KEY}/lookupleague.php?id=${leagueId}`);
  return j?.leagues?.[0]?.strLeague ?? null;
}

function enc(v: string) { return encodeURIComponent(v); }

async function searchAllTeamsByLeagueName(leagueId: number): Promise<TeamDTO[] | null> {
  const name = await lookupLeagueName(leagueId);
  if (!name) return null;
  const j = await getJSON<{ teams?: TeamDTO[] }>(`${TSD_V1}/${TSD_KEY}/search_all_teams.php?l=${enc(name)}`);
  return j?.teams ?? null;
}

function seasonVariants(y: number): string[] {
  return [`${y}`, `${y - 1}-${y}`]; // 단일연도 / 스플릿 모두 시도
}

async function deriveTeamsFromEvents(leagueId: number, year: number): Promise<TeamDTO[] | null> {
  const ids = new Set<string>();
  for (const s of seasonVariants(year)) {
    const evs = await getJSON<{ events?: EventDTO[] }>(`${TSD_V1}/${TSD_KEY}/eventsseason.php?id=${leagueId}&s=${enc(s)}`);
    for (const e of evs?.events ?? []) {
      if (e.idHomeTeam) ids.add(e.idHomeTeam);
      if (e.idAwayTeam) ids.add(e.idAwayTeam);
    }
  }
  if (ids.size === 0) return null;

  const teams: TeamDTO[] = [];
  for (const id of ids) {
    const t = await getJSON<{ teams?: TeamDTO[] }>(`${TSD_V1}/${TSD_KEY}/lookupteam.php?id=${id}`);
    if (t?.teams?.[0]) teams.push(t.teams[0]);
  }
  return teams;
}

function isKoreanCountry(c?: string | null) {
  if (!c) return null; // 알 수 없음 → 필터 패스
  const v = c.trim().toLowerCase();
  return v === 'south korea' || v === 'korea republic' || v === 'republic of korea' || v === 'korea, south';
}

// ---------- DB helpers ----------
async function getSeasonIdBySlugYear(slug: 'kleague1'|'kleague2', year: number): Promise<string> {
  const lg = await sb.from('leagues').select('id').eq('slug', slug).single();
  if (lg.error || !lg.data) throw new Error(`league not found: ${slug}`);
  const ss = await sb.from('seasons').select('id').eq('league_id', lg.data.id).eq('year', year).single();
  if (ss.error || !ss.data) throw new Error(`season not found: ${slug} ${year}`);
  return ss.data.id;
}

async function upsertTeams(slug: 'kleague1'|'kleague2', seasonId: string, teams: TeamDTO[]) {
  let inserted = 0, mapped = 0;
  for (const t of teams) {
    // country가 있으면 한국만, 없으면 통과
    const countryCheck = isKoreanCountry(t.strCountry);
    if (countryCheck === false) continue;

    // external.teamId 기준 멱등
    const exist = await sb.from('teams')
      .select('id')
      .contains('external', { thesportsdb: { teamId: t.idTeam } })
      .maybeSingle();

    let teamId = exist.data?.id as string | undefined;

    if (!teamId) {
      const ins = await sb.from('teams').insert({
        name: t.strTeam,
        short_name: t.strTeamShort || null,
        founded: t.intFormedYear ? Number(t.intFormedYear) : null,
        crest_url: t.strTeamBadge || null,
        external: { thesportsdb: { teamId: t.idTeam, country: t.strCountry ?? null } },
      }).select('id').single();
      if (ins.error) throw ins.error;
      teamId = ins.data.id;
      inserted++;
    } else {
      const upd = await sb.from('teams').update({
        name: t.strTeam,
        short_name: t.strTeamShort || null,
        crest_url: t.strTeamBadge || null,
        external: { thesportsdb: { teamId: t.idTeam, country: t.strCountry ?? null } },
      }).eq('id', teamId);
      if (upd.error) throw upd.error;
    }

    const map = await sb.from('season_teams').upsert({ season_id: seasonId, team_id: teamId });
    if (map.error) throw map.error;
    mapped++;
  }
  return { inserted, mapped };
}

async function seedFor(slug: 'kleague1'|'kleague2', leagueId: number, year: number) {
  const seasonId = await getSeasonIdBySlugYear(slug, year);

  let source = 'lookup_all_teams';
  let list = await lookupAllTeamsByLeague(leagueId) ?? [];
  // 중복 제거
  const uniq = new Map<string, TeamDTO>();
  for (const t of list) if (t?.idTeam) uniq.set(t.idTeam, t);
  list = [...uniq.values()];

  // 1차 시도: lookup_all_teams 결과로 업서트
  let res = await upsertTeams(slug, seasonId, list);

  // ⚠️ 여기가 핵심: 매핑 0이면 폴백 단계로 진행
  if (res.mapped === 0) {
    // 2차 폴백: 리그명으로 재검색
    const byName = await searchAllTeamsByLeagueName(leagueId);
    if (byName && byName.length) {
      source = 'search_all_teams';
      const u = new Map<string, TeamDTO>();
      for (const t of byName) if (t?.idTeam) u.set(t.idTeam, t);
      res = await upsertTeams(slug, seasonId, [...u.values()]);
    }
  }
  if (res.mapped === 0) {
    // 3차 폴백: 시즌 이벤트에서 팀 추출 → 상세 조회
    const fromEvents = await deriveTeamsFromEvents(leagueId, year);
    if (fromEvents && fromEvents.length) {
      source = 'eventsseason+lookupteam';
      const u = new Map<string, TeamDTO>();
      for (const t of fromEvents) if (t?.idTeam) u.set(t.idTeam, t);
      res = await upsertTeams(slug, seasonId, [...u.values()]);
    }
  }

  console.log(`[${slug}] source=${source}, teams=${list.length}, inserted=${res.inserted}, mapped=${res.mapped}`);
  return { ...res, source, count: list.length };
}


async function main() {
  console.log(`Seeding K League (robust) for season ${YEAR}...`);
  const a = await seedFor('kleague1', K1, YEAR);
  const b = await seedFor('kleague2', K2, YEAR);
  console.log('✅ seed complete', { kleague1: a, kleague2: b });
}
main().catch(e => { console.error('❌ seed failed', e); process.exit(1); });
