import { expect, test } from "@playwright/test";
import { login, unique } from "./helpers";

test("operator enrolls a student through the multi-step form", async ({ page }) => {
  await login(page, "operator");
  const name = unique("E2E Student");
  await page.goto("/students/new");
  await page.getByLabel("Full name (as in passport)").fill(name);
  await page.getByLabel("Gender").selectOption("female");
  await page.getByLabel("Date of birth").fill("2003-04-12");
  await page.getByLabel("Phone").fill(`+8801${Date.now().toString().slice(-9)}`);
  await page.getByLabel("Email").fill(`${Date.now()}@e2e.test`);
  // walk through every step to the last one
  for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "Next" }).click();
  await page.getByTestId("student-submit").click();
  await page.waitForURL(/\/students\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  // shows up in the list search
  await page.goto(`/students?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name })).toBeVisible();
});

test("operator adds a task and changes its status inline", async ({ page }) => {
  await login(page, "operator");
  const title = unique("E2E task");
  await page.goto("/tasks");
  await page.getByTestId("add-task").click();
  await page.getByTestId("task-title").fill(title);
  await page.getByTestId("task-submit").click();
  const row = page.getByTestId("task-row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByTestId("task-status").selectOption("in_progress");
  await expect(page.getByText("Task updated")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("task-row").filter({ hasText: title }).getByTestId("task-status")).toHaveValue("in_progress");
  // open the drawer and see the status change in history
  await page.getByTestId("task-row").filter({ hasText: title }).getByRole("link", { name: title }).click();
  await expect(page.getByTestId("task-drawer").getByText(/changed status/)).toBeVisible();
});

test("operator adds an offer and opens it in the modal", async ({ page }) => {
  await login(page, "operator");
  const title = unique("E2E CSC Master offer");
  await page.goto("/offers?new=1");
  await page.getByLabel("Offer name / title").fill(title);
  await page.getByLabel("University").selectOption({ index: 1 });
  await page.getByLabel("Program / major").fill("Software Engineering");
  await page.getByLabel("Degree level").selectOption("Master");
  const deadline = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Application deadline").fill(deadline);
  await page.getByTestId("offer-submit").click();
  await expect(page.getByText("Offer saved")).toBeVisible();
  await page.goto(`/offers?q=${encodeURIComponent(title)}`);
  await page.getByRole("button", { name: title }).click();
  const modal = page.getByTestId("offer-modal");
  await expect(modal.getByRole("heading", { name: title })).toBeVisible();
  await expect(modal.getByText("Software Engineering")).toBeVisible();
  await expect(modal.getByRole("button", { name: "Edit" })).toBeVisible();
});

test("finance operator adds income and expense", async ({ page }) => {
  await login(page, "finance");
  const ref = `E2E-${Date.now()}`;
  for (const type of ["income", "expense"] as const) {
    await page.goto("/finance/transactions");
    await page.getByTestId("add-transaction").click();
    const sheet = page.getByTestId("transaction-sheet");
    await sheet.getByRole("radio", { name: type }).click();
    await sheet.getByTestId("txn-amount").fill(type === "income" ? "12345" : "678");
    await sheet.getByLabel("Reference / transaction ID").fill(`${ref}-${type}`);
    await sheet.getByTestId("txn-submit").click();
    await expect(page.getByText(/saved/)).toBeVisible();
    await page.goto(`/finance/transactions?q=${ref}-${type}`);
    await expect(page.getByText(`${ref}-${type}`)).toBeVisible();
  }
});
