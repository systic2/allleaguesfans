// scripts/seed-tsd-leagues-teams.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { listTeamsByLeagueName, pickBadge, TsdTeam } from './tsd';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const LEAGUE_INFO = {
  kleague1: { name: 'South Korean K League 1' },
  kleague2: { name: 'South Korean K League 2' },
} as const;

const YEAR = 2025;

// 2025 허용 목록(철자 변화 감안: 간단 normalize 매칭)
const ALLOW_K1_2025 = [
  'Ulsan HD','Pohang Steelers','Jeonbuk Hyundai Motors','FC Seoul',
  'Gwangju FC','Daegu FC','Daejeon Hana Citizen','Suwon FC',
  'Gangwon FC','Gimcheon Sangmu','Jeju United','Jeju SK','FC Anyang'
];
const ALLOW_K2_2025 = [
  // 2025 K리그2 14팀(시드 전에 실제 참가팀 리스트를 확인해 반영하세요)
  'Busan IPark','Bucheon FC 1995','Gyeongnam FC','Seoul E-Land',
  'Ansan Greeners','Cheonan City','Chungbuk Cheongju','Chungnam Asan',
  'Jeonnam Dragons','Gimpo FC','Hwaseong FC','Incheon United',
  'Anyang','Cheongju Jikji' // 예시, 실제 시즌 참가팀으로 교체
];

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g,'')
    .replace(/fc|sc|afc|cf|united|citizen|motors|hd|sk/gi,'')
    .replace(/[^\p{Letter}\p{Number}]/gu,'');
}
function allowed(slug: keyof typeof LEAGUE_INFO, teamName: string) {
  const base = norm(teamName);
  const pool = slug === 'kleague1' ? ALLOW_K1_2025 : ALLOW_K2_2025;
  return pool.some(n => {
    const m = norm(n);
    return m === base || m.includes(base) || base.includes(m);
  });
}

async function getSeasonId(slug: keyof typeof LEAGUE_INFO) {
  const lg = await sb.from('leagues').select('id').eq('slug', slug).single();
  if (lg.error || !lg.data) throw new Error(`league not found: ${slug}`);
  const ss = await sb.from('seasons').select('id').eq('league_id', lg.data.id).eq('year', YEAR).single();
  if (ss.error || !ss.data) throw new Error(`season not found: ${slug} ${YEAR}`);
  return ss.data.id as string;
}

async function upsertTeam(t: TsdTeam) {
  const external = { thesportsdb: { teamId: t.idTeam } };
  const crest_url = pickBadge(t);

  const exist = await sb.from('teams')
    .select('id').eq('external->thesportsdb->>teamId', String(t.idTeam)).maybeSingle();

  if (!exist.data) {
    const ins = await sb.from('teams').insert({
      name: t.strTeam,
      short_name: t.strAlternate ?? null,
      crest_url,
      external,
    }).select('id').single();
    if (ins.error) throw ins.error;
    return ins.data.id as string;
  } else {
    const upd = await sb.from('teams').update({
      name: t.strTeam, short_name: t.strAlternate ?? null, crest_url, external,
    }).eq('id', exist.data.id);
    if (upd.error) throw upd.error;
    return exist.data.id as string;
  }
}

async function main() {
  for (const [slug, meta] of Object.entries(LEAGUE_INFO) as [keyof typeof LEAGUE_INFO, {name:string}][]) {
    const seasonId = await getSeasonId(slug);

    // ★ 핵심: 리그 "정확한 이름"으로 조회
    const all = await listTeamsByLeagueName(meta.name);

    // ★ 강력 필터: 국가 + 리그명 + 허용목록(시즌 참가팀)
    const cand = all.filter(t => {
      const countryOk = /korea/i.test(t.strCountry || '');
      const leagueOk  = /k\s*-?\s*league/i.test(t.strLeague || '');
      const allowOk   = allowed(slug, t.strTeam);
      return countryOk && leagueOk && allowOk;
    });

    // 디버그 로그
    console.log(`[${slug}] API=${meta.name} total=${all.length} -> filtered=${cand.length}`);
    console.log(' sample:', cand.slice(0,6).map(x => `${x.strTeam} (${x.strLeague}/${x.strCountry})`));

    let mapped = 0;
    for (const tt of cand) {
      const teamId = await upsertTeam(tt);

      const map = await sb.from('season_teams')
        .select('team_id').eq('season_id', seasonId).eq('team_id', teamId).maybeSingle();
      if (!map.data) {
        const ins = await sb.from('season_teams').insert({ season_id: seasonId, team_id: teamId });
        if (ins.error) throw ins.error;
      }
      mapped++;
    }
    console.log(`[${slug}] mapped=${mapped}`);
  }
  console.log('✅ seed leagues/teams (strict) complete');
}

main().catch(e => { console.error(e); process.exit(1); });
