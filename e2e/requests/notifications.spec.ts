import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs } from "../helpers/accounts";
import { ORIGIN, uniqueName } from "../helpers/requests";

const heading = (page: Page) => page.getByRole("heading", { level: 1, name: "Notifications" });
const navLink = (page: Page) => page.getByRole("navigation").getByRole("link", { name: /^Notifications/ });
const nameFor = (count: number) => (count > 0 ? `Notifications, ${count} unread` : "Notifications");
const entries = (page: Page) => page.getByRole("main").getByRole("listitem");
const entry = (page: Page, itemName: string, text: string) => entries(page).filter({ hasText: itemName }).filter({ hasText: text });
const unreadWord = (item: Locator) => item.getByText("Unread", { exact: true });

async function unreadCount(page: Page): Promise<number> {
  const res = await page.request.get("/api/notifications");
  expect(res.status()).toBe(200);
  return (await res.json()).unreadCount;
}

async function createSubmittedViaApi(page: Page, itemName: string) {
  const created = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { itemName, description: "Needed for the office", quantity: 1, unitPrice: 10, reason: "The old one broke", category: "EQUIPMENT" },
  });
  expect(created.status()).toBe(201);
  const row = (await created.json()).request as { id: number; requestNumber: string };
  const submitted = await page.request.post(`/api/requests/${row.id}/submit`, { headers: { Origin: ORIGIN }, data: {} });
  expect(submitted.status()).toBe(200);
  return row;
}

// A second signed-in person in a browser context of their own.
async function signedIn(browser: Browser, account: (typeof ACCOUNTS)["approver"]) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, account);
  return page;
}

async function approveViaApi(page: Page, requestId: number) {
  const res = await page.request.post(`/api/requests/${requestId}/approve`, { headers: { Origin: ORIGIN }, data: {} });
  expect(res.status()).toBe(200);
}

// Presses the key until the element has the focus, so the test only works if it is reachable by keyboard.
async function keyTo(page: Page, target: Locator, key: "Tab" | "Shift+Tab" = "Tab") {
  await expect(target).toBeVisible();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(key);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  await expect(target).toBeFocused();
}

test("TEST-227 / AC-196: the approver is told about a submit and the requester about the decision", async ({ page, browser }) => {
  let dialogs = 0;
  const watch = (p: Page) =>
    p.on("dialog", async (dialog) => {
      dialogs += 1;
      await dialog.dismiss();
    });
  watch(page);
  await loginAs(page, ACCOUNTS.requester);
  const approver = await signedIn(browser, ACCOUNTS.approver);
  watch(approver);
  const before = await unreadCount(approver);
  const itemName = uniqueName("<img src=x onerror=alert(1)>");
  const row = await createSubmittedViaApi(page, itemName);

  // A page change inside the app, without a reload, loads the count again.
  await approver.getByRole("navigation").getByRole("link", { name: "Dashboard" }).click();
  await expect(navLink(approver)).toHaveAccessibleName(nameFor(before + 1));
  await navLink(approver).click();
  await expect(heading(approver)).toBeVisible();
  const submitted = entry(approver, itemName, "submitted");
  await expect(submitted).toContainText(`Ploy submitted ${row.requestNumber}: ${itemName} for review.`);
  await expect(unreadWord(submitted)).toBeVisible();
  await expect(approver.getByRole("main").locator("img")).toHaveCount(0);

  await submitted.getByRole("link", { name: new RegExp(row.requestNumber) }).click();
  await expect(approver).toHaveURL(new RegExp(`/requests/${row.id}$`));
  await expect(navLink(approver)).toHaveAccessibleName(nameFor(before));
  await approver.goto("/notifications");
  await expect(entry(approver, itemName, "submitted")).toBeVisible();
  await expect(unreadWord(entry(approver, itemName, "submitted"))).toHaveCount(0);

  await approveViaApi(approver, row.id);
  const mine = await unreadCount(page);
  await page.goto("/requests");
  await expect(navLink(page)).toHaveAccessibleName(nameFor(mine));
  await navLink(page).click();
  const approved = entry(page, itemName, "approved");
  await expect(approved).toContainText(`Somchai approved ${row.requestNumber}: ${itemName}.`);
  await expect(unreadWord(approved)).toBeVisible();
  await expect(page.getByRole("main").locator("img")).toHaveCount(0);
  expect(dialogs).toBe(0);
  await approver.context().close();
});

test("TEST-228 / AC-197: loading, load error with Retry, empty, a failed mark and a failed count", async ({ page, browser }) => {
  await loginAs(page, ACCOUNTS.requester);
  const itemName = uniqueName("Notify states");
  const row = await createSubmittedViaApi(page, itemName);
  const approver = await signedIn(browser, ACCOUNTS.approver);
  await approveViaApi(approver, row.id);
  await approver.context().close();

  let mode: "fail" | "empty" | "real" = "fail";
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/notifications", async (route) => {
    if (mode === "real") return route.continue();
    if (mode === "empty") return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    await held;
    return route.fulfill({ status: 500, json: { error: "Something went wrong." } });
  });
  await page.goto("/notifications");
  await expect(page.getByText("Loading notifications...")).toBeVisible();
  release();
  await expect(page.getByText("Unable to load notifications.")).toBeVisible();
  mode = "real";
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(entry(page, itemName, "approved")).toBeVisible();

  await page.route("**/api/notifications/*/read", (route) => route.fulfill({ status: 500, json: { error: "Something went wrong." } }));
  const item = entry(page, itemName, "approved");
  await item.getByRole("button", { name: "Mark as read" }).click();
  await expect(page.getByRole("alert")).toHaveText("Something went wrong.");
  await expect(unreadWord(item)).toBeVisible();
  await expect(item.getByRole("button", { name: "Mark as read" })).toBeFocused();

  // Following the link still opens the request when marking fails.
  await item.getByRole("link", { name: new RegExp(row.requestNumber) }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Approved");
  await page.unroute("**/api/notifications/*/read");

  mode = "empty";
  await page.goto("/notifications");
  await expect(page.getByText("No notifications.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);

  await page.unroute("**/api/notifications");
  await page.route("**/api/notifications", (route) => route.fulfill({ status: 500, json: { error: "Something went wrong." } }));
  await page.goto("/requests");
  await expect(page.getByRole("link", { name: row.requestNumber })).toBeVisible();
  await expect(navLink(page)).toHaveAccessibleName("Notifications");
});

test("TEST-229 / AC-198: keyboard only, with names, announcements and focus", async ({ page, browser }) => {
  await loginAs(page, ACCOUNTS.requester);
  const approver = await signedIn(browser, ACCOUNTS.approver);
  const names = [uniqueName("Keyboard one"), uniqueName("Keyboard two")];
  for (const itemName of names) await approveViaApi(approver, (await createSubmittedViaApi(page, itemName)).id);
  await approver.context().close();

  await page.goto("/requests");
  const count = await unreadCount(page);
  expect(count).toBeGreaterThanOrEqual(2);
  await expect(navLink(page)).toHaveAccessibleName(`Notifications, ${count} unread`);
  await keyTo(page, navLink(page));
  await page.keyboard.press("Enter");
  await expect(heading(page)).toBeVisible();

  const item = entry(page, names[1], "approved");
  await expect(unreadWord(item)).toBeVisible();
  await keyTo(page, item.getByRole("button", { name: "Mark as read" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Notification marked as read");
  await expect(item.getByRole("link")).toBeFocused();
  await expect(unreadWord(item)).toHaveCount(0);
  await expect(navLink(page)).toHaveAccessibleName(nameFor(count - 1));

  await keyTo(page, page.getByRole("button", { name: "Mark all as read" }), "Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("All notifications marked as read");
  await expect(heading(page)).toBeFocused();
  await expect(page.getByRole("main").getByText("Unread", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
  await expect(navLink(page)).toHaveAccessibleName("Notifications");
});

test("TEST-230 / AC-199: a 100-character item name fits three widths and axe finds no serious violation", async ({ page, browser }) => {
  await loginAs(page, ACCOUNTS.requester);
  const itemName = `${Date.now()}`.padEnd(100, "W");
  await createSubmittedViaApi(page, itemName);
  const approver = await signedIn(browser, ACCOUNTS.approver);
  await approver.goto("/notifications");
  await expect(entry(approver, itemName, "submitted")).toBeVisible();
  await expect(navLink(approver)).toHaveAccessibleName(/^Notifications, \d+ unread$/);
  for (const width of [375, 768, 1280]) {
    await approver.setViewportSize({ width, height: 800 });
    const overflow = await approver.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect([width, overflow <= 0]).toEqual([width, true]);
    const result = await new AxeBuilder({ page: approver }).analyze();
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  }
  await approver.context().close();
});

test("TEST-231 / AC-200: the administrator has no link and is sent to the users screen", async ({ page }) => {
  await loginAs(page, ACCOUNTS.admin);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Users" })).toBeVisible();
  await expect(navLink(page)).toHaveCount(0);
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/admin\/users$/);
});
