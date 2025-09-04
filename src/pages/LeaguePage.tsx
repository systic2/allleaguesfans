// src/pages/LeaguesPage.tsx
import { useQuery } from "@tanstack/react-query";
import { fetchLeagues, type LeagueLite } from "@/lib/api";
import { Link } from "react-router-dom";

export default function LeaguesPage() {
  const { data, isLoading, error } = useQuery<LeagueLite[]>({
    queryKey: ["leagues"],
    queryFn: fetchLeagues,
  });

  if (isLoading) return <div className="p-6">로딩중…</div>;
  if (error) {
    // 🔐 기존 화면 문구 스타일 유지
    return (
      <div className="p-6 text-red-400">에러: {(error as Error).message}</div>
    );
  }

  const leagues = (data ?? []).sort((a, b) =>
    a.name.localeCompare(b.name, "en")
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">리그</h1>
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {leagues.map((l) => (
          <li key={l.id} className="border border-white/10 rounded-xl p-4">
            <Link to={`/leagues/${l.slug}`} className="hover:underline">
              {l.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
