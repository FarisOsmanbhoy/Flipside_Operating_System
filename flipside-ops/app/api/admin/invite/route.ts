import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserlessSupabase } from "@supabase/supabase-js";
import { sendInviteEmail } from "@/lib/email/resend";

const Schema = z.object({
  email: z.email(),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  full_name: z.string().min(1).max(120),
  access_level: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .default(1),
  department_id: z.uuid().optional().or(z.literal("")).optional(),
});

export async function POST(req: NextRequest) {
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

  // Create the user with a password and pre-confirmed email so they can sign
  // in immediately via email + password.
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name },
    },
  );
  if (createErr || !created?.user) {
    return NextResponse.json(
      { error: createErr?.message ?? "User creation failed" },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Generate a one-time magic link the admin can hand to the new user for
  // their first sign-in without typing the password.
  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: parsed.data.email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    });
  if (linkErr) {
    return NextResponse.json(
      {
        error: `User created but link generation failed: ${linkErr.message}`,
        user_id: created.user.id,
      },
      { status: 500 },
    );
  }
  const actionLink = linkData?.properties?.action_link ?? "";

  // The handle_new_auth_user trigger created a profile with default level 1.
  // Update level + department + name to match the invite form.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      access_level: parsed.data.access_level,
      department_id: parsed.data.department_id || null,
    })
    .eq("id", created.user.id);
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  const emailResult = await sendInviteEmail({
    to: parsed.data.email,
    fullName: parsed.data.full_name,
    actionLink,
    tempPassword: parsed.data.password,
    loginUrl: `${appUrl}/login`,
  });

  return NextResponse.json({
    ok: true,
    user_id: created.user.id,
    action_link: actionLink,
    email_sent: emailResult.sent,
    email_reason: emailResult.sent ? undefined : emailResult.reason,
  });
}
