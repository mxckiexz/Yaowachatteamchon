import { expect, type Page } from "@playwright/test";

export const ORIGIN = "http://localhost:5173";
export const uniqueName = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export interface Fill {
  itemName: string;
  description?: string;
  quantity?: string;
  unitPrice?: string;
  reason?: string;
  category?: string;
}

export async function fillForm(page: Page, f: Fill) {
  await page.getByLabel("Item name").fill(f.itemName);
  await page.getByLabel("Description").fill(f.description ?? "Needed for the office");
  await page.getByLabel("Quantity").fill(f.quantity ?? "2");
  await page.getByLabel("Unit price (THB)").fill(f.unitPrice ?? "100.50");
  await page.getByLabel(/^Reason/).fill(f.reason ?? "The old one broke");
  await page.getByLabel(/^Category/).selectOption(f.category ?? "EQUIPMENT");
}

// Creates a request through the UI and returns its id (taken from the detail page URL).
export async function createDraftViaUi(page: Page, itemName: string, over: Partial<Fill> = {}) {
  await page.goto("/requests/new");
  await fillForm(page, { itemName, ...over });
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/requests\/\d+$/);
  await expect(page.getByRole("heading", { name: new RegExp(itemName) })).toBeVisible();
  return Number(page.url().split("/").pop());
}

export async function submitViaUi(page: Page) {
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Submitted");
}
