import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSeasonId,
  searchTeamsInSeason,
  searchLeagues,
  type TeamLite,
  type LeagueLite,
} from "@/features/season/api";

type Props = {
  leagueSlug?: "kleague1" | "kleague2";
  year?: number;
};

export default function SearchBox({
  leagueSlug = "kleague1",
  year = 2025,
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamLite[]>([]);
  const [leagues, setLeagues] = useState<LeagueLite[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  // 시즌 ID 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const id = await getSeasonId(leagueSlug, year);
        if (alive) setSeasonId(id);
      } catch (e) {
        console.error(e);
        setSeasonId(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [leagueSlug, year]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // 디바운스 검색 (리그 + 팀 동시)
  useEffect(() => {
    const keyword = q.trim();
    if (!keyword) {
      setTeams([]);
      setLeagues([]);
      return;
    }

    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const [lg, tm] = await Promise.all([
          searchLeagues(keyword, 5),
          seasonId
            ? searchTeamsInSeason(seasonId, keyword, 10)
            : Promise.resolve([]),
        ]);
        setLeagues(lg);
        setTeams(tm);
        setOpen(true);
      } catch (e) {
        console.error(e);
        setLeagues([]);
        setTeams([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(t);
  }, [q, seasonId]);

  const empty = useMemo(
    () => !loading && q.trim() && leagues.length === 0 && teams.length === 0,
    [loading, q, leagues.length, teams.length]
  );

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim() && setOpen(true)}
        placeholder="리그 / 팀 검색…"
        className="w-full rounded-xl bg-white/90 dark:bg-black/30 border border-white/20 px-4 py-3 outline-none"
      />

      {open && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl border border-white/10 bg-white/95 dark:bg-black/90 shadow-xl max-h-96 overflow-auto z-20">
          {loading && (
            <div className="px-4 py-3 text-sm opacity-70">검색 중…</div>
          )}
          {empty && (
            <div className="px-4 py-3 text-sm opacity-70">결과 없음</div>
          )}
          // ✅ 리그 섹션 (반드시 slug로 이동)
          {!loading && leagues.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 text-[11px] uppercase opacity-60">
                리그
              </div>
              {leagues.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                    if (l.slug) {
                      nav(`/leagues/${l.slug}`); // ← 여기!
                    } else {
                      // slug가 비어있으면 안전 fallback
                      nav(`/leagues`);
                    }
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                >
                  <span className="text-sm font-medium">{l.name}</span>
                  {l.tier != null && (
                    <span className="text-xs opacity-60">T{l.tier}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          // ✅ 팀 섹션 (team id로 이동)
          {!loading && teams.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 text-[11px] uppercase opacity-60">
                팀
              </div>
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                    nav(`/teams/${t.id}`); // ← 팀 경로만
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                >
                  {t.crest_url ? (
                    <img
                      src={t.crest_url}
                      alt={t.name}
                      className="w-5 h-5 object-contain"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded bg-white/10" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t.name}</span>
                    {t.short_name && (
                      <span className="text-xs opacity-60">{t.short_name}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
