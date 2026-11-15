import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs } from "../helpers/accounts";
import { createDraftViaUi, fillForm, submitViaUi, uniqueName } from "../helpers/requests";

test("TEST-71 / AC-23: a requester creates a draft, edits it, is refused an incomplete submit, completes it and submits", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const name = uniqueName("Printer");
  await page.getByRole("link", { name: "New request" }).click();
  await page.getByLabel("Item name").fill(name);
  await page.getByLabel("Description").fill("Office printer");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Unit price (THB)").fill("4500.50");
  await expect(page.getByTestId("estimate")).toHaveText("฿9,001.00");
  // Reason and category are left empty: allowed for a draft, not for a submit (BR-06).
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/requests\/\d+$/);
  await expect(page.getByTestId("status-badge")).toHaveText("Draft");
  await expect(page.getByRole("heading", { name: /^PR-\d{4}-\d{4}: / })).toBeVisible();

  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("alert")).toContainText("The request is incomplete.");
  await expect(page.getByRole("alert")).toContainText("Reason is required to submit.");
  await expect(page.getByRole("alert")).toContainText("Category is required to submit.");
  await expect(page.getByTestId("status-badge")).toHaveText("Draft");

  // Edit the draft: server validation shows beside the field, then a valid change is saved.
  const editSection = page.getByRole("region", { name: "Edit draft" });
  await editSection.getByLabel("Quantity").fill("0");
  await editSection.getByRole("button", { name: "Save changes" }).click();
  await expect(editSection.getByText("Quantity must be a whole number from 1 to 1000.")).toBeVisible();
  await editSection.getByLabel("Quantity").fill("3");
  await editSection.getByLabel(/^Reason/).fill("Floor 2 has no printer");
  await editSection.getByLabel(/^Category/).selectOption("EQUIPMENT");
  await editSection.getByRole("button", { name: "Save changes" }).click();
  await expect(editSection.getByLabel("Quantity")).toHaveValue("3");

  await submitViaUi(page);
  await expect(page.getByTestId("total")).toHaveText("฿13,501.50");
  await expect(page.getByTestId("history").getByRole("listitem")).toHaveCount(2);
  // A submitted request can no longer be edited from the screen.
  await expect(page.getByRole("region", { name: "Edit draft" })).toHaveCount(0);
});

test("TEST-71 / AC-14 in the UI: server validation messages appear beside the fields", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests/new");
  await fillForm(page, { itemName: "", quantity: "0", unitPrice: "5" });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Item name is required (at most 100 characters).")).toBeVisible();
  await expect(page.getByText("Quantity must be a whole number from 1 to 1000.")).toBeVisible();
  await expect(page).toHaveURL(/\/requests\/new$/);
});

test("TEST-74 / AC-38: saved data is still there after reloading the detail page and the list", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const name = uniqueName("Persistence");
  const id = await createDraftViaUi(page, name);
  await submitViaUi(page);

  await page.reload();
  await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByTestId("status-badge")).toHaveText("Submitted");
  await expect(page.getByTestId("total")).toHaveText("฿201.00");
  await expect(page.getByTestId("history").getByRole("listitem")).toHaveCount(2);

  await page.goto("/requests");
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("Submitted");
  await expect(row).toContainText("฿201.00");
  await page.goto(`/requests/${id}`);
  await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
});
