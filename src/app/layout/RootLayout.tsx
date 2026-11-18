// src/app/layout/RootLayout.tsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import GlobalSearch from "../components/GlobalSearch";
import { Component, ErrorInfo, ReactNode, Suspense, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

class Boundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state = { err: undefined as Error | undefined };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div className="text-loss">
          문제가 발생했어요. 잠시 후 다시 시도해 주세요.
        </div>
      );
    }
    return this.props.children;
  }
}

// 터치 영역 44px (docs/prd.md 6.4)
const iconButton = "flex size-11 flex-shrink-0 items-center justify-center rounded-md text-ink/60 hover:text-ink hover:bg-raised";

export default function RootLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  // 페이지를 옮기면 오류 화면을 풀도록 경로마다 Boundary 를 새로 만든다
  const { pathname } = useLocation();

  // 서랍이 열려 있으면 Esc 로 닫는다
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: off-canvas drawer on mobile, static column on desktop */}
      {/* 닫힌 서랍은 invisible 로 숨겨 키보드 포커스·스크린리더에서도 빠지게 한다 (lg 이상은 항상 표시) */}
      <div
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] transform transition-transform duration-200 ease-out lg:visible lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 ${
          sidebarOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className={`lg:hidden absolute top-1 right-1 z-10 ${iconButton}`}
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5" />
          </button>
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        {/* 상단 액션 바: 이동 버튼 + 통합 검색 */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-panel/95 px-3 backdrop-blur sm:px-4">
          <button type="button" onClick={() => setSidebarOpen(true)} className={`lg:hidden ${iconButton}`} aria-label="메뉴 열기" aria-expanded={sidebarOpen} aria-controls="app-sidebar">
            <Menu className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => navigate(-1)} className={`hidden sm:flex ${iconButton}`} aria-label="뒤로">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => navigate(1)} className={`hidden sm:flex ${iconButton}`} aria-label="앞으로">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 max-w-2xl">
            <GlobalSearch />
          </div>
        </header>

        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6">
          <Boundary key={pathname}>
            <Suspense fallback={<div className="p-6 text-ink/70">로딩중…</div>}>
              <Outlet />
            </Suspense>
          </Boundary>
        </main>

        <footer className="border-t border-line px-4 py-4 text-xs text-ink/50 lg:px-6">
          <p>
            데이터 출처: <a href="https://www.thesportsdb.com" target="_blank" rel="noreferrer" className="underline hover:text-ink">TheSportsDB</a>
            {" · "}K리그 득점·도움 기록: <a href="https://www.kleague.com" target="_blank" rel="noreferrer" className="underline hover:text-ink">kleague.com</a>
          </p>
          <p className="mt-1">
            이 사이트는 각 리그·구단·Football Manager 와 관련 없는 비공식 팬 사이트입니다.{" "}
            <a href="https://github.com/systic2/allleaguesfans/issues" target="_blank" rel="noreferrer" className="underline hover:text-ink">데이터 오류 제보</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
