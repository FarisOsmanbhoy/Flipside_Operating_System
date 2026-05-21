"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Breadcrumbs } from "./Breadcrumbs";

const WIDE_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/staff\/?$/,
  /^\/admin\/users\/?$/,
  /^\/clients\/?$/,
  /^\/tasks\/?$/,
];

export function PageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const wide = WIDE_ROUTES.some((r) => r.test(pathname));
  const widthClass = wide ? "max-w-none" : "max-w-[1440px]";

  return (
    <div>
      <div className="border-b border-border-soft bg-canvas">
        <div
          className={`${widthClass} mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-end`}
        >
          <Breadcrumbs />
        </div>
      </div>
      <div
        className={`${widthClass} w-full mx-auto px-4 sm:px-6 lg:px-8 py-6`}
      >
        {children}
      </div>
    </div>
  );
}
