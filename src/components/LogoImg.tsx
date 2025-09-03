type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: string; // public에 있는 폴더 기준 경로
};

export default function LogoImg({
  src,
  alt,
  className = "w-6 h-6 object-contain",
  fallback = "/icons/alfs-badge.svg",
}: Props) {
  // 1) src가 비었으면 처음부터 폴백 사용
  const initial = (() => {
    const s = (src ?? "").trim();
    if (!s) return fallback;
    // 2) http → https 강제(혼합 콘텐츠 방지)
    return s.startsWith("http:") ? s.replace(/^http:/, "https:") : s;
  })();

  const fallbackAbs = new URL(fallback, window.location.origin).href;

  return (
    <img
      src={initial}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={(e) => {
        const img = e.currentTarget;
        // 무한 루프 방지: 이미 폴백이면 종료
        if (img.src === fallbackAbs) return;
        img.onerror = null;
        img.src = fallbackAbs;
      }}
    />
  );
}
