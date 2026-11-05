import { expect, type Page } from "@playwright/test";

export const USERS = {
  sysadmin: { email: "sysadmin@crm.test", password: "SysAdmin#2026", role: "System Administrator", home: "/dashboard" },
  admin: { email: "admin@crm.test", password: "Admin#2026", role: "Admin", home: "/dashboard" },
  operator: { email: "operator@crm.test", password: "Operator#2026", role: "Operator", home: "/dashboard" },
  finance: { email: "finance@crm.test", password: "Finance#2026", role: "Finance Operator", home: "/dashboard" },
  student: { email: "student@crm.test", password: "Student#2026", role: "Student", home: "/portal" },
} as const;
export type RoleName = keyof typeof USERS;

export async function login(page: Page, who: RoleName) {
  const u = USERS[who];
  await page.goto("/login");
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(u.home), { timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`${u.home}`));
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;
