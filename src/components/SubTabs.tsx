import { Link, useSearchParams } from "react-router-dom";

export interface SubTab {
  key: string;
  label: string;
}

// 상세 화면 상단의 탭 바. 선택한 탭은 ?tab= 으로 주소에 남는다 (docs/prd.md 6.1)
export default function SubTabs({ tabs, defaultKey }: { tabs: SubTab[]; defaultKey: string }) {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const current = tabs.some((tab) => tab.key === requested) ? requested : defaultKey;

  return (
    <nav aria-label="하위 탭" className="border-b border-line bg-sunken text-sm font-medium">
      <div className="flex overflow-x-auto px-2">
        {tabs.map((tab) => {
          const isActive = tab.key === current;
          const params = new URLSearchParams(searchParams);
          params.set("tab", tab.key);
          return (
            <Link
              key={tab.key}
              to={`?${params.toString()}`}
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-3 transition-colors ${
                isActive ? "border-accent text-ink" : "border-transparent text-ink/60 hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
