import { expect, test } from "@playwright/test";
import { login, type RoleName } from "./helpers";

/** Every page each role can open must render without a server error or client crash. */
const PAGES: Record<RoleName, string[]> = {
  sysadmin: ["/dashboard", "/tasks", "/students", "/students/new", "/offers", "/universities", "/kb", "/finance", "/finance/transactions", "/finance/fee-plans", "/finance/categories",
    "/reports", "/reports?tab=enrollment", "/reports?tab=funnel", "/reports?tab=visa", "/reports?tab=counselors", "/reports?tab=sources", "/reports?tab=offers", "/reports/finance",
    "/assistant", "/import", "/audit", "/trash", "/trash?tab=transactions", "/settings", "/admin/users", "/admin/roles", "/account"],
  admin: ["/dashboard", "/reports", "/finance", "/settings", "/audit"],
  operator: ["/dashboard", "/tasks", "/tasks?scope=all", "/students", "/offers", "/universities", "/kb", "/assistant", "/import"],
  finance: ["/dashboard", "/tasks", "/students", "/finance", "/finance/transactions", "/finance/fee-plans", "/reports/finance"],
  student: ["/portal", "/portal/account"],
};

for (const role of Object.keys(PAGES) as RoleName[]) {
  test(`${role}: all pages render`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${page.url()}: ${m.text()}`); });
    await login(page, role);
    for (const path of PAGES[role]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      await expect(page.getByText(/Application error|Unhandled Runtime Error|Internal Server Error/)).toHaveCount(0);
      await expect(page.locator("main")).toBeVisible();
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("student details tabs render for admin", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "admin");
  await page.goto("/students?status=visa_approved");
  await page.locator("table a[href^='/students/']").first().click();
  await page.waitForURL(/\/students\/[0-9a-f-]{36}/);
  const base = new URL(page.url()).pathname;
  for (const tab of ["overview", "education", "work", "family", "travel", "applications", "documents", "payments", "tasks", "notes"]) {
    const res = await page.goto(`${base}?tab=${tab}`);
    expect(res?.status(), tab).toBe(200);
    await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
  }
  await page.goto(base);
  await page.getByRole("button", { name: "Visa info sheet" }).click();
  await expect(page.getByLabel("Visa information sheet")).toHaveValue(/1\.Passport[\s\S]*Your Phone Number: \+880/);
  expect(errors).toEqual([]);
});
