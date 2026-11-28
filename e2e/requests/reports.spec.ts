import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { ORIGIN, uniqueName } from "../helpers/requests";

const main = (page: Page) => page.getByRole("main");
const navLink = (page: Page) => page.getByRole("navigation").getByRole("link", { name: "Reports", exact: true });
const exportButton = (page: Page) => page.getByRole("button", { name: "Export CSV" });
const applyButton = (page: Page) => page.getByRole("button", { name: "Apply filters" });
const clearButton = (page: Page) => page.getByRole("button", { name: "Clear filters" });
const table = (page: Page, caption: string) => page.getByRole("table", { name: caption });
const STATUS = ["Draft", "Submitted", "Approved", "Rejected", "Cancelled"];
const CATEGORY = ["Equipment", "Software", "Furniture", "Stationery", "Other", "No category"];

const baht = (value: number) => `฿${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Summary {
  count: number;
  total: number;
  byStatus: { count: number; total: number }[];
  byCategory: { count: number; total: number }[];
}

async function apiSummary(page: Page, query = ""): Promise<Summary> {
  const res = await page.request.get(`/api/reports/summary?${query}`);
  expect(res.status()).toBe(200);
  return (await res.json()).summary;
}

// The page must show exactly what the API says.
async function expectShows(page: Page, s: Summary) {
  await expect(main(page).getByText(`Requests: ${s.count}, total ${baht(s.total)}`, { exact: true }).first()).toBeVisible();
  for (const [caption, labels, rows] of [["By status", STATUS, s.byStatus], ["By category", CATEGORY, s.byCategory]] as const) {
    const cells = table(page, caption).locator("tbody tr");
    await expect(cells).toHaveCount(labels.length);
    for (const [i, label] of labels.entries()) {
      await expect(cells.nth(i).locator("th, td")).toHaveText([label, String(rows[i].count), baht(rows[i].total)]);
    }
  }
}

async function createViaApi(page: Page, itemName: string, category: string, submit = false) {
  const created = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { itemName, description: "Needed for the office", quantity: 2, unitPrice: 10.25, reason: "The old one broke", category },
  });
  expect(created.status()).toBe(201);
  const row = (await created.json()).request as { id: number; requestNumber: string };
  if (submit) expect((await page.request.post(`/api/requests/${row.id}/submit`, { headers: { Origin: ORIGIN }, data: {} })).status()).toBe(200);
  return row;
}

async function downloadCsv(page: Page, press: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent("download"), press()]);
  return { name: download.suggestedFilename(), text: readFileSync(await download.path(), "utf8") };
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

test("TEST-346 / AC-315: every role has the report, with the API's values and filters kept in the address", async ({ page }) => {
  for (const account of [ACCOUNTS.requester, ACCOUNTS.approver, ACCOUNTS.admin]) {
    await loginAs(page, account);
    if (account !== ACCOUNTS.admin) await createViaApi(page, uniqueName("Report roles"), "SOFTWARE");
    await navLink(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await expectShows(page, await apiSummary(page));

    await page.getByLabel("Status", { exact: true }).selectOption("DRAFT");
    await page.getByLabel("Category", { exact: true }).selectOption("SOFTWARE");
    await applyButton(page).click();
    await expect(page).toHaveURL(/\/reports\?status=DRAFT&category=SOFTWARE$/);
    const filtered = await apiSummary(page, "status=DRAFT&category=SOFTWARE");
    if (filtered.count > 0) await expectShows(page, filtered);

    await page.reload();
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue("DRAFT");
    await expect(page.getByLabel("Category", { exact: true })).toHaveValue("SOFTWARE");

    await clearButton(page).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue("");
    await expectShows(page, await apiSummary(page));

    await page.goBack();
    await expect(page).toHaveURL(/status=DRAFT&category=SOFTWARE$/);
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue("DRAFT");
    await logout(page);
  }
});

test("TEST-347 / AC-316: loading, load error with Retry, empty, filter errors and an export error", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await createViaApi(page, uniqueName("Report states"), "OTHER");

  let failing = true;
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/reports/summary**", async (route) => {
    if (!failing) return route.continue();
    await held;
    return route.fulfill({ status: 500, json: { error: "Something went wrong." } });
  });
  await page.goto("/reports");
  await expect(page.getByText("Loading report...")).toBeVisible();
  await expect(exportButton(page)).toBeDisabled();
  release();
  await expect(page.getByText("Unable to load the report.")).toBeVisible();
  await expect(exportButton(page)).toBeDisabled();
  failing = false;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(table(page, "By status")).toBeVisible();
  await expect(exportButton(page)).toBeEnabled();

  await page.goto("/reports?from=2000-01-01&to=2000-01-02");
  await expect(main(page).getByText("No requests match these filters.").first()).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(exportButton(page)).toBeDisabled();

  // A wrong value in the address: the message is beside its field and the address stays.
  await page.goto("/reports?from=2026-02-30");
  await expect(page.getByLabel("From", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("From", { exact: true })).toHaveAccessibleDescription(/date/i);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page).toHaveURL(/from=2026-02-30$/);
  await expect(exportButton(page)).toBeDisabled();

  // From after To, typed in the form: the values stay.
  await page.goto("/reports");
  await page.getByLabel("From", { exact: true }).fill("2026-03-02");
  await page.getByLabel("To", { exact: true }).fill("2026-03-01");
  await applyButton(page).click();
  await expect(page.getByLabel("To", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-03-02");
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("2026-03-01");
  await expect(page.getByRole("table")).toHaveCount(0);

  await page.goto("/reports");
  await expect(exportButton(page)).toBeEnabled();
  await page.route("**/api/reports/export.csv**", (route) =>
    route.fulfill({ status: 422, json: { error: "Too many requests to export. Narrow the filters.", code: "EXPORT_TOO_LARGE" } })
  );
  await exportButton(page).click();
  await expect(page.getByRole("alert")).toHaveText("Too many requests to export. Narrow the filters.");
  await expect(table(page, "By status")).toBeVisible();
  await expect(exportButton(page)).toBeEnabled();
  await expect(exportButton(page)).toBeFocused();
});

test("TEST-348 / AC-317: the export matches the applied filters, not the unapplied form", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const software = uniqueName("Report export software");
  const furniture = uniqueName("Report export furniture");
  const submitted = uniqueName("Report export submitted");
  await createViaApi(page, software, "SOFTWARE");
  await createViaApi(page, furniture, "FURNITURE");
  await createViaApi(page, submitted, "SOFTWARE", true);

  await page.goto("/reports");
  await page.getByLabel("Status", { exact: true }).selectOption("DRAFT");
  await applyButton(page).click();
  await expect(page).toHaveURL(/status=DRAFT$/);
  await expect(exportButton(page)).toBeEnabled();
  // Changed but not applied.
  await page.getByLabel("Category", { exact: true }).selectOption("SOFTWARE");
  const expected = await apiSummary(page, "status=DRAFT");
  const file = await downloadCsv(page, () => exportButton(page).click());
  expect(file.name).toMatch(/^purchase-requests-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(file.text).toContain(software);
  expect(file.text).toContain(furniture);
  expect(file.text).not.toContain(submitted);
  expect(file.text.trimEnd().split("\r\n")).toHaveLength(expected.count + 1);
});

test("TEST-349 / AC-318: keyboard only, with labels, focus and announcements", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await createViaApi(page, uniqueName("Report keyboard"), "EQUIPMENT");
  await page.goto("/requests");
  await keyTo(page, navLink(page));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  for (const label of ["From", "To", "Status", "Category"]) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  const status = main(page).getByRole("status");
  await expect(status).toHaveCount(1);
  const all = await apiSummary(page);
  await expect(status).toHaveText(`Requests: ${all.count}, total ${baht(all.total)}`);

  await keyTo(page, page.getByLabel("Status", { exact: true }));
  await page.keyboard.type("Draft");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("DRAFT");
  await keyTo(page, applyButton(page));
  await page.keyboard.press("Enter");
  const drafts = await apiSummary(page, "status=DRAFT");
  await expect(status).toHaveText(`Requests: ${drafts.count}, total ${baht(drafts.total)}`);
  await expect(applyButton(page)).toBeFocused();

  await keyTo(page, exportButton(page));
  const file = await downloadCsv(page, () => page.keyboard.press("Enter"));
  expect(file.name).toMatch(/\.csv$/);
  await expect(status).toHaveText("Report exported");
  await expect(exportButton(page)).toBeFocused();

  await keyTo(page, clearButton(page), "Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/reports$/);
  await expect(clearButton(page)).toBeFocused();
});

test("TEST-350 / AC-319: three widths without page scrolling, and axe finds no serious violation", async ({ page }) => {
  for (const account of [ACCOUNTS.approver, ACCOUNTS.admin]) {
    await loginAs(page, account);
    if (account === ACCOUNTS.approver) await createViaApi(page, uniqueName("Report widths"), "STATIONERY");
    await page.goto("/reports");
    await expect(table(page, "By status")).toBeVisible();
    await expect(table(page, "By category")).toBeVisible();
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect([width, overflow <= 0]).toEqual([width, true]);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await logout(page);
  }
});
