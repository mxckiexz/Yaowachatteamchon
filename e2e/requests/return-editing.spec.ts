import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { createDraftViaUi, submitViaUi, uniqueName } from "../helpers/requests";

test("TEST-200 / AC-171: approver can return a submitted request with confirmation", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Return for editing"));
  await submitViaUi(page);
  await logout(page);
  await loginAs(page, ACCOUNTS.approver);
  await page.goto(`/requests/${id}`);
  const section = page.getByRole("region", { name: "Return for editing" });
  await section.getByRole("button", { name: "Return for editing", exact: true }).click();
  await expect(section.getByLabel("Reason")).toBeFocused();
  await section.getByLabel("Reason").fill("Please correct the quantity");
  await expect(section.getByRole("button", { name: "Keep submitted" })).toBeVisible();
  await section.getByRole("button", { name: "Confirm return" }).click();
  await expect(page).toHaveURL(/\/reviews\?returned=PR-/);
  await expect(page.locator("p.alert-success[role='status']")).toContainText("was returned to the requester");
});

test("TEST-201 / AC-172: owner can edit and resubmit the returned draft", async ({ page, context }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Returned draft"));
  await submitViaUi(page);
  const approver = await context.newPage();
  await loginAs(approver, ACCOUNTS.approver);
  const response = await approver.request.post(`/api/requests/${id}/return`, { data: { reason: "Please add more detail" }, headers: { Origin: "http://localhost:5173" } });
  expect(response.status()).toBe(200);
  await logout(approver);
  await approver.close();
  await loginAs(page, ACCOUNTS.requester);
  await page.goto(`/requests/${id}`);
  await expect(page.getByTestId("status-badge")).toHaveText("Draft");
  await expect(page.getByRole("region", { name: "Edit draft" })).toBeVisible();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Submitted");
});
