import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";

const ORIGIN = "http://localhost:5173";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page, name: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = result.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length} nodes): ${v.help}`);
  console.log(`axe ${name}: ${result.violations.length} violations${summary.length ? "\n  " + summary.join("\n  ") : ""}`);
  expect(blocking.map((v) => `${name}: ${v.id} ${v.help}`), `${name} blocking violations`).toEqual([]);
}

// Creates and submits a request through the API of the logged-in employee, returns its id.
async function pendingRequest(page: Page, title: string, approverId: number) {
  const created = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { title, justification: "For the accessibility scan", items: [{ name: "Pen", quantity: 2, unitPrice: 10 }] },
  });
  const id = (await created.json()).request.id as number;
  await page.request.post(`/api/requests/${id}/submit`, { headers: { Origin: ORIGIN }, data: { approverId } });
  return id;
}

test("TEST-57 / AC-42: the main screens have no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await scan(page, "login");
  await page.getByLabel("E-mail").fill("x@y.z");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await scan(page, "login with error");

  await loginAs(page, ACCOUNTS.employee);
  const approverId = (await (await page.request.get("/api/approvers")).json()).approvers.find((a: { name: string }) => a.name === "Somchai").id;
  const tag = Math.random().toString(36).slice(2, 6);
  const id = await pendingRequest(page, `Accessibility ${tag}`, approverId);
  const draft = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { title: `Draft ${tag}`, items: [{ name: "Pen", quantity: 1, unitPrice: 5 }] },
  });
  const draftId = (await draft.json()).request.id;

  await page.goto("/requests");
  await expect(page.getByRole("link", { name: `Accessibility ${tag}` })).toBeVisible();
  await scan(page, "my requests");
  await page.goto("/requests/new");
  await expect(page.getByLabel("Title")).toBeVisible();
  await scan(page, "new request");
  await page.getByLabel("Title").fill("ab");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Title must be 3 to 120 characters.")).toBeVisible();
  await scan(page, "new request with errors");
  await page.goto(`/requests/${draftId}`);
  await expect(page.getByLabel("Approver")).toBeVisible();
  await scan(page, "draft detail with submit panel");
  await page.goto(`/requests/${id}`);
  await expect(page.getByTestId("status-badge")).toHaveText("Pending approval");
  await scan(page, "pending detail");
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.goto("/reviews");
  await expect(page.getByRole("link", { name: `Accessibility ${tag}` })).toBeVisible();
  await scan(page, "review queue");
  await page.getByRole("link", { name: `Accessibility ${tag}` }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByLabel(/Reason/)).toBeVisible();
  await scan(page, "decision panel (reject)");
});
