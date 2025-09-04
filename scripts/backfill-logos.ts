// scripts/backfill-logos.ts
// 실행 예:
//   pnpm tsx --env-file=.env scripts/backfill-logos.ts --dry-run --limit=200 --concurrency=6 --sleep=120
//
// 기능:
// - teams 테이블 중 crest_url이 null 또는 빈 문자열("")인 팀을 대상으로
//   TheSportsDB에서 배지를 조회해 crest_url을 채웁니다.
// - --dry-run: DB 업데이트를 수행하지 않고 예정 변경만 로그로 표시
// - --limit: 최대 처리 팀 수 제한 (기본 500)
// - --concurrency: 동시 처리 개수 (기본 4)
// - --sleep: 각 요청 사이 지연(ms) (기본 150ms)

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// -----------------------------
// 환경 변수 로드 & 검증
// -----------------------------
const SB_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SB_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TSD_KEY = process.env.THESPORTSDB_KEY || "3";

if (!SB_URL || !SB_SERVICE_ROLE) {
  // eslint-disable-next-line no-console
  console.error(
    "[backfill-logos] 환경변수 누락: VITE_SUPABASE_URL(or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY 가 필요합니다."
  );
  process.exit(1);
}

const TSD = `https://www.thesportsdb.com/api/v1/json/${TSD_KEY}`;
const sb = createClient(SB_URL, SB_SERVICE_ROLE, {
  auth: { persistSession: false },
});

// -----------------------------
// CLI 옵션 파싱 (간단 버전)
// -----------------------------
type CliOptions = {
  dryRun: boolean;
  limit: number;
  concurrency: number;
  sleep: number;
};

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const opt: CliOptions = {
    dryRun: args.includes("--dry-run"),
    limit: 500,
    concurrency: 4,
    sleep: 150,
  };
  for (const a of args) {
    if (a.startsWith("--limit=")) opt.limit = Number(a.split("=")[1] || "0") || 0;
    if (a.startsWith("--concurrency="))
      opt.concurrency = Number(a.split("=")[1] || "0") || 0;
    if (a.startsWith("--sleep="))
      opt.sleep = Number(a.split("=")[1] || "0") || 0;
  }
  if (opt.limit <= 0) opt.limit = 500;
  if (opt.concurrency <= 0) opt.concurrency = 4;
  if (opt.sleep < 0) opt.sleep = 150;
  return opt;
}

const OPT = parseCliOptions();

// -----------------------------
// 타입 정의 (우리가 쓰는 최소 필드만)
// -----------------------------
type ExternalMeta = {
  thesportsdb?: { teamId?: string | null } | null;
} | null;

type TeamRow = {
  id: number;
  name: string;
  crest_url: string | null;
  external: ExternalMeta;
};

type TsdLookupTeam = {
  teams?: Array<{
    idTeam?: string | null;
    strTeam?: string | null;
    strTeamBadge?: string | null;
  }> | null;
};

// -----------------------------
// 유틸
// -----------------------------
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function getBadge(teamId: string): Promise<string | null> {
  try {
    const r = await fetch(`${TSD}/lookupteam.php?id=${encodeURIComponent(teamId)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as TsdLookupTeam;
    const badge = j?.teams?.[0]?.strTeamBadge ?? null;
    return badge || null;
  } catch (_err: unknown) {
    return null;
  }
}

/**
 * 간단한 동시성 제한 실행기 (외부 패키지 없이)
 */
async function withConcurrency<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency: number,
  sleepMs = 0
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  async function runOne(seq: number): Promise<void> {
    while (true) {
      const myIdx = idx++;
      if (myIdx >= items.length) return;
      const item = items[myIdx];

      // worker 실행
      const r = await worker(item, myIdx);
      results[myIdx] = r;

      // API 예절: 요청 간 딜레이
      if (sleepMs > 0) await sleep(sleepMs);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, (_, i) =>
    runOne(i)
  );
  await Promise.all(runners);
  return results;
}

// -----------------------------
// 메인 로직
// -----------------------------
async function main(): Promise<void> {
  // 1) 타깃 팀 조회: crest_url IS NULL OR crest_url == ''
  const { data, error } = await sb
    .from("teams")
    .select("id, name, crest_url, external")
    .or("crest_url.is.null,crest_url.eq.")
    .limit(OPT.limit);

  if (error) throw error;

  const targets: TeamRow[] = (data ?? []).filter((t): t is TeamRow => !!t);

  if (targets.length === 0) {
    // eslint-disable-next-line no-console
    console.log("ℹ️  업데이트 대상 팀이 없습니다.");
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `▶️  처리 대상: ${targets.length}개 | dryRun=${OPT.dryRun} | concurrency=${OPT.concurrency} | sleep=${OPT.sleep}ms`
  );

  let updated = 0;

  await withConcurrency(
    targets,
    async (t) => {
      const teamId = t.external?.thesportsdb?.teamId ?? null;
      if (!teamId) return { id: t.id, ok: false, reason: "no-teamId" as const };

      const badge = await getBadge(teamId);
      if (!badge) return { id: t.id, ok: false, reason: "no-badge" as const };

      if (OPT.dryRun) {
        // eslint-disable-next-line no-console
        console.log(`DRY: would update team#${t.id} (${t.name}) -> ${badge}`);
        return { id: t.id, ok: true as const, dry: true as const };
      }

      const { error: upErr } = await sb
        .from("teams")
        .update({ crest_url: badge })
        .eq("id", t.id);

      if (!upErr) {
        updated++;
        return { id: t.id, ok: true as const };
      } else {
        return { id: t.id, ok: false, reason: "update-failed" as const };
      }
    },
    OPT.concurrency,
    OPT.sleep
  );

  // eslint-disable-next-line no-console
  console.log(`✅ backfill complete. updated=${updated}/${targets.length}`);
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
