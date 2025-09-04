// src/app/components/SearchBox.tsx
import { useEffect, useState } from "react";
import {
  searchLeagues,
  searchTeamsInSeason,
  getSeasonId,
  type TeamLite,
  type LeagueLite,
} from "@/features/season/api";

export default function SearchBox() {
  const [keyword, setKeyword] = useState("");
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [leagues, setLeagues] = useState<LeagueLite[]>([]);
  const [teams, setTeams] = useState<TeamLite[]>([]);

  useEffect(() => {
    let alive = true;

    async function run() {
      const [ls] = await Promise.all([searchLeagues(keyword, 5)]);
      if (!alive) return;
      setLeagues(ls);

      if (seasonId != null) {
        const ts = await searchTeamsInSeason(seasonId, keyword, 10);
        if (!alive) return;
        setTeams(ts);
      } else {
        setTeams([]);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [keyword, seasonId]);

  // 예시: 기본 시즌 ID 로딩 (필요 시 제거/변경)
  useEffect(() => {
    let alive = true;
    (async () => {
      const id = await getSeasonId("k-league-1"); // 기본 리그 예시
      if (alive) setSeasonId(id);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="검색어 입력"
        className="w-72 rounded-lg border border-white/20 bg-transparent px-3 py-2"
      />
      <section>
        <h4 className="text-sm text-white/60 mb-1">리그</h4>
        <ul className="list-disc pl-5">
          {leagues.map((l) => (
            <li key={l.id}>{l.name}</li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="text-sm text-white/60 mb-1">팀</h4>
        <ul className="list-disc pl-5">
          {teams.map((t) => (
            <li key={t.id}>{t.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
