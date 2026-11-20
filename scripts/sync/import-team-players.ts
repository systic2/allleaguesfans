/**
 * Import team players from TheSportsDB API
 * Endpoint: https://www.thesportsdb.com/api/v1/json/{THESPORTSDB_API_KEY}/lookup_all_players.php?id={teamId}
 *
 * --if-older-than-days=N: 마지막 수집이 N 일 안인 팀은 건너뛴다(팀별 players_v2 최신 updated_at 기준).
 * 매시간 동기화 워크플로가 이 옵션으로 실행해, 팀마다 명단을 대략 일주일에 한 번 다시 받는다.
 */
import { supa } from './lib/supabase.ts';

const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY;
if (!THESPORTSDB_API_KEY) throw new Error('THESPORTSDB_API_KEY is not set');
const DELAY_MS = 700; // 프리미엄 한도(분당 100회) 안에 들도록 europe-player-stats.ts 와 같은 간격
const REQUEST_TIMEOUT_MS = 15_000;
const TEAMS_PAGE_SIZE = 1000;

interface TheSportsDBPlayer {
  idPlayer: string;
  strPlayer: string;
  strTeam?: string;
  idTeam?: string;
  strPosition?: string;
  strNumber?: string;
  dateBorn?: string;
  strNationality?: string;
  strHeight?: string;
  strWeight?: string;
  strThumb?: string;
  strBirthLocation?: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 요청이 실패하면 null 을 돌려준다. 선수가 없는 팀({ player: null } → [])과 구분해 실패를 종료 코드로 알린다
async function fetchTeamPlayers(teamId: string): Promise<TheSportsDBPlayer[] | null> {
  const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_API_KEY}/lookup_all_players.php?id=${teamId}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: any = await response.json();
    if (data && Array.isArray(data.player)) return data.player;
    if (data && data.player === null) return [];
    throw new Error(`Unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
  } catch (error) {
    console.error(`Error fetching players for team ${teamId}:`, error);
    return null;
  }
}

// 이번 실행에서 받은 선수 행에 같은 시각을 찍는다. 화면은 팀의 최신 시각과 함께 받은 행만 '현재 선수단'으로 본다
// (응답에서 빠진 선수는 지우지 않으므로, 이 시각으로 이전 명단에만 있던 선수를 가린다)
const RUN_STARTED_AT = new Date().toISOString();

// 받은 선수 수를 돌려주고, 받기나 저장에 실패하면 null 을 돌려준다(그 팀의 이전 명단은 그대로 남는다)
async function importTeamPlayers(teamId: string, teamName: string): Promise<number | null> {
  if (!/^\d+$/.test(teamId)) {
    console.log(`Skipping non-numeric ID: ${teamId} (${teamName})`);
    return 0;
  }

  console.log(`Importing players for ${teamName} (${teamId})...`);

  const fetched = await fetchTeamPlayers(teamId);
  if (fetched === null) return null;

  // 다른 팀 ID 가 붙은 행은 넣지 않는다. 그 팀의 최신 수집 시각만 바꿔 기존 명단을 가리거나(roster-snapshot.ts),
  // teams_v2 에 없는 팀이면 외래 키 오류로 이 팀 전체 저장이 실패한다
  const otherTeam = fetched.filter(p => p.idTeam && p.idTeam !== teamId);
  if (otherTeam.length > 0) console.log(`   Skipped ${otherTeam.length} players listed under another team`);
  const players = Array.from(
    new Map(fetched.filter(p => !p.idTeam || p.idTeam === teamId).map(p => [p.idPlayer, p])).values()
  );

  if (players.length === 0) {
    console.log(`   No players found`);
    return 0;
  }

  console.log(`   Found ${players.length} players`);

  // Map to players_v2 schema
  const essentialPlayers = players.map(p => ({
    idPlayer: p.idPlayer,
    strPlayer: p.strPlayer,
    strTeam: p.strTeam || teamName,
    idTeam: teamId,
    strPosition: p.strPosition || null,
    strNumber: p.strNumber || null,
    strNationality: p.strNationality || null,
    strHeight: p.strHeight || null,
    strWeight: p.strWeight || null,
    dateBorn: p.dateBorn || null,
    strThumb: p.strThumb || null,
    strBirthLocation: p.strBirthLocation || null,
    updated_at: RUN_STARTED_AT,
  }));

  // Upsert into players_v2
  const { error } = await supa
    .from('players_v2')
    .upsert(essentialPlayers, {
      onConflict: 'idPlayer',
      ignoreDuplicates: false
    });

  if (error) {
    console.error(`   Error inserting players into players_v2:`, error);
    return null;
  }

  console.log(`   Successfully imported ${players.length} players to v2`);
  return players.length;
}

function parseMaxAgeDays(args: string[]): number | null {
  const arg = args.find(a => a.startsWith('--if-older-than-days='));
  if (!arg) return null;
  const days = Number(arg.split('=')[1]);
  if (!Number.isFinite(days) || days <= 0) throw new Error(`Invalid ${arg}`);
  return days;
}

// 팀마다 가장 최근 updated_at 을 그 팀의 마지막 수집 시각으로 본다. 7일이 지나 받을 차례였는데 실패하거나
// 시간 제한으로 못 받은 팀은 다음 실행에서 다시 받는다(강제 실행에서 실패한 7일 안의 팀은 7일이 지날 때까지 기다린다) (scripts/one-off/migrate-players-to-v2.ts 를 손으로 돌리면 그 시각도 여기 들어간다)
async function lastImportedByTeam(): Promise<Map<string, number>> {
  const latest = new Map<string, number>();
  for (let from = 0; ; from += TEAMS_PAGE_SIZE) {
    const { data, error } = await supa
      .from('players_v2')
      .select('idPlayer, idTeam, updated_at')
      .not('updated_at', 'is', null)
      .order('idPlayer', { ascending: true })
      .range(from, from + TEAMS_PAGE_SIZE - 1);
    if (error) throw new Error(`Error reading last import times: ${error.message}`);
    for (const row of data ?? []) {
      const at = Date.parse(row.updated_at);
      if (row.idTeam && !Number.isNaN(at) && at > (latest.get(row.idTeam) ?? -Infinity)) latest.set(row.idTeam, at);
    }
    if (!data || data.length < TEAMS_PAGE_SIZE) break;
  }
  return latest;
}

async function main() {
  const maxAgeDays = parseMaxAgeDays(process.argv.slice(2));

  // Get all target teams from standings_v2 (EPL, K1, K2)
  const teams: { teamId: string; teamName: string; leagueId: string }[] = [];
  for (let from = 0; ; from += TEAMS_PAGE_SIZE) {
    const { data, error } = await supa
      .from('standings_v2')
      .select('teamId, teamName, leagueId')
      .in('leagueId', ['4689', '4822', '4328', '4335', '4332', '4331', '4334']) // K1, K2, EPL, La Liga, Serie A, Bundesliga, Ligue 1
      .order('teamName', { ascending: true })
      .order('teamId', { ascending: true })
      .range(from, from + TEAMS_PAGE_SIZE - 1);
    if (error) throw new Error(`Error fetching teams: ${error.message}`);
    teams.push(...(data ?? []));
    if (!data || data.length < TEAMS_PAGE_SIZE) break;
  }
  if (teams.length === 0) throw new Error('No teams found in database');

  // hist_* 같은 과거 기록용 팀 ID 는 TheSportsDB 팀이 아니라 받을 명단이 없다
  const allTeams = Array.from(new Map(teams.filter(t => /^\d+$/.test(t.teamId)).map(t => [t.teamId, t])).values());

  // 선수가 한 명도 없는 팀(API 명단이 빈 팀 포함)은 수집 시각이 없어 매번 다시 확인한다
  let uniqueTeams = allTeams;
  if (maxAgeDays !== null) {
    const latest = await lastImportedByTeam();
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    uniqueTeams = allTeams.filter(t => (latest.get(t.teamId) ?? -Infinity) < cutoff);
    console.log(`${allTeams.length - uniqueTeams.length} of ${allTeams.length} teams were imported within ${maxAgeDays} days`);
    if (uniqueTeams.length === 0) {
      console.log('Nothing to import; skipping.');
      return;
    }
  }

  console.log('Starting player data import to PLAYERS_V2 table...');
  console.log(`Found ${uniqueTeams.length} unique teams to import`);

  let totalPlayers = 0;
  let successfulImports = 0;
  const failedTeams: string[] = [];

  for (const team of uniqueTeams) {
    const count = await importTeamPlayers(team.teamId, team.teamName);
    if (count === null) failedTeams.push(`${team.teamName} (${team.teamId})`);
    else if (count > 0) {
      totalPlayers += count;
      successfulImports++;
    }

    if (team !== uniqueTeams[uniqueTeams.length - 1]) {
      await delay(DELAY_MS);
    }
  }

  console.log('------------------------------------------------');
  console.log('Import Summary (V2):');
  console.log(`   Teams processed: ${uniqueTeams.length}`);
  console.log(`   Successful imports: ${successfulImports}`);
  console.log(`   Total players imported: ${totalPlayers}`);
  console.log(`   Failed teams: ${failedTeams.length}${failedTeams.length ? ` - ${failedTeams.join(', ')}` : ''}`);
  console.log('------------------------------------------------');

  // 워크플로 실행이 실패로 보이도록 종료 코드를 1 로 둔다
  if (failedTeams.length > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
