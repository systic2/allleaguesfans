import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Star, X } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { MAX_FAVORITES, favoriteHref, type Favorite, type FavoriteType } from "@/lib/favorites";
import CrestImg from "@/app/components/CrestImg";
import { SegmentedControl } from "@/components/FilterBar";

const TYPE_OPTIONS: { value: "" | FavoriteType; label: string }[] = [
  { value: "", label: "전체" },
  { value: "league", label: "리그" },
  { value: "team", label: "팀" },
  { value: "player", label: "선수" },
];
const GROUP_LABELS: Record<FavoriteType, string> = { league: "리그", team: "팀", player: "선수" };

// /favorites?type=team — 이 브라우저에 저장한 즐겨찾기
export default function FavoritesPage() {
  const [params, setParams] = useSearchParams();
  const { favorites, persistent, remove } = useFavorites();
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const rawType = params.get("type") ?? "";
  const type = TYPE_OPTIONS.some((o) => o.value === rawType) ? (rawType as "" | FavoriteType) : "";

  const groups = (["league", "team", "player"] as FavoriteType[])
    .filter((t) => !type || t === type)
    .map((t) => ({ type: t, items: favorites.filter((fav) => fav.type === t) }))
    .filter((group) => group.items.length > 0);

  // 해제한 뒤 키보드 포커스를 다음 항목의 해제 버튼(없으면 제목)으로 옮기고 결과를 읽어 준다
  const handleRemove = (fav: Favorite) => {
    const visible = groups.flatMap((group) => group.items);
    const index = visible.findIndex((item) => item.type === fav.type && item.id === fav.id);
    const nextItem = visible[index + 1] ?? visible[index - 1];
    remove(fav.type, fav.id);
    setAnnouncement(`${fav.name} 즐겨찾기를 해제했습니다.`);
    requestAnimationFrame(() => {
      const target = nextItem && document.querySelector<HTMLButtonElement>(`[data-fav-remove="${nextItem.type}:${CSS.escape(nextItem.id)}"]`);
      (target ?? headingRef.current)?.focus();
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-ink focus:outline-none">즐겨찾기</h1>
        <p role="status" className="text-xs text-ink/50">
          {persistent
            ? `이 브라우저에만 저장됩니다 (최대 ${MAX_FAVORITES}개, 지금 ${favorites.length}개).`
            : "이 브라우저에서는 저장할 수 없어 이 탭을 닫으면 사라집니다."}
        </p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      <SegmentedControl
        label="종류"
        options={TYPE_OPTIONS}
        value={type}
        onChange={(value) => setParams((prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set("type", value);
          else next.delete("type");
          return next;
        })}
      />

      {groups.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-4 text-sm text-ink/60">
          <p className="text-ink">즐겨찾기가 없습니다.</p>
          <p className="mt-1">
            리그·팀·선수 화면의 <Star className="inline h-3.5 w-3.5" aria-hidden="true" /> 즐겨찾기 버튼으로 추가하세요.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.type} aria-label={GROUP_LABELS[group.type]} className="rounded-lg border border-line bg-panel">
            <h2 className="border-b border-line px-4 py-2 text-sm font-bold text-ink/70">
              {GROUP_LABELS[group.type]} <span className="font-normal text-ink/40">{group.items.length}</span>
            </h2>
            <ul>
              {group.items.map((fav) => (
                <li key={`${fav.type}-${fav.id}`} className="flex items-center border-b border-line last:border-0">
                  <Link to={favoriteHref(fav)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-4 hover:bg-raised">
                    <CrestImg src={fav.image} alt="" size={24} className={fav.type === "player" ? "rounded-full" : ""} />
                    <span className="truncate text-sm text-ink">{fav.name}</span>
                  </Link>
                  <button
                    type="button"
                    data-fav-remove={`${fav.type}:${fav.id}`}
                    onClick={() => handleRemove(fav)}
                    aria-label={`${fav.name} 즐겨찾기 해제`}
                    className="flex size-11 shrink-0 items-center justify-center text-ink/50 hover:text-loss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
