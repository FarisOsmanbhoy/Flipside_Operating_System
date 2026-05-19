import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function ListPageLayout({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
      <aside className="lg:sticky lg:top-32 lg:self-start">
        <Card className="p-4">{sidebar}</Card>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
