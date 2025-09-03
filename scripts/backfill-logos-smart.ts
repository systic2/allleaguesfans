// 실행: pnpm tsx --env-file=.env scripts/backfill-logos-smart.ts kleague1 2025
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SB_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TSD_KEY = process.env.THESPORTSDB_KEY || '3';
const TSD = `https://www.thesportsdb.com/api/v1/json/${TSD_KEY}`;

type TeamRow = { id: string; name: string; crest_url: string | null; external: any | null };

const sb = createClient(SB_URL, SB_SERVICE_ROLE, { auth: { persistSession: false } });

// K리그1/2 대표 동의어(영문 표기 다양성 흡수)
const SYNONYMS: Record<string, string[]> = {
  "Ulsan": ["Ulsan HD", "Ulsan Hyundai"],
  "Ulsan Hyundai": ["Ulsan HD"],
  "Pohang Steelers": ["Pohang"],
  "Jeonbuk Hyundai Motors": ["Jeonbuk", "Jeonbuk Hyundai"],
  "FC Seoul": ["Seoul"],
  "Incheon United": ["Incheon Utd", "Incheon"],
  "Daegu FC": ["Daegu"],
  "Daejeon Hana Citizen": ["Daejeon Citizen", "Daejeon"],
  "Gwangju FC": ["Gwangju"],
  "Gangwon FC": ["Gangwon"],
  "Suwon FC": ["Suwon FC"],
  "Gimcheon Sangmu": ["Sangju Sangmu", "Gimcheon"],
  "Jeju United": ["Jeju Utd", "Jeju"],
};

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, '').replace(/fc|sc|cf|afc|city|united|footballclub/gi, '').replace(/[^\p{Letter}\p{Number}]/gu, '');
}
function scoreMatch(q: string, cand: any): number {
  const base = norm(q);
  const names: string[] = [];
  if (cand.strTeam) names.push(String(cand.strTeam));
  if (cand.strAlternate) names.push(...String(cand.strAlternate).split(','));
  const uniq = Array.from(new Set(names.map(norm)));
  let best = 0;
  for (const n of uniq) {
    if (!n) continue;
    if (n === base) best = Math.max(best, 100);
    else if (n.includes(base) || base.includes(n)) best = Math.max(best, 80);
    else {
      const common = [...n].filter(ch => base.includes(ch)).length;
      best = Math.max(best, Math.floor((common / Math.max(n.length, base.length)) * 60));
    }
  }
  return best;
}
const pickBadge = (c: any) => (c?.strTeamBadge || c?.strTeamLogo || null)?.toString().replace(/^http:/, 'https:') ?? null;

async function getSeasonId(slug: 'kleague1'|'kleague2', year = 2025) {
  const lg = await sb.from('leagues').select('id').eq('slug', slug).single();
  if (lg.error || !lg.data) throw lg.error || new Error(`league not found: ${slug}`);
  const ss = await sb.from('seasons').select('id').eq('league_id', lg.data.id).eq('year', year).single();
  if (ss.error || !ss.data) throw ss.error || new Error(`season not found: ${slug} ${year}`);
  return ss.data.id as string;
}

async function tsdLookup(teamId: string) {
  const r = await fetch(`${TSD}/lookupteam.php?id=${teamId}`);
  if (!r.ok) return null;
  const j = await r.json();
  return j?.teams?.[0] ?? null;
}
async function tsdSearch(name: string) {
  const r = await fetch(`${TSD}/searchteams.php?t=${encodeURIComponent(name)}`);
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.teams ?? []) as any[];
}
function filterKR(list: any[]) {
  return list.filter(x => {
    const country = (x.strCountry || x.strNationality || '').toLowerCase();
    const league  = (x.strLeague || '').toLowerCase();
    return (country.includes('korea')) && (league.includes('k league') || league.includes('kleague') || league.includes('k-league'));
  });
}

async function main() {
  const slug = (process.argv[2] as 'kleague1'|'kleague2') || 'kleague1';
  const year = Number(process.argv[3] || 2025);
  const seasonId = await getSeasonId(slug, year);

  const { data, error } = await sb
    .from('season_teams')
    .select('team:teams(id,name,crest_url,external)')
    .eq('season_id', seasonId);
  if (error) throw error;

  const teams: TeamRow[] = (data ?? []).map((r: any) => r.team);
  let checked = 0, updated = 0;

  for (const t of teams) {
    if (t.crest_url && t.crest_url.trim() !== '') continue; // 이미 있음
    checked++;
    const extId = t.external?.thesportsdb?.teamId as string | undefined;

    // 1) teamId 있으면 바로 lookup
    if (extId) {
      const one = await tsdLookup(extId);
      const badge = pickBadge(one);
      if (badge) {
        await sb.from('teams').update({ crest_url: badge }).eq('id', t.id);
        updated++; console.log('✓', t.name, 'via teamId');
        continue;
      }
    }

    // 2) 이름 + 동의어로 검색 → 한국/K리그만 필터 → 최고득점 픽
    const candidates: any[] = [];
    const queries = [t.name, ...(SYNONYMS[t.name] ?? [])];
    for (const q of queries) {
      const arr = await tsdSearch(q);
      candidates.push(...arr);
    }
    const filtered = filterKR(candidates);
    if (filtered.length === 0) { console.warn('… no KR match:', t.name); continue; }

    filtered.sort((a, b) => scoreMatch(t.name, b) - scoreMatch(t.name, a));
    const best = filtered[0];
    const badge = pickBadge(best);
    if (!badge) { console.warn('… no badge:', t.name); continue; }

    const updates: any = { crest_url: badge };
    if (best.idTeam) {
      updates.external = {
        ...(t.external ?? {}),
        thesportsdb: { ...(t.external?.thesportsdb ?? {}), teamId: String(best.idTeam) },
      };
    }
    await sb.from('teams').update(updates).eq('id', t.id);
    updated++; console.log('✓', t.name, '=>', badge);
  }

  console.log(`✅ logos smart backfill done. checked=${checked}, updated=${updated}`);
}

main().catch(e => { console.error(e); process.exit(1); });
