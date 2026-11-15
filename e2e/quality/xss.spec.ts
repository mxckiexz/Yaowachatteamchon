import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";

test("TEST-56 / AC-41: HTML and script typed into text is shown as text and never executed", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  const tag = Math.random().toString(36).slice(2, 6);
  const title = `<img src=x onerror="window.__xss=1"> ${tag}`;
  const itemName = `<script>window.__xss=2</script>${tag}`;
  const comment = `<b>bold</b><script>window.__xss=3</script> ${tag}`;
  const xss = () => page.evaluate(() => (window as unknown as { __xss?: number }).__xss);

  await loginAs(page, ACCOUNTS.employee);
  await page.getByRole("link", { name: "New request" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Justification").fill(`<svg onload="window.__xss=4">`);
  await page.getByLabel("Item name 1").fill(itemName);
  await page.getByLabel("Unit price 1").fill("10");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/requests\/\d+$/);

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText(itemName)).toBeVisible();
  expect(await xss()).toBeUndefined();
  expect(await page.locator("main img, h1 img, table img").count()).toBe(0);

  await page.getByLabel("Approver").selectOption({ label: ACCOUNTS.approver.name });
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Pending approval");
  await page.getByRole("link", { name: "My requests" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  expect(await xss()).toBeUndefined();
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.getByRole("link", { name: "Review queue" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  expect(await xss()).toBeUndefined();
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByLabel(/Reason/).fill(comment);
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Rejected");
  await expect(page.getByTestId("decision-comment")).toHaveText(comment);
  await expect(page.getByTestId("history")).toContainText(comment);
  expect(await xss()).toBeUndefined();
  expect(dialogs).toEqual([]);
});
