import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { ACCOUNTS, DEMO_PASSWORD, loginAs, logout } from "../e2e/helpers/accounts";
import { createDraftViaUi, fillForm, ORIGIN, submitViaUi } from "../e2e/helpers/requests";

const OUT = "artifacts/sprint-1/evidence";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  // Start from an empty list for the demo accounts (local development database only).
  const env = { ...process.env };
  for (const line of readFileSync("server/.env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2];
  }
  execSync("npx tsx scripts/reset-demo-requests.ts", { cwd: "server", env, stdio: "inherit" });
});

// Short readable names for the screenshots; the 4-letter tag keeps repeated runs apart.
const name = (label: string) => `${label} ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const shot = (page: Page, file: string) => page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });

// Records a real API call (status and body) as a text file, so a screenshot is never the only proof.
async function apiCall(page: Page, file: string, method: "GET" | "POST" | "PATCH", path: string, data?: unknown, expectedStatus?: number) {
  const response =
    method === "GET" ? await page.request.get(path) : await page.request[method.toLowerCase() as "post" | "patch"](path, { headers: { Origin: ORIGIN }, data });
  const body = await response.text();
  let pretty = body;
  try { pretty = JSON.stringify(JSON.parse(body), null, 2); } catch { /* keep text */ }
  writeFileSync(`${OUT}/${file}.txt`, `${method} ${path}${data ? `\nrequest body: ${JSON.stringify(data)}` : ""}\nstatus: ${response.status()}\n${pretty}\n`);
  if (expectedStatus) expect(response.status()).toBe(expectedStatus);
  return { status: response.status(), body: body ? JSON.parse(body) : null };
}

test("Scenario 1: normal journey from requester to approver, with persistence", async ({ page }) => {
  const item = name("Laser printer");
  await loginAs(page, ACCOUNTS.requester);
  await shot(page, "s1-01-requester-list");

  await page.getByRole("link", { name: "New request" }).click();
  await fillForm(page, { itemName: item, description: "Office printer for floor 2", quantity: "2", unitPrice: "4500.50", reason: "The old one broke", category: "EQUIPMENT" });
  await expect(page.getByTestId("estimate")).toHaveText("฿9,001.00");
  await shot(page, "s1-02-new-request-form");

  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/requests\/\d+$/);
  await expect(page.getByTestId("status-badge")).toHaveText("Draft");
  await shot(page, "s1-03-draft-detail");
  const id = Number(page.url().split("/").pop());

  await submitViaUi(page);
  await shot(page, "s1-04-submitted-detail");
  await page.reload();
  await expect(page.getByTestId("status-badge")).toHaveText("Submitted");
  await expect(page.getByTestId("total")).toHaveText("฿9,001.00");
  await shot(page, "s1-05-after-reload");
  await apiCall(page, "s1-06-api-detail-submitted", "GET", `/api/requests/${id}`, undefined, 200);
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.getByRole("link", { name: "Review queue" }).click();
  await expect(page.getByRole("cell", { name: item })).toBeVisible();
  await shot(page, "s1-07-review-queue");
  await page.getByRole("row", { name: new RegExp(item) }).getByRole("link").click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByLabel("Comment (optional)").fill("Go ahead");
  await shot(page, "s1-08-approve-confirmation");
  await page.getByRole("button", { name: "Confirm approval" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await shot(page, "s1-09-approved-by-approver");
  await logout(page);

  await loginAs(page, ACCOUNTS.requester);
  await page.getByRole("row", { name: new RegExp(item) }).getByRole("link").click();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await expect(page.getByTestId("history")).toContainText("Go ahead");
  await shot(page, "s1-10-requester-sees-approved");
  await apiCall(page, "s1-11-api-detail-approved", "GET", `/api/requests/${id}`, undefined, 200);
});

test("Scenario 2: business rule rejections", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  // Incomplete draft: no reason, no category.
  await page.goto("/requests/new");
  const incomplete = name("Monitor");
  await page.getByLabel("Item name").fill(incomplete);
  await page.getByLabel("Description").fill("Second screen");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit price (THB)").fill("5000");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/requests\/\d+$/);
  const incompleteId = Number(page.url().split("/").pop());
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("alert")).toContainText("Reason is required to submit.");
  await shot(page, "s2-01-incomplete-submit-refused");
  await apiCall(page, "s2-02-api-submit-incomplete", "POST", `/api/requests/${incompleteId}/submit`, {}, 422);

  // A complete request to reject.
  const item = name("Keyboard");
  const id = await createDraftViaUi(page, item);
  await submitViaUi(page);
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.goto(`/requests/${id}`);
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByRole("alert")).toContainText("needs a reason");
  await shot(page, "s2-03-reject-without-reason");
  await apiCall(page, "s2-04-api-reject-short-reason", "POST", `/api/requests/${id}/reject`, { reason: "no" }, 422);
  await page.getByLabel(/Reason/).fill("Over budget this month");
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Rejected");
  await shot(page, "s2-05-rejected");
  await apiCall(page, "s2-06-api-decide-again", "POST", `/api/requests/${id}/approve`, { comment: "Changed my mind" }, 409);

  // An approver's own request cannot be approved by the same person.
  const own = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { itemName: name("Own request"), description: "Own", quantity: 1, unitPrice: 10, reason: "Own reason", category: "OTHER" },
  });
  const ownId = (await own.json()).request.id;
  await page.request.post(`/api/requests/${ownId}/submit`, { headers: { Origin: ORIGIN }, data: {} });
  await apiCall(page, "s2-07-api-self-approval", "POST", `/api/requests/${ownId}/approve`, { comment: "Approved by me" }, 403);
  await logout(page);

  await loginAs(page, ACCOUNTS.requester);
  await apiCall(page, "s2-08-api-edit-submitted", "PATCH", `/api/requests/${id}`, { itemName: "Changed after submit" }, 409);
  await page.goto("/requests/new");
  await fillForm(page, { itemName: "", quantity: "0", unitPrice: "5" });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Item name is required (at most 100 characters).")).toBeVisible();
  await shot(page, "s2-09-validation-errors");
  await apiCall(page, "s2-10-api-validation", "POST", "/api/requests", { itemName: "", description: "x", quantity: 0, unitPrice: 5, total: 1 }, 422);
});

test("Scenario 3: login, logout and forbidden operations", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ACCOUNTS.requester.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
  await shot(page, "s3-01-wrong-login");

  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/requests");
  await expect(page.getByRole("link", { name: "Review queue" })).toHaveCount(0);
  await shot(page, "s3-02-requester-no-review-link");
  await page.goto("/reviews");
  await page.waitForURL("**/requests");
  await apiCall(page, "s3-03-api-requester-review-queue", "GET", "/api/requests?scope=review", undefined, 403);
  const own = await createDraftViaUi(page, name("Own draft"));
  await submitViaUi(page);
  await apiCall(page, "s3-04-api-requester-approve", "POST", `/api/requests/${own}/approve`, { comment: "Not allowed" }, 403);

  // Another requester cannot read it.
  await logout(page);
  await shot(page, "s3-05-after-logout");
  await apiCall(page, "s3-06-api-after-logout", "GET", "/api/auth/me", undefined, 401);
  await loginAs(page, ACCOUNTS.requester2);
  await page.goto(`/requests/${own}`);
  await expect(page.getByText("Request not found.")).toBeVisible();
  await shot(page, "s3-07-other-requester-not-found");
  await apiCall(page, "s3-08-api-other-requester", "GET", `/api/requests/${own}`, undefined, 404);
  const anon = await pwRequest.newContext({ baseURL: ORIGIN });
  const r = await anon.get("/api/requests");
  writeFileSync(`${OUT}/s3-09-api-anonymous.txt`, `GET /api/requests (no cookie)\nstatus: ${r.status()}\n${await r.text()}\n`);
  expect(r.status()).toBe(401);
});

test("Scenario 4: the administrator", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 480 });
  await loginAs(page, ACCOUNTS.admin);
  await expect(page.getByRole("row", { name: /Nattapong/ })).toBeVisible();
  await shot(page, "s4-01-admin-users");
  const row = page.getByRole("row", { name: /Nattapong/ });
  try {
    await page.getByRole("button", { name: "Deactivate Nattapong" }).click();
    await expect(row).toContainText("Inactive");
    await shot(page, "s4-02-user-deactivated");
    const login = await pwRequest.newContext({ baseURL: ORIGIN });
    const res = await login.post("/api/auth/login", { headers: { Origin: ORIGIN }, data: { email: ACCOUNTS.requester2.email, password: DEMO_PASSWORD } });
    writeFileSync(`${OUT}/s4-03-api-deactivated-login.txt`, `POST /api/auth/login (deactivated user, correct password)\nstatus: ${res.status()}\n${await res.text()}\n`);
    expect(res.status()).toBe(401);
  } finally {
    await page.getByRole("button", { name: "Activate Nattapong" }).click();
    await expect(row).toContainText("Active");
  }
  await page.getByRole("link", { name: "All requests" }).click();
  await expect(page.getByRole("heading", { name: "All requests (read only)" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^PR-/ }).first()).toBeVisible();
  await shot(page, "s4-04-admin-all-requests");
  const first = (await (await page.request.get("/api/requests?scope=all")).json()).requests[0];
  await apiCall(page, "s4-05-api-admin-approve", "POST", `/api/requests/${first.id}/approve`, { comment: "Admin may not decide" }, 403);
  const me = (await (await page.request.get("/api/auth/me")).json()).user;
  await apiCall(page, "s4-06-api-admin-self-change", "PATCH", `/api/admin/users/${me.id}`, { isActive: false }, 409);
});
