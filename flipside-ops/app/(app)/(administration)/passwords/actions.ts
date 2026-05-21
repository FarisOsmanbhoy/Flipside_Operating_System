"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireLevel } from "@/lib/auth";

const Payload = z.object({
  category_id: z.uuid(),
  system: z.string().min(1).max(200),
  dept_id: z.string().uuid().optional().or(z.literal("")),
  username: z.string().max(500).optional().or(z.literal("")),
  password: z.string().max(500).optional().or(z.literal("")),
  web_address: z.string().max(2000).optional().or(z.literal("")),
  further_info: z.string().max(5000).optional().or(z.literal("")),
});

function emptyToNull<T extends Record<string, unknown>>(obj: T) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? null : v;
  }
  return out;
}

export async function createPassword(input: z.input<typeof Payload>) {
  await requireLevel(2);
  const parsed = Payload.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("passwords")
    .insert(emptyToNull(parsed));
  if (error) throw new Error(error.message);
  revalidatePath("/passwords");
}

export async function updatePassword(
  id: string,
  input: z.input<typeof Payload>,
) {
  await requireLevel(2);
  const parsed = Payload.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("passwords")
    .update(emptyToNull(parsed))
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/passwords");
}

export async function deletePassword(id: string) {
  await requireLevel(2);
  const supabase = await createClient();
  const { error } = await supabase.from("passwords").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/passwords");
}
