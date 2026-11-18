// src/lib/favorites.ts
// 리그·팀·선수 즐겨찾기 (docs/prd.md COMMON-01). 로그인 없이 이 브라우저의 localStorage 에만 둔다.
// 저장소를 쓸 수 없는 환경(사파리 비공개 모드, 차단된 사이트 데이터 등)에서는 이 탭의 메모리에만 남는다.

export type FavoriteType = "league" | "team" | "player";

export interface Favorite {
  type: FavoriteType;
  /** 화면 주소의 ID: 리그는 slug, 팀·선수는 TheSportsDB ID */
  id: string;
  name: string;
  image: string | null;
  addedAt: string;
}

export const FAVORITES_KEY = "alf:favorites:v1";
export const MAX_FAVORITES = 100;

const TYPES: FavoriteType[] = ["league", "team", "player"];

export function favoriteHref(fav: Pick<Favorite, "type" | "id">): string {
  if (fav.type === "league") return `/leagues/${fav.id}`;
  if (fav.type === "team") return `/teams/${fav.id}`;
  return `/players/${fav.id}`;
}

function isFavorite(value: unknown): value is Favorite {
  const v = value as Partial<Favorite> | null;
  return !!v && TYPES.includes(v.type as FavoriteType) && typeof v.id === "string" && v.id !== ""
    && typeof v.name === "string" && (v.image === null || typeof v.image === "string") && typeof v.addedAt === "string";
}

/** 저장된 문자열을 읽는다. 형식이 틀린 항목·중복은 버리고 최대 개수까지만 */
export function parseFavorites(raw: string | null): Favorite[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter(isFavorite).filter((fav) => {
      const key = `${fav.type}:${fav.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

export type ToggleResult = { favorites: Favorite[]; result: "added" | "removed" | "full" };

/**
 * 있으면 지우고, 없으면 맨 앞에 더한다. 100개가 차 있으면 더하지 않는다(오래된 것을 몰래 지우지 않음).
 * want 를 주면 그 상태로 맞춘다: 다른 탭이 먼저 같은 항목을 바꿨어도 사용자가 누른 버튼의 뜻을 뒤집지 않는다.
 * 이미 그 상태면 같은 배열을 돌려준다
 */
export function toggleFavorite(
  list: Favorite[], item: Omit<Favorite, "addedAt">, now: string = new Date().toISOString(), want?: boolean,
): ToggleResult {
  const exists = list.some((fav) => fav.type === item.type && fav.id === item.id);
  const on = want ?? !exists;
  if (!on) {
    return { favorites: exists ? list.filter((fav) => !(fav.type === item.type && fav.id === item.id)) : list, result: "removed" };
  }
  if (exists) return { favorites: list, result: "added" };
  if (list.length >= MAX_FAVORITES) return { favorites: list, result: "full" };
  return { favorites: [{ ...item, addedAt: now }, ...list], result: "added" };
}

/** 이미 있는 항목의 이름·이미지를 지금 화면의 값으로 바꾼다 (순서·추가 시각은 그대로). 바뀐 게 없으면 같은 배열 */
export function updateFavoriteMeta(list: Favorite[], item: Omit<Favorite, "addedAt">): Favorite[] {
  const index = list.findIndex((fav) => fav.type === item.type && fav.id === item.id);
  if (index === -1 || (list[index].name === item.name && list[index].image === item.image)) return list;
  const next = [...list];
  next[index] = { ...list[index], name: item.name, image: item.image };
  return next;
}

// ---------- 저장소 (useFavorites 가 구독) ----------

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: Favorite[] | null = null;
// null = 아직 확인 전. 읽기만 되고 쓰기가 막힌 환경(사파리 비공개 모드, 용량 초과)도 있어 실제로 써 보고 정한다
let persistent: boolean | null = null;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function probeWritable(): boolean {
  try {
    const s = storage();
    if (!s) return false;
    const probe = `${FAVORITES_KEY}:probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return true;
  } catch {
    // 쓰기는 됐는데 지우기에서 실패했을 수 있으니 한 번 더 치운다
    try {
      storage()?.removeItem(`${FAVORITES_KEY}:probe`);
    } catch {
      // 지울 수 없으면 그대로 둔다
    }
    return false;
  }
}

function read(): Favorite[] {
  try {
    return parseFavorites(storage()?.getItem(FAVORITES_KEY) ?? null);
  } catch {
    return [];
  }
}

export function getFavorites(): Favorite[] {
  if (cache === null) cache = read();
  return cache;
}

/** localStorage 에 저장되고 있는지 (false 면 이 탭에서만 유지) */
export function isFavoritesPersistent(): boolean {
  if (persistent === null) persistent = probeWritable();
  return persistent;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function write(next: Favorite[]) {
  cache = next;
  try {
    const s = storage();
    if (!s) throw new Error("localStorage unavailable");
    s.setItem(FAVORITES_KEY, JSON.stringify(next));
    persistent = true;
  } catch {
    persistent = false;
  }
  emit();
}

/**
 * 저장된 최신 목록에 change 를 적용해 쓴다.
 * 다른 탭이 방금 저장한 내용을 이 탭의 캐시로 덮어쓰지 않도록, 저장소를 쓸 수 있으면 다시 읽고 바꾼다.
 */
export function updateFavorites(change: (current: Favorite[]) => Favorite[]) {
  const current = isFavoritesPersistent() ? read() : getFavorites();
  const next = change(current);
  if (next === current) {
    // 바꿀 게 없으면 쓰지 않는다. 다른 탭 변경을 아직 못 받았으면 캐시만 맞춘다
    if (JSON.stringify(current) !== JSON.stringify(getFavorites())) {
      cache = current;
      emit();
    }
    return;
  }
  write(next);
}

export function setFavorites(next: Favorite[]) {
  write(next);
}

// 다른 탭에서 바꾸면 따라간다. 리스너는 구독자 수와 관계없이 하나만 둔다
function onStorage(e: StorageEvent) {
  if (e.key !== FAVORITES_KEY && e.key !== null) return;
  // 이 탭이 메모리에만 들고 있으면(쓰기 실패) 저장소 값으로 덮어써 잃지 않는다
  if (persistent === false) return;
  cache = read();
  emit();
}

export function subscribeFavorites(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** 테스트용: 메모리 상태를 비운다 */
export function resetFavoritesCache() {
  cache = null;
  persistent = null;
}
