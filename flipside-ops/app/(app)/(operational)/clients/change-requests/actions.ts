"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManage, getSession } from "@/lib/auth";

const Schema = z.object({
  client_id: z.uuid(),
  section_type_id: z.uuid().optional().or(z.literal("")),
  summary: z.string().min(5, "Tell us more — at least 5 chars.").max(2000),
});

export type ChangeRequestState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

export async function submitChangeRequest(
  _prev: ChangeRequestState,
  formData: FormData,
): Promise<ChangeRequestState> {
  const profile = await getSession();
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("change_requests").insert({
    client_id: parsed.data.client_id,
    section_type_id: parsed.data.section_type_id || null,
    requested_by: profile.id,
    summary: parsed.data.summary,
  });
  if (error) return { error: error.message };

  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/clients/changes");
  return { success: true };
}

const DecideSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "rejected"]),
  decision_notes: z.string().max(1000).optional().or(z.literal("")),
});

export async function decideChangeRequest(input: {
  id: string;
  decision: "approved" | "rejected";
  decision_notes?: string;
}) {
  const profile = await getSession();
  if (!canManage(profile)) {
    throw new Error("Only level 2+ users can review change requests.");
  }
  const parsed = DecideSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid review payload.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("change_requests")
    .update({
      status: parsed.data.decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      decision_notes: parsed.data.decision_notes || null,
    })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients/changes");
}
