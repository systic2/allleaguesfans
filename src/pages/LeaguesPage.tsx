import { useQuery } from "@tanstack/react-query";
import { fetchLeagues } from "../lib/api";
import type { League } from "../lib/types";

export default function LeaguesPage() {
  const { data, isLoading, error } = useQuery<League[], Error>({
    queryKey: ["leagues"],
    queryFn: fetchLeagues,
  });

  if (isLoading) return <p className="opacity-80">로딩 중…</p>;
  if (error)
    return (
      <pre className="text-red-400 whitespace-pre-wrap">
        에러: {error.message}
      </pre>
    );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">리그</h1>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        {data?.map((l) => (
          <li
            key={l.id}
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition shadow-md p-4"
          >
            <div className="text-base font-medium">{l.name}</div>
            <div className="text-xs opacity-70 mt-1">{l.country ?? "-"}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
