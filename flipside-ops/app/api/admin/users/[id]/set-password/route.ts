import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserlessSupabase } from "@supabase/supabase-js";

const Schema = z.object({
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetUserId } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: actor } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("id", user.id)
    .maybeSingle();
  if (!actor || actor.access_level < 3)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Force admins to rotate their own password via /forgot-password so an
  // attacker who hijacks an admin session cannot quietly lock the real user
  // out by overwriting their password from inside the app.
  if (targetUserId === user.id) {
    return NextResponse.json(
      { error: "Use /forgot-password to change your own password." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  const admin = createBrowserlessSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    password: parsed.data.password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
