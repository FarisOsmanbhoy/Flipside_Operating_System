// Hand-maintained types mirroring the migrations. Replace with `supabase gen
// types typescript` output once the project is connected via the Supabase CLI.

export type AccessLevel = 1 | 2 | 3;
export type TaskType =
  | "task"
  | "notice"
  | "industry_alert"
  | "recurring_template";
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type SubStatus = "preferred" | "backup" | "blacklisted";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export type Lookup = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
};

export type Department = Lookup;
export type ClientStatus = Lookup;
export type ClientType = Lookup;
export type TaskPriority = Lookup;
export type TaskCategory = Lookup;
export type IndustryAlertCategory = Lookup;
export type NoticeCategory = Lookup;

export type ClientSectionType = Lookup & {
  slug: string;
  description: string | null;
  icon: string | null;
  required_level: AccessLevel;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  access_level: AccessLevel;
  department_id: string | null;
  phone: string | null;
  mobile: string | null;
  start_date: string | null;
  avatar_url: string | null;
  languages: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  name: string;
  type_id: string | null;
  status_id: string | null;
  location: string | null;
  since_date: string | null;
  assigned_pm_id: string | null;
  important_info: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientSectionData = {
  id: string;
  client_id: string;
  section_type_id: string;
  data: Record<string, unknown>;
  last_reviewed_at: string | null;
  updated_at: string;
};

export type ClientContact = {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  preferred_channel: string | null;
  notes: string | null;
  display_order: number;
};

export type ClientSubcontractor = {
  id: string;
  client_id: string;
  trade: string;
  company_name: string;
  status: SubStatus;
  contact: string | null;
  notes: string | null;
};

export type Task = {
  id: string;
  type: TaskType;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_department: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority_id: string | null;
  category_id: string | null;
  alert_category_id: string | null;
  notice_category_id: string | null;
  linked_client_id: string | null;
  needs_prep: boolean;
  private: boolean;
  recurrence: Recurrence;
  recurrence_source_id: string | null;
  completed_at: string | null;
  dismissed_by: string[];
  created_at: string;
  created_by: string | null;
  updated_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type ChangeRequest = {
  id: string;
  client_id: string;
  section_type_id: string | null;
  requested_by: string;
  summary: string;
  proposed_data: Record<string, unknown> | null;
  status: ChangeRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_notes: string | null;
  created_at: string;
};

export type AuditLogEntry = {
  id: number;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: "create" | "update" | "delete";
  summary: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
};
