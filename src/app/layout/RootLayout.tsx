// src/app/layout/RootLayout.tsx
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import GlobalSearch from "../components/GlobalSearch";
import { Component, ErrorInfo, ReactNode } from "react";

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
  return (
    <div className="min-h-screen grid grid-cols-[20rem_1fr]">
      <Sidebar />
      <main className="p-6">
        {/* 상단: 전체가 검색바 */}
        <header className="mb-6 sticky top-0 z-20">
          <div className="backdrop-blur supports-[backdrop-filter]:bg-white/5 bg-white/3 dark:bg-black/20 border border-white/10 rounded-2xl px-4 py-3 shadow-md">
            <GlobalSearch /> {/* ✅ 글로벌 검색 */}
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 dark:bg-black/20 shadow-xl p-5">
          <Boundary>
            <Outlet />
          </Boundary>
        </section>
      </main>
    </div>
  );
}
