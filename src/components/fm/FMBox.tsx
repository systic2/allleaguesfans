import { ReactNode } from "react";

interface FMBoxProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export default function FMBox({ title, children, className = "", action }: FMBoxProps) {
  return (
    <div className={`flex flex-col bg-panel border border-line shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-raised to-panel border-b border-line">
        <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-0">
        {children}
      </div>
    </div>
  );
}
