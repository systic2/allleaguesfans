import { useQuery } from "@tanstack/react-query";
import { fetchLeagues } from "../lib/api";
import type { League } from "../lib/types";
import { Link } from "react-router-dom";

export default function LeagueListPage() {
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
        {data?.map((l) => {
          // slug가 없을 가능성에 대한 안전 가드
          const to = l.slug ? `/leagues/${l.slug}` : "#";
          const disabled = !l.slug;

          return (
            <li key={l.id}>
              <Link
                to={to}
                aria-disabled={disabled}
                className={`block rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition shadow-md p-4 focus:outline-none focus:ring-2 focus:ring-sky-400/50 ${
                  disabled ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <div className="text-base font-medium">{l.name}</div>
                <div className="text-xs opacity-70 mt-1">
                  {l.country ?? "-"}
                  {l.tier != null && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
                      T{l.tier}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
