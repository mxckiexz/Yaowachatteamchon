import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { ORIGIN, uniqueName } from "../helpers/requests";

async function createRequest(page: import("@playwright/test").Page, itemName: string, category = "OTHER") {
  const response = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { itemName, description: "Search filter description", quantity: 1, unitPrice: 10, reason: "Search filter reason", category },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).request.id as number;
}

async function createSubmittedRequest(page: import("@playwright/test").Page, itemName: string, category = "OTHER") {
  const id = await createRequest(page, itemName, category);
  const response = await page.request.post(`/api/requests/${id}/submit`, { headers: { Origin: ORIGIN }, data: {} });
  expect(response.status()).toBe(200);
  return id;
}

test("TEST-119 / AC-87: filters work with keyboard and Enter", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const submittedName = uniqueName("Browser filter submitted");
  await createRequest(page, uniqueName("Browser filter draft"), "EQUIPMENT");
  await createSubmittedRequest(page, submittedName, "SOFTWARE");
  await page.goto("/requests");
  await page.getByLabel("Search text").focus();
  await page.getByLabel("Search text").fill(submittedName);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Status")).toBeFocused();
  await page.getByLabel("Status").selectOption("SUBMITTED");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Category")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/status=SUBMITTED/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText(submittedName);
});

test("TEST-120 / AC-88: labels and review controls are present", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests");
  await expect(page.getByLabel("Search text")).toBeVisible();
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByLabel("Category")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/requests$/);
  await expect(page.getByRole("status")).toContainText(/results|Loading results/);
});

test("TEST-121 / AC-89: Clear filters removes query parameters", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const clearName = uniqueName("Browser clear row");
  await createRequest(page, clearName, "EQUIPMENT");
  await page.goto("/requests?q=anything&status=DRAFT");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/requests$/);
  await expect(page.locator("tbody tr").filter({ hasText: clearName })).toHaveCount(1);
});

test("TEST-122 / AC-90: empty state and forbidden scope control", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests");
  await expect(page.getByRole("link", { name: "Review queue" })).toHaveCount(0);
  await page.goto("/requests?q=no-such-request");
  await expect(page.getByText("No requests match these filters.")).toBeVisible();
});

test("TEST-123 / AC-91: live result announcement", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests?q=no-such-request");
  await expect(page.getByRole("status")).toContainText("0 results");
});

test("TEST-129 / AC-97: the page has no horizontal overflow at supported widths", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/requests");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
  }
});

test("TEST-130 / AC-98: axe reports no filter-toolbar violations", async ({ page }) => {
  for (const account of [ACCOUNTS.requester, ACCOUNTS.approver, ACCOUNTS.admin]) {
    await loginAs(page, account);
    const path = account === ACCOUNTS.approver ? "/reviews" : account === ACCOUNTS.admin ? "/all-requests" : "/requests";
    await page.goto(path);
    const result = await new AxeBuilder({ page }).include("form[aria-label='Filter requests']").analyze();
    expect(result.violations).toEqual([]);
    if (account === ACCOUNTS.approver) await expect(page.getByLabel("Status")).toHaveCount(0);
    if (account === ACCOUNTS.requester) await expect(page.getByRole("link", { name: "Review queue" })).toHaveCount(0);
    await logout(page);
  }
});

test("TEST-131 / AC-99: reload and Back restore URL filters", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests");
  const persistedName = uniqueName("Browser persisted filter");
  await createRequest(page, persistedName, "EQUIPMENT");
  await createRequest(page, uniqueName("Browser other filter"), "SOFTWARE");
  await page.getByLabel("Search text").fill(persistedName);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(persistedName).replaceAll("%20", "(?:%20|\\+)" )}`));
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(persistedName);
  await page.reload();
  await expect(page.getByLabel("Search text")).toHaveValue(persistedName);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(persistedName);
  await page.goto("/requests");
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(persistedName).replaceAll("%20", "(?:%20|\\+)" )}`));
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(persistedName);
});
