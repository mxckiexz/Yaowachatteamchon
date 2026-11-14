import { expect, type Page } from "@playwright/test";

export const uniqueTitle = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Creates a request through the UI and returns its id (taken from the detail page URL).
export async function createDraftViaUi(page: Page, title: string) {
  await page.getByRole("link", { name: "My requests" }).click();
  await page.getByRole("link", { name: "New request" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Justification").fill("Needed for the office");
  await page.getByLabel("Item name 1").fill("A4 paper box");
  await page.getByLabel("Quantity 1").fill("2");
  await page.getByLabel("Unit price 1").fill("100.50");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Item name 2").fill("Stapler");
  await page.getByLabel("Quantity 2").fill("3");
  await page.getByLabel("Unit price 2").fill("20");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/requests\/\d+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return Number(page.url().split("/").pop());
}

export async function submitViaUi(page: Page, approverName: string) {
  await page.getByLabel("Approver").selectOption({ label: approverName });
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Pending approval")).toBeVisible();
}
