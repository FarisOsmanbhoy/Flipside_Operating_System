import { getSession } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";
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
        <TopNav profile={profile} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
