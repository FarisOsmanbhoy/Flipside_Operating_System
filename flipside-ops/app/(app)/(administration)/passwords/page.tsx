import { getSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportButton } from "@/components/import/ImportButton";
import { PasswordsListClient } from "./PasswordsListClient";

export const dynamic = "force-dynamic";

export default async function PasswordsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  const { q } = await searchParams;
  const supabase = await createClient();

  const [{ data: rows }, { data: categories }, { data: departments }] =
    await Promise.all([
      supabase
        .from("passwords")
        .select(
          "id, category_id, system, dept_id, username, password, web_address, further_info",
        )
        .order("system"),
      supabase
        .from("password_categories")
        .select("id, name, display_order, is_active")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
    ]);

  return (
    <>
      <PageHeader
        title="Passwords"
        subtitle="Shared logins for the tools the team uses. Anyone can view; managers and admins can edit."
        actions={isAdmin(session) ? <ImportButton domain="passwords" /> : null}
      />
      <PasswordsListClient
        session={session}
        rows={rows ?? []}
        categories={categories ?? []}
        departments={departments ?? []}
        initialQ={q ?? ""}
      />
    </>
  );
}
