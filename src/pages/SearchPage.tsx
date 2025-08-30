import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchByName } from "../lib/api";
import type { SearchRow } from "../lib/types";

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const { data, isLoading, error } = useQuery<SearchRow[], Error>({
    queryKey: ["search-full", q],
    queryFn: () => searchByName(q),
    enabled: q.trim().length > 0,
  });

  if (!q) return <p>검색어를 입력해 주세요.</p>;
  if (isLoading) return <p>로딩 중…</p>;
  if (error)
    return (
      <pre className="text-red-500 whitespace-pre-wrap">
        에러: {error.message}
      </pre>
    );
  if (!data || data.length === 0) return <p>검색 결과가 없습니다.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-3">“{q}” 검색 결과</h1>
      <ul className="space-y-2">
        {data.map((r) => {
          const href =
            r.type === "team"
              ? `/teams/${r.entity_id}`
              : `/players/${r.entity_id}`;
          return (
            <li
              key={`${r.type}-${r.entity_id}`}
              className="rounded-xl border p-3"
            >
              <span className="text-xs uppercase opacity-70 mr-2">
                {r.type}
              </span>
              <Link to={href} className="underline">
                {r.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
