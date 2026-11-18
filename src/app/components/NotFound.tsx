import { Link } from "react-router-dom";

// 없는 주소·ID 공통 화면. 관련 목록으로 돌아갈 링크를 준다
export default function NotFound({ message = "페이지를 찾을 수 없습니다." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-4xl font-bold text-ink/30">404</p>
      <h2 className="text-xl font-bold text-ink">{message}</h2>
      <p className="text-sm text-ink/60">주소가 바뀌었거나 아직 수집되지 않은 데이터일 수 있습니다.</p>
      <div className="flex gap-2 text-sm">
        <Link to="/" className="rounded-md border border-line bg-panel px-4 py-2 hover:bg-raised">홈으로</Link>
        <Link to="/leagues" className="rounded-md border border-line bg-panel px-4 py-2 hover:bg-raised">리그 목록</Link>
      </div>
    </div>
  );
}
