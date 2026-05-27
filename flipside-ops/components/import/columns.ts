// Client-safe mirror of lib/import/schemas.ts: just the column metadata the
// wizard's dropdowns need (no Zod, no server-only imports). Keep in sync with
// lib/import/schemas.ts. If they drift, the import will fail at commit-time
// when the server re-validates.

export type ImportDomain = "passwords" | "clients" | "suppliers";

export type ImportColumnLite = {
  column: string;
  required: boolean;
  lookup?: { table: string; labelColumn: string; allowCreate: boolean };
};

const passwords: ImportColumnLite[] = [
  { column: "system", required: true },
  {
    column: "category_id",
    required: true,
    lookup: { table: "password_categories", labelColumn: "name", allowCreate: true },
  },
  {
    column: "dept_id",
    required: false,
    lookup: { table: "departments", labelColumn: "name", allowCreate: false },
  },
  { column: "username", required: false },
  { column: "password", required: false },
  { column: "web_address", required: false },
  { column: "further_info", required: false },
];

const clients: ImportColumnLite[] = [
  { column: "name", required: true },
  {
    column: "type_id",
    required: false,
    lookup: { table: "client_types", labelColumn: "name", allowCreate: true },
  },
  {
    column: "status_id",
    required: false,
    lookup: { table: "client_statuses", labelColumn: "name", allowCreate: true },
  },
  { column: "location", required: false },
  { column: "since_date", required: false },
  {
    column: "assigned_pm_id",
    required: false,
    lookup: { table: "profiles", labelColumn: "full_name", allowCreate: false },
  },
  { column: "important_info", required: false },
  { column: "notes", required: false },
];

const suppliers: ImportColumnLite[] = [
  { column: "name", required: true },
  {
    column: "type_id",
    required: false,
    lookup: { table: "supplier_types", labelColumn: "name", allowCreate: true },
  },
  {
    column: "status_id",
    required: false,
    lookup: { table: "supplier_statuses", labelColumn: "name", allowCreate: true },
  },
  { column: "location", required: false },
  { column: "since_date", required: false },
  {
    column: "assigned_pm_id",
    required: false,
    lookup: { table: "profiles", labelColumn: "full_name", allowCreate: false },
  },
  { column: "important_info", required: false },
  { column: "notes", required: false },
];

export const IMPORT_COLUMNS: Record<ImportDomain, ImportColumnLite[]> = {
  passwords,
  clients,
  suppliers,
};
