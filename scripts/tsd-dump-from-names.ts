// 실행: pnpm tsx --env-file=.env scripts/tsd-dump-from-names.ts
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.THESPORTSDB_KEY || '3';
const V1  = `https://www.thesportsdb.com/api/v1/json/${KEY}`;

/** 2025 K리그1 12개 (필요 시 최신 참가팀 반영) */
const K1_NAMES = [
  'Ulsan HD',
  'Pohang Steelers',
  'Jeonbuk Hyundai Motors',
  'FC Seoul',
  'Gwangju FC',
  'Daegu FC',
  'Daejeon Hana Citizen',
  'Suwon FC',
  'Gangwon FC',
  'Gimcheon Sangmu',
  'Jeju SK FC',
  'FC Anyang',
];

/** 2025 K리그2 14개 (✍️ 실제 참가팀으로 갱신해 주세요) */
const K2_NAMES = [
  'Suwon Samsung Bluewings',
  'Busan IPark',
  'Bucheon FC 1995',
  'Gyeongnam FC',
  'Seoul E-Land',
  'Ansan Greeners',
  'Cheonan City',
  'Chungbuk Cheongju',
  'Chungnam Asan',
  'Jeonnam Dragons',
  'Gimpo FC',
  'Seongnam FC',
  'Incheon United',
  'Cheongju Jikji' // 예시: 실제 시즌 구성에 맞게 교체
];

/** 동의어/옛 표기 (필요 시 계속 보강) */
const SYNONYMS: Record<string, string[]> = {
  // K리그1
  'Ulsan HD': ['Ulsan Hyundai', 'Ulsan'],
  'Jeonbuk Hyundai Motors': ['Jeonbuk Hyundai', 'Jeonbuk'],
  'Incheon United': ['Incheon Utd', 'Incheon'],
  'Jeju United': ['Jeju United FC', 'Jeju Utd', 'Jeju'],
  'Daejeon Hana Citizen': ['Daejeon Citizen', 'Daejeon'],
  'Gimcheon Sangmu': ['Gimcheon Sangmu FC', 'Sangju Sangmu', 'Gimcheon', 'Sangmu'],

  // K리그2
  'Suwon Samsung Bluewings': ['Suwon Bluewings', 'Suwon Samsung'],
  'Chungbuk Cheongju': ['Cheongju', 'Chungbuk', 'Cheongju FC'],
  'Chungnam Asan': ['Asan Mugunghwa', 'Asan', 'Chungnam Asan FC'],
  'Seoul E-Land': ['Seoul ELand', 'Seoul E Land'],
};

type Team = {
  idTeam: string;
  strTeam: string;
  strLeague?: string;
  strCountry?: string;
  strTeamBadge?: string;
  strTeamLogo?: string;
  strAlternate?: string;
};

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchJson(url: string, tries = 3): Promise<any> {
  let delay = 1000;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url);
    if (r.status === 429) {
      if (i === tries - 1) throw new Error(`${url} -> 429`);
      await sleep(delay);        // 백오프
      delay *= 2;
      continue;
    }
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  }
}

async function searchByName(name: string): Promise<Team[]> {
  const j = await fetchJson(`${V1}/searchteams.php?t=${encodeURIComponent(name)}`);
  return (j?.teams ?? []) as Team[];
}

async function listByLeagueId(leagueId: number): Promise<Team[]> {
  const j = await fetchJson(`${V1}/lookup_all_teams.php?id=${leagueId}`);
  return (j?.teams ?? []) as Team[];
}

function norm(s: string) {
  return s.toLowerCase()
    .replace(/\s+/g,'')
    .replace(/fc|sc|afc|cf|united|citizen|motors|hd|hyundai|footballclub|sangmu|dragon|dragons/gi,'')
    .replace(/[^\p{Letter}\p{Number}]/gu,'');
}
function score(q: string, cand: Team): number {
  const base = norm(q);
  const names: string[] = [];
  if (cand.strTeam) names.push(cand.strTeam);
  if (cand.strAlternate) names.push(...String(cand.strAlternate).split(','));
  const uniq = Array.from(new Set(names.map(norm)));
  let best = 0;
  for (const n of uniq) {
    if (!n) continue;
    if (n === base) best = Math.max(best, 100);
    else if (n.includes(base) || base.includes(n)) best = Math.max(best, 85);
    else {
      const common = [...n].filter((ch) => base.includes(ch)).length;
      best = Math.max(best, Math.floor((common / Math.max(n.length, base.length)) * 70));
    }
  }
  return best;
}
function isKR(t: Team) {
  return (t.strCountry || '').toLowerCase().includes('korea');
}
function badge(t: Team) {
  const u = t.strTeamBadge || t.strTeamLogo || '';
  return u ? u.replace(/^http:/, 'https:') : null;
}

async function resolveOne(target: string) {
  const queries = [target, ...(SYNONYMS[target] ?? [])];
  let cands: Team[] = [];

  for (const q of queries) {
    const arr = await searchByName(q);
    cands.push(...arr);
    await sleep(1200); // 호출 간 간격 (429 예방)
  }

  // 최후 수단: 리그 전체 목록에서 찾기
  if (!cands.length) {
    const leaguePool = [
      ...(await listByLeagueId(4689)), // K리그1
      ...(await listByLeagueId(4822)), // K리그2
    ];
    cands.push(...leaguePool);
  }

  // 한국 팀만
  cands = cands.filter(isKR);
  if (!cands.length) return null;

  // 점수순 정렬
  cands.sort((a,b) => score(target, b) - score(target, a));
  const best = cands[0];
  return {
    idTeam: best.idTeam,
    strTeam: best.strTeam,
    badge: badge(best),
    league: best.strLeague,
    country: best.strCountry,
    tried: queries
  };
}

async function main() {
  const tmpDir = join(process.cwd(), 'tmp');
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

  const k1: any[] = [];
  for (const name of K1_NAMES) {
    try {
      const r = await resolveOne(name);
      if (r) k1.push(r); else console.warn('⚠️ not found (K1):', name);
    } catch (e:any) {
      console.warn('⚠️ error (K1):', name, e.message || e);
    }
  }
  await writeFile(join(tmpDir, 'kleague1-from-names.json'), JSON.stringify(k1, null, 2), 'utf8');
  console.log(`K1 resolved=${k1.length}/${K1_NAMES.length}`);

  const k2: any[] = [];
  for (const name of K2_NAMES) {
    try {
      const r = await resolveOne(name);
      if (r) k2.push(r); else console.warn('⚠️ not found (K2):', name);
    } catch (e:any) {
      console.warn('⚠️ error (K2):', name, e.message || e);
    }
  }
  await writeFile(join(tmpDir, 'kleague2-from-names.json'), JSON.stringify(k2, null, 2), 'utf8');
  console.log(`K2 resolved=${k2.length}/${K2_NAMES.length}`);

  console.log('✅ dump-from-names done. ./tmp/kleague*-from-names.json 확인');
}

main().catch((e)=>{ console.error(e); process.exit(1); });
