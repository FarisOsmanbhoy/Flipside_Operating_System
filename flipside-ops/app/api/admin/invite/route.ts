import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserlessSupabase } from "@supabase/supabase-js";

const Schema = z.object({
  email: z.email(),
  full_name: z.string().min(1).max(120),
  access_level: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .default(1),
  department_id: z.uuid().optional().or(z.literal("")).optional(),
});

export async function POST(req: NextRequest) {
  // Require admin (level 3) via session-scoped Supabase client.
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

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const admin = createBrowserlessSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: invite, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password`,
      data: { full_name: parsed.data.full_name },
    });
  if (inviteErr || !invite?.user) {
    return NextResponse.json(
      { error: inviteErr?.message ?? "Invite failed" },
      { status: 500 },
    );
  }

  // The handle_new_auth_user trigger created a profile with default level 1.
  // Update level + department to match the invite form.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      access_level: parsed.data.access_level,
      department_id: parsed.data.department_id || null,
    })
    .eq("id", invite.user.id);
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user_id: invite.user.id });
}
