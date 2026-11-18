import { useId, type ReactNode } from "react";

// 목록 페이지 상단의 필터 묶음과 공통 입력 스타일
export const filterControl =
  "min-h-11 rounded-md border border-line bg-sunken px-3 text-sm text-ink focus:border-accent focus:outline-none";

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-panel p-3">{children}</div>;
}

// 안의 컨트롤은 각자 aria-label 을 갖는다. 버튼 여러 개를 label 로 감싸면 라벨 클릭이 첫 버튼을 누르므로 group 으로 둔다
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-1 text-xs text-ink/60">
      <span id={id}>{label}</span>
      {children}
    </div>
  );
}

/** 여러 값 중 하나를 고르는 버튼 묶음 (상태 필터 등) */
export function SegmentedControl<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`min-h-11 rounded-md border px-3 text-sm ${
            option.value === value ? "border-accent bg-raised text-ink" : "border-line bg-sunken text-ink/70 hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
