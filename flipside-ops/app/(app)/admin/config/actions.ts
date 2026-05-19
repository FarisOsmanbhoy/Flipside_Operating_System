"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const ALLOWED = new Set([
  "departments",
  "client_statuses",
  "client_types",
  "client_section_types",
  "task_priorities",
  "task_categories",
  "industry_alert_categories",
  "notice_categories",
]);

const guard = (table: string) => {
  if (!ALLOWED.has(table)) throw new Error("Unknown lookup table.");
};

const Add = z.object({ table: z.string(), name: z.string().min(1).max(120) });
export async function addLookup(input: { table: string; name: string }) {
  await requireRole("admin");
  const parsed = Add.parse(input);
  guard(parsed.table);

  const supabase = await createClient();
  // For client_section_types we also need a slug.
  const extras: Record<string, unknown> =
    parsed.table === "client_section_types"
      ? { slug: parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }
      : {};
  const { error } = await supabase
    .from(parsed.table)
    .insert({ name: parsed.name, ...extras });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/config");
}

const Update = z.object({
  table: z.string(),
  id: z.uuid(),
  name: z.string().min(1).max(120).optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().optional(),
});
export async function updateLookup(input: {
  table: string;
  id: string;
  name?: string;
  is_active?: boolean;
  display_order?: number;
}) {
  await requireRole("admin");
  const parsed = Update.parse(input);
  guard(parsed.table);

  const payload: Record<string, unknown> = {};
  if (parsed.name !== undefined) payload.name = parsed.name;
  if (parsed.is_active !== undefined) payload.is_active = parsed.is_active;
  if (parsed.display_order !== undefined)
    payload.display_order = parsed.display_order;

  const supabase = await createClient();
  const { error } = await supabase
    .from(parsed.table)
    .update(payload)
    .eq("id", parsed.id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/config");
}

const Del = z.object({ table: z.string(), id: z.uuid() });
export async function deleteLookup(input: { table: string; id: string }) {
  await requireRole("admin");
  const parsed = Del.parse(input);
  guard(parsed.table);

  const supabase = await createClient();
  const { error } = await supabase
    .from(parsed.table)
    .delete()
    .eq("id", parsed.id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/config");
}
