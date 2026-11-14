import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { createDraftViaUi, submitViaUi, uniqueTitle } from "../helpers/requests";

const ORIGIN = "http://localhost:5173";

test("TEST-48 / AC-32: the approver approves one request and rejects another with a reason; the requester sees both", async ({ page }) => {
  const approveTitle = uniqueTitle("To approve");
  const rejectTitle = uniqueTitle("To reject");

  await loginAs(page, ACCOUNTS.employee);
  await createDraftViaUi(page, approveTitle);
  await submitViaUi(page, ACCOUNTS.approver.name);
  await createDraftViaUi(page, rejectTitle);
  await submitViaUi(page, ACCOUNTS.approver.name);
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.getByRole("link", { name: "Review queue" }).click();
  await expect(page.getByRole("link", { name: approveTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: rejectTitle })).toBeVisible();

  // Approve
  await page.getByRole("link", { name: approveTitle }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("฿261.00").first()).toBeVisible();
  await page.getByLabel("Comment (optional)").fill("Go ahead");
  await page.getByRole("button", { name: "Confirm approval" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await expect(page.getByTestId("decision-comment")).toHaveText("Go ahead");
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);

  // Reject: first without a reason (refused), then with one
  await page.getByRole("link", { name: "Review queue" }).click();
  await expect(page.getByRole("link", { name: approveTitle })).toHaveCount(0);
  await page.getByRole("link", { name: rejectTitle }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByRole("alert")).toContainText("needs a reason");
  await expect(page.getByTestId("status-badge")).toHaveText("Pending approval");
  await page.getByLabel(/Reason/).fill("Over budget this month");
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Rejected");
  await logout(page);

  // The requester sees the outcomes and the comments
  await loginAs(page, ACCOUNTS.employee);
  await page.getByRole("link", { name: approveTitle }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await expect(page.getByTestId("decision-comment")).toHaveText("Go ahead");
  await expect(page.getByTestId("history").getByRole("listitem")).toHaveCount(3);
  await page.getByRole("link", { name: "My requests" }).click();
  await page.getByRole("link", { name: rejectTitle }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Rejected");
  await expect(page.getByTestId("decision-comment")).toHaveText("Over budget this month");

  // The API itself refuses the requester, whatever the page shows
  const id = Number(page.url().split("/").pop());
  const denied = await page.request.post(`/api/requests/${id}/decision`, {
    headers: { Origin: ORIGIN },
    data: { decision: "APPROVED", comment: "Trying anyway" },
  });
  expect(denied.status()).toBe(403);
});

test("TEST-49 / AC-32, AC-21: an employee has no review link, is redirected from /reviews, and the API says 403", async ({ page }) => {
  await loginAs(page, ACCOUNTS.employee2);
  await expect(page.getByRole("link", { name: "Review queue" })).toHaveCount(0);
  await page.goto("/reviews");
  await page.waitForURL("**/requests");
  await expect(page.getByRole("heading", { name: "My requests" })).toBeVisible();

  const queue = await page.request.get("/api/reviews");
  expect(queue.status()).toBe(403);
  expect(await queue.json()).not.toHaveProperty("requests");
  const decision = await page.request.post("/api/requests/1/decision", {
    headers: { Origin: ORIGIN },
    data: { decision: "APPROVED", comment: "Not allowed" },
  });
  expect(decision.status()).toBe(403);
});

test("an approver cannot read another person's request by guessing its URL", async ({ page }) => {
  const title = uniqueTitle("Only for Somchai");
  await loginAs(page, ACCOUNTS.employee);
  const id = await createDraftViaUi(page, title);
  await submitViaUi(page, ACCOUNTS.approver.name);
  await logout(page);

  await loginAs(page, ACCOUNTS.approver2);
  await page.goto(`/requests/${id}`);
  await expect(page.getByText("Request not found.")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
  const api = await page.request.get(`/api/requests/${id}`);
  expect(api.status()).toBe(404);
});
