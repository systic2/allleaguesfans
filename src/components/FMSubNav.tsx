import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

type MenuItem = {
  label: string;
  href?: string; // If it's a direct link
  children?: { label: string; href: string }[]; // Dropdown items
};

interface FMSubNavProps {
  type: 'team' | 'player';
  basePath?: string; // e.g., /teams/123 or /players/456
}

export default function FMSubNav({ type, basePath = "" }: FMSubNavProps) {
  // Define menus based on type
  const teamMenus: MenuItem[] = [
    {
      label: "상황판",
      children: [
        { label: "개요", href: `${basePath}?tab=overview` },
        { label: "구단 정보", href: `${basePath}?tab=info` }, // Placeholder tab
        { label: "시설", href: `${basePath}?tab=facilities` }, // Placeholder tab
      ],
    },
    {
      label: "선수단",
      children: [
        { label: "선수단", href: `${basePath}?tab=squad` },
        { label: "전술", href: `${basePath}?tab=tactics` }, // Placeholder
        { label: "등번호", href: `${basePath}?tab=numbers` }, // Placeholder
      ],
    },
    {
      label: "일정",
      children: [
        { label: "일정", href: `${basePath}?tab=fixtures` },
        { label: "결과", href: `${basePath}?tab=results` },
      ],
    },
    {
      label: "통계",
      children: [
        { label: "선수 기록", href: `${basePath}?tab=stats` },
        { label: "팀 기록", href: `${basePath}?tab=team-stats` },
      ],
    },
    { label: "이적", href: "#" }, // No dropdown example
    { label: "구단 비전", href: "#" },
    { label: "재정", href: "#" },
  ];

  const playerMenus: MenuItem[] = [
    {
      label: "상황판",
      children: [
        { label: "프로필", href: basePath },
        { label: "속성", href: basePath }, // Currently single page
        { label: "정보", href: basePath },
      ],
    },
    {
      label: "계약",
      children: [
        { label: "계약 정보", href: "#" },
        { label: "재계약 제의", href: "#" },
      ],
    },
    {
      label: "이적",
      children: [
        { label: "이적 현황", href: "#" },
        { label: "관심 구단", href: "#" },
      ],
    },
    {
      label: "보고서",
      children: [
        { label: "스카우트 리포트", href: "#" },
        { label: "코치 리포트", href: "#" },
      ],
    },
    { label: "기록", href: "#" },
    { label: "비교", href: "#" },
    { label: "역사", href: "#" },
  ];

  const menus = type === 'team' ? teamMenus : playerMenus;

  return (
    <div className="bg-[#1e1e1e] border-b border-[#333] text-sm font-medium text-gray-300 shadow-md">
      <div className="flex items-center px-4 overflow-x-auto">
        {menus.map((menu, index) => (
          <MenuDropdown key={index} item={menu} />
        ))}
      </div>
    </div>
  );
}

function MenuDropdown({ item }: { item: MenuItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Link
        to={item.href || "#"}
        className={`
          flex items-center gap-1 px-4 py-3 hover:bg-[#333] hover:text-white transition-colors whitespace-nowrap
          ${isOpen ? 'bg-[#333] text-white' : ''}
        `}
      >
        {item.label}
        {item.children && <ChevronDown className="w-3 h-3 text-gray-500 group-hover:text-white" />}
      </Link>

      {/* Dropdown Menu */}
      {item.children && isOpen && (
        <div className="absolute left-0 top-full z-50 min-w-[160px] bg-[#2a2a2a] border border-[#444] shadow-xl py-1 rounded-b-md">
          {item.children.map((child, idx) => (
            <Link
              key={idx}
              to={child.href}
              className="block px-4 py-2 text-gray-300 hover:bg-[#3e3e3e] hover:text-white text-xs"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
