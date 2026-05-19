import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-10 px-6">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
