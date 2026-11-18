import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchByName } from "@/lib/api";
import type { SearchRow } from "@/domain/types";
import { SEARCH_SCOPE_TEXT, groupSearchRows, searchResultHref } from "@/lib/search";
import { SearchResultRow } from "@/app/components/GlobalSearch";

// 검색창의 Enter 결과 화면. 1글자 검색도 여기서 한다
export default function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();

  const { data, isLoading, isError } = useQuery<SearchRow[]>({
    queryKey: ["search-page", q],
    queryFn: () => searchByName(q),
    enabled: q.length > 0,
  });

  const groups = data ? groupSearchRows(data, q) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-bold text-ink">{q ? `'${q}' 검색 결과` : "검색"}</h1>

      {!q ? (
        <p className="text-sm text-ink/60">검색창에 리그·팀·선수 이름을 입력하세요. {SEARCH_SCOPE_TEXT}</p>
      ) : isLoading ? (
        <p className="text-sm text-ink/70">로딩중…</p>
      ) : isError ? (
        <p className="text-sm text-loss">검색하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-4 text-sm text-ink/60">
          <p className="font-medium text-ink">검색 결과 없음</p>
          <p className="mt-1">{SEARCH_SCOPE_TEXT} 다른 검색어를 입력해 보세요.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.type} aria-label={group.label} className="rounded-lg border border-line bg-panel">
            <h2 className="border-b border-line px-4 py-2 text-sm font-bold text-ink/70">
              {group.label} <span className="font-normal text-ink/40">{group.rows.length}</span>
            </h2>
            <ul>
              {group.rows.map((row, idx) => (
                <li key={`${row.type}-${searchResultHref(row)}-${idx}`} className="border-b border-line last:border-0">
                  <Link to={searchResultHref(row)} className="flex min-h-11 items-center px-4 hover:bg-raised">
                    <SearchResultRow row={row} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
