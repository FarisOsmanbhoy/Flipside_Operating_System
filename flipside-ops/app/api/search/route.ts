import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export type SearchHit = {
  kind: "client" | "task" | "staff";
  id: string;
  label: string;
  sublabel?: string;
};

export async function GET(req: NextRequest) {
  await getSession();

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const supabase = await createClient();
  const like = `%${q}%`;

  const [clients, tasks, staff] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, location")
      .ilike("name", like)
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, status")
      .ilike("title", like)
      .limit(5),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .or(`full_name.ilike.${like},email.ilike.${like}`)
      .limit(5),
  ]);

  const hits: SearchHit[] = [
    ...(clients.data ?? []).map((c) => ({
      kind: "client" as const,
      id: c.id,
      label: c.name,
      sublabel: c.location ?? undefined,
    })),
    ...(tasks.data ?? []).map((t) => ({
      kind: "task" as const,
      id: t.id,
      label: t.title,
      sublabel: t.status,
    })),
    ...(staff.data ?? []).map((s) => ({
      kind: "staff" as const,
      id: s.id,
      label: s.full_name ?? s.email,
      sublabel: s.full_name ? s.email : undefined,
    })),
  ];

  return NextResponse.json({ hits });
}
