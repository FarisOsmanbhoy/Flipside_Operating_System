"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManage, getSession } from "@/lib/auth";

const guardWrite = async () => {
  const profile = await getSession();
  if (!canManage(profile)) {
    throw new Error("Only level 2+ users can edit client records.");
  }
  return profile;
};

// ───── Create client ────────────────────────────────────────────────
const NewClientSchema = z.object({
  name: z.string().min(1).max(160),
  type_id: z.uuid().optional().or(z.literal("")),
  status_id: z.uuid().optional().or(z.literal("")),
  location: z.string().max(160).optional().or(z.literal("")),
  since_date: z.string().optional().or(z.literal("")),
  assigned_pm_id: z.uuid().optional().or(z.literal("")),
  important_info: z.string().optional().or(z.literal("")),
});

export type NewClientState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

export async function createClientRecord(
  _prev: NewClientState,
  formData: FormData,
): Promise<NewClientState> {
  await guardWrite();
  const parsed = NewClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: parsed.data.name,
      type_id: parsed.data.type_id || null,
      status_id: parsed.data.status_id || null,
      location: parsed.data.location || null,
      since_date: parsed.data.since_date || null,
      assigned_pm_id: parsed.data.assigned_pm_id || null,
      important_info: parsed.data.important_info || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Create failed." };

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

// ───── Update a single field on the client ──────────────────────────
const UpdateFieldSchema = z.object({
  id: z.uuid(),
  field: z.enum([
    "name",
    "location",
    "important_info",
    "notes",
    "status_id",
    "type_id",
    "assigned_pm_id",
    "since_date",
  ]),
  value: z.string().nullable(),
});

export async function updateClientField(input: {
  id: string;
  field: string;
  value: string | null;
}) {
  await guardWrite();
  const parsed = UpdateFieldSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid field update.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ [parsed.data.field]: parsed.data.value || null })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${parsed.data.id}`);
  revalidatePath("/clients");
}

// ───── Upsert section data (jsonb) ──────────────────────────────────
const UpsertSectionSchema = z.object({
  client_id: z.uuid(),
  section_type_id: z.uuid(),
  data: z.record(z.string(), z.unknown()),
});

export async function upsertSectionData(input: {
  client_id: string;
  section_type_id: string;
  data: Record<string, unknown>;
}) {
  await guardWrite();
  const parsed = UpsertSectionSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid section payload.");

  const supabase = await createClient();
  const { error } = await supabase.from("client_section_data").upsert(
    {
      client_id: parsed.data.client_id,
      section_type_id: parsed.data.section_type_id,
      data: parsed.data.data,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "client_id,section_type_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${parsed.data.client_id}`);
}

// ───── Mark section as reviewed (resets staleness) ──────────────────
export async function markSectionReviewed(input: {
  client_id: string;
  section_type_id: string;
}) {
  await guardWrite();
  const supabase = await createClient();
  const { error } = await supabase.from("client_section_data").upsert(
    {
      client_id: input.client_id,
      section_type_id: input.section_type_id,
      last_reviewed_at: new Date().toISOString(),
      data: {},
    },
    { onConflict: "client_id,section_type_id", ignoreDuplicates: false },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${input.client_id}`);
}

// ───── Contacts ─────────────────────────────────────────────────────
const ContactSchema = z.object({
  id: z.uuid().optional(),
  client_id: z.uuid(),
  name: z.string().min(1).max(120),
  role: z.string().max(120).optional().or(z.literal("")),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  preferred_channel: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type ContactState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

export async function saveContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  await guardWrite();
  const parsed = ContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const payload = {
    client_id: parsed.data.client_id,
    name: parsed.data.name,
    role: parsed.data.role || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    preferred_channel: parsed.data.preferred_channel || null,
    notes: parsed.data.notes || null,
  };
  const { error } = parsed.data.id
    ? await supabase.from("client_contacts").update(payload).eq("id", parsed.data.id)
    : await supabase.from("client_contacts").insert(payload);
  if (error) return { error: error.message };

  revalidatePath(`/clients/${parsed.data.client_id}`);
  return {};
}

export async function deleteContact(id: string, client_id: string) {
  await guardWrite();
  const supabase = await createClient();
  const { error } = await supabase.from("client_contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${client_id}`);
}

// ───── Subcontractors ───────────────────────────────────────────────
const SubSchema = z.object({
  id: z.uuid().optional(),
  client_id: z.uuid(),
  trade: z.string().min(1).max(80),
  company_name: z.string().min(1).max(160),
  status: z.enum(["preferred", "backup", "blacklisted"]),
  contact: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type SubState = ContactState;

export async function saveSubcontractor(
  _prev: SubState,
  formData: FormData,
): Promise<SubState> {
  await guardWrite();
  const parsed = SubSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const payload = {
    client_id: parsed.data.client_id,
    trade: parsed.data.trade,
    company_name: parsed.data.company_name,
    status: parsed.data.status,
    contact: parsed.data.contact || null,
    notes: parsed.data.notes || null,
  };
  const { error } = parsed.data.id
    ? await supabase.from("client_subcontractors").update(payload).eq("id", parsed.data.id)
    : await supabase.from("client_subcontractors").insert(payload);
  if (error) return { error: error.message };

  revalidatePath(`/clients/${parsed.data.client_id}`);
  return {};
}

export async function deleteSubcontractor(id: string, client_id: string) {
  await guardWrite();
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_subcontractors")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${client_id}`);
}
