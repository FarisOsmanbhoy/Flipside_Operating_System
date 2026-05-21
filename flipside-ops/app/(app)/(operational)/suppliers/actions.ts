"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManage, getSession, isAdmin } from "@/lib/auth";

const guardWrite = async () => {
  const profile = await getSession();
  if (!canManage(profile)) {
    throw new Error("Only level 2+ users can edit supplier records.");
  }
  return profile;
};

const guardAdmin = async () => {
  const profile = await getSession();
  if (!isAdmin(profile)) {
    throw new Error("Only admins (level 3) can reassign the account manager.");
  }
  return profile;
};

// ───── Create supplier ──────────────────────────────────────────────
const NewSupplierSchema = z.object({
  name: z.string().min(1).max(160),
  type_id: z.uuid().optional().or(z.literal("")),
  status_id: z.uuid().optional().or(z.literal("")),
  location: z.string().max(160).optional().or(z.literal("")),
  since_date: z.string().optional().or(z.literal("")),
  assigned_pm_id: z.uuid().optional().or(z.literal("")),
  important_info: z.string().optional().or(z.literal("")),
});

export type NewSupplierState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

export async function createSupplierRecord(
  _prev: NewSupplierState,
  formData: FormData,
): Promise<NewSupplierState> {
  await guardWrite();
  const parsed = NewSupplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
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

  revalidatePath("/suppliers");
  redirect(`/suppliers/${data.id}`);
}

// ───── Update a single field on the supplier ────────────────────────
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

export async function updateSupplierField(input: {
  id: string;
  field: string;
  value: string | null;
}) {
  await guardWrite();
  const parsed = UpdateFieldSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid field update.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ [parsed.data.field]: parsed.data.value || null })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/suppliers/${parsed.data.id}`);
  revalidatePath("/suppliers");
}

// ───── Reassign account manager (level 3 only) ─────────────────────
const UpdateAssignedPmSchema = z.object({
  supplier_id: z.uuid(),
  assigned_pm_id: z.uuid().nullable(),
});

export async function updateSupplierAssignedPm(input: {
  supplier_id: string;
  assigned_pm_id: string | null;
}) {
  await guardAdmin();
  const parsed = UpdateAssignedPmSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid PM assignment.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ assigned_pm_id: parsed.data.assigned_pm_id })
    .eq("id", parsed.data.supplier_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/suppliers/${parsed.data.supplier_id}`);
  revalidatePath("/suppliers");
}

// ───── Upsert section data (jsonb) ──────────────────────────────────
const UpsertSectionSchema = z.object({
  supplier_id: z.uuid(),
  section_type_id: z.uuid(),
  data: z.record(z.string(), z.unknown()),
});

export async function upsertSupplierSectionData(input: {
  supplier_id: string;
  section_type_id: string;
  data: Record<string, unknown>;
}) {
  await guardWrite();
  const parsed = UpsertSectionSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid section payload.");

  const supabase = await createClient();
  const { error } = await supabase.from("supplier_section_data").upsert(
    {
      supplier_id: parsed.data.supplier_id,
      section_type_id: parsed.data.section_type_id,
      data: parsed.data.data,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id,section_type_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/suppliers/${parsed.data.supplier_id}`);
}

// ───── Contacts ─────────────────────────────────────────────────────
const ContactSchema = z.object({
  id: z.uuid().optional(),
  supplier_id: z.uuid(),
  name: z.string().min(1).max(120),
  role: z.string().max(120).optional().or(z.literal("")),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  preferred_channel: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type SupplierContactState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

export async function saveSupplierContact(
  _prev: SupplierContactState,
  formData: FormData,
): Promise<SupplierContactState> {
  await guardWrite();
  const parsed = ContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const payload = {
    supplier_id: parsed.data.supplier_id,
    name: parsed.data.name,
    role: parsed.data.role || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    preferred_channel: parsed.data.preferred_channel || null,
    notes: parsed.data.notes || null,
  };
  const { error } = parsed.data.id
    ? await supabase.from("supplier_contacts").update(payload).eq("id", parsed.data.id)
    : await supabase.from("supplier_contacts").insert(payload);
  if (error) return { error: error.message };

  revalidatePath(`/suppliers/${parsed.data.supplier_id}`);
  return {};
}

export async function deleteSupplierContact(id: string, supplier_id: string) {
  await guardWrite();
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/suppliers/${supplier_id}`);
}
