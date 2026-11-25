import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { createDraftViaUi, ORIGIN, submitViaUi, uniqueName } from "../helpers/requests";

test("TEST-104 / AC-71, AC-73: owner sees Cancel, confirms it, and sees the cancelled history", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Cancel draft"));
  const cancelButton = page.getByRole("button", { name: "Cancel request", exact: true });
  await expect(cancelButton).toBeVisible();
  await cancelButton.click();
  const confirm = page.getByRole("button", { name: "Confirm cancellation" });
  await expect(confirm).toBeFocused();
  await confirm.click();
  await expect(page.getByTestId("status-badge")).toHaveText("Cancelled");
  await expect(page.getByTestId("history")).toContainText("Cancelled");
  await expect(page.getByRole("button", { name: "Cancel request", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit request" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Edit draft" })).toHaveCount(0);
  expect(id).toBeGreaterThan(0);
});

test("TEST-105 / AC-72: a non-owner and an owner of an approved request do not see Cancel", async ({ page, context }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Cancel visibility"));
  await submitViaUi(page);

  const approverPage = await context.newPage();
  await loginAs(approverPage, ACCOUNTS.approver);
  const approved = await approverPage.request.post(`/api/requests/${id}/approve`, { headers: { Origin: ORIGIN }, data: { comment: "Approved" } });
  expect(approved.status()).toBe(200);
  await approverPage.close();

  await page.reload();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await expect(page.getByRole("button", { name: "Cancel request", exact: true })).toHaveCount(0);
  await logout(page);

  await loginAs(page, ACCOUNTS.requester2);
  await page.goto(`/requests/${id}`);
  await expect(page.getByText("Request not found.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel request", exact: true })).toHaveCount(0);
});
