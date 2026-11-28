import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
  await section.getByRole("button", { name: "Keep submitted" }).click();
  await expect(section.getByRole("button", { name: "Return for editing", exact: true })).toBeFocused();
  await section.getByRole("button", { name: "Return for editing", exact: true }).click();
  await section.getByLabel("Reason").fill("No");
  await section.getByRole("button", { name: "Confirm return" }).click();
  await expect(section.getByRole("alert")).toBeVisible();
  await expect(section.getByLabel("Reason")).toHaveValue("No");
  await section.getByLabel("Reason").fill("Please correct the quantity");
  await section.getByRole("button", { name: "Confirm return" }).click();
  await expect(page).toHaveURL(/\/reviews$/);
  await expect(page.getByRole("status")).toContainText("was returned to the requester");
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeFocused();
  await page.goto(`/requests/${id}`);
  await expect(page.getByRole("region", { name: "Return for editing" })).toHaveCount(0);
  const own = await page.request.post("/api/requests", { headers: { Origin: "http://localhost:5173" }, data: { itemName: "Own F11 request", description: "Own request", quantity: 1, unitPrice: 10, reason: "Own reason", category: "EQUIPMENT" } });
  const ownId = (await own.json()).request.id; await page.request.post(`/api/requests/${ownId}/submit`, { headers: { Origin: "http://localhost:5173" }, data: {} }); await page.goto(`/requests/${ownId}`); await expect(page.getByRole("region", { name: "Return for editing" })).toHaveCount(0);
  const decided = await page.request.post("/api/requests", { headers: { Origin: "http://localhost:5173" }, data: { itemName: "Decided F11 request", description: "Decided request", quantity: 1, unitPrice: 10, reason: "Decided reason", category: "EQUIPMENT" } });
  const decidedId = (await decided.json()).request.id; await page.request.post(`/api/requests/${decidedId}/submit`, { headers: { Origin: "http://localhost:5173" }, data: {} });
  const browser = page.context().browser(); const isolated = await browser!.newContext(); const secondApprover = await isolated.newPage(); await loginAs(secondApprover, ACCOUNTS.approver2); await secondApprover.request.post(`/api/requests/${decidedId}/approve`, { headers: { Origin: "http://localhost:5173" }, data: { comment: "Approved" } }); await isolated.close();
  await loginAs(page, ACCOUNTS.approver); await page.goto(`/requests/${decidedId}`); await expect(page.getByRole("region", { name: "Return for editing" })).toHaveCount(0);
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

test("TEST-202 / AC-173: returned drafts remain usable by the owner", async ({ page, context }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Return cross feature")); await submitViaUi(page);
  const before = await page.request.get("/api/dashboard"); const beforeData = await before.json();
  const approver = await context.newPage(); await loginAs(approver, ACCOUNTS.approver);
  const response = await approver.request.post(`/api/requests/${id}/return`, { data: { reason: "Please add more detail" }, headers: { Origin: "http://localhost:5173" } }); expect(response.status()).toBe(200);
  await logout(approver); await approver.close(); await loginAs(page, ACCOUNTS.requester); await page.goto(`/requests/${id}`);
  await expect(page.getByRole("region", { name: "Edit draft" })).toBeVisible();
  const after = await page.request.get("/api/dashboard"); const afterData = await after.json();
  expect(afterData.counts.DRAFT).toBe(beforeData.counts.DRAFT + 1); expect(afterData.counts.SUBMITTED).toBe(beforeData.counts.SUBMITTED - 1);
  const upload = await page.request.post(`/api/requests/${id}/attachments`, { headers: { Origin: "http://localhost:5173", "Content-Type": "application/octet-stream", "X-File-Name": "return-proof.pdf" }, data: Buffer.from("%PDF-1.4 test attachment") }); expect(upload.status()).toBe(201);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Draft/ })).toBeVisible();
  await page.goto(`/requests/${id}`);
  await expect(page.getByRole("region", { name: "Attachments" })).toBeVisible();
  const attachments = await page.request.get(`/api/requests/${id}/attachments`); const attachment = (await attachments.json()).attachments[0]; expect(attachment.fileName).toBe("return-proof.pdf");
  const deleted = await page.request.delete(`/api/requests/${id}/attachments/${attachment.id}`, { headers: { Origin: "http://localhost:5173" } }); expect(deleted.status()).toBe(204);
  await expect(page.getByRole("button", { name: "Cancel request", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel request", exact: true }).click(); await page.getByRole("button", { name: "Confirm cancellation" }).click(); await expect(page.getByTestId("status-badge")).toHaveText("Cancelled");
});

test("TEST-203 / AC-174: return form has no horizontal page scrolling at required widths", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester); const id = await createDraftViaUi(page, uniqueName("Return responsive")); await submitViaUi(page); await logout(page); await loginAs(page, ACCOUNTS.approver); await page.goto(`/requests/${id}`);
  await page.getByRole("button", { name: "Return for editing", exact: true }).click();
  for (const width of [375, 768, 1280]) { await page.setViewportSize({ width, height: 800 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); }
});

test("TEST-204 / AC-175: return section has no serious or critical axe violations", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester); const id = await createDraftViaUi(page, uniqueName("Return axe")); await submitViaUi(page); await logout(page); await loginAs(page, ACCOUNTS.approver); await page.goto(`/requests/${id}`); await page.getByRole("button", { name: "Return for editing", exact: true }).click();
  const result = await new AxeBuilder({ page }).analyze(); expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});

test("TEST-205 / AC-176: return reason is rendered as text and success is announced", async ({ page, context }) => {
  await loginAs(page, ACCOUNTS.requester); const id = await createDraftViaUi(page, uniqueName("Return text")); await submitViaUi(page); const approver = await context.newPage(); await loginAs(approver, ACCOUNTS.approver);
  const reason = "Please <b>fix</b> the details"; const response = await approver.request.post(`/api/requests/${id}/return`, { data: { reason }, headers: { Origin: "http://localhost:5173" } }); expect(response.status()).toBe(200); await logout(approver); await approver.close(); await loginAs(page, ACCOUNTS.requester); await page.goto(`/requests/${id}`);
  await expect(page.getByTestId("history")).toContainText(reason); await expect(page.getByTestId("history").locator("b")).toHaveCount(0);
});
