import { requireLevel } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireLevel(3);
  return <>{children}</>;
}
