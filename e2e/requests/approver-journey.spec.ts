import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { createDraftViaUi, ORIGIN, submitViaUi, uniqueName } from "../helpers/requests";

test("TEST-72 / AC-32: an approver approves one request and rejects another (first without a reason); the requester sees both", async ({ page }) => {
  const approveName = uniqueName("To approve");
  const rejectName = uniqueName("To reject");

  await loginAs(page, ACCOUNTS.requester);
  await createDraftViaUi(page, approveName);
  await submitViaUi(page);
  await createDraftViaUi(page, rejectName);
  await submitViaUi(page);
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.getByRole("link", { name: "Review queue" }).click();
  await expect(page.getByRole("row", { name: new RegExp(approveName) })).toContainText("Ploy");
  await expect(page.getByRole("row", { name: new RegExp(rejectName) })).toBeVisible();

  // Approve (any approver may decide, no assignment)
  await page.getByRole("row", { name: new RegExp(approveName) }).getByRole("link").click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("฿201.00").first()).toBeVisible();
  await page.getByLabel("Comment (optional)").fill("Go ahead");
  await page.getByRole("button", { name: "Confirm approval" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await expect(page.getByTestId("history")).toContainText("Go ahead");
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);

  // Reject: first without a reason (refused), then with one
  await page.getByRole("link", { name: "Review queue" }).click();
  await expect(page.getByRole("row", { name: new RegExp(approveName) })).toHaveCount(0);
  await page.getByRole("row", { name: new RegExp(rejectName) }).getByRole("link").click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByRole("alert")).toContainText("needs a reason");
  await expect(page.getByTestId("status-badge")).toHaveText("Submitted");
  await page.getByLabel(/Reason/).fill("Over budget this month");
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Rejected");
  await expect(page.getByTestId("rejection-reason")).toHaveText("Over budget this month");
  await logout(page);

  // The requester sees the outcomes and the reasons
  await loginAs(page, ACCOUNTS.requester);
  await page.getByRole("row", { name: new RegExp(approveName) }).getByRole("link").click();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await expect(page.getByTestId("history").getByRole("listitem")).toHaveCount(3);
  await page.getByRole("link", { name: "My requests" }).click();
  await page.getByRole("row", { name: new RegExp(rejectName) }).getByRole("link").click();
  await expect(page.getByTestId("status-badge")).toHaveText("Rejected");
  await expect(page.getByTestId("rejection-reason")).toHaveText("Over budget this month");
});

test("TEST-73 / AC-26, AC-32: a requester has no decision buttons and the API refuses them", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester2);
  await expect(page.getByRole("link", { name: "Review queue" })).toHaveCount(0);
  const id = await createDraftViaUi(page, uniqueName("Requester only"));
  await submitViaUi(page);
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);

  await page.goto("/reviews");
  await page.waitForURL("**/requests");
  const queue = await page.request.get("/api/requests?scope=review");
  expect(queue.status()).toBe(403);
  const approve = await page.request.post(`/api/requests/${id}/approve`, { headers: { Origin: ORIGIN }, data: { comment: "Trying anyway" } });
  expect(approve.status()).toBe(403);
  const reject = await page.request.post(`/api/requests/${id}/reject`, { headers: { Origin: ORIGIN }, data: { reason: "Trying anyway" } });
  expect(reject.status()).toBe(403);
});

test("an approver cannot approve their own request, and another requester cannot open it", async ({ page }) => {
  const name = uniqueName("Approver own");
  await loginAs(page, ACCOUNTS.approver);
  const id = await createDraftViaUi(page, name);
  await submitViaUi(page);
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  const own = await page.request.post(`/api/requests/${id}/approve`, { headers: { Origin: ORIGIN }, data: {} });
  expect(own.status()).toBe(403);
  expect((await own.json()).code).toBe("SELF_APPROVAL");
  await logout(page);

  await loginAs(page, ACCOUNTS.requester);
  await page.goto(`/requests/${id}`);
  await expect(page.getByText("Request not found.")).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
  expect((await page.request.get(`/api/requests/${id}`)).status()).toBe(404);
});
