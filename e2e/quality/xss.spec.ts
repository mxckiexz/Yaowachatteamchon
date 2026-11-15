import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { fillForm } from "../helpers/requests";

test("TEST-86 / AC-51: HTML and script typed into text is shown as text and never executed", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  const tag = Math.random().toString(36).slice(2, 6);
  const itemName = `<img src=x onerror="window.__xss=1"> ${tag}`;
  const description = `<script>window.__xss=2</script>${tag}`;
  const reason = `<svg onload="window.__xss=4"> ${tag}`;
  const rejection = `<b>bold</b><script>window.__xss=3</script> ${tag}`;
  const xss = () => page.evaluate(() => (window as unknown as { __xss?: number }).__xss);

  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests/new");
  await fillForm(page, { itemName, description, reason, unitPrice: "10", quantity: "1" });
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/requests\/\d+$/);
  // The draft is shown in an edit form; the values are text inside inputs, never markup.
  await expect(page.getByLabel("Item name")).toHaveValue(itemName);
  expect(await xss()).toBeUndefined();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Submitted");

  // Read-only view of the same text
  await expect(page.getByRole("heading", { name: new RegExp(tag) })).toContainText(itemName);
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText(reason)).toBeVisible();
  expect(await xss()).toBeUndefined();
  expect(await page.locator("h1 img, table img, h1 svg, table svg").count()).toBe(0);

  await page.getByRole("link", { name: "My requests" }).click();
  await expect(page.getByRole("cell", { name: itemName })).toBeVisible();
  expect(await xss()).toBeUndefined();
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.getByRole("link", { name: "Review queue" }).click();
  await expect(page.getByRole("cell", { name: itemName })).toBeVisible();
  expect(await xss()).toBeUndefined();
  await page.getByRole("row", { name: new RegExp(tag) }).getByRole("link").click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByLabel(/Reason/).fill(rejection);
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Rejected");
  await expect(page.getByTestId("rejection-reason")).toHaveText(rejection);
  await expect(page.getByTestId("history")).toContainText(rejection);
  expect(await xss()).toBeUndefined();
  expect(dialogs).toEqual([]);
});
