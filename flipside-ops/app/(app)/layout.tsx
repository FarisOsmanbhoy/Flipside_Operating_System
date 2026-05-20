import { getSession } from "@/lib/auth";
import { TopHeader } from "@/components/nav/TopHeader";
import { MainNav } from "@/components/nav/MainNav";
import { PageShell } from "@/components/nav/PageShell";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSession();

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <TopHeader profile={profile} />
        <MainNav level={profile.access_level} />
        <main className="flex-1">
          <PageShell>{children}</PageShell>
        </main>
      </div>
    </ToastProvider>
  );
}
