/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- 환경변수 ----
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TSD_KEY = Deno.env.get("THESPORTSDB_KEY") ?? "3";
const DEFAULT_YEAR = Number(Deno.env.get("SEASON_YEAR") ?? "2025");

// K리그 TheSportsDB 리그 ID
const K1 = 4689; // K League 1
const K2 = 4822; // K League 2

// v1 엔드포인트 (table/events 가용)
const TSD = "https://www.thesportsdb.com/api/v1/json";

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// ---- 유틸: 안전 파싱 ----
async function safeReadJson<T = any>(req: Request): Promise<T | null> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    const txt = await req.text();
    if (!txt.trim()) return null;
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

async function safeFetchJson<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("fetch not ok:", url, res.status);
      return null;
    }
    const txt = await res.text();
    if (!txt.trim()) return null;
    try {
      return JSON.parse(txt) as T;
    } catch (e) {
      console.warn("non-JSON body:", url, String(e));
      return null;
    }
  } catch (e) {
    console.warn("fetch error:", url, String(e));
    return null;
  }
}

type TableRow = {
  idTeam: string;
  intRank?: string;
  intPoints?: string;
  intWin?: string;
  intDraw?: string;
  intLoss?: string;
  intGoalsFor?: string;
  intGoalsAgainst?: string;
  strForm?: string;
};

type EventRow = {
  idEvent: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strStatus?: string | null;
  dateEvent?: string | null;
  strTime?: string | null;
  strTimestamp?: string | null;
  strVenue?: string | null;
};

// ---- 메인 핸들러 ----
Deno.serve(async (req) => {
  try {
    // year: 쿼리스트링 우선, 없으면 바디 JSON, 그래도 없으면 기본값
    const { searchParams } = new URL(req.url);
    let year = DEFAULT_YEAR;

    const qp = searchParams.get("year");
    if (qp && /^\d{4}$/.test(qp)) {
      year = parseInt(qp, 10);
    } else {
      const body = await safeReadJson<{ year?: number | string }>(req);
      const raw = body?.year;
      const n =
        typeof raw === "string"
          ? parseInt(raw, 10)
          : typeof raw === "number"
          ? raw
          : NaN;
      if (Number.isFinite(n) && n >= 1900) {
        year = n;
      }
    }

    const seasonIdK1 = await getSeasonId("kleague1", year);
    const seasonIdK2 = await getSeasonId("kleague2", year);

    const [st1, st2] = await Promise.all([
      syncStandings(K1, seasonIdK1, year),
      syncStandings(K2, seasonIdK2, year),
    ]);

    const [fx1, fx2] = await Promise.all([
      syncFixtures(K1, seasonIdK1, year),
      syncFixtures(K2, seasonIdK2, year),
    ]);

    return json({
      ok: true,
      year,
      standings: { k1: st1, k2: st2 },
      fixtures: { k1: fx1, k2: fx2 },
    });
  } catch (e) {
    console.error("handler error:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});

// ---- 도우미/업서트 로직 ----
async function getSeasonId(slug: string, year: number): Promise<string> {
  const { data: lg, error: e1 } = await sb
    .from("leagues")
    .select("id")
    .eq("slug", slug)
    .single();
  if (e1 || !lg) throw new Error(`league not found: ${slug}`);
  const { data: ss, error: e2 } = await sb
    .from("seasons")
    .select("id")
    .eq("league_id", lg.id)
    .eq("year", year)
    .single();
  if (e2 || !ss) throw new Error(`season not found: ${slug} ${year}`);
  return ss.id;
}

function toInt(v?: string) {
  return Number(v ?? 0) | 0;
}
function toMaybeInt(v?: string | null) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toIsoUtc(ts?: string | null, d?: string | null, t?: string | null) {
  if (ts && ts.includes("+")) return new Date(ts).toISOString();
  if (d && t) return new Date(`${d}T${t}Z`).toISOString();
  if (d) return new Date(`${d}T00:00:00Z`).toISOString();
  return null;
}
function hasScore(ev: EventRow) {
  return ev.intHomeScore != null && ev.intAwayScore != null;
}
function mapStatus(
  ev: EventRow
): "SCHEDULED" | "LIVE" | "HT" | "FT" | "PEN" | "PST" | "CAN" {
  const s = (ev.strStatus ?? "").toLowerCase();
  if (!s) {
    const k = toIsoUtc(ev.strTimestamp, ev.dateEvent, ev.strTime);
    if (k && new Date(k).getTime() > Date.now()) return "SCHEDULED";
  }
  if (s.includes("live")) return "LIVE";
  if (s.includes("half")) return "HT";
  if (s.includes("pen")) return "PEN";
  if (s.includes("post") || s.includes("suspend")) return "PST";
  if (s.includes("cancel")) return "CAN";
  if (s.includes("finish") || s.includes("ft") || hasScore(ev)) return "FT";
  return "SCHEDULED";
}

async function findTeamByTsdId(idTeam: string) {
  const { data, error } = await sb
    .from("teams")
    .select("id,name,external")
    .contains("external", { thesportsdb: { teamId: idTeam } })
    .maybeSingle();
  if (error) console.warn("team lookup error", error.message);
  return data ?? null;
}

async function fetchTsdTable(leagueId: number, year: number) {
  const variants = [`${year}`, `${year - 1}-${year}`]; // 단일연도, 스플릿연도 폴백
  for (const s of variants) {
    const j = await safeFetchJson<{ table?: TableRow[] }>(`${TSD}/${TSD_KEY}/lookuptable.php?l=${leagueId}&s=${s}`);
    if (j?.table && j.table.length) return j.table;
  }
  return null;
}

async function deriveStandingsFromFixtures(seasonId: string) {
  const { data: fx, error } = await sb
    .from("fixtures")
    .select("home_team_id,away_team_id,score_home,score_away,kickoff,status")
    .eq("season_id", seasonId)
    .in("status", ["FT", "PEN"])
    .order("kickoff", { ascending: true });
  if (error) throw error;

  type Stat = { played: number; win: number; draw: number; loss: number; gf: number; ga: number; points: number; formArr: string[] };
  const stat = new Map<string, Stat>();
  const ensure = (id: string): Stat => {
    let s = stat.get(id);
    if (!s) { s = { played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, points: 0, formArr: [] }; stat.set(id, s); }
    return s;
  };
  
  const seasonSet = await getSeasonTeamSet(seasonId); // ★ 추가

  for (const f of fx ?? []) {
    const H = (f as any).home_team_id as string;
    const A = (f as any).away_team_id as string;
    const sh = (f as any).score_home as number | null;
    const sa = (f as any).score_away as number | null;
    if (!seasonSet.has(H) || !seasonSet.has(A)) continue;

    const h = ensure(H), a = ensure(A);
    h.played++; a.played++;
    h.gf += sh; h.ga += sa;
    a.gf += sa; a.ga += sh;

    if (sh > sa) { h.win++; a.loss++; h.points += 3; h.formArr.push("W"); a.formArr.push("L"); }
    else if (sh < sa) { a.win++; h.loss++; a.points += 3; a.formArr.push("W"); h.formArr.push("L"); }
    else { h.draw++; a.draw++; h.points += 1; a.points += 1; h.formArr.push("D"); a.formArr.push("D"); }
  }

  let upserts = 0;
  for (const [teamId, s] of stat) {
    const form = s.formArr.slice(-5).join("");
    const { error: e } = await sb.from("standings").upsert(
      {
        season_id: seasonId,
        team_id: teamId,
        played: s.played, win: s.win, draw: s.draw, loss: s.loss,
        gf: s.gf, ga: s.ga, points: s.points, form,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "season_id,team_id" }
    );
    if (!e) upserts++;
  }
  return upserts;
}

async function syncStandings(leagueId: number, seasonId: string, year: number) {
  // 1) TSD 순위 시도
  const table = await fetchTsdTable(leagueId, year);
  let upserts = 0;

  if (table) {
    for (const row of table) {
      if (!row.idTeam) continue;
      const team = await findTeamByTsdId(row.idTeam);
      if (!team) continue;

      const payload = {
        played: toInt(row.intWin) + toInt(row.intDraw) + toInt(row.intLoss),
        win: toInt(row.intWin),
        draw: toInt(row.intDraw),
        loss: toInt(row.intLoss),
        gf: toInt(row.intGoalsFor),
        ga: toInt(row.intGoalsAgainst),
        points: toInt(row.intPoints),
        form: (row.strForm ?? "").replaceAll(" ", "").toUpperCase(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await sb.from("standings").upsert(
        { season_id: seasonId, team_id: team.id, ...payload },
        { onConflict: "season_id,team_id" }
      );
      if (!error) upserts++;
    }
  }

  // 2) upserts가 0이면 fixtures에서 파생 계산
  if (upserts === 0) {
    const derived = await deriveStandingsFromFixtures(seasonId);
    return { upserts: derived, source: "DERIVED" as const };
  }

  // ... (TSD 테이블 업서트 완료 후) 또는 (DERIVED 계산 후)
  const baselineAdded = await ensureAllTeamsInStandings(seasonId);

  if (upserts === 0) {
    // 파생 계산 + 베이스라인
    return { upserts: baselineAdded /* + derived 수 */, source: "DERIVED" as const };
  }
  // TSD 결과 + 베이스라인 포함
  return { upserts: upserts + baselineAdded, source: "TSD" as const };
}


async function syncFixtures(leagueId: number, seasonId: string, year: number) {
  const next = await safeFetchJson<{ events?: EventRow[] }>(
    `${TSD}/${TSD_KEY}/eventsnextleague.php?id=${leagueId}`
  );
  const past = await safeFetchJson<{ events?: EventRow[] }>(
    `${TSD}/${TSD_KEY}/eventspastleague.php?id=${leagueId}`
  );
  const rows = dedupById(
    [...(next?.events ?? []), ...(past?.events ?? [])],
    (e) => e.idEvent
  );

  const seasonSet = await getSeasonTeamSet(seasonId); // ★ 추가

  let inserts = 0,
    updates = 0;
  for (const ev of rows) {
    if (!ev.idEvent || !ev.idHomeTeam || !ev.idAwayTeam) continue;

    const home = await findTeamByTsdId(ev.idHomeTeam);
    const away = await findTeamByTsdId(ev.idAwayTeam);
    if (!home || !away) continue;

    // ★ 시즌 참가팀만 저장 (외부 리그/친선 경기 차단)
    if (!seasonSet.has(home.id) || !seasonSet.has(away.id)) continue;

    const kickoff = toIsoUtc(ev.strTimestamp, ev.dateEvent, ev.strTime);
    const status = mapStatus(ev);

    const { data: exist } = await sb
      .from("fixtures")
      .select("id")
      .contains("external", { thesportsdb: { eventId: ev.idEvent } })
      .maybeSingle();

    if (exist?.id) {
      const { error } = await sb
        .from("fixtures")
        .update({
          season_id: seasonId,
          round: null,
          kickoff,
          status,
          venue: ev.strVenue ?? null,
          home_team_id: home.id,
          away_team_id: away.id,
          score_home: toMaybeInt(ev.intHomeScore),
          score_away: toMaybeInt(ev.intAwayScore),
          updated_at: new Date().toISOString(),
        })
        .eq("id", exist.id);
      if (!error) updates++;
      else console.error("fixtures update error", error.message);
    } else {
      const { error } = await sb.from("fixtures").insert({
        season_id: seasonId,
        round: null,
        kickoff,
        status,
        venue: ev.strVenue ?? null,
        home_team_id: home.id,
        away_team_id: away.id,
        score_home: toMaybeInt(ev.intHomeScore),
        score_away: toMaybeInt(ev.intAwayScore),
        external: { thesportsdb: { eventId: ev.idEvent } },
      });
      if (!error) inserts++;
      else console.error("fixtures insert error", error.message);
    }
  }
  return { inserts, updates, source: "TSD" };
}

function dedupById<T>(arr: T[], get: (x: T) => string | undefined) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = get(x);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// season_teams를 기준으로 standings에 없는 팀을 0값으로 채움
async function ensureAllTeamsInStandings(seasonId: string) {
  const { data: sRows } = await sb
    .from("standings")
    .select("team_id")
    .eq("season_id", seasonId);
  const existing = new Set((sRows ?? []).map(r => r.team_id));

  const { data: stRows, error } = await sb
    .from("season_teams")
    .select("team_id")
    .eq("season_id", seasonId);
  if (error) throw error;

  let added = 0;
  for (const r of stRows ?? []) {
    if (!existing.has(r.team_id)) {
      const { error: e } = await sb.from("standings").insert({
        season_id: seasonId,
        team_id: r.team_id,
        played: 0, win: 0, draw: 0, loss: 0,
        gf: 0, ga: 0, points: 0, form: "",
        updated_at: new Date().toISOString(),
      });
      if (!e) added++;
    }
  }
  return added;
}

async function getSeasonTeamSet(seasonId: string): Promise<Set<string>> {
  const { data } = await sb.from("season_teams").select("team_id").eq("season_id", seasonId);
  return new Set((data ?? []).map((r: any) => r.team_id as string));
}

