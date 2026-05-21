"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSession, requireLevel } from "@/lib/auth";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "text/plain",
]);

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const MetaSchema = z.object({
  category_id: z.uuid(),
  title: z.string().min(1).max(300),
  company: z.string().max(200).optional().or(z.literal("")),
  reference: z.string().max(200).optional().or(z.literal("")),
  revision_no: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().nonnegative().nullable(),
  ),
});

function sanitise(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export async function createManual(formData: FormData) {
  const session = await requireLevel(2);
  const supabase = await createClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select a file.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large (max 25 MB).");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}.`);
  }

  const meta = MetaSchema.parse({
    category_id: formData.get("category_id"),
    title: formData.get("title"),
    company: formData.get("company") ?? "",
    reference: formData.get("reference") ?? "",
    revision_no: formData.get("revision_no") ?? "",
  });

  const path = `${meta.category_id}/${crypto.randomUUID()}/${sanitise(file.name)}`;

  const { error: uploadErr } = await supabase.storage
    .from("manuals")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadErr) throw new Error(uploadErr.message);

  const { error: insertErr } = await supabase.from("manuals").insert({
    category_id: meta.category_id,
    title: meta.title,
    company: meta.company || null,
    reference: meta.reference || null,
    revision_no: meta.revision_no,
    published_at: new Date().toISOString(),
    author_id: session.id,
    storage_path: path,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
  });
  if (insertErr) {
    // Best-effort cleanup of orphaned upload
    await supabase.storage.from("manuals").remove([path]);
    throw new Error(insertErr.message);
  }

  revalidatePath("/manuals");
}

const UpdateSchema = MetaSchema;

export async function updateManual(
  id: string,
  input: z.input<typeof UpdateSchema>,
) {
  await requireLevel(2);
  const parsed = UpdateSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("manuals")
    .update({
      category_id: parsed.category_id,
      title: parsed.title,
      company: parsed.company || null,
      reference: parsed.reference || null,
      revision_no: parsed.revision_no,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/manuals");
}

export async function deleteManual(id: string) {
  await requireLevel(2);
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("manuals")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("manuals").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (row?.storage_path) {
    await supabase.storage.from("manuals").remove([row.storage_path]);
  }
  revalidatePath("/manuals");
}

// Used by the page to mint a signed URL just-in-time when a user clicks View.
export async function getManualSignedUrl(id: string) {
  await getSession();
  const supabase = await createServiceClient();
  const { data: row } = await supabase
    .from("manuals")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!row?.storage_path) throw new Error("File not found.");
  const { data, error } = await supabase.storage
    .from("manuals")
    .createSignedUrl(row.storage_path, 60 * 60);
  if (error || !data) throw new Error(error?.message ?? "Could not sign URL.");
  return data.signedUrl;
}
