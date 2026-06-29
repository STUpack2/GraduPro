import { ReactNode } from "react";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function SectionHeader({ title, description, icon, action }: SectionHeaderProps) {
  return (
    <header className="flex items-start gap-3 mb-3 px-1">
      {icon && (
        <div className="bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 rounded-xl text-primary shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight text-gray-900 dark:text-white truncate">
          {title}
        </h2>
        {description && (
          <p className="text-[13px] text-gray-600 dark:text-text-muted mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
