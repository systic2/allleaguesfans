import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchByName } from "@/lib/api";

type GSRow = {
  type: "league" | "team" | "player";
  entity_id: number;
  name: string;
  slug?: string;
  team_id?: number;
  crest_url?: string | null;
  short_name?: string | null;
};

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";

  const { data } = useQuery<GSRow[]>({
    queryKey: ["search-page", q],
    queryFn: async () => (await searchByName(q)) as unknown as GSRow[],
    enabled: q.trim().length > 0,
  });

  const rows: GSRow[] = data ?? ([] as GSRow[]);
  if (rows.length === 0) return <p>검색 결과가 없습니다.</p>;

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        let href = "#";
        if (r.type === "team") href = `/teams/${r.team_id ?? r.entity_id}`;
        else if (r.type === "league") href = `/leagues/${r.slug ?? ""}`;
        else href = `/players/${r.entity_id}`;

        return (
          <li key={`${r.type}-${r.entity_id}`}>
            <Link to={href} className="hover:underline">
              {r.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
