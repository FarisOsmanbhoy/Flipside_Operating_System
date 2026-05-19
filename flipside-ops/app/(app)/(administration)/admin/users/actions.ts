"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const RoleSchema = z.object({
  id: z.uuid(),
  role: z.enum(["admin", "manager", "editor"]),
});

export async function setUserRole(input: {
  id: string;
  role: "admin" | "manager" | "editor";
}) {
  await requireRole("admin");
  const parsed = RoleSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid input.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
  revalidatePath("/staff");
}

const ActiveSchema = z.object({
  id: z.uuid(),
  is_active: z.boolean(),
});

export async function setUserActive(input: { id: string; is_active: boolean }) {
  await requireRole("admin");
  const parsed = ActiveSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid input.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
  revalidatePath("/staff");
}
