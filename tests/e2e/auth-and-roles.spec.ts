import { expect, test } from "@playwright/test";
import { login, USERS, type RoleName } from "./helpers";

const NAV: Record<Exclude<RoleName, "student">, { visible: string[]; hidden: string[] }> = {
  sysadmin: { visible: ["Dashboard", "Students", "Finance", "Users", "Roles & permissions"], hidden: [] },
  admin: { visible: ["Dashboard", "Students", "Offers", "Finance", "Reports", "Audit log"], hidden: ["Users", "Roles & permissions"] },
  operator: { visible: ["Dashboard", "Tasks", "Students", "Offers", "Info Center", "AI Assistant"], hidden: ["Finance", "Reports", "Users", "Audit log"] },
  finance: { visible: ["Dashboard", "Tasks", "Students", "Finance", "Finance reports"], hidden: ["Offers", "Users", "Reports"] },
};

test.describe("login per role", () => {
  for (const role of Object.keys(NAV) as (keyof typeof NAV)[]) {
    test(`${role} lands on the dashboard and sees only allowed menu items`, async ({ page }) => {
      await login(page, role);
      const nav = page.getByRole("navigation", { name: "Main" }).first();
      for (const item of NAV[role].visible) await expect(nav.getByRole("link", { name: item, exact: true })).toBeVisible();
      for (const item of NAV[role].hidden) await expect(nav.getByRole("link", { name: item, exact: true })).toHaveCount(0);
      await page.getByTestId("user-menu").click();
      await expect(page.getByTestId("user-role")).toHaveText(USERS[role].role);
    });
  }

  test("student lands on the portal and cannot open staff pages", async ({ page }) => {
    await login(page, "student");
    await expect(page.getByRole("heading", { name: /Hello/ })).toBeVisible();
    await expect(page.getByText("Document Checklist for Visa Interview")).toBeVisible();
    await page.goto("/students");
    await expect(page).toHaveURL(/\/portal/);
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.operator.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  });
});

test.describe("role-restricted pages return 403", () => {
  test("operator gets HTTP 403 on finance and user management", async ({ page }) => {
    await login(page, "operator");
    for (const path of ["/finance", "/admin/users", "/reports"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(403);
      await expect(page.getByRole("heading", { name: /403/ })).toBeVisible();
    }
  });

  test("admin gets HTTP 403 on users & roles", async ({ page }) => {
    await login(page, "admin");
    const res = await page.goto("/admin/roles");
    expect(res?.status()).toBe(403);
  });

  test("anonymous API calls are rejected", async ({ request }) => {
    const res = await request.get("/api/export/students?format=csv");
    expect(res.status()).toBe(401);
  });
});
