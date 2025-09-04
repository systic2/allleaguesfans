type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  size?: number; // px
};

export default function CrestImg({
  src,
  alt,
  className = "",
  size = 24,
}: Props) {
  const url = src ?? "/logo-fallback.svg";
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`object-contain ${className}`}
    />
  );
}
