import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { createDraftViaUi, uniqueName } from "../helpers/requests";

const ORIGIN = "http://localhost:5173";

async function makeDraft(page: import("@playwright/test").Page) {
  await loginAs(page, ACCOUNTS.requester);
  return createDraftViaUi(page, uniqueName("F13 browser"));
}

test("TEST-248 / AC-217: approval progress labels and current approver controls", async ({ page, context }) => {
  const id = await makeDraft(page);
  const admin = await context.newPage();
  await loginAs(admin, ACCOUNTS.admin);
  const users = await admin.request.get("/api/admin/users");
  const list = (await users.json()).users.filter((u: any) => u.role === "APPROVER" && u.isActive).slice(0, 2);
  expect(list.length).toBeGreaterThanOrEqual(2);
  expect((await admin.request.put(`/api/requests/${id}/approval-steps`, { headers: { Origin: ORIGIN }, data: { approverIds: list.map((u: any) => u.id) } })).status()).toBe(200);
  await admin.goto(`/requests/${id}`);
  await expect(admin.getByRole("heading", { name: "Approval steps" })).toBeVisible();
  await expect(admin.getByRole("region", { name: "Approval steps" }).getByText("Step 1 of 2", { exact: true })).toBeVisible();
  await logout(admin);
  await admin.close();
});

test("TEST-249 / AC-218: approval chain controls are keyboard reachable and announce save", async ({ page, context }) => {
  const id = await makeDraft(page);
  const admin = await context.newPage();
  await loginAs(admin, ACCOUNTS.admin);
  await admin.goto(`/requests/${id}`);
  const editor = admin.getByRole("region", { name: "Configure approval steps" });
  await editor.getByRole("button", { name: "Add approver" }).focus();
  await admin.keyboard.press("Enter");
  await editor.getByRole("button", { name: "Save approval chain" }).focus();
  await admin.keyboard.press("Enter");
  await expect(editor.getByRole("status")).toContainText("Approval chain saved");
  await editor.getByRole("button", { name: "Clear" }).focus();
  await admin.keyboard.press("Enter");
  await expect(editor.getByRole("button", { name: "Add approver" })).toBeFocused();
});

test("TEST-250 / AC-219: approval chain has responsive layout and no serious axe findings", async ({ page, context }) => {
  const id = await makeDraft(page);
  const admin = await context.newPage();
  await loginAs(admin, ACCOUNTS.admin);
  await admin.goto(`/requests/${id}`);
  await admin.getByRole("button", { name: "Add approver" }).click();
  for (const width of [375, 768, 1280]) {
    await admin.setViewportSize({ width, height: 800 });
    expect(await admin.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  const result = await new AxeBuilder({ page: admin }).analyze();
  expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});
