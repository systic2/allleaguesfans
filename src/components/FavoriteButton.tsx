import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { MAX_FAVORITES, type Favorite } from "@/lib/favorites";

// 상세 화면 머리의 즐겨찾기 토글
export default function FavoriteButton({ item }: { item: Omit<Favorite, "addedAt"> }) {
  const { isFavorite, toggle, refreshMeta, persistent } = useFavorites();
  const itemKey = `${item.type}:${item.id}`;
  // 다른 항목으로 이동하면(같은 컴포넌트가 재사용됨) 이전 항목의 안내는 보이지 않게 항목별로 둔다
  const [notice, setNotice] = useState<{ key: string; text: string } | null>(null);
  // 이 항목에서 버튼을 눌렀는지도 항목 키로 둔다 (효과로 초기화하면 항목이 바뀐 첫 렌더에 이전 값이 보임)
  const [actedKey, setActedKey] = useState<string | null>(null);
  const acted = actedKey === itemKey;
  const on = isFavorite(item.type, item.id);

  useEffect(() => {
    if (on) refreshMeta(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, itemKey, item.name, item.image]);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        aria-pressed={on}
        onClick={() => {
          const result = toggle(item);
          setActedKey(itemKey);
          setNotice(result === "full" ? { key: itemKey, text: `즐겨찾기는 최대 ${MAX_FAVORITES}개까지입니다. 다른 항목을 해제한 뒤 추가해 주세요.` } : null);
        }}
        className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm ${
          on ? "border-draw/60 bg-draw/10 text-draw" : "border-line bg-sunken text-ink/70 hover:text-ink"
        }`}
      >
        <Star className="h-4 w-4" fill={on ? "currentColor" : "none"} aria-hidden="true" />
        {on ? "즐겨찾기 해제" : "즐겨찾기"}
      </button>
      <span role="status" className="text-xs">
        {notice?.key === itemKey && <span className="text-draw">{notice.text}</span>}
        {/* 추가·해제 모두 저장되지 않았다면 알린다 (해제가 저장되지 않으면 새로고침 뒤 다시 나타남) */}
        {(on || acted) && !persistent && (
          <span className="text-ink/50">이 브라우저에서는 저장할 수 없어 이 탭을 닫으면 바뀐 내용이 사라집니다.</span>
        )}
      </span>
    </span>
  );
}
