// 실행: pnpm tsx --env-file=.env scripts/backfill-logos.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SB_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TSD_KEY = process.env.THESPORTSDB_KEY || '3';
const TSD = `https://www.thesportsdb.com/api/v1/json/${TSD_KEY}`;

const sb = createClient(SB_URL, SB_SERVICE_ROLE, { auth: { persistSession: false } });

async function getBadge(teamId: string): Promise<string | null> {
  try {
    const r = await fetch(`${TSD}/lookupteam.php?id=${teamId}`);
    if (!r.ok) return null;
    const j = await r.json();
    const badge = j?.teams?.[0]?.strTeamBadge as string | undefined;
    return badge || null;
  } catch (_) { return null; }
}

async function main() {
  // crest_url이 없거나 빈 팀들만 타깃
  const { data, error } = await sb
    .from('teams')
    .select('id, name, crest_url, external')
    .or('crest_url.is.null,crest_url.eq.')
    .limit(500);
  if (error) throw error;

  let updated = 0;
  for (const t of data ?? []) {
    const teamId = t.external?.thesportsdb?.teamId as string | undefined;
    if (!teamId) continue;
    const badge = await getBadge(teamId);
    if (!badge) continue;

    const { error: upErr } = await sb.from('teams').update({ crest_url: badge }).eq('id', t.id);
    if (!upErr) updated++;
  }
  console.log(`✅ backfill complete. updated=${updated}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
