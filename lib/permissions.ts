/** Permission model shared by client and server. The database is the source of truth for grants. */

export const ACTIONS = ["view", "create", "edit", "delete", "export"] as const;
export type Action = (typeof ACTIONS)[number];

export const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "students", label: "Students" },
  { key: "universities", label: "Universities" },
  { key: "offers", label: "University offers" },
  { key: "applications", label: "Applications" },
  { key: "tasks", label: "Tasks (own)" },
  { key: "tasks_all", label: "All users' tasks" },
  { key: "sprints", label: "Sprints" },
  { key: "kb", label: "Knowledge base" },
  { key: "finance", label: "Finance" },
  { key: "finance_categories", label: "Finance categories" },
  { key: "finance_reports", label: "Finance reports" },
  { key: "reports", label: "Business reports" },
  { key: "assistant", label: "AI assistant" },
  { key: "assistant_finance", label: "AI assistant: finance data" },
  { key: "audit", label: "Audit log" },
  { key: "trash", label: "Deleted items (restore)" },
  { key: "settings", label: "Settings" },
  { key: "import", label: "Bulk import" },
  { key: "portal", label: "Student portal" },
  { key: "users", label: "Users (System Admin only)" },
  { key: "roles", label: "Roles & permissions (System Admin only)" },
] as const;
export type Module = (typeof MODULES)[number]["key"];

/** Modules that are locked to the System Administrator and cannot be granted from the matrix. */
export const LOCKED_MODULES: Module[] = ["users", "roles"];

export type PermissionSet = Set<string>;
export const can = (perms: PermissionSet | string[], module: Module, action: Action = "view") =>
  Array.isArray(perms) ? perms.includes(`${module}:${action}`) : perms.has(`${module}:${action}`);
