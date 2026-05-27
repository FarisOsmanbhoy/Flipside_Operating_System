// Target-schema definitions used by the AI import wizard.
//
// Each domain enumerates:
//   - the DB columns we accept on insert
//   - a human description (fed to the AI prompt so it can map sensibly)
//   - whether the column is required
//   - whether it's a foreign-key lookup (resolved via resolveLookups.ts)
//
// The Zod row schema validates a single resolved row before insert. We keep
// it lenient on optional text fields (matches the existing actions.ts schemas
// in passwords/clients/suppliers) so spreadsheet realities don't reject rows.

import { z } from "zod";

export type ImportDomain = "passwords" | "clients" | "suppliers";

export type ImportColumn = {
  column: string;             // DB column name (snake_case)
  description: string;        // shown to AI + admin
  required: boolean;
  // For FK columns we tell the importer which lookup table + display field
  // to resolve against. Null means scalar.
  lookup?: {
    table: string;
    labelColumn: string;      // e.g. 'name' on password_categories
    valueColumn: "id";        // always uuid PK
    allowCreate: boolean;     // can the wizard offer to create a new lookup row?
  };
};

export type ImportSchema = {
  domain: ImportDomain;
  tableName: string;          // target DB table
  displayName: string;        // e.g. "passwords"
  routePath: string;          // for revalidatePath after commit
  columns: ImportColumn[];
  // Per-row Zod check. Runs server-side on the resolved row right before
  // insert. Falls back to lenient .passthrough() of unknown extras.
  rowSchema: z.ZodType;
};

// ─── Passwords ──────────────────────────────────────────────────────────
const passwordsRowSchema = z.object({
  category_id: z.uuid(),
  system: z.string().min(1).max(200),
  dept_id: z.string().uuid().nullable().optional(),
  username: z.string().max(500).nullable().optional(),
  password: z.string().max(500).nullable().optional(),
  web_address: z.string().max(2000).nullable().optional(),
  further_info: z.string().max(5000).nullable().optional(),
});

const passwordsSchema: ImportSchema = {
  domain: "passwords",
  tableName: "passwords",
  displayName: "Passwords",
  routePath: "/passwords",
  rowSchema: passwordsRowSchema,
  columns: [
    {
      column: "system",
      description:
        "Name of the system/service the credential is for (e.g. 'Microsoft 365', 'AutoCAD Web'). Required.",
      required: true,
    },
    {
      column: "category_id",
      description:
        "Category the credential belongs to (e.g. 'Email', 'Design Software'). Maps to password_categories table.",
      required: true,
      lookup: {
        table: "password_categories",
        labelColumn: "name",
        valueColumn: "id",
        allowCreate: true,
      },
    },
    {
      column: "dept_id",
      description:
        "Department that owns/uses this credential (optional). Maps to departments table.",
      required: false,
      lookup: {
        table: "departments",
        labelColumn: "name",
        valueColumn: "id",
        allowCreate: false,
      },
    },
    {
      column: "username",
      description: "Login username, email, or account ID (sensitive).",
      required: false,
    },
    {
      column: "password",
      description: "The password itself (sensitive).",
      required: false,
    },
    {
      column: "web_address",
      description: "URL where this credential is used (e.g. 'https://login.microsoftonline.com').",
      required: false,
    },
    {
      column: "further_info",
      description:
        "Free-form notes: 2FA setup, recovery info, account owner, anything else (sensitive).",
      required: false,
    },
  ],
};

// ─── Clients ────────────────────────────────────────────────────────────
const clientsRowSchema = z.object({
  name: z.string().min(1).max(160),
  type_id: z.string().uuid().nullable().optional(),
  status_id: z.string().uuid().nullable().optional(),
  location: z.string().max(160).nullable().optional(),
  since_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "since_date must be YYYY-MM-DD")
    .nullable()
    .optional(),
  assigned_pm_id: z.string().uuid().nullable().optional(),
  important_info: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const clientsSchema: ImportSchema = {
  domain: "clients",
  tableName: "clients",
  displayName: "Clients",
  routePath: "/clients",
  rowSchema: clientsRowSchema,
  columns: [
    {
      column: "name",
      description: "Client name (the company/entity). Required.",
      required: true,
    },
    {
      column: "type_id",
      description: "Client type (e.g. 'Architect', 'Developer'). Maps to client_types.",
      required: false,
      lookup: { table: "client_types", labelColumn: "name", valueColumn: "id", allowCreate: true },
    },
    {
      column: "status_id",
      description: "Client lifecycle status (e.g. 'Active', 'Dormant'). Maps to client_statuses.",
      required: false,
      lookup: { table: "client_statuses", labelColumn: "name", valueColumn: "id", allowCreate: true },
    },
    {
      column: "location",
      description: "City, region, or full address (free text).",
      required: false,
    },
    {
      column: "since_date",
      description: "Date the relationship began. ISO format YYYY-MM-DD.",
      required: false,
    },
    {
      column: "assigned_pm_id",
      description:
        "Assigned project manager — match by full name or email. Maps to profiles table.",
      required: false,
      lookup: { table: "profiles", labelColumn: "full_name", valueColumn: "id", allowCreate: false },
    },
    {
      column: "important_info",
      description: "Headline info worth surfacing at a glance (free text).",
      required: false,
    },
    {
      column: "notes",
      description: "Longer-form notes (free text).",
      required: false,
    },
  ],
};

// ─── Suppliers ──────────────────────────────────────────────────────────
const suppliersRowSchema = z.object({
  name: z.string().min(1).max(160),
  type_id: z.string().uuid().nullable().optional(),
  status_id: z.string().uuid().nullable().optional(),
  location: z.string().max(160).nullable().optional(),
  since_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "since_date must be YYYY-MM-DD")
    .nullable()
    .optional(),
  assigned_pm_id: z.string().uuid().nullable().optional(),
  important_info: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const suppliersSchema: ImportSchema = {
  domain: "suppliers",
  tableName: "suppliers",
  displayName: "Suppliers",
  routePath: "/suppliers",
  rowSchema: suppliersRowSchema,
  columns: [
    {
      column: "name",
      description: "Supplier/vendor name. Required.",
      required: true,
    },
    {
      column: "type_id",
      description:
        "Supplier type (e.g. 'Material', 'Equipment Rental'). Maps to supplier_types.",
      required: false,
      lookup: { table: "supplier_types", labelColumn: "name", valueColumn: "id", allowCreate: true },
    },
    {
      column: "status_id",
      description:
        "Supplier lifecycle status (e.g. 'Active', 'On hold'). Maps to supplier_statuses.",
      required: false,
      lookup: { table: "supplier_statuses", labelColumn: "name", valueColumn: "id", allowCreate: true },
    },
    {
      column: "location",
      description: "City, region, or full address (free text).",
      required: false,
    },
    {
      column: "since_date",
      description: "Date the relationship began. ISO format YYYY-MM-DD.",
      required: false,
    },
    {
      column: "assigned_pm_id",
      description:
        "Internal owner/PM — match by full name or email. Maps to profiles table.",
      required: false,
      lookup: { table: "profiles", labelColumn: "full_name", valueColumn: "id", allowCreate: false },
    },
    {
      column: "important_info",
      description: "Headline info worth surfacing at a glance.",
      required: false,
    },
    {
      column: "notes",
      description: "Longer-form notes.",
      required: false,
    },
  ],
};

const REGISTRY: Record<ImportDomain, ImportSchema> = {
  passwords: passwordsSchema,
  clients: clientsSchema,
  suppliers: suppliersSchema,
};

export function getImportSchema(domain: ImportDomain): ImportSchema {
  const s = REGISTRY[domain];
  if (!s) throw new Error(`Unknown import domain: ${domain}`);
  return s;
}

export function listImportDomains(): ImportDomain[] {
  return Object.keys(REGISTRY) as ImportDomain[];
}
