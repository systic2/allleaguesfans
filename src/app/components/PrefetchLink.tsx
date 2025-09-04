import { Link, type LinkProps } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

type Props = LinkProps & {
  onPrefetch?: (qc: ReturnType<typeof useQueryClient>) => void;
};

export default function PrefetchLink({
  onPrefetch,
  onMouseEnter,
  ...rest
}: Props) {
  const qc = useQueryClient();
  return (
    <Link
      {...rest}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        onPrefetch?.(qc);
      }}
    />
  );
}
