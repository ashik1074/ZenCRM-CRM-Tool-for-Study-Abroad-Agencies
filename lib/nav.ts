import type { Action, Module } from "./permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: string; // lucide icon name, resolved in the client nav
  module: Module;
  action?: Action;
  systemAdminOnly?: boolean;
  group: "main" | "manage" | "admin";
};

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", module: "dashboard", group: "main" },
  { href: "/tasks", label: "Tasks", icon: "ListTodo", module: "tasks", group: "main" },
  { href: "/students", label: "Students", icon: "GraduationCap", module: "students", group: "main" },
  { href: "/offers", label: "Offers", icon: "FileBadge", module: "offers", group: "main" },
  { href: "/universities", label: "Universities", icon: "Landmark", module: "universities", group: "main" },
  { href: "/kb", label: "Info Center", icon: "BookOpen", module: "kb", group: "main" },
  { href: "/finance", label: "Finance", icon: "Wallet", module: "finance", group: "main" },
  { href: "/reports", label: "Reports", icon: "BarChart3", module: "reports", group: "main" },
  { href: "/reports/finance", label: "Finance reports", icon: "PieChart", module: "finance_reports", group: "main" },
  { href: "/assistant", label: "AI Assistant", icon: "Sparkles", module: "assistant", group: "main" },
  { href: "/import", label: "Bulk import", icon: "Upload", module: "import", group: "manage" },
  { href: "/audit", label: "Audit log", icon: "History", module: "audit", group: "manage" },
  { href: "/trash", label: "Deleted items", icon: "Trash2", module: "trash", group: "manage" },
  { href: "/settings", label: "Settings", icon: "Settings", module: "settings", group: "manage" },
  { href: "/admin/users", label: "Users", icon: "Users", module: "users", systemAdminOnly: true, group: "admin" },
  { href: "/admin/roles", label: "Roles & permissions", icon: "ShieldCheck", module: "roles", systemAdminOnly: true, group: "admin" },
];

/**
 * Route prefix → required permission. Longest prefix wins. Used by middleware to return HTTP 403
 * before rendering, and by pages via requirePagePermission (defence in depth).
 */
export const ROUTE_PERMISSIONS: { prefix: string; module: Module; action: Action; systemAdminOnly?: boolean }[] = [
  { prefix: "/dashboard", module: "dashboard", action: "view" },
  { prefix: "/tasks", module: "tasks", action: "view" },
  { prefix: "/students/new", module: "students", action: "create" },
  { prefix: "/students", module: "students", action: "view" },
  { prefix: "/offers", module: "offers", action: "view" },
  { prefix: "/universities", module: "universities", action: "view" },
  { prefix: "/kb", module: "kb", action: "view" },
  { prefix: "/finance/categories", module: "finance_categories", action: "edit" },
  { prefix: "/finance", module: "finance", action: "view" },
  { prefix: "/reports/finance", module: "finance_reports", action: "view" },
  { prefix: "/reports", module: "reports", action: "view" },
  { prefix: "/assistant", module: "assistant", action: "view" },
  { prefix: "/import", module: "import", action: "view" },
  { prefix: "/audit", module: "audit", action: "view" },
  { prefix: "/trash", module: "trash", action: "view" },
  { prefix: "/settings", module: "settings", action: "view" },
  { prefix: "/admin", module: "users", action: "view", systemAdminOnly: true },
  { prefix: "/portal", module: "portal", action: "view" },
];

export function routePermission(pathname: string) {
  return ROUTE_PERMISSIONS.filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
}
