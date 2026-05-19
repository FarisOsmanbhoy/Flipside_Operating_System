import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="border-b border-border-soft bg-surface/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-end">
          <Breadcrumbs />
        </div>
      </div>
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
}
