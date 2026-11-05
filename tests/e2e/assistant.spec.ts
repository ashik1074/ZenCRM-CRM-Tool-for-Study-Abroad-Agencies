import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("AI assistant", () => {
  test.skip(!process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY is not set — skipping live assistant tests");

  test("answers a count question from the database", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page, "admin");
    await page.goto("/assistant");
    await page.getByTestId("assistant-input").fill("How many students registered this year?");
    await page.getByTestId("assistant-input").press("Enter");
    const answer = page.getByTestId("assistant-message").last();
    await expect(answer).not.toContainText("Looking that up", { timeout: 120_000 });
    await expect(answer).toContainText(/\d+/);
    await answer.getByText(/Show query/).click();
    await expect(answer.locator("pre").first()).toContainText(/v_students/i);
  });

  test("refuses finance questions for operators", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page, "operator");
    await page.goto("/assistant");
    await page.getByTestId("assistant-input").fill("What was our profit last month?");
    await page.getByTestId("assistant-input").press("Enter");
    const answer = page.getByTestId("assistant-message").last();
    await expect(answer).not.toContainText("Looking that up", { timeout: 120_000 });
    await expect(answer).toContainText(/access|permission|not available|can't|cannot/i);
    await expect(answer).not.toContainText("৳");
  });

  test("returns the visa checklist verbatim", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page, "operator");
    await page.goto("/assistant");
    await page.getByTestId("assistant-input").fill("Give me the document checklist for visa interview");
    await page.getByTestId("assistant-input").press("Enter");
    const kb = page.getByTestId("kb-verbatim").last();
    await expect(kb).toContainText("1.Passport", { timeout: 120_000 });
    await expect(kb).toContainText("Ans. Sent all China residence Copy");
  });
});
