// src/app/components/SmallPitch.tsx
type Item = { label: string; order: number };
export default function SmallPitch(props: {
  items?: Item[];
  mainPos?: string;
}) {
  const { items = [], mainPos } = props;
  return (
    <div className="rounded-xl border border-white/10 p-4">
      {mainPos ? (
        <div className="text-sm text-white/70">
          주 포지션: <b>{mainPos}</b>
        </div>
      ) : items.length > 0 ? (
        <ul className="grid grid-cols-4 gap-2 text-center text-xs">
          {items.map((i) => (
            <li key={i.order} className="rounded bg-white/5 py-1">
              {i.label}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-white/50">
          표시할 포지션 정보가 없습니다.
        </div>
      )}
    </div>
  );
}
