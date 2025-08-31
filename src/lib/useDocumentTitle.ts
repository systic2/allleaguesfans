import { useEffect } from "react";

/** 페이지별 탭 타이틀을 설정합니다. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | All Leagues Fans` : "All Leagues Fans";
  }, [title]);
}
