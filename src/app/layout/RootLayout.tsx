// src/app/layout/RootLayout.tsx
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import GlobalSearch from "../components/GlobalSearch";
import { Component, ErrorInfo, ReactNode, useState } from "react";
import { Menu, X } from "lucide-react";

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
        <div className="text-red-400">
          문제가 발생했어요. 잠시 후 다시 시도해 주세요.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[20rem_1fr]">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: off-canvas drawer on mobile, static column on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full bg-[#0b0b14] lg:bg-transparent">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5" />
          </button>
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>

      <main className="p-4 lg:p-6 min-w-0">
        {/* 상단: 전체가 검색바 */}
        <header className="mb-6 sticky top-0 z-20">
          <div className="flex items-center gap-2 backdrop-blur supports-[backdrop-filter]:bg-white/5 bg-white/3 dark:bg-black/20 border border-white/10 rounded-2xl px-3 sm:px-4 py-3 shadow-md">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex-shrink-0 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
              aria-label="메뉴 열기"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <GlobalSearch /> {/* ✅ 글로벌 검색 */}
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 dark:bg-black/20 shadow-xl p-3 sm:p-5 overflow-x-hidden">
          <Boundary>
            <Outlet />
          </Boundary>
        </section>
      </main>
    </div>
  );
}
