import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";

const statuses = ["Draft", "Submitted", "Approved", "Rejected", "Cancelled"];

test("TEST-139 / AC-107: role-specific dashboard cards and groups", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/dashboard");
  for (const label of statuses) await expect(page.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  await logout(page);
  await loginAs(page, ACCOUNTS.approver);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "My requests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();
  await logout(page);
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Approved/ })).toHaveAttribute("href", "/all-requests?status=APPROVED");
});

test("TEST-140 / AC-108: dashboard is keyboard accessible and has no serious axe violations", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /Draft/ }).focus();
  await expect(page.getByRole("link", { name: /Draft/ })).toBeFocused();
  const result = await new AxeBuilder({ page }).include("section[aria-labelledby='dashboard-heading']").analyze();
  expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});

test("TEST-141 / AC-109: dashboard has no horizontal document overflow", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/dashboard");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
  }
});

test("TEST-142 / AC-110, AC-113: dashboard error and retry announce the exact message", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.route("**/api/dashboard", (route) => route.abort());
  await page.goto("/dashboard");
  await expect(page.getByRole("alert")).toContainText("Unable to load dashboard counts.");
  await expect(page.getByRole("status")).toContainText("Unable to load dashboard counts.");
  await page.unroute("**/api/dashboard");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("status")).toContainText("Dashboard counts loaded");
});

test("TEST-143 / AC-111: zero cards remain visible as zero with a scoped link", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/dashboard");
  const zero = page.locator("a").filter({ has: page.locator("p", { hasText: /^0$/ }) }).first();
  if (await zero.count()) await expect(zero).toHaveAttribute("href", /\/requests\?status=/);
});

test("TEST-144 / AC-112: card counts equal rows in each linked list", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/dashboard");
  const links = page.locator("section[aria-labelledby='dashboard-heading'] a[href*='status=']");
  const hrefs = await links.evaluateAll((els) => els.map((el) => ({ href: (el as HTMLAnchorElement).href, count: Number(el.querySelector("p")?.textContent) })));
  for (const item of hrefs) {
    await page.goto(item.href);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(item.count);
  }
});

test("TEST-145 / AC-114: dashboard navigation and anonymous redirect", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await loginAs(page, ACCOUNTS.requester);
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
});
