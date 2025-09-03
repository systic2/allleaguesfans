import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { listPlayersByTeamId } from './tsd';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

async function main(slug: 'kleague1'|'kleague2' = 'kleague1', year = 2025) {
  // 시즌 참가 팀 목록 + team.external.thesportsdb.teamId 필요
  const season = await sb.rpc('get_season_id', { p_slug: slug, p_year: year }).single().catch(async () => {
    const lg = await sb.from('leagues').select('id').eq('slug', slug).single();
    const ss = await sb.from('seasons').select('id').eq('league_id', lg.data!.id).eq('year', year).single();
    return { data: { get_season_id: ss.data!.id } } as any;
  });

  const st = await sb.from('season_teams')
    .select('team:teams(id, name, external)')
    .eq('season_id', season.data!.get_season_id);
  if (st.error) throw st.error;

  let upserts = 0;
  for (const row of st.data ?? []) {
    const tid = row.team.external?.thesportsdb?.teamId;
    if (!tid) continue;
    const players = await listPlayersByTeamId(String(tid));
    for (const p of players) {
      const ext = { thesportsdb: { playerId: p.idPlayer } };
      await sb.from('players').upsert({
        team_id: row.team.id,
        name: p.strPlayer,
        position: p.strPosition ?? null,
        nationality: p.strNationality ?? null,
        external: ext,
      }, { onConflict: 'team_id,name' });
      upserts++;
    }
  }
  console.log(`✅ players upserted=${upserts}`);
}

main().catch(e => { console.error(e); process.exit(1); });
