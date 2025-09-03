// src/components/TeamBadge.tsx
type Props = {
  teamId: string;
  apiLogo?: string;
  alt: string;
  leagueSlug: "k-league-1" | "k-league-2";
};

export default function TeamBadge({ teamId, apiLogo, alt, leagueSlug }: Props) {
  const local = `/logos/${leagueSlug}/${teamId}.png`; // public 기준
  const fallback = "/images/fallback-badge.svg";
  return (
    <picture>
      {/* 1) 로컬 캐시, 2) API 원본, 3) 폴백 */}
      <img
        src={local}
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (img.src.endsWith(teamId + ".png") && apiLogo) {
            img.src = apiLogo;
          } else if (img.src !== window.location.origin + fallback) {
            img.src = fallback;
          }
        }}
        alt={alt}
        width={28}
        height={28}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
