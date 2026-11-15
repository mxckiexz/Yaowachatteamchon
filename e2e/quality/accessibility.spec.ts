import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { ORIGIN } from "../helpers/requests";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page, name: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = result.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length} nodes): ${v.help}`);
  console.log(`axe ${name}: ${result.violations.length} violations${summary.length ? "\n  " + summary.join("\n  ") : ""}`);
  expect(blocking.map((v) => `${name}: ${v.id} ${v.help}`), `${name} blocking violations`).toEqual([]);
}

async function makeRequest(page: Page, itemName: string, submit: boolean) {
  const created = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { itemName, description: "For the accessibility scan", quantity: 2, unitPrice: 10, reason: "Scan", category: "OTHER" },
  });
  const id = (await created.json()).request.id as number;
  if (submit) await page.request.post(`/api/requests/${id}/submit`, { headers: { Origin: ORIGIN }, data: {} });
  return id;
}

test("TEST-87 / AC-52: the main screens of the three roles have no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await scan(page, "login");
  await page.getByLabel("E-mail").fill("x@y.z");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await scan(page, "login with error");

  await loginAs(page, ACCOUNTS.requester);
  const tag = Math.random().toString(36).slice(2, 6);
  const submittedId = await makeRequest(page, `Scan submitted ${tag}`, true);
  const draftId = await makeRequest(page, `Scan draft ${tag}`, false);
  await page.goto("/requests");
  await expect(page.getByRole("cell", { name: `Scan submitted ${tag}` })).toBeVisible();
  await scan(page, "my requests");
  await page.goto("/requests/new");
  await expect(page.getByLabel("Item name")).toBeVisible();
  await scan(page, "new request");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Item name is required (at most 100 characters).")).toBeVisible();
  await scan(page, "new request with errors");
  await page.goto(`/requests/${draftId}`);
  await expect(page.getByRole("region", { name: "Submit for approval" })).toBeVisible();
  await scan(page, "draft detail with edit and submit");
  await page.goto(`/requests/${submittedId}`);
  await expect(page.getByTestId("status-badge")).toHaveText("Submitted");
  await scan(page, "submitted detail");
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.goto("/reviews");
  await expect(page.getByRole("cell", { name: `Scan submitted ${tag}` })).toBeVisible();
  await scan(page, "review queue");
  await page.goto(`/requests/${submittedId}`);
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByLabel(/Reason/)).toBeVisible();
  await scan(page, "decision panel (reject)");
  await logout(page);

  await loginAs(page, ACCOUNTS.admin);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Nattapong/ })).toBeVisible();
  await scan(page, "administrator users");
  await page.goto("/all-requests");
  await expect(page.getByRole("heading", { name: "All requests (read only)" })).toBeVisible();
  await scan(page, "administrator all requests");
});
