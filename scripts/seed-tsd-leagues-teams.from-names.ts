// 실행: pnpm tsx --env-file=.env scripts/seed-tsd-leagues-teams.from-names.ts
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

type Resolved = { idTeam: string; strTeam: string; badge?: string | null };

async function load(path: string): Promise<Resolved[]> {
  const buf = await readFile(path, 'utf8');
  return JSON.parse(buf) as Resolved[];
}

async function getSeasonId(slug: 'kleague1'|'kleague2', year: number) {
  const lg = await sb.from('leagues').select('id').eq('slug', slug).single();
  if (lg.error || !lg.data) throw new Error(`league not found: ${slug}`);
  const ss = await sb.from('seasons').select('id').eq('league_id', lg.data.id).eq('year', year).single();
  if (ss.error || !ss.data) throw new Error(`season not found: ${slug} ${year}`);
  return ss.data.id as string;
}

async function upsertTeamByResolved(r: Resolved) {
  const crest = r.badge ?? null;
  const external = { thesportsdb: { teamId: r.idTeam } };
  const exist = await sb.from('teams').select('id').eq('external->thesportsdb->>teamId', String(r.idTeam)).maybeSingle();

  if (!exist.data) {
    const ins = await sb.from('teams').insert({
      name: r.strTeam,
      crest_url: crest,
      external,
    }).select('id').single();
    if (ins.error) throw ins.error;
    return ins.data.id as string;
  } else {
    const upd = await sb.from('teams').update({
      name: r.strTeam,
      crest_url: crest,
      external,
    }).eq('id', exist.data.id);
    if (upd.error) throw upd.error;
    return exist.data.id as string;
  }
}

async function mapSeasonTeams(seasonId: string, list: Resolved[]) {
  // 시즌 매핑 초기화
  const del = await sb.from('season_teams').delete().eq('season_id', seasonId);
  if (del.error) throw del.error;

  let mapped = 0;
  for (const r of list) {
    const teamId = await upsertTeamByResolved(r);
    const m = await sb.from('season_teams').insert({ season_id: seasonId, team_id: teamId });
    if (m.error) throw m.error;
    mapped++;
  }
  return mapped;
}

async function main() {
  const YEAR = 2025;
  const k1 = await load('tmp/kleague1-from-names.json');
  const k2 = await load('tmp/kleague2-from-names.json');

  // 기대 개수는 프로젝트 정책에 맞추어 유효성 체크
  if (k1.length < 12) console.warn(`⚠️ K1 resolved ${k1.length}/12 (이름 배열을 보강하세요)`);
  if (k2.length < 14) console.warn(`⚠️ K2 resolved ${k2.length}/14 (이름 배열을 보강하세요)`);

  const s1 = await getSeasonId('kleague1', YEAR);
  const s2 = await getSeasonId('kleague2', YEAR);

  const m1 = await mapSeasonTeams(s1, k1);
  const m2 = await mapSeasonTeams(s2, k2);

  console.log(`✅ strict seed(from-names) done. K1=${m1}, K2=${m2}`);
}

main().catch(e => { console.error(e); process.exit(1); });
