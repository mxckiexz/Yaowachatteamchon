import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs } from "../helpers/accounts";
import { ORIGIN } from "../helpers/requests";

async function createRequest(page: import("@playwright/test").Page, itemName: string, category = "OTHER") {
  const response = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { itemName, description: "Search filter description", quantity: 1, unitPrice: 10, reason: "Search filter reason", category },
  });
  expect(response.status()).toBe(201);
}

test("TEST-119 / AC-87: filters work with keyboard and Enter", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests");
  await page.getByLabel("Search text").fill("unlikely-no-match");
  await page.getByLabel("Search text").press("Enter");
  await expect(page).toHaveURL(/q=unlikely-no-match/);
  await expect(page.getByText("You have no requests yet.")).toBeVisible();
});

test("TEST-120 / AC-88: labels and review controls are present", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests");
  await expect(page.getByLabel("Search text")).toBeVisible();
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByLabel("Category")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
});

test("TEST-121 / AC-89: Clear filters removes query parameters", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests?q=anything&status=DRAFT");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/requests$/);
});

test("TEST-122 / AC-90 and TEST-123 / AC-91: empty state and live result announcement", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests?q=no-such-request");
  await expect(page.getByText("You have no requests yet.")).toBeVisible();
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
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests");
  const result = await new AxeBuilder({ page }).include("form[aria-label='Filter requests']").analyze();
  expect(result.violations).toEqual([]);
});

test("TEST-131 / AC-99: reload and Back restore URL filters", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/requests");
  await page.getByLabel("Search text").fill("persisted");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/q=persisted/);
  await page.reload();
  await expect(page.getByLabel("Search text")).toHaveValue("persisted");
  await page.goto("/requests");
  await page.goBack();
  await expect(page).toHaveURL(/q=persisted/);
});
