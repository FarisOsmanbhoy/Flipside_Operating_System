"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireLevel } from "@/lib/auth";

const LevelSchema = z.object({
  id: z.uuid(),
  access_level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export async function setUserLevel(input: {
  id: string;
  access_level: 1 | 2 | 3;
}) {
  await requireLevel(3);
  const parsed = LevelSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid input.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ access_level: parsed.data.access_level })
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
  await requireLevel(3);
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
