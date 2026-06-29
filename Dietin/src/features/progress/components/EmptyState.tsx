import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  cta?: { label: string; onClick: () => void };
  illustration?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, cta, illustration }: EmptyStateProps) {
  return (
    <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
      {illustration ?? (Icon ? (
        <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-full">
          <Icon className="w-7 h-7 text-gray-400 dark:text-white/60" aria-hidden />
        </div>
      ) : null)}
      <h3 className="text-base font-medium text-gray-900 dark:text-white">{title}</h3>
      {description && (
        <p className="text-sm text-gray-600 dark:text-text-muted max-w-xs">{description}</p>
      )}
      {cta && (
        <Button
          onClick={cta.onClick}
          className="mt-2 bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black"
        >
          {cta.label}
        </Button>
      )}
    </div>
  );
}
