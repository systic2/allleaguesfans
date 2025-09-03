// 실행: pnpm tsx --env-file=.env scripts/tsd-dump-league-teams.ts
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.THESPORTSDB_KEY || '3';
const V1  = `https://www.thesportsdb.com/api/v1/json/${KEY}`;

type Team = {
  idTeam: string;
  strTeam: string;
  strCountry?: string;
  strLeague?: string;
  strTeamBadge?: string;
  strTeamLogo?: string;
};

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function call(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function listById(leagueId: number): Promise<Team[]> {
  const j = await call(`${V1}/lookup_all_teams.php?id=${leagueId}`);
  return j?.teams ?? [];
}
async function listByName(leagueName: string): Promise<Team[]> {
  const j = await call(`${V1}/search_all_teams.php?l=${encodeURIComponent(leagueName)}`);
  return j?.teams ?? [];
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g,'').replace(/[^\p{Letter}\p{Number}]/gu,'');
}
function isKR(x: Team) {
  return (x.strCountry || '').toLowerCase().includes('korea');
}
function isKLeague(x: Team) {
  const l = (x.strLeague || '').toLowerCase();
  return l.includes('k league') || l.includes('kleague') || l.includes('k-league');
}

async function dumpOne(tag: 'kleague1'|'kleague2', id: number, name: string) {
  // 1) id기반(신뢰도↑) + 2) name기반 병합
  const a = await listById(id);
  const b = await listByName(name);
  const map = new Map<string, Team>();
  for (const r of [...a, ...b]) {
    const key = r.idTeam || norm(r.strTeam);
    if (!map.has(key)) map.set(key, r);
  }
  const all = [...map.values()];
  const filtered = all.filter(x => isKR(x) && isKLeague(x));

  await ensureDir(join(process.cwd(), 'tmp'));
  await writeFile(join(process.cwd(), 'tmp', `${tag}-all.json`), JSON.stringify(all, null, 2), 'utf8');
  await writeFile(join(process.cwd(), 'tmp', `${tag}-filtered.json`), JSON.stringify(filtered, null, 2), 'utf8');

  console.log(`[${tag}] all=${all.length} filtered=${filtered.length}`);
  for (const r of filtered) {
    console.log(` - ${r.strTeam} | ${r.strLeague} | ${r.strCountry} | ${r.idTeam}`);
  }
}

async function main() {
  await dumpOne('kleague1', 4689, 'South Korean K League 1');
  await dumpOne('kleague2', 4822, 'South Korean K League 2');
  console.log('✅ dump done. ./tmp/kleague*-*.json 확인');
}
main().catch(e => { console.error(e); process.exit(1); });
