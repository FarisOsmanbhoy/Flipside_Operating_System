import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ManualsListClient } from "./ManualsListClient";

export const dynamic = "force-dynamic";

export default async function ManualsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  const { q } = await searchParams;
  const supabase = await createClient();

  const [{ data: rows }, { data: categories }, { data: people }] =
    await Promise.all([
      supabase
        .from("manuals")
        .select(
          "id, category_id, title, company, reference, revision_no, published_at, author_id, storage_path, file_name",
        )
        .order("title"),
      supabase
        .from("manual_categories")
        .select("id, name, display_order, is_active")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("profiles").select("id, full_name"),
    ]);

  return (
    <>
      <PageHeader
        title="Manuals, Guides & Docs"
        subtitle="SOPs and reference material the team can consult any time."
      />
      <ManualsListClient
        session={session}
        rows={rows ?? []}
        categories={categories ?? []}
        people={people ?? []}
        initialQ={q ?? ""}
      />
    </>
  );
}
