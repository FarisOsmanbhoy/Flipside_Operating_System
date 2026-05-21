"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

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
  const { data: changeRequest, error } = await supabase
    .from("change_requests")
    .insert({
      client_id: parsed.data.client_id,
      section_type_id: parsed.data.section_type_id || null,
      requested_by: profile.id,
      summary: parsed.data.summary,
    })
    .select("id")
    .single();
  if (error || !changeRequest) {
    return { error: error?.message ?? "Submit failed." };
  }

  // Surface the change request as an admin-only task so it shows up alongside
  // other work and any admin completing it resolves it for everyone.
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", parsed.data.client_id)
    .maybeSingle();

  await supabase.from("tasks").insert({
    type: "task",
    title: `Review change request: ${client?.name ?? "client"}`,
    description: parsed.data.summary,
    linked_client_id: parsed.data.client_id,
    linked_change_request_id: changeRequest.id,
    status: "open",
  });

  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/tasks");
  return { success: true };
}

