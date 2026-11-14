import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { ACCOUNTS, DEMO_PASSWORD, loginAs, logout } from "../e2e/helpers/accounts";
import { createDraftViaUi, submitViaUi } from "../e2e/helpers/requests";

// Short readable titles for the screenshots; the 4-letter tag keeps repeated runs apart.
const uniqueTitle = (label: string) => `${label} ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const OUT = "artifacts/sprint-1/evidence";
const ORIGIN = "http://localhost:5173";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  // Start from an empty list for the four demo accounts (local development database only).
  const env = { ...process.env };
  for (const line of readFileSync("server/.env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2];
  }
  execSync("npx tsx scripts/reset-demo-requests.ts", { cwd: "server", env, stdio: "inherit" });
});

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

// Records a real API call (status and body) as a text file, so a screenshot is never the only proof.
async function apiCall(page: Page, name: string, method: "GET" | "POST", path: string, data?: unknown, expectedStatus?: number) {
  const response =
    method === "GET"
      ? await page.request.get(path)
      : await page.request.post(path, { headers: { Origin: ORIGIN }, data });
  const body = await response.text();
  let pretty = body;
  try { pretty = JSON.stringify(JSON.parse(body), null, 2); } catch { /* keep text */ }
  writeFileSync(`${OUT}/${name}.txt`, `${method} ${path}${data ? `\nrequest body: ${JSON.stringify(data)}` : ""}\nstatus: ${response.status()}\n${pretty}\n`);
  if (expectedStatus) expect(response.status()).toBe(expectedStatus);
  return { status: response.status(), body: body ? JSON.parse(body) : null };
}

test("Scenario 1: normal journey from employee to approver, with persistence", async ({ page }) => {
  const title = uniqueTitle("Office supplies");
  await loginAs(page, ACCOUNTS.employee);
  await shot(page, "s1-01-employee-list");

  await page.getByRole("link", { name: "New request" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Justification").fill("Stock is empty");
  await page.getByLabel("Item name 1").fill("A4 paper box");
  await page.getByLabel("Quantity 1").fill("2");
  await page.getByLabel("Unit price 1").fill("100.50");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Item name 2").fill("Stapler");
  await page.getByLabel("Quantity 2").fill("3");
  await page.getByLabel("Unit price 2").fill("20");
  await expect(page.getByTestId("estimate")).toHaveText("฿261.00");
  await shot(page, "s1-02-new-request-form");

  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/requests\/\d+$/);
  await expect(page.getByTestId("status-badge")).toHaveText("Draft");
  await shot(page, "s1-03-draft-detail");
  const id = Number(page.url().split("/").pop());

  await submitViaUi(page, ACCOUNTS.approver.name);
  await shot(page, "s1-04-pending-detail");

  await page.reload();
  await expect(page.getByTestId("status-badge")).toHaveText("Pending approval");
  await expect(page.getByTestId("total")).toHaveText("฿261.00");
  await shot(page, "s1-05-after-reload");
  await apiCall(page, "s1-06-api-detail-pending", "GET", `/api/requests/${id}`, undefined, 200);
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.getByRole("link", { name: "Review queue" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await shot(page, "s1-07-review-queue");
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByLabel("Comment (optional)").fill("Go ahead");
  await shot(page, "s1-08-approve-confirmation");
  await page.getByRole("button", { name: "Confirm approval" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await shot(page, "s1-09-approved-by-approver");
  await logout(page);

  await loginAs(page, ACCOUNTS.employee);
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await expect(page.getByTestId("decision-comment")).toHaveText("Go ahead");
  await shot(page, "s1-10-requester-sees-approved");
  await apiCall(page, "s1-11-api-detail-approved", "GET", `/api/requests/${id}`, undefined, 200);
});

test("Scenario 2: rule rejections (reason required, final decision, validation, self assignment)", async ({ page }) => {
  const title = uniqueTitle("To reject");
  await loginAs(page, ACCOUNTS.employee);
  await createDraftViaUi(page, title);
  const id = Number(page.url().split("/").pop());
  await submitViaUi(page, ACCOUNTS.approver.name);
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.getByRole("link", { name: "Review queue" }).click();
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByRole("alert")).toContainText("needs a reason");
  await shot(page, "s2-01-reject-without-reason");
  await apiCall(page, "s2-02-api-reject-without-reason", "POST", `/api/requests/${id}/decision`, { decision: "REJECTED", comment: "no" }, 422);

  await page.getByLabel(/Reason/).fill("Over budget this month");
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Rejected");
  await shot(page, "s2-03-rejected");
  await apiCall(page, "s2-04-api-decide-again", "POST", `/api/requests/${id}/decision`, { decision: "APPROVED", comment: "Changed my mind" }, 409);

  // Self assignment: the approver creates their own request and tries to send it to themselves.
  const me = (await (await page.request.get("/api/auth/me")).json()).user;
  const own = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { title: uniqueTitle("Own request"), items: [{ name: "Pen", quantity: 1, unitPrice: 10 }] },
  });
  const ownId = (await own.json()).request.id;
  await apiCall(page, "s2-05-api-self-assignment", "POST", `/api/requests/${ownId}/submit`, { approverId: me.id }, 422);
  await logout(page);

  await loginAs(page, ACCOUNTS.employee);
  await page.getByRole("link", { name: "New request" }).click();
  await page.getByLabel("Title").fill("ab");
  await page.getByLabel("Item name 1").fill("Pen");
  await page.getByLabel("Quantity 1").fill("0");
  await page.getByLabel("Unit price 1").fill("5");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Title must be 3 to 120 characters.")).toBeVisible();
  await shot(page, "s2-06-validation-errors");
  await apiCall(page, "s2-07-api-validation", "POST", "/api/requests", { title: "ab", total: 1, items: [{ name: "Pen", quantity: 0, unitPrice: 5 }] }, 422);
});

test("Scenario 3: login, logout and forbidden operations", async ({ page, playwright }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ACCOUNTS.employee.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
  await shot(page, "s3-01-wrong-login");

  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/requests");
  await expect(page.getByRole("link", { name: "Review queue" })).toHaveCount(0);
  await shot(page, "s3-02-employee-no-review-link");
  await page.goto("/reviews");
  await page.waitForURL("**/requests");
  await apiCall(page, "s3-03-api-employee-reviews", "GET", "/api/reviews", undefined, 403);
  await apiCall(page, "s3-04-api-employee-decision", "POST", "/api/requests/1/decision", { decision: "APPROVED", comment: "Not allowed" }, 403);
  await logout(page);
  await shot(page, "s3-05-after-logout");
  await apiCall(page, "s3-06-api-after-logout", "GET", "/api/auth/me", undefined, 401);

  // Another approver cannot read a request assigned to Somchai.
  const title = uniqueTitle("Only for Somchai");
  await loginAs(page, ACCOUNTS.employee);
  await createDraftViaUi(page, title);
  const id = Number(page.url().split("/").pop());
  await submitViaUi(page, ACCOUNTS.approver.name);
  await logout(page);
  await loginAs(page, ACCOUNTS.approver2);
  await page.goto(`/requests/${id}`);
  await expect(page.getByText("Request not found.")).toBeVisible();
  await shot(page, "s3-07-other-approver-not-found");
  await apiCall(page, "s3-08-api-other-approver", "GET", `/api/requests/${id}`, undefined, 404);

  // A caller with no session at all.
  const anon = await pwRequest.newContext({ baseURL: ORIGIN });
  const r = await anon.get("/api/requests");
  writeFileSync(`${OUT}/s3-09-api-anonymous.txt`, `GET /api/requests (no cookie)\nstatus: ${r.status()}\n${await r.text()}\n`);
  expect(r.status()).toBe(401);
});
