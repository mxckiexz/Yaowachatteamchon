import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs } from "../helpers/accounts";
import { createDraftViaUi, submitViaUi, uniqueTitle } from "../helpers/requests";

test("TEST-46 / AC-18: an employee creates a draft with two items and submits it to an approver", async ({ page }) => {
  await loginAs(page, ACCOUNTS.employee);
  const title = uniqueTitle("Office supplies");
  await page.getByRole("link", { name: "New request" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Item name 1").fill("A4 paper box");
  await page.getByLabel("Quantity 1").fill("2");
  await page.getByLabel("Unit price 1").fill("100.50");
  await expect(page.getByTestId("estimate")).toHaveText("฿201.00");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Item name 2").fill("Stapler");
  await page.getByLabel("Quantity 2").fill("3");
  await page.getByLabel("Unit price 2").fill("20");
  await expect(page.getByTestId("estimate")).toHaveText("฿261.00");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Item name 3").fill("Remove me");
  await page.getByLabel("Unit price 3").fill("999");
  await page.getByRole("button", { name: "Remove item 3" }).click();
  await expect(page.getByTestId("estimate")).toHaveText("฿261.00");

  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/requests\/\d+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  await expect(page.getByTestId("total")).toHaveText("฿261.00");

  await submitViaUi(page, ACCOUNTS.approver.name);
  await expect(page.getByText("Approver: Somchai")).toBeVisible();
  await expect(page.getByTestId("history").getByRole("listitem")).toHaveCount(2);
});

test("TEST-46 / AC-12 in the UI: server validation messages appear beside the fields", async ({ page }) => {
  await loginAs(page, ACCOUNTS.employee);
  await page.getByRole("link", { name: "New request" }).click();
  await page.getByLabel("Title").fill("ab");
  await page.getByLabel("Item name 1").fill("Pen");
  await page.getByLabel("Quantity 1").fill("0");
  await page.getByLabel("Unit price 1").fill("5");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Title must be 3 to 120 characters.")).toBeVisible();
  await expect(page.getByText("Quantity must be a whole number from 1 to 1000.")).toBeVisible();
  await expect(page).toHaveURL(/\/requests\/new$/);
});

test("TEST-47 / AC-31: saved data is still there after reloading the detail page and the list", async ({ page }) => {
  await loginAs(page, ACCOUNTS.employee);
  const title = uniqueTitle("Persistence check");
  const id = await createDraftViaUi(page, title);
  await submitViaUi(page, ACCOUNTS.approver.name);

  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Pending approval")).toBeVisible();
  await expect(page.getByTestId("total")).toHaveText("฿261.00");
  await expect(page.getByTestId("history").getByRole("listitem")).toHaveCount(2);

  await page.goto("/requests");
  const row = page.getByRole("row", { name: new RegExp(title) });
  await expect(row).toContainText("Pending approval");
  await expect(row).toContainText("Somchai");
  await page.goto(`/requests/${id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});
