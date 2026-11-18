import { useState } from "react";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  size?: number; // px
};

// 엠블럼이 없거나 불러오지 못하면 같은 크기의 빈 자리를 둔다 (docs/prd.md 8.3)
export default function CrestImg({
  src,
  alt,
  className = "",
  size = 24,
}: Props) {
  // 실패한 주소를 기억한다 — 같은 컴포넌트에 다른 src 가 오면(팀 페이지 사이 이동 등) 다시 시도한다
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return <span aria-hidden="true" className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={`object-contain ${className}`}
    />
  );
}
