import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { listSeasonEvents } from './tsd';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const LEAGUES = { kleague1: 4689, kleague2: 4822 } as const;

async function getSeasonId(slug: keyof typeof LEAGUES, year: number) {
  const lg = await sb.from('leagues').select('id').eq('slug', slug).single();
  const ss = await sb.from('seasons').select('id').eq('league_id', lg.data!.id).eq('year', year).single();
  return ss.data!.id as string;
}
async function mapTeamId(tsdTeamId: string): Promise<string | null> {
  const q = await sb.from('teams').select('id')
    .eq('external->thesportsdb->>teamId', String(tsdTeamId)).maybeSingle();
  return q.data?.id ?? null;
}

async function main(slug: keyof typeof LEAGUES = 'kleague1', year = 2025) {
  const leagueId = LEAGUES[slug];
  const seasonId = await getSeasonId(slug, year);

  const events = await listSeasonEvents(leagueId, String(year)); // K리그는 단일연도
  let ins = 0, upd = 0;

  for (const e of events) {
    const homeId = e.idHomeTeam ? await mapTeamId(e.idHomeTeam) : null;
    const awayId = e.idAwayTeam ? await mapTeamId(e.idAwayTeam) : null;
    if (!homeId || !awayId) continue;

    const payload = {
      season_id: seasonId,
      event_date: e.dateEvent,
      home_team_id: homeId,
      away_team_id: awayId,
      home_score: e.intHomeScore ? Number(e.intHomeScore) : null,
      away_score: e.intAwayScore ? Number(e.intAwayScore) : null,
      external: { thesportsdb: { eventId: e.idEvent } },
    };

    const exists = await sb.from('fixtures').select('id')
      .eq('season_id', seasonId)
      .eq('home_team_id', homeId)
      .eq('away_team_id', awayId)
      .eq('event_date', e.dateEvent)
      .maybeSingle();

    if (exists.data) {
      const r = await sb.from('fixtures').update(payload).eq('id', exists.data.id);
      if (!r.error) upd++;
    } else {
      const r = await sb.from('fixtures').insert(payload);
      if (!r.error) ins++;
    }
  }
  console.log(`✅ fixtures inserts=${ins}, updates=${upd}`);
}

main().catch(e => { console.error(e); process.exit(1); });
