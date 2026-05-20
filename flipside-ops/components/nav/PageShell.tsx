import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="border-b border-border-soft bg-canvas">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-end">
          <Breadcrumbs />
        </div>
      </div>
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
}
