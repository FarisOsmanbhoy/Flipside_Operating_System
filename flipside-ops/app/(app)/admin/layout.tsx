import Link from "next/link";
import { Users, SlidersHorizontal, History } from "lucide-react";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
      <aside>
        <h2 className="text-xs font-semibold uppercase text-muted tracking-wide mb-2 px-2">
          Admin
        </h2>
        <nav className="space-y-1">
          <AdminLink href="/admin/users" icon={<Users size={14} />}>
            Users
          </AdminLink>
          <AdminLink
            href="/admin/config"
            icon={<SlidersHorizontal size={14} />}
          >
            Config
          </AdminLink>
          <AdminLink href="/admin/audit" icon={<History size={14} />}>
            Audit log
          </AdminLink>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}

function AdminLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted hover:text-ink hover:bg-canvas rounded"
    >
      {icon}
      {children}
    </Link>
  );
}
