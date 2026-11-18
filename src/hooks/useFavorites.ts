import { useCallback, useSyncExternalStore } from "react";
import {
  getFavorites, isFavoritesPersistent, subscribeFavorites, toggleFavorite, updateFavoriteMeta, updateFavorites,
  type Favorite, type ToggleResult,
} from "@/lib/favorites";

/** 즐겨찾기 목록과 토글. 모든 화면이 같은 저장소를 구독한다 */
export function useFavorites() {
  const favorites = useSyncExternalStore(subscribeFavorites, getFavorites, getFavorites);
  const persistent = useSyncExternalStore(subscribeFavorites, isFavoritesPersistent, isFavoritesPersistent);

  /** 화면에 보이던 상태의 반대로 맞춘다 (저장소를 다시 읽은 값을 뒤집지 않는다) */
  const toggle = useCallback((item: Omit<Favorite, "addedAt">): ToggleResult["result"] => {
    const want = !favorites.some((fav) => fav.type === item.type && fav.id === item.id);
    let result: ToggleResult["result"] = "added";
    updateFavorites((current) => {
      const toggled = toggleFavorite(current, item, undefined, want);
      result = toggled.result;
      return toggled.favorites;
    });
    return result;
  }, [favorites]);

  const remove = useCallback((type: Favorite["type"], id: string) => {
    updateFavorites((current) =>
      current.some((fav) => fav.type === type && fav.id === id)
        ? current.filter((fav) => !(fav.type === type && fav.id === id))
        : current);
  }, []);

  /** 즐겨찾기한 항목의 상세 화면에서 이름·이미지가 바뀌었으면 저장값도 맞춘다 */
  const refreshMeta = useCallback((item: Omit<Favorite, "addedAt">) => {
    updateFavorites((current) => updateFavoriteMeta(current, item));
  }, []);

  const isFavorite = useCallback(
    (type: Favorite["type"], id: string) => favorites.some((fav) => fav.type === type && fav.id === id),
    [favorites],
  );

  return { favorites, persistent, toggle, remove, refreshMeta, isFavorite };
}
